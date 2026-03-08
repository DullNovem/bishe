$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path (Join-Path $root ".runtime") "pids.json"

if (!(Test-Path $pidFile)) {
    Write-Host "未找到运行中的进程记录（$pidFile）。"
    exit 0
}

$pids = Get-Content -Path $pidFile -Raw | ConvertFrom-Json

foreach ($name in @("frontend", "backend", "ml")) {
    $procId = $pids.$name
    if ($procId) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id $procId -Force
            Write-Host "已停止 $name (PID=$procId)"
        } else {
            Write-Host "$name 未运行 (PID=$procId)"
        }
    }
}

Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "全部服务已停止。"
