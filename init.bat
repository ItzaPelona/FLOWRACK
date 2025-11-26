@echo off
rem FlowRack Initialization Script for Windows

echo ================================================
echo FlowRack Warehouse Management System
echo Initialization Script
echo ================================================
echo.

rem Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.8 or higher from https://python.org
    pause
    exit /b 1
)

echo [INFO] Python found
python --version
echo.

rem Check if virtual environment exists
if exist "venv" (
    echo [WARNING] Virtual environment already exists
    set /p recreate="Do you want to recreate it? This will delete the existing one. (y/N): "
    if /i "%recreate%"=="y" (
        echo [INFO] Removing existing virtual environment...
        rmdir /s /q venv
    ) else (
        echo [INFO] Keeping existing virtual environment
        goto skip_venv_creation
    )
)

echo [INFO] Creating virtual environment...
python -m venv venv
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create virtual environment
    pause
    exit /b 1
)
echo [INFO] Virtual environment created successfully
echo.

:skip_venv_creation

rem Activate virtual environment
echo [INFO] Activating virtual environment...
call venv\Scripts\activate.bat
echo.

rem Install dependencies
echo [INFO] Installing Python dependencies...
pip install --upgrade pip
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo [INFO] Dependencies installed successfully
echo.

rem Check if .env file exists
if not exist ".env" (
    echo [WARNING] .env file not found
    if exist ".env.example" (
        echo [INFO] Creating .env file from template...
        copy .env.example .env
        echo [WARNING] Please edit .env file with your configuration
        echo [INFO] Opening .env file for editing...
        notepad .env
    ) else (
        echo [WARNING] No .env.example found. Please create .env manually
        echo [INFO] Creating basic .env file...
        (
            echo # FlowRack Configuration
            echo FLASK_ENV=development
            echo SECRET_KEY=your-secret-key-here
            echo DATABASE_URL=sqlite:///flowrack.db
        ) > .env
        notepad .env
    )
    echo.
    pause
)

rem Initialize database
echo.
set /p init_db="Do you want to initialize/reset the database? (y/N): "
if /i "%init_db%"=="y" (
    echo [INFO] Initializing database...
    python backend\database\init_db.py
    if %errorlevel% neq 0 (
        echo [ERROR] Database initialization failed
        pause
        exit /b 1
    )
    echo [INFO] Database initialized successfully
)

echo.
echo ================================================
echo Initialization Complete!
echo ================================================
echo.
echo Next steps:
echo   1. Review your .env configuration
echo   2. Test database connection: python backend\database\check_db.py
echo   3. Run the application using:
echo      - Development mode: run.bat dev
echo      - Production mode:  run.bat prod
echo.
pause
