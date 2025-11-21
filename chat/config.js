export default {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.CHAT_PORT || 8006,
    SERVICE_NAME: process.env.SERVICE_NAME || 'chat',
    SERVICE_VERSION: '1.0.0',
    DATABASE_PATH: process.env.DATABASE_PATH || '/usr/src/app/db/shared.sqlite',
    METRICS_ALLOW_CIDRS: process.env.METRICS_ALLOW_CIDRS || '172.16.0.0/12',
    METRICS_DENY_IPS: process.env.METRICS_DENY_IPS || '127.0.0.1,::1',
    METRICS_GATEWAY_IP: process.env.METRICS_GATEWAY_IP || '172.16.0.1',
};
