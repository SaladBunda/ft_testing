// addGameStats.js - Database migration to add game statistics to users table
const Database = require('better-sqlite3');
const path = require('path');

/**
 * Add game statistics fields to the users table
 * This script should be run once to migrate the existing database
 */
function addGameStatsToUsers() {
    try {
        // Connect to the shared SQLite database
        const dbPath = process.env.DATABASE_PATH || '/usr/src/app/db/shared.sqlite';
        console.log(`🎮 Connecting to database at: ${dbPath}`);
        
        const db = new Database(dbPath);
        
        // Enable foreign keys
        db.pragma('foreign_keys = ON');
        
        console.log('📊 Adding game statistics fields to users table...');
        
        // Add game statistics columns to the users table
        const gameStatsColumns = [
            // Basic Game Stats
            'games_played INTEGER DEFAULT 0',
            'games_won INTEGER DEFAULT 0', 
            'games_lost INTEGER DEFAULT 0',
            'win_rate REAL DEFAULT 0.0',
            'current_streak INTEGER DEFAULT 0',
            
            // Player Progression
            'player_level INTEGER DEFAULT 1',
            'experience_points INTEGER DEFAULT 0',
            
            // Ranking System
            'rank_points INTEGER DEFAULT 1000',
            'rank_tier TEXT DEFAULT "Bronze"'
        ];
        
        // Check if columns already exist before adding them
        const tableInfo = db.prepare("PRAGMA table_info(users)").all();
        const existingColumns = tableInfo.map(col => col.name);
        
        let addedColumns = 0;
        
        gameStatsColumns.forEach(columnDef => {
            const columnName = columnDef.split(' ')[0];
            
            if (!existingColumns.includes(columnName)) {
                try {
                    const alterSQL = `ALTER TABLE users ADD COLUMN ${columnDef}`;
                    console.log(`  ➕ Adding column: ${columnName}`);
                    db.exec(alterSQL);
                    addedColumns++;
                } catch (error) {
                    console.error(`  ❌ Failed to add column ${columnName}:`, error.message);
                }
            } else {
                console.log(`  ⏭️  Column ${columnName} already exists, skipping...`);
            }
        });
        
        // Create index for better query performance on ranking
        try {
            console.log('📈 Creating indexes for game statistics...');
            db.exec(`CREATE INDEX IF NOT EXISTS idx_users_rank_points ON users(rank_points DESC)`);
            db.exec(`CREATE INDEX IF NOT EXISTS idx_users_player_level ON users(player_level DESC)`);
            db.exec(`CREATE INDEX IF NOT EXISTS idx_users_win_rate ON users(win_rate DESC)`);
            console.log('  ✅ Indexes created successfully');
        } catch (error) {
            console.error('  ❌ Failed to create indexes:', error.message);
        }
        
        // Verify the migration
        console.log('\n🔍 Verifying migration...');
        const updatedTableInfo = db.prepare("PRAGMA table_info(users)").all();
        const newColumns = updatedTableInfo.filter(col => 
            ['games_played', 'games_won', 'games_lost', 'win_rate', 'current_streak', 
             'player_level', 'experience_points', 'rank_points', 'rank_tier'].includes(col.name)
        );
        
        console.log('📋 Game statistics columns in users table:');
        newColumns.forEach(col => {
            console.log(`  ✅ ${col.name} (${col.type}) - Default: ${col.dflt_value || 'NULL'}`);
        });
        
        db.close();
        
        console.log(`\n🎉 Migration completed successfully!`);
        console.log(`   📊 Added ${addedColumns} new columns`);
        console.log(`   📈 Created performance indexes`);
        console.log(`   🎮 Users table is now ready for game statistics!`);
        
        return true;
        
    } catch (error) {
        console.error('💥 Migration failed:', error);
        return false;
    }
}

/**
 * Create a test development user
 * Useful for testing when you don't want to use Google OAuth
 */
function createTestUser() {
    try {
        const dbPath = process.env.DATABASE_PATH || '/usr/src/app/db/shared.sqlite';
        const db = new Database(dbPath);
        
        console.log('👤 Creating test development user...');
        
        // Check if test user already exists
        const existingUser = db.prepare('SELECT id, email FROM users WHERE email = ?').get('dev@test.com');
        
        if (existingUser) {
            console.log(`  ⚠️  Test user already exists: ID ${existingUser.id}, Email: ${existingUser.email}`);
            db.close();
            return existingUser.id;
        }
        
        // Create test user
        const insertUser = db.prepare(`
            INSERT INTO users (
                email, password_hash, name, username, first_name, last_name, 
                is_verified, profile_completed, created_at,
                games_played, games_won, games_lost, win_rate, current_streak,
                player_level, experience_points, rank_points, rank_tier
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const testUserData = {
            email: 'dev@test.com',
            password_hash: '$2b$10$dummy.hash.for.testing.purposes.only', // Dummy hash
            name: 'Dev Test User',
            username: 'devtester',
            first_name: 'Dev',
            last_name: 'Tester',
            is_verified: 1,
            profile_completed: 1,
            // Game stats with some initial values for testing
            games_played: 0,
            games_won: 0,
            games_lost: 0,
            win_rate: 0.0,
            current_streak: 0,
            player_level: 1,
            experience_points: 0,
            rank_points: 1000,
            rank_tier: 'Bronze'
        };
        
        const result = insertUser.run(
            testUserData.email, testUserData.password_hash, testUserData.name, 
            testUserData.username, testUserData.first_name, testUserData.last_name,
            testUserData.is_verified, testUserData.profile_completed,
            testUserData.games_played, testUserData.games_won, testUserData.games_lost,
            testUserData.win_rate, testUserData.current_streak, testUserData.player_level,
            testUserData.experience_points, testUserData.rank_points, testUserData.rank_tier
        );
        
        console.log(`  ✅ Test user created successfully!`);
        console.log(`     🆔 User ID: ${result.lastInsertRowid}`);
        console.log(`     📧 Email: ${testUserData.email}`);
        console.log(`     👤 Username: ${testUserData.username}`);
        console.log(`     🎮 Initial Level: ${testUserData.player_level}`);
        console.log(`     🏆 Initial Rank: ${testUserData.rank_tier} (${testUserData.rank_points} points)`);
        
        db.close();
        return result.lastInsertRowid;
        
    } catch (error) {
        console.error('💥 Failed to create test user:', error);
        return null;
    }
}

// Export functions for use in other files
module.exports = {
    addGameStatsToUsers,
    createTestUser
};

// Allow running this file directly
if (require.main === module) {
    console.log('🚀 Starting database migration for game statistics...\n');
    
    // Run migration
    const migrationSuccess = addGameStatsToUsers();
    
    if (migrationSuccess) {
        console.log('\n' + '='.repeat(50));
        
        // Create test user
        const userId = createTestUser();
        
        if (userId) {
            console.log('\n🎯 Development setup complete!');
            console.log('   You can now:');
            console.log('   1. Use dev@test.com as test user');
            console.log('   2. Test game statistics features');
            console.log('   3. Query user stats from the database');
        }
    } else {
        console.log('\n❌ Migration failed. Please check the errors above.');
        process.exit(1);
    }
}