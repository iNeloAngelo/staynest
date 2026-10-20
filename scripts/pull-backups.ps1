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

foreach ($remoteDump in ($stamps -split "`n" | Where-Object { $_ })) {
  $name = Split-Path $remoteDump -Leaf
  $stamp = $name -replace '^staynest-', '' -replace '\.dump\.age$', ''
  $target = Join-Path $Destination $stamp
  New-Item -ItemType Directory -Force -Path $target | Out-Null

  $files = @(
    "staynest-$stamp.dump.age",
    "staynest-$stamp.dump.age.sha256",
    "staynest-$stamp.dump.restore-check.txt",
    "staynest-globals-$stamp.sql.age",
    "staynest-silo-$stamp.tar.gz.age",
    "staynest-silo-$stamp.tar.gz.age.sha256"
  )
  foreach ($file in $files) {
    & scp -q "${SshHost}:${RemoteDir}/${file}" (Join-Path $target $file)
    if ($LASTEXITCODE -ne 0) {
      throw "scp не скачал $file (exit $LASTEXITCODE)"
    }
  }

  $dumpSha = Assert-Sha256 (Join-Path $target "staynest-$stamp.dump.age") (Join-Path $target "staynest-$stamp.dump.age.sha256")
  $siloSha = Assert-Sha256 (Join-Path $target "staynest-silo-$stamp.tar.gz.age") (Join-Path $target "staynest-silo-$stamp.tar.gz.age.sha256")

  Write-Host "OK: $target (dump $($dumpSha.Substring(0, 12))…, silo $($siloSha.Substring(0, 12))…)"
}

# Ретенция локальной offsite-копии.
Get-ChildItem $Destination -Directory |
  Where-Object { $_.Name -match '^\d{8}T\d{6}Z$' -and $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
  ForEach-Object { Remove-Item -Recurse -Force $_.FullName; Write-Host "Удалена старая копия $($_.Name)" }

Write-Host "Offsite-копия готова: $Destination"
Write-Host "Расшифровка: tools\age\age\age.exe -d -i age-identity.txt -o staynest.dump <stamp>\staynest-<stamp>.dump.age"
