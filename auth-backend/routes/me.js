
module.exports = async function (fastify) {
    fastify.get('/me', { 
        schema: {
            description: 'Get current authenticated user information',
            tags: ['User Management'],
            summary: 'Get Current User',
            security: [
                {
                    Bearer: [],
                    CSRF: []
                }
            ],
            response: {
                200: {
                    description: 'Current user information retrieved successfully',
                    type: 'object',
                    properties: {
                        userId: {
                            type: 'integer',
                            description: 'User ID from JWT token',
                            example: 27
                        }
                    },
                    required: ['userId']
                },
                401: {
                    description: 'Unauthorized - Invalid or missing JWT token',
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error message',
                            example: 'Unauthorized'
                        }
                    },
                    required: ['error']
                },
                403: {
                    description: 'Forbidden - CSRF token missing or invalid',
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error message',
                            example: 'CSRF token missing or invalid'
                        }
                    },
                    required: ['error']
                }
            }
        }, preHandler: [fastify.authenticate] 
    }, async (req) => {
        return { userId: req.user.sub };
    });
};
