@echo off
rem FlowRack Run Script for Windows

setlocal enabledelayedexpansion

rem Parse command line arguments
set MODE=%1
if "%MODE%"=="" set MODE=dev

echo ================================================
echo FlowRack Warehouse Management System
echo Run Script - %MODE% mode
echo ================================================
echo.

rem Check if virtual environment exists
if not exist "venv" (
    echo [ERROR] Virtual environment not found
    echo Please run init.bat first to initialize the project
    pause
    exit /b 1
)

rem Activate virtual environment
echo [INFO] Activating virtual environment...
call venv\Scripts\activate.bat

rem Check if dependencies are installed
if not exist "venv\Lib\site-packages\flask\__init__.py" (
    echo [ERROR] Dependencies not found
    echo Please run init.bat first to install dependencies
    pause
    exit /b 1
)

rem Check if .env file exists
if not exist ".env" (
    echo [WARNING] .env file not found
    echo Please run init.bat first or create .env manually
    pause
    exit /b 1
)

rem Set environment variables based on mode
if /i "%MODE%"=="dev" (
    echo [INFO] Running in DEVELOPMENT mode
    set FLASK_ENV=development
    set FLASK_DEBUG=1
) else if /i "%MODE%"=="prod" (
    echo [INFO] Running in PRODUCTION mode
    set FLASK_ENV=production
    set FLASK_DEBUG=0
) else (
    echo [ERROR] Invalid mode: %MODE%
    echo Usage: run.bat [dev^|prod]
    echo   dev  - Development mode with debug enabled
    echo   prod - Production mode
    pause
    exit /b 1
)

echo.
echo [INFO] The application will be available at: http://localhost:5000
echo [INFO] Press Ctrl+C to stop the application
echo.

if /i "%MODE%"=="dev" (
    echo [INFO] Development mode features:
    echo   - Auto-reload on code changes
    echo   - Detailed error messages
    echo   - Debug toolbar enabled
    echo.
)

echo [INFO] Default login credentials:
echo   Admin: ADMIN001 / admin123
echo   ** Please change default passwords after first login **
echo.

rem Start the Flask application
echo [INFO] Starting FlowRack application...
echo.
python -m backend.app

echo.
echo [INFO] Application stopped.
pause
