# FlowRack Startup Scripts - User Guide

## Overview
The FlowRack startup process has been split into two separate scripts for better workflow:

1. **init.bat** - One-time initialization (setup)
2. **run.bat** - Running the application (development/production)

This separation prevents you from having to reinitialize the entire system every time you want to run the application.

## Scripts Description

### init.bat - Initialization Script
**Purpose**: First-time setup and configuration

**What it does:**
- Checks if Python is installed
- Creates a virtual environment (or recreates if requested)
- Installs all Python dependencies from requirements.txt
- Sets up .env configuration file
- Optionally initializes/resets the database

**When to use:**
- First time setting up the project
- After updating requirements.txt
- When you need to reset the database
- When recreating the virtual environment

**Command:**
```cmd
init.bat
```

### run.bat - Application Runner
**Purpose**: Start the FlowRack application in different modes

**What it does:**
- Activates the virtual environment
- Checks if everything is properly initialized
- Sets environment variables based on mode
- Starts the Flask application

**Modes:**
1. **Development Mode** (`run.bat dev`)
   - Debug enabled
   - Auto-reload on code changes
   - Detailed error messages
   - Debug toolbar enabled

2. **Production Mode** (`run.bat prod`)
   - Debug disabled
   - Optimized performance
   - Production-ready configuration

**Commands:**
```cmd
# Development mode (default)
run.bat dev

# Production mode
run.bat prod

# Shorthand (defaults to dev)
run.bat
```

## Typical Workflow

### First Time Setup
```cmd
# 1. Initialize the project
init.bat

# 2. Run the application in development mode
run.bat dev
```

### Daily Development
```cmd
# Just run the application
run.bat dev
```

### After Updating Dependencies
```cmd
# Reinitialize to install new packages
init.bat

# Then run normally
run.bat dev
```

### For Production Testing
```cmd
# Run in production mode
run.bat prod
```

## Comparison with Old start.bat

### Old Workflow (start.bat)
- Every run would check and recreate environment
- Would ask about database initialization every time
- Mixed initialization with running
- Slower startup on subsequent runs

### New Workflow (init.bat + run.bat)
- ✅ Separate initialization from running
- ✅ Faster subsequent startups
- ✅ Clear separation of concerns
- ✅ Support for development/production modes
- ✅ No unnecessary prompts when just running

## Troubleshooting

### "Virtual environment not found"
Run `init.bat` first to create the virtual environment.

### "Dependencies not found"
Run `init.bat` to install dependencies.

### ".env file not found"
Run `init.bat` to create the configuration file.

### Database errors
Run `init.bat` and choose to initialize the database when prompted.

## Files Created

- `init.bat` - Initialization script
- `run.bat` - Application runner
- `start.bat` - (Old script, can be kept for reference or deleted)

## Notes

- The old `start.bat` is still available but no longer needed
- You can safely delete `start.bat` if you prefer
- Both scripts work with Windows PowerShell and Command Prompt
- Linux/macOS users should continue using `start.sh`
