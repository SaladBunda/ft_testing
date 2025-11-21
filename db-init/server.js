const fastify = require('fastify')({ logger: true });
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { initializeDatabase } = require('./utils/schema');
const { initializeChatSchema } = require('./utils/chatSchema');
const { runMigrations } = require('./utils/migrations');
const config = require('./config');


// Simple config
const PORT = config.PORT;
const DATABASE_PATH = config.DATABASE_PATH || '/usr/src/app/db/shared.sqlite';
const DATABASE_DIR = '/usr/src/app/db';

let db = null;
let isDatabaseReady = false;

// Initialize database
const initDatabase = async () => {
    try {
        console.log('🚀 Starting Database Service...');
        
        // Create directory
        if (!fs.existsSync(DATABASE_DIR)) {
            fs.mkdirSync(DATABASE_DIR, { recursive: true });
        }
        
        // Connect to database
        db = new sqlite3.Database(DATABASE_PATH);
        console.log(`🔗 Connected to: ${DATABASE_PATH}`);
        
        // Initialize schema
        await initializeDatabase(db);
        await initializeChatSchema(db);

        // Run migrations
        await runMigrations(db);
        
        isDatabaseReady = true;
        console.log('✅ Database ready');
        
    } catch (error) {
        console.error('❌ Database init failed:', error);
        process.exit(1);
    }
};

// Health check
fastify.get('/health', async (request, reply) => {
    if (!isDatabaseReady) {
        return reply.code(503).send({ status: 'not_ready' });
    }
    
    try {
        await new Promise((resolve, reject) => {
            db.get('SELECT 1 as test', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        return reply.send({ status: 'healthy', ready: true });
    } catch (error) {
        return reply.code(503).send({ status: 'unhealthy', error: error.message });
    }
});

// Status endpoint
fastify.get('/status', async (request, reply) => {
    if (!isDatabaseReady) {
        return reply.code(503).send({ status: 'initializing' });
    }
    
    try {
        const tables = await new Promise((resolve, reject) => {
            db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => row.name));
            });
        });
        
        return reply.send({
            status: 'ready',
            database_path: DATABASE_PATH,
            tables: tables
        });
    } catch (error) {
        return reply.code(500).send({ status: 'error', error: error.message });
    }
});

// Graceful shutdown
const shutdown = () => {
    console.log('🛑 Shutting down...');
    if (db) {
        db.close();
    }
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start
const start = async () => {
    await initDatabase();
    
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    
    console.log(`🚀 Database Service running on port ${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/health`);
};

start();