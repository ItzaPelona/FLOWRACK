# FIX FOR LOGIN ISSUE - READ THIS FIRST!

## Your Problem
You cannot login with `ADMIN001` / `admin123` - getting "Login Failed" error.

## Root Cause
The database initialization script (`init_db.py`) was using an old library (`psycopg2`) while the rest of the application uses the new library (`psycopg` version 3). This caused a mismatch in how data was being stored and retrieved.

## What I Fixed

1. ✅ **Updated `init_db.py`** - Now uses `psycopg` (version 3) instead of `psycopg2`
2. ✅ **Created diagnostic tool** - `check.bat` to verify database state
3. ✅ **Updated initialization scripts** - Better error handling
4. ✅ **Added documentation** - Troubleshooting guides

## How to Fix Your Issue

### Step 1: Run the Diagnostic Tool

Open PowerShell/Command Prompt in your project folder and run:
```cmd
check.bat
```

This will tell you exactly what's wrong:
- ✓ or ✗ Database connection
- ✓ or ✗ Users table exists
- ✓ or ✗ Admin user found
- ✓ or ✗ Password is valid

### Step 2: Reinitialize the Database

If the diagnostic shows any problems (likely ✗ Password is INVALID), run:
```cmd
init.bat
```

When prompted:
```
Do you want to initialize/reset the database? (y/N):
```
Type `y` and press Enter.

This will:
- Drop and recreate all tables
- Create the admin user with correct password hash
- Add sample data for testing

### Step 3: Verify the Fix

Run the diagnostic again:
```cmd
check.bat
```

You should now see all green checkmarks (✓):
- ✓ Database connection successful!
- ✓ Users table exists
- ✓ Admin user found
- ✓ Password 'admin123' is VALID
- ✓ PASSWORD IS VALID - Login should work!

### Step 4: Start the Application

```cmd
run.bat dev
```

Open browser: `http://localhost:5000`

Login with:
- **Registration Number:** ADMIN001
- **Password:** admin123

## If It Still Doesn't Work

### Option A: Complete Reset

```cmd
# Stop any running FlowRack processes (Ctrl+C)

# Delete virtual environment
rmdir /s /q venv

# Start fresh
init.bat

# Verify
check.bat

# Run
run.bat dev
```

### Option B: Check PostgreSQL

Make sure PostgreSQL is installed and running:

```powershell
# Check if PostgreSQL service is running
Get-Service postgresql*

# If not running, start it
Start-Service postgresql-x64-XX
```

### Option C: Check .env File

Make sure you have a `.env` file in the root folder with correct database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flowrack
DB_USER=flowrack_user
DB_PASSWORD=your_actual_password
```

## New Workflow (No More Repetitive Setup!)

### First Time Only:
```cmd
init.bat
```

### Every Other Time:
```cmd
run.bat dev
```

### When Something Breaks:
```cmd
check.bat
```

## Quick Reference

| Command | Purpose |
|---------|---------|
| `init.bat` | First-time setup, reset database |
| `run.bat dev` | Start in development mode |
| `run.bat prod` | Start in production mode |
| `check.bat` | Diagnose database issues |

## Additional Help

- **Detailed troubleshooting:** See `docs/TROUBLESHOOTING.md`
- **Startup scripts guide:** See `docs/STARTUP_SCRIPTS.md`
- **Main README:** See `README.md`

## What Changed in Your Project

**New Files:**
- ✅ `init.bat` - One-time initialization
- ✅ `run.bat` - Application runner (dev/prod modes)
- ✅ `check.bat` - Database diagnostic tool
- ✅ `backend/database/check_db.py` - Diagnostic script
- ✅ `docs/TROUBLESHOOTING.md` - Comprehensive troubleshooting guide
- ✅ `docs/STARTUP_SCRIPTS.md` - Scripts documentation

**Modified Files:**
- ✅ `backend/database/init_db.py` - Fixed library mismatch (psycopg2 → psycopg)
- ✅ `README.md` - Updated with new workflow and troubleshooting

**Old Files (can be deleted if you want):**
- `start.bat` - No longer needed, replaced by init.bat + run.bat

## Summary

The login issue was caused by a database library mismatch. I've fixed the code and created tools to help you diagnose and fix such issues in the future. Just run `init.bat` again to reset the database with the correct configuration, and you should be able to login!
