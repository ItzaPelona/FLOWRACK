@echo off
rem FlowRack Database Diagnostic Script

echo ================================================
echo FlowRack Database Diagnostic
echo ================================================
echo.

rem Check if virtual environment exists
if not exist "venv" (
    echo [ERROR] Virtual environment not found
    echo Please run init.bat first
    pause
    exit /b 1
)

rem Activate virtual environment
call venv\Scripts\activate.bat

rem Run diagnostic script
python backend\database\check_db.py

echo.
pause
