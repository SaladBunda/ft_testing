module.exports = async function (fastify) {
    fastify.post('/logout', { 
        schema: {
            description: 'Logout user by invalidating refresh token and clearing JWT cookies',
            tags: ['Authentication'],
            summary: 'User Logout',
            security: [
                {
                    Bearer: [],
                    CSRF: []
                }
            ],
            response: {
                200: {
                    description: 'Logout successful',
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                            description: 'Success message',
                            example: 'Logged out successfully'
                        }
                    },
                    required: ['message']
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
                },
                500: {
                    description: 'Internal server error',
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error message',
                            example: 'Internal server error'
                        }
                    },
                    required: ['error']
                }
            }
        },
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        try {
            const refreshToken = req.cookies.refreshToken;
            
            if (refreshToken) {
                // Delete the refresh token from database
                const result = await new Promise((resolve, reject) => {
                    fastify.db.run('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken], function(err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes });
                    });
                });
                
                // Optionally log if no tokens were deleted (token might have already expired)
                if (result.changes === 0) {
                    fastify.log.info('No refresh token found to delete during logout');
                }
            }
            
            // Clear the cookies with the same options they were set with
            reply.clearCookie('accessToken', { 
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });
            
            reply.clearCookie('refreshToken', { 
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });
            
            return reply.code(200).send({ message: 'Logged out successfully' });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
};
