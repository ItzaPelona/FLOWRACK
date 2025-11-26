# FlowRack Troubleshooting Guide

## Login Issues

### Problem: "Login Failed" with ADMIN001/admin123

**Symptoms:**
- Cannot login with default credentials
- Getting "Invalid credentials" error
- Admin user exists but password doesn't work

**Diagnosis:**
Run the database diagnostic tool:
```cmd
check.bat
```

**Common Causes:**

1. **Database Not Initialized**
   - The users table doesn't exist
   - No admin user in database
   
   **Solution:**
   ```cmd
   init.bat
   # Choose 'y' when prompted to initialize database
   ```

2. **Password Hash Mismatch**
   - Database was initialized with wrong library version
   - Password hash is corrupted
   
   **Solution:**
   ```cmd
   init.bat
   # Choose 'y' to reinitialize database
   # This will recreate all tables and the admin user
   ```

3. **User is Deactivated**
   - User exists but `is_active` is FALSE
   
   **Solution:** Manually update database or reinitialize

**Verification:**
After fixing, run:
```cmd
check.bat
```

Look for these success messages:
- ✓ Database connection successful!
- ✓ Users table exists
- ✓ Admin user found
- ✓ Password 'admin123' is VALID
- ✓ PASSWORD IS VALID - Login should work!

## Database Connection Issues

### Problem: Cannot Connect to Database

**Error Messages:**
- "Error connecting to database"
- "Connection refused"
- "Database does not exist"

**Solutions:**

1. **Check PostgreSQL is Running**
   ```powershell
   # Windows - Check if PostgreSQL service is running
   Get-Service postgresql*
   
   # Start PostgreSQL if stopped
   Start-Service postgresql-x64-XX
   ```

2. **Verify .env Configuration**
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=flowrack
   DB_USER=flowrack_user
   DB_PASSWORD=your_password
   ```

3. **Create Database Manually**
   ```cmd
   # Using psql command line
   psql -U postgres
   CREATE DATABASE flowrack;
   CREATE USER flowrack_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE flowrack TO flowrack_user;
   ```

4. **Check Database Exists**
   Run diagnostic:
   ```cmd
   check.bat
   ```

## Installation Issues

### Problem: Virtual Environment Not Found

**Error:**
```
[ERROR] Virtual environment not found
Please run init.bat first
```

**Solution:**
```cmd
init.bat
```

### Problem: Dependencies Installation Failed

**Errors:**
- "Could not install packages"
- "Package not found"
- "Build failed"

**Solutions:**

1. **Update pip:**
   ```cmd
   call venv\Scripts\activate.bat
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```

2. **Install Build Tools (if needed):**
   - Download Microsoft C++ Build Tools
   - Or use pre-built wheels

3. **Clean Install:**
   ```cmd
   rmdir /s /q venv
   init.bat
   ```

## Runtime Issues

### Problem: Port Already in Use

**Error:**
```
Address already in use
Port 5000 is already in use
```

**Solutions:**

1. **Kill Existing Process:**
   ```powershell
   # Find process using port 5000
   netstat -ano | findstr :5000
   
   # Kill the process (replace PID with actual process ID)
   taskkill /PID <PID> /F
   ```

2. **Change Port:**
   Edit `backend/app.py`:
   ```python
   socketio.run(app, host='0.0.0.0', port=5001, debug=True)
   ```

### Problem: Module Not Found

**Error:**
```
ModuleNotFoundError: No module named 'flask'
ModuleNotFoundError: No module named 'backend'
```

**Solutions:**

1. **Activate Virtual Environment:**
   ```cmd
   call venv\Scripts\activate.bat
   ```

2. **Reinstall Dependencies:**
   ```cmd
   init.bat
   ```

3. **Check Python Path:**
   The virtual environment should be activated before running the app

## Library Version Issues

### Problem: psycopg vs psycopg2 Conflicts

**Symptoms:**
- Import errors related to psycopg
- Database operations fail unexpectedly

**Background:**
- FlowRack uses `psycopg` version 3 (modern)
- Old code may reference `psycopg2` (legacy)

**Solution:**
All code has been updated to use `psycopg` version 3. If you encounter issues:
```cmd
init.bat
# This will reinstall all dependencies with correct versions
```

## Application Issues

### Problem: Frontend Cannot Connect to Backend

**Symptoms:**
- API calls return 404
- CORS errors in browser console
- "Failed to fetch" errors

**Solutions:**

1. **Check Backend is Running:**
   ```cmd
   # Should see: Running on http://localhost:5000
   ```

2. **Verify API Endpoints:**
   Open browser to: `http://localhost:5000/api/health`

3. **Check CORS Configuration:**
   Backend should have Flask-CORS enabled

### Problem: WebSocket Connection Failed

**Error in Console:**
```
WebSocket connection failed
Could not connect to ws://localhost:5000
```

**Solutions:**

1. **Check Flask-SocketIO:**
   ```cmd
   pip list | findstr socketio
   ```

2. **Verify Backend Started Correctly:**
   Look for: "WebSocket ready"

3. **Firewall Issues:**
   Allow port 5000 in Windows Firewall

## Data Issues

### Problem: No Data Showing in Frontend

**Possible Causes:**

1. **Database Empty:**
   ```cmd
   check.bat
   # Check if users table has data
   ```

2. **Authentication Failed:**
   - Cannot retrieve data without valid login
   - Check browser console for 401 errors

3. **API Endpoint Issues:**
   - Check Network tab in browser DevTools
   - Verify API responses

**Solution:**
```cmd
# Reinitialize with sample data
init.bat
# Choose 'y' to initialize database
```

## Diagnostic Commands

### Quick Checks

```cmd
# 1. Check database connection and users
check.bat

# 2. Test Python environment
call venv\Scripts\activate.bat
python --version
pip list

# 3. Test backend imports
python -c "from backend.models.user import User; print('OK')"

# 4. Check if PostgreSQL is running
psql -U postgres -c "SELECT version();"

# 5. List databases
psql -U postgres -c "\l"
```

### Log Files

Check application logs for errors:
- Terminal output when running `run.bat dev`
- Browser console (F12) for frontend errors

## Getting Help

### Before Asking for Help

1. Run diagnostic:
   ```cmd
   check.bat
   ```

2. Check this troubleshooting guide

3. Review error messages carefully

4. Try reinitializing:
   ```cmd
   init.bat
   ```

### Information to Provide

When reporting issues, include:
- Error message (full text)
- Output from `check.bat`
- Python version: `python --version`
- Operating system version
- Steps to reproduce the issue
- What you've already tried

## Reset Everything

If all else fails, complete reset:

```cmd
# 1. Stop all running processes (Ctrl+C)

# 2. Remove virtual environment
rmdir /s /q venv

# 3. Reinitialize from scratch
init.bat

# 4. Run diagnostic
check.bat

# 5. Start application
run.bat dev
```

## Prevention

### Best Practices

1. **Always use init.bat for first setup**
   - Don't manually create venv
   - Don't manually install packages

2. **Use run.bat to start the application**
   - Don't run Python directly
   - Ensures environment is activated

3. **Keep .env file secure**
   - Don't commit to git
   - Use strong passwords in production

4. **Regular checks**
   - Run `check.bat` periodically
   - Monitor application logs

5. **Update dependencies carefully**
   - Test after updating requirements.txt
   - Run init.bat after changes
