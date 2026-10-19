# StayNest: подготовка SSH-доступа к серверу.
# Создаёт отдельный ключ, закрывает его ACL (аналог chmod 600),
# добавляет алиас в ~/.ssh/config и (опционально) ставит ключ на сервер.
#
# Запускать САМОМУ в своём окне PowerShell (не через агента):
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-ssh.ps1 -HostName 1.2.3.4 -User root
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-ssh.ps1 -HostName 1.2.3.4 -User root -InstallKey
#
# Приватный ключ никуда не выводится. -InstallKey спросит пароль сервера
# в вашем терминале; в чат он не попадает.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$HostName,

    [string]$User = "root",
    [int]$Port = 22,
    [string]$Alias = "staynest",
    [string]$KeyPath = "$env:USERPROFILE\.ssh\staynest_deploy",
    [switch]$InstallKey
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

function Write-Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }

if (-not (Get-Command ssh-keygen -ErrorAction SilentlyContinue)) {
    throw "Не найден ssh-keygen. Включите OpenSSH Client в Windows: Settings > Apps > Optional Features."
}

$sshDir = Split-Path -Parent $KeyPath
if (-not (Test-Path $sshDir)) {
    New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
}

Write-Step "Ключ"
if (Test-Path $KeyPath) {
    Write-Host "Ключ уже существует: $KeyPath (не перезаписываю)"
} else {
    ssh-keygen -t ed25519 -a 100 -N '""' -C "staynest-deploy" -f $KeyPath
    if ($LASTEXITCODE -ne 0) { throw "ssh-keygen завершился с ошибкой." }
    Write-Host "Создан ключ: $KeyPath"
}

Write-Step "Права на приватный ключ (аналог 600)"
icacls $KeyPath /inheritance:r | Out-Null
icacls $KeyPath /grant:r "$($env:USERNAME):(R)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Не удалось выставить ACL на $KeyPath" }
Write-Host "Доступ только для пользователя $($env:USERNAME):"
(Get-Acl $KeyPath).Access | ForEach-Object {
    Write-Host ("  {0} -> {1}" -f $_.IdentityReference, $_.FileSystemRights)
}

Write-Step "Алиас '$Alias' в ~/.ssh/config"
$configPath = Join-Path $sshDir "config"
$begin = "# >>> staynest ($Alias) >>>"
$end = "# <<< staynest ($Alias) <<<"
$block = @"
$begin
Host $Alias
    HostName $HostName
    User $User
    Port $Port
    IdentityFile $KeyPath
    IdentitiesOnly yes
    StrictHostKeyChecking accept-new
$end
"@

$existing = ""
if (Test-Path $configPath) {
    $existing = [System.IO.File]::ReadAllText($configPath)
    $pattern = "(?s)" + [regex]::Escape($begin) + ".*?" + [regex]::Escape($end) + "\r?\n?"
    $existing = [regex]::Replace($existing, $pattern, "")
    $existing = $existing.TrimEnd() + "`r`n`r`n"
}
$content = $existing + $block + "`r`n"
[System.IO.File]::WriteAllText($configPath, $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Записано в $configPath"

Write-Step "Публичный ключ (его можно показывать, это не секрет)"
Get-Content "$KeyPath.pub" | Write-Host

Write-Step "Установка ключа на сервер"
if ($InstallKey) {
    Write-Host "Сейчас ssh спросит пароль сервера. Вводите его в этом окне, не в чате." -ForegroundColor Yellow
    Get-Content "$KeyPath.pub" | ssh -p $Port "$User@$HostName" "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
    if ($LASTEXITCODE -ne 0) {
        throw "Не удалось установить ключ. Проверьте пароль/доступ или добавьте ключ через панель провайдера."
    }
    Write-Host "Ключ установлен." -ForegroundColor Green
} else {
    Write-Host "Вариант А: добавьте публичный ключ выше через панель провайдера."
    Write-Host "Вариант Б: выполните команду ниже и введите пароль сервера в своём окне:"
    Write-Host ""
    Write-Host ("Get-Content `"{0}.pub`" | ssh -p {1} {2}@{3} `"mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`"" -f $KeyPath, $Port, $User, $HostName) -ForegroundColor Yellow
}

Write-Step "Проверка"
Write-Host "Выполните: ssh $Alias `"echo OK`""
Write-Host "Ожидаемый ответ: OK"
Write-Host ""
Write-Host "После этого агенту достаточно алиаса '$Alias' (IP, пользователь и путь к ключу уже в конфиге)."
