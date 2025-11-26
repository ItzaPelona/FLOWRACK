# Quick Start Guide - User Management Features

## 🚀 Getting Started

### 1. Apply Database Migrations

Run these commands in order:

```powershell
# Apply user status migration
python backend\database\migrate_user_status.py

# Apply avatar field migration
python backend\database\migrate_avatar.py
```

Expected output:
```
✅ Migration completed successfully!
```

---

### 2. Start the Application

```powershell
# If not already running
.\run.bat dev
```

---

### 3. Test Features

#### A. Password Reset (Any User)
1. Login: http://localhost:5000
2. Credentials: USR001 / user123
3. Click Profile → "Change Password"
4. Current: user123
5. New: newpassword123
6. Logout and test new password

#### B. Profile Editing (Any User)
1. Login and go to Profile
2. Click "Edit Profile"
3. Update email, phone, or department
4. Click "Save Changes"
5. See updated info immediately

#### C. User Registration (Public)
1. Logout
2. Click "Register here" on login page
3. Fill form:
   - First Name: Test
   - Last Name: User
   - Registration Number: USR003
   - Email: test.user@example.com
   - Password: testpass123
4. Click "Register"
5. See approval message

#### D. Approve Registration (Admin)
1. Login as ADMIN001 / admin123
2. Click "Pending Users" in menu
3. See new registration
4. Click "Approve"
5. User can now login

#### E. Upload Avatar (Any User)
1. Login and go to Profile
2. Click "Upload Avatar"
3. Choose image (< 2MB)
4. See avatar in profile and navbar
5. Click "Remove" to delete

---

## 🎯 Feature Overview

### ✅ What's New

| Feature | Status | Access Level |
|---------|--------|--------------|
| Password Reset | ✅ Working | All Users |
| Profile Editing | ✅ Working | All Users |
| Self Registration | ✅ Working | Public |
| Admin Approval | ✅ Working | Admin Only |
| Avatar Upload | ✅ Working | All Users |

### 🔐 Security

- Passwords hashed with bcrypt
- Current password verification required
- JWT authentication on all endpoints
- File size limits enforced (2MB)
- Email format validation
- Admin-only approval workflow

---

## 📝 Common Use Cases

### New Employee Registration
1. Employee visits login page
2. Clicks "Register here"
3. Fills registration form
4. Admin receives notification (check Pending Users)
5. Admin approves registration
6. Employee receives active account

### User Updates Contact Info
1. User logs in
2. Goes to Profile
3. Clicks "Edit Profile"
4. Updates email/phone
5. Saves changes
6. Info updated immediately

### User Personalizes Account
1. User uploads profile picture
2. Avatar appears in navbar
3. Avatar visible to all users
4. Can remove and re-upload anytime

---

## 🐛 Troubleshooting

### "Registration number already exists"
- Use a unique registration number
- Check if user already exists in system

### "Failed to upload avatar"
- Check file size (must be < 2MB)
- Ensure file is an image (PNG, JPG, etc.)
- Try different image format

### "Insufficient permissions"
- Only admins can approve registrations
- Only admins can access Pending Users view
- Users can only edit their own profile

### Migration errors
- Ensure database is running
- Check .env file has correct DB credentials
- Migrations are idempotent (safe to run multiple times)

---

## 📊 Database Changes

```sql
-- New columns added to users table:
ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);

-- New index for performance:
CREATE INDEX idx_users_status ON users(status);
```

---

## 🔗 API Endpoints

### Public
- `POST /api/users/register` - Self-registration

### User (Authenticated)
- `POST /api/users/change-password` - Change password
- `PUT /api/users/update-profile` - Update profile
- `POST /api/users/upload-avatar` - Upload avatar
- `DELETE /api/users/remove-avatar` - Remove avatar

### Admin Only
- `GET /api/users/pending` - List pending users
- `POST /api/users/:id/approve` - Approve user
- `DELETE /api/users/:id/reject` - Reject user

---

## ✨ Tips

1. **For Admins**: Check Pending Users regularly
2. **For Users**: Keep profile updated for better contact
3. **Avatars**: Use square images for best results
4. **Passwords**: Use strong passwords (min 6 chars)
5. **Registration**: Use official email for faster approval

---

## 📞 Support

If you encounter issues:
1. Check this guide first
2. Verify migrations ran successfully
3. Check browser console for errors
4. Restart Flask server if needed

---

**Last Updated**: November 25, 2025
**Version**: 1.0.0
**Status**: ✅ Production Ready
