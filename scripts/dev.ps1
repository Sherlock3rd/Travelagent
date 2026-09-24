param(
    [ValidateSet('Start', 'Stop', 'Status')][string]$Action = 'Start',
    [ValidateRange(1, 65535)][int]$Port = 8788
)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskScript = Join-Path $PSScriptRoot 'server.mjs'
$taskRuntime = Join-Path $taskRoot '.runtime'
$taskState = Join-Path $taskRuntime 'server.json'
$taskServer = $null
if (Test-Path -LiteralPath $taskState) {
    $taskInfo = Get-Content -LiteralPath $taskState -Raw -Encoding UTF8 | ConvertFrom-Json
    $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($taskInfo.pid)"
    if ($taskProcess -and $taskProcess.Name -eq 'node.exe' -and $taskProcess.CommandLine.Contains($taskScript)) {
        $taskServer = $taskProcess
    }
}
if ($Action -eq 'Stop') {
    if ($taskServer) { Stop-Process -Id $taskServer.ProcessId; Write-Output 'Travelagent stopped.' }
    else { Write-Output 'Travelagent is not running.' }
    if (Test-Path -LiteralPath $taskState) { Remove-Item -LiteralPath $taskState }
    return
}
if ($taskServer) {
    $taskHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$($taskInfo.port)/healthz" -TimeoutSec 3
    if ($taskHealth.service -ne 'travelagent' -or $taskHealth.pid -ne $taskServer.ProcessId) { throw 'Service identity mismatch.' }
    Write-Output "Travelagent running: http://127.0.0.1:$($taskInfo.port) | PID=$($taskServer.ProcessId) | root=$taskRoot"
    return
}
if ($Action -eq 'Status') { Write-Output 'Travelagent is not running.'; return }
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
    throw "Port $Port is already in use. Choose another -Port."
}
New-Item -ItemType Directory -Path $taskRuntime -Force | Out-Null
$taskNode = (Get-Command node.exe).Source
$taskOldPort = $env:PORT
$taskOldHost = $env:HOST
try {
    $env:PORT = "$Port"
    $env:HOST = '127.0.0.1'
    $taskChild = Start-Process -FilePath $taskNode -ArgumentList ('"' + $taskScript + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRuntime 'server.log') -RedirectStandardError (Join-Path $taskRuntime 'server.error.log') -PassThru
} finally {
    $env:PORT = $taskOldPort
    $env:HOST = $taskOldHost
}
@{ pid = $taskChild.Id; port = $Port; root = $taskRoot } | ConvertTo-Json | Set-Content -LiteralPath $taskState -Encoding UTF8
for ($taskAttempt = 0; $taskAttempt -lt 20; $taskAttempt++) {
    if ($taskChild.HasExited) { throw "Service exited. See $taskRuntime\server.error.log" }
    try {
        $taskHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/healthz" -TimeoutSec 1
        if ($taskHealth.service -eq 'travelagent' -and $taskHealth.pid -eq $taskChild.Id) {
            Write-Output "Travelagent ready: http://127.0.0.1:$Port | PID=$($taskChild.Id) | root=$taskRoot"
            return
        }
    } catch { }
    Start-Sleep -Milliseconds 250
}
throw "Service did not become ready. Inspect $taskRuntime."
