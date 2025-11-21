module.exports = {
    PORT: process.env.DB_INIT_PORT || 3000,
    DATABASE_PATH: process.env.DATABASE_PATH || '/usr/src/app/db/shared.sqlite',
    DATABASE_DIR: process.env.DATABASE_DIR || '/usr/src/app/db',
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // Database settings
    DB_TIMEOUT: parseInt(process.env.DB_TIMEOUT) || 30000,
    MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 5,
    
    // Service discovery
    SERVICE_NAME: 'db-init',
    SERVICE_VERSION: '1.0.0'
};