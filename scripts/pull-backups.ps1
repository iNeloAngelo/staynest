# Забирает последние бэкапы StayNest с VPS на машину разработчика (offsite-копия).
# Запуск: powershell -File scripts/pull-backups.ps1
# После закрытия root-доступа используется SSH-алиас staynest (пользователь deploy).
# Скачивает зашифрованные age-архивы, проверяет SHA-256 дампа и бакета.
# Приватный age-ключ лежит рядом (age-identity.txt) и на сервер не возвращается.
param(
  [string]$SshHost = 'staynest',
  [string]$RemoteDir = '/home/deploy/backups/staynest/daily',
  [string]$Destination = (Join-Path $env:USERPROFILE 'staynest-backups'),
  [int]$StampCount = 1,
  [int]$KeepDays = 30
)

$ErrorActionPreference = 'Stop'

$stamps = & ssh $SshHost "ls -1t $RemoteDir/staynest-*.dump.age 2>/dev/null | head -n $StampCount"
if ($LASTEXITCODE -ne 0) {
  throw "SSH не смог прочитать $RemoteDir (exit $LASTEXITCODE)"
}
if (-not $stamps) {
  throw "На $SshHost нет бэкапов в $RemoteDir"
}

New-Item -ItemType Directory -Force -Path $Destination | Out-Null
# Бэкапы содержат PII: доступ только текущему пользователю.
& icacls $Destination /inheritance:r /grant:r "$($env:USERNAME):(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "icacls не закрыл доступ к $Destination (exit $LASTEXITCODE)"
}

function Assert-Sha256([string]$Path, [string]$ShaPath) {
  if (-not (Test-Path $Path) -or -not (Test-Path $ShaPath)) {
    throw "Не скачались $Path или $ShaPath"
  }
  $expected = (Get-Content $ShaPath -TotalCount 1).Split(' ')[0].ToLowerInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
  if ($expected -ne $actual) {
    throw "SHA-256 не совпал для $Path"
  }
  return $actual
}

$incomplete = @()

foreach ($remoteDump in ($stamps -split "`n" | Where-Object { $_ })) {
  $name = Split-Path $remoteDump -Leaf
  $stamp = $name -replace '^staynest-', '' -replace '\.dump\.age$', ''
  $target = Join-Path $Destination $stamp
  New-Item -ItemType Directory -Force -Path $target | Out-Null

  # Сначала критичный для БД набор: без него offsite-копия бессмысленна.
  $required = @(
    "staynest-$stamp.dump.age",
    "staynest-$stamp.dump.age.sha256",
    "staynest-$stamp.dump.restore-check.txt",
    "staynest-globals-$stamp.sql.age"
  )
  foreach ($file in $required) {
    & scp -q "${SshHost}:${RemoteDir}/${file}" (Join-Path $target $file)
    if ($LASTEXITCODE -ne 0) {
      throw "scp не скачал $file (exit $LASTEXITCODE)"
    }
  }
  $dumpSha = Assert-Sha256 (Join-Path $target "staynest-$stamp.dump.age") (Join-Path $target "staynest-$stamp.dump.age.sha256")

  # Бакет — отдельно: если его не было в бэкапе, дамп БД всё равно уже в offsite.
  $siloSha = $null
  $siloFiles = @(
    "staynest-silo-$stamp.tar.gz.age",
    "staynest-silo-$stamp.tar.gz.age.sha256"
  )
  $siloOk = $true
  foreach ($file in $siloFiles) {
    & scp -q "${SshHost}:${RemoteDir}/${file}" (Join-Path $target $file)
    if ($LASTEXITCODE -ne 0) { $siloOk = $false; break }
  }
  if ($siloOk) {
    $siloSha = Assert-Sha256 (Join-Path $target "staynest-silo-$stamp.tar.gz.age") (Join-Path $target "staynest-silo-$stamp.tar.gz.age.sha256")
    Write-Host "OK: dump $dumpSha silo $siloSha"
  }
  if (-not $siloOk) {
    $incomplete += $stamp
    Write-Warning "bucket archive missing for $stamp"
  }
}

if ($incomplete.Count -gt 0) {
  throw "Offsite-копия неполная (нет бакета): $($incomplete -join ', ')"
}

# Ретенция локальной offsite-копии.
Get-ChildItem $Destination -Directory |
  Where-Object { $_.Name -match '^\d{8}T\d{6}Z$' -and $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
  ForEach-Object { Remove-Item -Recurse -Force $_.FullName; Write-Host "Удалена старая копия $($_.Name)" }

Write-Host "Offsite-копия готова: $Destination"
Write-Host "Decryption: see docs/ops.md section 11.2 (age -d -i age-identity.txt)."
