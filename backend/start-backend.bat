@echo off
REM 启动垃圾短信检测系统 - 后端 (CMD)
REM 用法: start-backend.bat

echo.
echo ========================================
echo 启动后端服务...
echo ========================================
echo 后端地址: http://localhost:8080/api
echo.

REM 检查Maven是否安装
mvn --version >nul 2>&1
if errorlevel 1 (
    echo Maven未安装，请先安装Maven
    exit /b 1
)

REM 编译并运行
mvn clean spring-boot:run

exit /b %errorlevel%
