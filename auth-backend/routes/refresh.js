const config = require('../config');

module.exports = async function (fastify) {
    fastify.post('/refresh', {
        schema: {
            description: 'Refresh JWT access token using valid refresh token from cookies',
            tags: ['Authentication'],
            summary: 'Refresh Access Token',
            response: {
                200: {
                    description: 'Token refreshed successfully, new tokens set as HTTP-only cookies',
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                            description: 'Success message',
                            example: 'Token refreshed successfully'
                        }
                    },
                    required: ['message']
                },
                400: {
                    description: 'Missing refresh token',
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error message',
                            example: 'Refresh token is required'
                        }
                    },
                    required: ['error']
                },
                401: {
                    description: 'Invalid or expired refresh token',
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error message',
                            example: 'Invalid or expired refresh token'
                        }
                    },
                    required: ['error']
                }
            }
        }
    }, async (req, reply) => {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return reply.code(400).send({ error: 'Refresh token is required' });
        }
        
        try {
            const decoded = fastify.jwt.verify(refreshToken);
            if (!decoded) {
                return reply.code(401).send({ error: 'Invalid refresh token' });
            }
        } catch (err) {
            return reply.code(401).send({ error: 'Invalid refresh token' });
        }
        
        // Check if the refresh token exists in the database and is not expired
        const tokenRecord = await new Promise((resolve, reject) => {
            fastify.db.get('SELECT user_id FROM refresh_tokens WHERE token = ? AND expires_at > ?', [refreshToken, Math.floor(Date.now() / 1000)], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!tokenRecord) {
            await new Promise((resolve, reject) => {
                fastify.db.run('DELETE FROM refresh_tokens WHERE expires_at <= ?', [Math.floor(Date.now() / 1000)], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            return reply.code(401).send({ error: 'Invalid or expired refresh token' });
        }
        
        const user = await new Promise((resolve, reject) => {
            fastify.db.get('SELECT id FROM users WHERE id = ?', [tokenRecord.user_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!user) {
            return reply.code(401).send({ error: 'Invalid refresh token' });
        }
        
        const newAccessToken = fastify.jwt.sign({ sub: user.id }, { expiresIn: config.JWT_ACCESS_EXPIRES_IN });
        
        const newRefreshToken = fastify.jwt.sign({ sub: user.id }, { expiresIn: config.JWT_REFRESH_EXPIRES_IN });
        
        await new Promise((resolve, reject) => {
            fastify.db.run('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        const expiresAt = Math.floor(Date.now() / 1000) + (parseInt(config.JWT_REFRESH_EXPIRES_IN) || 7 * 24 * 60 * 60);
        await new Promise((resolve, reject) => {
            fastify.db.run('INSERT INTO refresh_tokens(user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, newRefreshToken, expiresAt], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        reply.setCookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: config.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: parseInt(config.JWT_ACCESS_EXPIRES_IN) || 15 * 60,
            path: '/'
        });
        
        reply.setCookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: config.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: parseInt(config.JWT_REFRESH_EXPIRES_IN) || 7 * 24 * 60 * 60,
            path: '/'
        });
        
        return reply.code(200).send({ message: 'Token refreshed successfully' });
    });
};
