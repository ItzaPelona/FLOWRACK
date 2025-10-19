@echo off
rem FlowRack Startup Script for Windows

echo ================================================
echo FlowRack Warehouse Management System
echo Startup Script for Windows
echo ================================================

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

rem Check if virtual environment exists
if not exist "venv" (
    echo [WARNING] Virtual environment not found. Creating...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment
        pause
        exit /b 1
    )
    echo [INFO] Virtual environment created successfully
)

rem Activate virtual environment
echo [INFO] Activating virtual environment...
call venv\Scripts\activate.bat

rem Check if requirements are installed
if not exist "venv\Lib\site-packages\flask\__init__.py" (
    echo [INFO] Installing Python dependencies...
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo [INFO] Dependencies installed successfully
)

rem Check if .env file exists
if not exist ".env" (
    echo [WARNING] .env file not found. Creating from template...
    copy .env.example .env
    echo [WARNING] Please edit .env file with your database credentials
    echo [INFO] Opening .env file for editing...
    notepad .env
    pause
)

rem Ask if user wants to initialize database
echo.
set /p init_db="Do you want to initialize the database? (y/N): "
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

rem Start the application
echo.
echo [INFO] Starting FlowRack application...
echo.
echo [INFO] The application will be available at: http://localhost:5000
echo [INFO] Press Ctrl+C to stop the application
echo.
echo [INFO] Default login credentials:
echo [INFO]   Admin: ADMIN001 / admin123
echo [INFO]   ** Please change default passwords after first login **
echo.

rem Start the Flask application
python -m backend.app

echo [INFO] Application stopped.
pause