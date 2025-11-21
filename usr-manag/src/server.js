const fastify = require('fastify')({ logger: true });
const config = require('../config');
// Define allowed origins (single FRONTEND_URL or comma-separated FRONTEND_URLS)

const allowedOrigins = config.FRONTEND_URL;

console.log('allowedOrigins ::::::', allowedOrigins);

fastify.setErrorHandler(function (err, req, reply) {
    // Handle validation errors with custom messages
    if (err.validation) {
        const messages = err.validation.map(validationErr => {
            if (validationErr.keyword === 'required') {
                return `${validationErr.params.missingProperty} is required`;
            }
            return `${validationErr.instancePath} ${validationErr.message}`;
        });
        
        return reply.code(400).send({
            error: 'Validation failed',
            details: messages
        });
    }
    
    // Preserve the original status code if it exists, otherwise default to 500
    const statusCode = err.statusCode || 500;
    reply.code(statusCode).send({
        error: err.message || 'Internal server error'
    });
});

fastify.register(require('@fastify/cookie'));

// Register plugins
fastify.register(require('@fastify/cors'), {
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        const allowed = allowedOrigins.includes(origin);
        cb(null, allowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    maxAge: 600,
});

fastify.register(require('../plugins/db'));
fastify.register(require('../plugins/auth'));
fastify.register(require('../plugins/swagger'));

// Health check
fastify.get('/health', {
    schema: {
        tags: ['System'],
        summary: 'Health check',
        security: [],
        response: {
            200: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    service: { type: 'string' },
                    version: { type: 'string' },
                    timestamp: { type: 'string' }
                }
            }
        }
    }
}, async (request, reply) => {
    return {
        status: 'ok',
        service: config.SERVICE_NAME,
        version: config.SERVICE_VERSION,
        timestamp: new Date().toISOString()
    };
});

// Service discovery endpoint
fastify.get('/service-info', {
    schema: {
        tags: ['System'],
        summary: 'Service metadata',
        security: [],
        response: {
            200: {
                type: 'object',
                properties: {
                    service: { type: 'string' },
                    version: { type: 'string' },
                    endpoints: { type: 'array', items: { type: 'string' } },
                    dependencies: { type: 'array', items: { type: 'string' } }
                }
            }
        }
    }
}, async (request, reply) => {
    return {
        service: config.SERVICE_NAME,
        version: config.SERVICE_VERSION,
        endpoints: [
            'GET /health',
            'GET /service-info',
            'GET /users',
            'GET /me',
            'GET /users/:id',
            'PATCH /me/status',
            'PATCH /me/profile',
            'DELETE /me',
            'POST /users/:id/friend',
            'POST /users/:id/block',
            'GET /conversations/:id'
        ],
        dependencies: ['auth-backend']
    };
});

// Register routes
fastify.register(require('../routes/users'), { prefix: '' });
fastify.register(require('../routes/chat'), { prefix: '' });
// fastify.register(require('../routes/profile'), { prefix: '' });
fastify.register(require('../plugins/metrics'), { prefix: '/metrics' });
const start = async () => {
    try {
        await fastify.listen({ port: `${config.USR_MANAG_PORT}`, host: '0.0.0.0' });
        fastify.log.info(`User Management Service listening on port ${config.USR_MANAG_PORT}`);
        fastify.log.info(`Auth Service URL: ${config.AUTH_BACKEND_URL}`);
        fastify.log.info(`API Documentation: http://localhost:${config.USR_MANAG_PORT}/docs`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

start();
