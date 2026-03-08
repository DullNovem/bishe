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

$pythonExe = Join-Path $root ".venv\Scripts\python.exe"
if (!(Test-Path $pythonExe)) {
    throw "未找到虚拟环境 Python：$pythonExe，请先创建并安装依赖。"
}

if (!(Test-Path $frontendServer)) {
    $serverLines = @(
        "const http = require('http');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const root = process.cwd();",
        "const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8' };",
        "http.createServer((req,res)=> {",
        "  const reqPath = req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);",
        "  const filePath = path.join(root, reqPath);",
        "  fs.readFile(filePath, (err,data)=> {",
        "    if (err) { res.statusCode = 404; res.end('Not Found'); return; }",
        "    const ext = path.extname(filePath).toLowerCase();",
        "    res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');",
        "    res.end(data);",
        "  });",
        "}).listen(5501, '127.0.0.1', ()=> console.log('Preview server running at http://127.0.0.1:5501'));"
    )
    $serverLines | Set-Content -Path $frontendServer -Encoding UTF8
}

Stop-OldProcesses

if (!(Test-Path $backendJar)) {
    Write-Host "[1/4] 构建后端 JAR..." -ForegroundColor Yellow
    Push-Location $backendDir
    try {
        & mvn clean package -DskipTests
    } finally {
        Pop-Location
    }
}

Write-Host "[2/4] 启动 ML 服务..." -ForegroundColor Yellow
$mlProcess = Start-Process -FilePath $pythonExe -ArgumentList "api_server.py" -WorkingDirectory $mlDir -PassThru

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
