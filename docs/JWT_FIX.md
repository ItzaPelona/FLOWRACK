# JWT Token Fix - Inventory View Issue

## Problem
The inventory view and other authenticated endpoints were returning error:
```
"msg": "Subject must be a string"
```

## Root Cause
Flask-JWT-Extended expects the JWT token's `identity` (subject) to be a **string**, but the code was passing an **integer** (user ID).

When creating the JWT token in the login endpoint:
```python
# WRONG - passing integer
access_token = create_access_token(identity=user.id)  # user.id is an int
```

## Solution

### 1. Convert User ID to String When Creating Token
**File:** `backend/routes/auth.py`

Changed:
```python
# Convert user.id to string for JWT compatibility
access_token = create_access_token(identity=str(user.id))
```

### 2. Created Helper Function to Convert Back to Integer
**File:** `backend/routes/auth.py`

Added helper function:
```python
def get_current_user_id():
    """Helper function to get current user ID as integer from JWT"""
    return int(get_jwt_identity())
```

### 3. Updated All Routes to Use Helper
Replaced all instances of:
```python
current_user_id = get_jwt_identity()
```

With:
```python
current_user_id = get_current_user_id()
```

**Files updated:**
- ✅ `backend/routes/auth.py` - All auth endpoints
- ✅ `backend/routes/users.py` - User management endpoints  
- ✅ `backend/routes/products.py` - Inventory/product endpoints
- ✅ `backend/routes/requests.py` - Request management endpoints
- ✅ `backend/routes/debts.py` - Debt management endpoints
- ✅ `backend/routes/dashboard.py` - Dashboard endpoints

## Testing

After the fix, all endpoints should work:

```powershell
# Login
$body = @{registration_number="ADMIN001"; password="admin123"} | ConvertTo-Json
$response = Invoke-WebRequest -Uri http://localhost:5000/api/auth/login -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
$token = ($response.Content | ConvertFrom-Json).access_token

# Test products endpoint (inventory)
$headers = @{Authorization="Bearer $token"}
Invoke-WebRequest -Uri http://localhost:5000/api/products -Method GET -Headers $headers -UseBasicParsing
```

## What Now Works

✅ Login returns valid JWT token
✅ Dashboard view loads data
✅ Inventory view displays products  
✅ User management works
✅ Request management works
✅ Debt management works
✅ All authenticated endpoints work

## Why This Happened

The JWT specification (RFC 7519) defines the "sub" (subject) claim as a **string**:
> "The 'sub' (subject) claim identifies the principal that is the subject of the JWT. The Claims in a JWT are normally statements about the subject. The subject value MUST either be scoped to be locally unique in the context of the issuer or be globally unique. The processing of this claim is generally application specific. The 'sub' value is a case-sensitive **string**..."

Flask-JWT-Extended enforces this specification, so passing an integer causes validation to fail.

## Related Issues Fixed

1. ✅ Python 3.13 compatibility (eventlet → threading mode)
2. ✅ Database library consistency (psycopg2 → psycopg v3)
3. ✅ JWT subject type (integer → string)
4. ✅ Token verification in all routes

## Summary

The issue was a simple type mismatch - JWT tokens require string identities, but we were passing integers. The fix converts the user ID to a string when creating the token, and back to an integer when retrieving it from the token. All authenticated endpoints now work correctly!
