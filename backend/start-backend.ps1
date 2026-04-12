[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
chcp.com 65001 > $null
$env:JAVA_TOOL_OPTIONS = "-Dfile.encoding=UTF-8"
$env:MAVEN_OPTS = "-Dfile.encoding=UTF-8"
$env:PYTHONIOENCODING = "utf-8"
# 启动垃圾短信检测系统 - 后端 (PowerShell)
# 用法: .\start-backend.ps1

$backend_dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $backend_dir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "启动后端服务..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "后端地址: http://localhost:8080/api" -ForegroundColor Yellow
Write-Host ""

# 检查Maven是否安装
if (-not (Get-Command mvn -ErrorAction SilentlyContinue)) {
    Write-Host "Maven未安装，请先安装Maven" -ForegroundColor Red
    exit 1
}

# 编译并运行
mvn clean spring-boot:run

Pop-Location
