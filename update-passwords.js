const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

// Database path in the shared volume
const DB_PATH = '/shared-db/database.db';
const NEW_PASSWORD = 'testpassword123';

async function updatePasswords() {
    console.log('🔄 Updating test user passwords...\n');
    
    try {
        const db = new Database(DB_PATH);
        
        // Hash the new password
        const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);
        
        // Update all test users
        const stmt = db.prepare(`
            UPDATE users 
            SET password_hash = ? 
            WHERE email LIKE 'test%@test.com'
        `);
        
        const result = stmt.run(passwordHash);
        
        console.log(`✅ Updated ${result.changes} test user passwords`);
        console.log('📧 Users: test1@test.com, test2@test.com, ... test8@test.com');
        console.log('🔑 New Password: testpassword123\n');
        
        // Verify the users
        const users = db.prepare(`
            SELECT email, username, is_verified 
            FROM users 
            WHERE email LIKE 'test%@test.com' 
            ORDER BY email
        `).all();
        
        console.log('Verified users:');
        users.forEach(user => {
            console.log(`  ✓ ${user.username} (${user.email}) - Verified: ${user.is_verified ? 'Yes' : 'No'}`);
        });
        
        db.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

updatePasswords();
