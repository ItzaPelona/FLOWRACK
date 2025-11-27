/**
 * Fix localStorage User Data
 * Run this script in the browser console to manually fix missing user data
 * 
 * This is a one-time fix for existing sessions. New logins will work automatically.
 */

(async function fixUserData() {
    console.log('🔧 FlowRack User Data Fix Tool');
    console.log('================================\n');
    
    // Check if token exists
    const token = localStorage.getItem('flowrack_token');
    if (!token) {
        console.error('❌ No authentication token found. Please login first.');
        return;
    }
    
    console.log('✅ Token found:', token.substring(0, 20) + '...');
    
    // Check if user data already exists
    const existingUser = localStorage.getItem('flowrack_user');
    if (existingUser && existingUser !== 'null') {
        try {
            const userData = JSON.parse(existingUser);
            if (userData && userData.role) {
                console.log('✅ User data already exists:');
                console.log('   - Name:', userData.first_name, userData.last_name);
                console.log('   - Role:', userData.role);
                console.log('   - Email:', userData.email);
                console.log('\n✨ No fix needed! Your session is already configured correctly.');
                return;
            }
        } catch (e) {
            console.warn('⚠️  Found corrupted user data, will fetch fresh data...');
        }
    } else {
        console.log('⚠️  No user data found in localStorage');
    }
    
    // Fetch user data from backend
    console.log('\n🔄 Fetching user data from server...');
    
    try {
        const response = await fetch(window.location.origin + '/api/auth/profile', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const userData = await response.json();
        
        if (!userData || !userData.role) {
            throw new Error('Invalid user data received from server');
        }
        
        // Save to localStorage
        localStorage.setItem('flowrack_user', JSON.stringify(userData));
        
        console.log('\n✅ User data saved successfully!');
        console.log('================================');
        console.log('   - Name:', userData.first_name, userData.last_name);
        console.log('   - Role:', userData.role);
        console.log('   - Email:', userData.email);
        console.log('   - Registration:', userData.registration_number);
        console.log('================================\n');
        
        console.log('🎉 Fix complete! Reloading page in 2 seconds...');
        
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('\n❌ Failed to fetch user data:', error.message);
        console.log('\n📝 Please try one of these options:');
        console.log('   1. Logout and login again (recommended)');
        console.log('   2. Clear browser cache and login again');
        console.log('   3. Check if the backend server is running');
    }
})();
