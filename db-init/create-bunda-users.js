const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Database path (same as in server.js)
const DATABASE_PATH = process.env.DATABASE_PATH || '/usr/src/app/db/shared.sqlite';

console.log('🔄 Creating bunda users with testpassword123...\n');
console.log(`📁 Database: ${DATABASE_PATH}\n`);

const db = new sqlite3.Database(DATABASE_PATH);

async function createUsers() {
    // Hash the password once
    const password = 'testpassword123';
    const passwordHash = await bcrypt.hash(password, 10);
    
    console.log(`🔐 Password hash generated: ${passwordHash.substring(0, 20)}...\n`);
    
    const users = [];
    for (let i = 1; i <= 8; i++) {
        users.push({
            email: `bunda${i}@test.com`,
            username: `bunda${i}`,
            password_hash: passwordHash,
            is_verified: 1,
            profile_completed: 1,
            first_name: 'Bunda',
            last_name: `User${i}`
        });
    }
    
    for (const user of users) {
        await new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO users 
                (email, username, password_hash, is_verified, profile_completed, first_name, last_name, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
                    } else {
                        console.log(`✅ Created/Updated: ${user.username} (${user.email})`);
                        resolve();
                    }
                }
            );
            
            stmt.finalize();
        });
    }
    
    console.log('\n✅ All bunda users created/updated!');
    console.log('📧 Usernames: bunda1, bunda2, bunda3, ..., bunda8');
    console.log('📧 Emails: bunda1@test.com, bunda2@test.com, ..., bunda8@test.com');
    console.log('🔑 Password: testpassword123 (for all users)');
    
    db.close();
}

createUsers().catch(err => {
    console.error('❌ Error:', err);
    db.close();
    process.exit(1);
});
