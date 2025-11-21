const fp = require('fastify-plugin');

async function swagger(fastify, options) {
    // Register Swagger
    await fastify.register(require('@fastify/swagger'), {
        openapi: {
            openapi: '3.0.0',
            info: {
                title: 'ft_transendance_42 Authentication API',
                description: 'Secure authentication microservice with JWT, CSRF protection, and rate limiting',
                version: '1.0.0',
                contact: {
                    name: 'ft_transendance_42 Team',
                    email: 'team@ft_transendance_42.com'
                },
                license: {
                    name: 'MIT',
                    url: 'https://opensource.org/licenses/MIT'
                }
            },
            servers: [
                // Note: BACKEND_URL should point to this service base URL
                { url: process.env.BACKEND_URL || 'http://localhost:8005', description: 'Service base URL' }
            ],
            tags: [
                {
                    name: 'Authentication',
                    description: 'User authentication endpoints including login, register, refresh, and logout'
                },
                {
                    name: 'Two-Factor',
                    description: '2FA setup, verification, and management endpoints'
                },
                {
                    name: 'Security',
                    description: 'CSRF and security endpoints'
                },
                {
                    name: 'User Management',
                    description: 'User profile and management endpoints'
                },
                {
                    name: 'OAuth',
                    description: 'Google OAuth 2.0 authentication endpoints'
                }
            ],
            components: {
                securitySchemes: {
                    Bearer: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                        description: 'JWT Bearer token for authentication'
                    },
                    CSRF: {
                        type: 'apiKey',
                        name: 'X-CSRF-Token',
                        in: 'header',
                        description: 'CSRF token for state-changing requests'
                    }
                }
            }
        }
    });

    // Register Swagger UI
    await fastify.register(require('@fastify/swagger-ui'), {
        routePrefix: '/documentation',
        uiConfig: {
            docExpansion: 'full',
            deepLinking: true
        },
        uiHooks: {
            onRequest: function (request, reply, next) {
                next();
            },
            preHandler: function (request, reply, next) {
                next();
            }
        },
        staticCSP: true,
        transformStaticCSP: (header) => header,
        transformSpecification: (swaggerObject, request, reply) => {
            return swaggerObject;
        }
    });

    // Add route for raw OpenAPI spec
    fastify.get('/api-docs', async (request, reply) => {
        return fastify.swagger();
    });
}

module.exports = fp(swagger);

