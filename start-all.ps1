[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
chcp.com 65001 > $null
$env:JAVA_TOOL_OPTIONS = "-Dfile.encoding=UTF-8"
$env:MAVEN_OPTS = "-Dfile.encoding=UTF-8"
$env:PYTHONIOENCODING = "utf-8"
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$mlDir = Join-Path $root "ml-model"
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$runtimeDir = Join-Path $root ".runtime"
$pidFile = Join-Path $runtimeDir "pids.json"
$backendJar = Join-Path $backendDir "target\spam-sms-detection-0.0.1-SNAPSHOT.jar"
$frontendServer = Join-Path $frontendDir "serve-preview.js"

if (!(Test-Path $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir | Out-Null
}

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "缺少命令: $Name，请先安装后重试。"
    }
}

function Get-PythonLauncher {
    $scriptPath = Join-Path $mlDir "api_server.py"
    $candidates = @()
    $knownPython = "C:\Users\86183\AppData\Local\Programs\Python\Python310\python.exe"

    $venvPython = Join-Path $root ".venv\Scripts\python.exe"
    if (Test-Path $venvPython) {
        $candidates += @{
            Name = ".venv"
            FilePath = $venvPython
            Arguments = @("api_server.py")
            Probe = @("--version")
        }
    }

    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd) {
        $candidates += @{
            Name = "python"
            FilePath = $pythonCmd.Source
            Arguments = @($scriptPath)
            Probe = @("--version")
        }
    }

    $pyCmd = Get-Command py -ErrorAction SilentlyContinue
    if ($pyCmd) {
        $candidates += @{
            Name = "py"
            FilePath = $pyCmd.Source
            Arguments = @("-3.10", $scriptPath)
            Probe = @("-3.10", "--version")
        }
    }

    if (Test-Path $knownPython) {
        $candidates += @{
            Name = "python310"
            FilePath = $knownPython
            Arguments = @($scriptPath)
            Probe = @("--version")
        }
    }

    foreach ($candidate in $candidates) {
        try {
            & $candidate.FilePath @($candidate.Probe) *> $null
            if ($LASTEXITCODE -eq 0) {
                return @{
                    FilePath = $candidate.FilePath
                    Arguments = $candidate.Arguments
                    Name = $candidate.Name
                }
            }
        } catch {
        }
    }

    throw "未找到可用的 Python 运行环境。请确保 .venv、python、py -3.10 或本机 Python 3.10 安装路径至少有一个可用。"
}

function Wait-Http {
    param(
        [string]$Url,
        [int]$Retry = 30
    )

    for ($i = 0; $i -lt $Retry; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
                return $true
            }
        } catch {
        }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Stop-OldProcesses {
    if (Test-Path $pidFile) {
        try {
            $old = Get-Content -Path $pidFile -Raw | ConvertFrom-Json
            foreach ($name in @("ml", "backend", "frontend")) {
                $procId = $old.$name
                if ($procId) {
                    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
                    if ($proc) {
                        Stop-Process -Id $procId -Force
                    }
                }
            }
        } catch {
        }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "一键启动：ML + Backend + Frontend 预览" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Require-Command "node"
Require-Command "java"
Require-Command "mvn"

$pythonLauncher = Get-PythonLauncher
Write-Host ("Python 解释器 : {0}" -f $pythonLauncher.Name) -ForegroundColor DarkCyan

if (!(Test-Path $frontendServer)) {
    $serverLines = @(
        "const http = require('http');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const root = process.cwd();",
        "const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8' };",
        "http.createServer((req,res)=> {",
        "  const pathname = decodeURIComponent(req.url.split('?')[0]);",
        "  const reqPath = pathname === '/' ? '/index.html' : pathname === '/login' ? '/login.html' : pathname === '/register' ? '/register.html' : pathname === '/dashboard' ? '/index.html' : pathname;",
        "  const filePath = path.join(root, reqPath);",
        "  fs.readFile(filePath, (err,data)=> {",
        "    if (err) { res.statusCode = 404; res.end('Not Found'); return; }",
        "    const ext = path.extname(filePath).toLowerCase();",
        "    res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');",
        "    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');",
        "    res.setHeader('Pragma', 'no-cache');",
        "    res.setHeader('Expires', '0');",
        "    res.end(data);",
        "  });",
        "}).listen(5501, '127.0.0.1', ()=> console.log('Preview server running at http://127.0.0.1:5501'));"
    )
    $serverLines | Set-Content -Path $frontendServer -Encoding UTF8
}

Stop-OldProcesses

Write-Host "[1/4] 构建后端 JAR..." -ForegroundColor Yellow
Push-Location $backendDir
try {
    & mvn clean package -DskipTests
} finally {
    Pop-Location
}

Write-Host "[2/4] 启动 ML 服务..." -ForegroundColor Yellow
$mlProcess = Start-Process -FilePath $pythonLauncher.FilePath -ArgumentList $pythonLauncher.Arguments -WorkingDirectory $mlDir -PassThru

Write-Host "[3/4] 启动后端服务..." -ForegroundColor Yellow
$backendProcess = Start-Process -FilePath "java" -ArgumentList "-jar", "$backendJar" -WorkingDirectory $backendDir -PassThru

Write-Host "[4/4] 启动前端预览..." -ForegroundColor Yellow
$frontendProcess = Start-Process -FilePath "node" -ArgumentList "serve-preview.js" -WorkingDirectory $frontendDir -PassThru

$pids = @{
    ml = $mlProcess.Id
    backend = $backendProcess.Id
    frontend = $frontendProcess.Id
}
$pids | ConvertTo-Json | Set-Content -Path $pidFile -Encoding UTF8

Write-Host "等待服务就绪..." -ForegroundColor Yellow
$mlOk = Wait-Http "http://127.0.0.1:5000/health"
$backendOk = Wait-Http "http://127.0.0.1:8080/api/detection/health"
$frontendOk = Wait-Http "http://127.0.0.1:5501/"

Write-Host ""
Write-Host "========== 启动结果 ==========" -ForegroundColor Cyan
Write-Host "ML 服务      : " -NoNewline
Write-Host ($(if ($mlOk) { "OK" } else { "FAILED" })) -ForegroundColor $(if ($mlOk) { "Green" } else { "Red" })
Write-Host "后端服务      : " -NoNewline
Write-Host ($(if ($backendOk) { "OK" } else { "FAILED" })) -ForegroundColor $(if ($backendOk) { "Green" } else { "Red" })
Write-Host "前端预览      : " -NoNewline
Write-Host ($(if ($frontendOk) { "OK" } else { "FAILED" })) -ForegroundColor $(if ($frontendOk) { "Green" } else { "Red" })
Write-Host ""
Write-Host "前端地址: http://127.0.0.1:5501"
Write-Host "后端地址: http://127.0.0.1:8080/api"
Write-Host ""
Write-Host "停止全部服务请运行: .\stop-all.ps1" -ForegroundColor Yellow
