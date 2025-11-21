const fp = require('fastify-plugin');

async function swaggerPlugin(fastify) {
    const config = require('../config');
    
    // Register Swagger
    await fastify.register(require('@fastify/swagger'), {
        openapi: {
            openapi: '3.0.0',
            info: {
                title: 'User Management Service',
                description: 'Microservice for user profiles and relationships',
                version: config.SERVICE_VERSION
            },
            servers: [
                {
                    url: `http://localhost:${config.USR_MANAG_PORT}`,
                    description: 'Development server'
                }
            ],
			components: {
				securitySchemes: {
					bearerAuth: {
						type: 'http',
						scheme: 'bearer',
						bearerFormat: 'JWT'
					}
				},
				schemas: {
					User: {
						type: 'object',
						properties: {
							id: { type: 'integer' },
							username: { type: 'string', nullable: true },
							first_name: { type: 'string', nullable: true },
							last_name: { type: 'string', nullable: true },
							profile_pic: { type: 'string', nullable: true },
							is_online: { type: 'integer', enum: [0, 1] },
							created_at: { type: 'string' },
							updated_at: { type: 'string' }
						}
					}
				}
			},
            tags: [
				{ name: 'Users', description: 'User directory, search, and relationships (friend, block)' },
				{ name: 'Profile', description: 'Current user profile management (me, status, completion)' },
                { name: 'System', description: 'Service health and metadata' }
            ],
            security: [{ bearerAuth: [] }]
        }
    });

    // Register Swagger UI
    await fastify.register(require('@fastify/swagger-ui'), {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'full',
            deepLinking: false
		},
		// Transform the generated spec to ensure routes and tags are exposed nicely
		transformSpecification: (swaggerObject) => swaggerObject
    });
    
    console.log('Swagger plugin registered');
}

module.exports = fp(swaggerPlugin);
