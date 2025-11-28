const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const DB_PATH = path.join(__dirname, 'auth-backend/db/database.db');
const db = new sqlite3.Database(DB_PATH);

const PASSWORD = 'test123'; // Same password for all test users

async function createTestUsers() {
    console.log('🔄 Creating test users...\n');
    
    // Hash the password once
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    
    const users = [];
    for (let i = 1; i <= 8; i++) {
        users.push({
            email: `test${i}@test.com`,
            username: `test${i}`,
            password_hash: passwordHash,
            is_verified: 1,
            profile_completed: 1,
            first_name: `Test`,
            last_name: `User${i}`
        });
    }
    
    const insertPromises = users.map(user => {
        return new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO users 
                (email, username, password_hash, is_verified, profile_completed, first_name, last_name) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run(
                user.email,
                user.username,
                user.password_hash,
                user.is_verified,
                user.profile_completed,
                user.first_name,
                user.last_name,
                function(err) {
                    if (err) {
                        console.log(`❌ Failed to create ${user.username}: ${err.message}`);
                        reject(err);
                    } else if (this.changes > 0) {
                        console.log(`✅ Created user: ${user.username} (${user.email})`);
                        resolve();
                    } else {
                        console.log(`⚠️  User already exists: ${user.username}`);
                        resolve();
                    }
                }
            );
            
            stmt.finalize();
        });
    });
    
    try {
        await Promise.all(insertPromises);
        console.log('\n✅ All test users processed!');
        console.log('📧 Email: test1@test.com, test2@test.com, ... test8@test.com');
        console.log('🔑 Password: test123 (for all users)');
    } catch (error) {
        console.error('❌ Error creating users:', error);
    } finally {
        db.close();
    }
}

createTestUsers();
