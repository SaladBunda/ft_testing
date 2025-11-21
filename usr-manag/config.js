module.exports = {
    NODE_ENV: process.env.NODE_ENV,
    USR_MANAG_PORT: process.env.USR_MANAG_PORT || 4000,
    SERVICE_NAME: process.env.TARGET_2 || 'usr-manag',
    AUTH_BACKEND_URL: process.env.AUTH_BACKEND_URL || 'http://localhost:8005',
    DATABASE_PATH: process.env.DATABASE_PATH || './db/sqlite.db',
    
    // CORS settings
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:8080',
    
    // Service discovery
    SERVICE_NAME: 'usr-manag',
    SERVICE_VERSION: '1.0.0',
    
    INTERNAL_SERVICE_KEY: process.env.INTERNAL_SERVICE_KEY,

    JWT_SECRET: process.env.JWT_SECRET,
};
