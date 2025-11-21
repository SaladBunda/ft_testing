const { generateSecret, toDataURL, verifyTOTP } = require('../utils/twofa');
const { verifyPassword } = require('../utils/hash');

module.exports = async function (fastify) {
    fastify.post('/2fa/setup-start',
    {
        preHandler: [fastify.authenticate],
        schema: {
            description: 'Start 2FA setup process. Generates a secret and QR code for authenticator app setup.',
            tags: ['Two-Factor'],
            summary: 'Start 2FA Setup',
            security: [
                {
                    Bearer: [],
                    CSRF: []
                }
            ],
            response: {
                200: { 
                    description: '2FA setup initiated successfully',
                    type: 'object', 
                    properties: { 
                        qrCode: { 
                            type: 'string',
                            description: 'Base64 encoded QR code image for authenticator app',
                            example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
                        } 
                    }, 
                    required: ['qrCode'] 
                },
                400: { 
                    description: 'User not found or 2FA already enabled',
                    type: 'object', 
                    properties: { 
                        error: { 
                            type: 'string',
                            description: 'Error message',
                            example: '2FA already enabled'
                        } 
                    }, 
                    required: ['error'] 
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
        }
    },
    async (req, reply) => {
        const userId = req.user.sub;
        
        const user = await new Promise((resolve, reject) => {
            fastify.db.get(
                `SELECT email, twofa_enabled FROM users WHERE id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });
        
        if (!user) { return reply.code(400).send({ error: 'User not found' }); }
        
        if (user.twofa_enabled) {
            return reply.code(400).send({ error: '2FA already enabled' });
        }
        
        const secret = generateSecret(user.email);
        
        await new Promise((res, rej) => {
            fastify.db.run(
                `UPDATE users
                SET twofa_secret = ?, twofa_enabled = 0, twofa_confirmed = 0
                WHERE id = ?`,
                [secret.base32, userId],
                (err) => {
                    if (err) rej(err);
                    res();
                }
            );
        });
        
        const qrCode = await toDataURL(secret.otpauth_url);
        return reply.code(200).send({ qrCode });
    });
    
    fastify.post('/2fa/setup-verify', {
        preHandler: [fastify.authenticate],
        config: {
            rateLimit: {
                max: 5,
                timeWindow: '1m'
            }
        },
        schema: {
            description: 'Verify 2FA token and enable 2FA for the current user. Requires valid 6-digit TOTP token.',
            tags: ['Two-Factor'],
            summary: 'Verify and Enable 2FA',
            security: [
                {
                    Bearer: [],
                    CSRF: []
                }
            ],
            body: { $ref: 'TwoFATokenBody#' },
            response: {
                200: { 
                    description: '2FA enabled successfully',
                    type: 'object', 
                    properties: { 
                        message: { 
                            type: 'string',
                            description: 'Success message',
                            example: '2FA enabled'
                        } 
                    }, 
                    required: ['message'] 
                },
                400: { 
                    description: '2FA not setup or invalid request',
                    type: 'object', 
                    properties: { 
                        error: { 
                            type: 'string',
                            description: 'Error message',
                            example: '2FA not setup'
                        } 
                    }, 
                    required: ['error'] 
                },
                401: { 
                    description: 'Invalid token or unauthorized',
                    type: 'object', 
                    properties: { 
                        error: { 
                            type: 'string',
                            description: 'Error message',
                            example: 'Invalid token'
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
        }
    }, async (req, reply) => {
        const userId = req.user.sub;
        const token = req.body.token;
        
        const row = await new Promise((resolve, reject) => {
            fastify.db.get(
                `SELECT twofa_secret FROM users WHERE id = ?`,
                [userId],
                (err, r) => {
                    if (err) reject(err);
                    resolve(r);
                }
            );
        });
        
        if (!row || !row.twofa_secret) {
            return reply.code(400).send({ error: '2FA not setup' });
        }
        
        const ok = verifyTOTP({ secret: row.twofa_secret, token });
        if (!ok) return reply.code(401).send({ error: 'Invalid token' });
        
        await new Promise((res, rej) => {
            fastify.db.run(
                `UPDATE users SET twofa_enabled = 1, twofa_confirmed = 1 WHERE id = ?`,
                [userId],
                (err) => {
                    if (err) rej(err);
                    res();
                }
            );
        });
        
        return reply.code(200).send({ message: '2FA enabled' });
    });

    // Disable 2FA (requires current password)
    fastify.post('/2fa/disable', {
        preHandler: [fastify.authenticate],
        config: {
            rateLimit: { max: 5, timeWindow: '1m' }
        },
        schema: {
            description: 'Disable 2FA for the current user. Requires current password for security.',
            tags: ['Two-Factor'],
            summary: 'Disable 2FA',
            security: [
                {
                    Bearer: [],
                    CSRF: []
                }
            ],
            body: { $ref: 'TwoFADisableBody#' },
            response: {
                200: { 
                    description: '2FA disabled successfully',
                    type: 'object', 
                    properties: { 
                        message: { 
                            type: 'string',
                            description: 'Success message',
                            example: '2FA disabled'
                        } 
                    }, 
                    required: ['message'] 
                },
                400: { 
                    description: 'User not found or 2FA not enabled',
                    type: 'object', 
                    properties: { 
                        error: { 
                            type: 'string',
                            description: 'Error message',
                            example: '2FA is not enabled'
                        } 
                    }, 
                    required: ['error'] 
                },
                401: { 
                    description: 'Invalid password or unauthorized',
                    type: 'object', 
                    properties: { 
                        error: { 
                            type: 'string',
                            description: 'Error message',
                            example: 'Invalid password'
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
        }
    }, async (req, reply) => {
        const userId = req.user.sub;
        const { password } = req.body || {};

        const row = await new Promise((resolve, reject) => {
            fastify.db.get(
                'SELECT password_hash, twofa_enabled FROM users WHERE id = ?',
                [userId],
                (err, r) => err ? reject(err) : resolve(r)
            );
        });

        if (!row) return reply.code(400).send({ error: 'User not found' });
        if (!row.twofa_enabled) return reply.code(400).send({ error: '2FA is not enabled' });

        const ok = await verifyPassword(password, row.password_hash);
        if (!ok) return reply.code(401).send({ error: 'Invalid password' });

        await new Promise((res, rej) => {
            fastify.db.run(
                'UPDATE users SET twofa_enabled = 0, twofa_confirmed = 0, twofa_secret = NULL WHERE id = ?',
                [userId],
                (err) => err ? rej(err) : res()
            );
        });

        return reply.code(200).send({ message: '2FA disabled' });
    });

    // Check 2FA status for current user
    fastify.get('/2fa/status', {
        preHandler: [fastify.authenticate],
        schema: {
            description: 'Check whether 2FA is enabled for the current user',
            tags: ['Two-Factor'],
            summary: 'Check 2FA Status',
            security: [
                {
                    Bearer: [],
                    CSRF: []
                }
            ],
            response: {
                200: {
                    description: '2FA status retrieved successfully',
                    type: 'object',
                    properties: { 
                        enabled: { 
                            type: 'boolean',
                            description: 'Whether 2FA is enabled for the user',
                            example: true
                        } 
                    },
                    required: ['enabled']
                },
                400: {
                    description: 'User not found',
                    type: 'object',
                    properties: { 
                        error: { 
                            type: 'string',
                            description: 'Error message',
                            example: 'User not found'
                        } 
                    },
                    required: ['error']
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
        }
    }, async (req, reply) => {
        const userId = req.user.sub;

        const row = await new Promise((resolve, reject) => {
            fastify.db.get(
                'SELECT twofa_enabled FROM users WHERE id = ?',
                [userId],
                (err, r) => err ? reject(err) : resolve(r)
            );
        });

        if (!row) {
            return reply.code(400).send({ error: 'User not found' });
        }

        return reply.code(200).send({ enabled: !!row.twofa_enabled });
    });
};