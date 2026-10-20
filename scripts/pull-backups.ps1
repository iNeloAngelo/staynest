# Забирает последние бэкапы StayNest с VPS на машину разработчика (offsite-копия).
# Запуск: powershell -File scripts/pull-backups.ps1
# После закрытия root-доступа используется SSH-алиас staynest (пользователь deploy).
# Проверяет SHA-256 скачанного дампа. Данные содержат PII: каталог только для владельца.
param(
  [string]$SshHost = 'staynest',
  [string]$RemoteDir = '/home/deploy/backups/staynest/daily',
  [string]$Destination = (Join-Path $env:USERPROFILE 'staynest-backups'),
  [int]$StampCount = 1
)

$ErrorActionPreference = 'Stop'

$stamps = & ssh $SshHost "ls -1t $RemoteDir/staynest-*.dump 2>/dev/null | head -n $StampCount"
if (-not $stamps) {
  throw "На $SshHost нет бэкапов в $RemoteDir"
}

foreach ($remoteDump in ($stamps -split "`n" | Where-Object { $_ })) {
  $name = Split-Path $remoteDump -Leaf
  $stamp = $name -replace '^staynest-', '' -replace '\.dump$', ''
  $target = Join-Path $Destination $stamp
  New-Item -ItemType Directory -Force -Path $target | Out-Null

  $files = @(
    "staynest-$stamp.dump",
    "staynest-$stamp.dump.sha256",
    "staynest-$stamp.dump.restore-check.txt",
    "staynest-globals-$stamp.sql",
    "staynest-silo-$stamp.tar.gz",
    "staynest-silo-$stamp.tar.gz.sha256"
  )
  foreach ($file in $files) {
    & scp -q "${SshHost}:${RemoteDir}/${file}" (Join-Path $target $file) 2>$null
  }

  $dumpPath = Join-Path $target "staynest-$stamp.dump"
  $shaPath = Join-Path $target "staynest-$stamp.dump.sha256"
  if (-not (Test-Path $dumpPath) -or -not (Test-Path $shaPath)) {
    throw "Не скачались дамп или контрольная сумма для $stamp"
  }

  $expected = (Get-Content $shaPath -TotalCount 1).Split(' ')[0].ToLowerInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 -Path $dumpPath).Hash.ToLowerInvariant()
  if ($expected -ne $actual) {
    throw "SHA-256 не совпал для $dumpPath"
  }

  Write-Host "OK: $target (sha256 $($actual.Substring(0, 12))…)"
}

Write-Host "Offsite-копия готова: $Destination"
