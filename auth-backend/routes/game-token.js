module.exports = async function (fastify) {
    fastify.get('/game-token', {
        schema: {
            description: 'Get access token for game authentication',
            tags: ['Game Integration'],
            summary: 'Get Game Token',
            response: {
                200: {
                    description: 'Token retrieved successfully',
                    type: 'object',
                    properties: {
                        token: {
                            type: 'string',
                            description: 'JWT access token for game authentication'
                        },
                        user: {
                            type: 'object',
                            description: 'User information',
                            properties: {
                                id: { type: 'integer' },
                                username: { type: 'string' },
                                name: { type: 'string' }
                            }
                        }
                    },
                    required: ['token', 'user']
                },
                401: {
                    description: 'Not authenticated',
                    type: 'object',
                    properties: {
                        error: { type: 'string' }
                    },
                    required: ['error']
                }
            }
        }
    }, async (req, reply) => {
        try {
            // Check if user has valid session
            const user = await req.jwtVerify();
            
            if (!user || !user.sub) {
                return reply.code(401).send({ error: 'Not authenticated' });
            }

            // Get user details from database
            const userDetails = await new Promise((resolve, reject) => {
                fastify.db.get(
                    'SELECT id, username, name, email FROM users WHERE id = ?',
                    [user.sub],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            if (!userDetails) {
                return reply.code(401).send({ error: 'User not found' });
            }

            // Get the access token from cookies
            const accessToken = req.cookies.accessToken;
            
            if (!accessToken) {
                return reply.code(401).send({ error: 'No access token found' });
            }

            // Return the token and user info
            return reply.code(200).send({
                token: accessToken,
                user: {
                    id: userDetails.id,
                    username: userDetails.username,
                    name: userDetails.name,
                    email: userDetails.email
                }
            });

        } catch (error) {
            console.error('Game token error:', error);
            return reply.code(401).send({ error: 'Authentication failed' });
        }
    });
};