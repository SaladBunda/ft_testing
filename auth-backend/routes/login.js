const { verifyPassword } = require('../utils/hash');
const config = require('../config');

module.exports = async function (fastify) {
    fastify.post('/login', {
        schema: {
            description: 'Authenticate user with email and password, returns user info and sets JWT cookies',
            tags: ['Authentication'],
            summary: 'User Login',
            body: { $ref: 'AuthLoginBody#' },
            response: {
                200: { 
                    description: 'Login successful, or requires 2FA step',
                    type: 'object', 
                    properties: { 
                        user: {
                            type: 'object',
                            description: 'User information',
                            properties: {
                                id: { 
                                    type: 'integer',
                                    description: 'User ID',
                                    example: 27
                                },
                                email: { 
                                    type: 'string',
                                    description: 'User email address',
                                    example: 'user@example.com'
                                }
                            },
                            required: ['id', 'email']
                        },
                        requires2FA: {
                            type: 'boolean',
                            description: 'Indicates that a second factor is required to complete login'
                        },
                        expiresIn: { 
                            type: 'integer',
                            description: 'Access token expiration time in seconds',
                            example: 900
                        },
                        tokenType: { 
                            type: 'string',
                            description: 'Token type for authorization header',
                            example: 'Bearer'
                        }
                    },
                    required: ['expiresIn', 'tokenType'] 
                },
                301: {
                    description: 'Login successful, but email is not verified',
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                            description: 'Success message',
                            example: 'Login successful, but email is not verified'
                        }
                    },
                    required: ['message']
                },
                400: { 
                    description: 'Missing required fields',
                    type: 'object', 
                    properties: { 
                        error: { 
                            type: 'string',
                            description: 'Error message',
                            example: 'Email and password are required'
                        } 
                    }, 
                    required: ['error'] 
                },
                401: {
                    description: 'Invalid credentials or account locked',
                    type: 'object', 
                    properties: { 
                        error: { 
                            type: 'string',
                            description: 'Error message',
                            example: 'Wrong email or password'
                        },
                        remainingAttempts: {
                            type: 'integer',
                            description: 'Number of login attempts remaining before lockout',
                            example: 2
                        }
                    }, 
                    required: ['error'] 
                },
                403: {
                    description: '2FA setup required before logging in',
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error message',
                            example: 'Finish 2FA enrollment before logging in.'
                        },
                        requires2FASetup: {
                            type: 'boolean',
                            description: 'Indicates that 2FA setup must be completed'
                        }
                    },
                    required: ['error']
                },
                423: {
                    description: 'Account temporarily locked due to too many failed attempts',
                    type: 'object', 
                    properties: { 
                        error: { 
                            type: 'string',
                            description: 'Lockout message',
                            example: 'Account is temporarily locked due to too many failed attempts'
                        }, 
                        lockedUntil: { 
                            type: 'string',
                            description: 'ISO timestamp when account will be unlocked',
                            example: '2024-01-01T12:00:00.000Z'
                        } 
                    }, 
                    required: ['error', 'lockedUntil'] 
                }
            }
        }
    }, async (req, reply) => {
        const { email, password } = req.body || {};
        if (!email || !password) return reply.code(400).send({ error: 'Email and password are required' });

        // const isLocked = await fastify.accountLockout.isLocked(email);
        // if (isLocked) {
        //     const status = await fastify.accountLockout.getLockoutStatus(email);
        //     return reply.code(423).send({
        //         error: 'Account is temporarily locked due to too many failed attempts',
        //         lockedUntil: status.lockedUntil
        //     })
        // }

        const user = await new Promise((resolve, reject) => {
            fastify.db.get('SELECT id, password_hash, twofa_enabled, twofa_confirmed, is_verified FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Note: 2FA handling occurs after password verification below

        if (!user) {
            const lockoutResult = await fastify.accountLockout.recordFailedAttempt(email);
            // if (lockoutResult.isLocked) {
            //     return reply.code(423).send({
            //         error: 'Account is temporarily locked due to too many failed attempts',
            //         lockedUntil: lockoutResult.lockedUntil,
            //     });
            // }
            
            return reply.code(401).send({
                error: 'Wrong email or password',
                remainingAttempts: lockoutResult.remainingAttempts
            });
        };

        if (!user.is_verified) {
            return reply.code(403).send({
                error: 'Email not verified',
                requiresEmailVerification: true
            });
        }

        const isPasswordValid = await verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
            const lockoutResult = await fastify.accountLockout.recordFailedAttempt(email);
            // if (lockoutResult.isLocked) {
            //     return reply.code(423).send({
            //         error: 'Account is temporarily locked due to too many failed attempts',
            //         lockedUntil: lockoutResult.lockedUntil
            //     });
            // }
            
            return reply.code(401).send({
                error: 'Wrong email or password',
                remainingAttempts: lockoutResult.remainingAttempts
            });
        }
        
        await fastify.accountLockout.resetLockout(email);

        // Block login for unverified accounts after password validation

        // Fully protected account → need TOTP step
        if (user.twofa_enabled && user.twofa_confirmed) {
            const pre2faExpiresIn = 5 * 60; // 5 minutes
            const pre2faToken = fastify.jwt.sign({ sub: user.id, scope: 'needs_2fa' }, { expiresIn: pre2faExpiresIn });

            reply.setCookie('pre2faToken', pre2faToken, {
                httpOnly: true,
                secure: config.NODE_ENV === 'production',
                sameSite: 'lax',  // Changed from 'strict' to 'lax' for better compatibility
                maxAge: pre2faExpiresIn,
                path: '/'
            });

            return reply.code(200).send({
                requires2FA: true,
                expiresIn: pre2faExpiresIn,
                tokenType: 'Bearer'
            });
        }

        // 2FA is required but user never finished setup
        if (user.twofa_enabled && !user.twofa_confirmed) {
            return reply.code(403).send({ requires2FASetup: true, error: 'Finish 2FA enrollment before logging in.' });
        }

        const accessToken = fastify.jwt.sign({ sub: user.id }, { expiresIn: config.JWT_ACCESS_EXPIRES_IN });
        const refreshToken = fastify.jwt.sign({ sub: user.id }, { expiresIn: config.JWT_REFRESH_EXPIRES_IN });
        
        // Calculate expiration time for refresh token
        const refreshExpirySeconds = config.JWT_REFRESH_EXPIRES_IN ? 
            (parseInt(config.JWT_REFRESH_EXPIRES_IN) * 24 * 60 * 60) : 
            (7 * 24 * 60 * 60); // Default to 7 days in seconds
        const expiresAt = Math.floor(Date.now() / 1000) + refreshExpirySeconds;

        await new Promise((resolve, reject) => {
            fastify.db.run('INSERT INTO refresh_tokens(user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, refreshToken, expiresAt], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Set cookies with secure options
        const accessTokenExpiry = config.JWT_ACCESS_EXPIRES_IN ? 
            (parseInt(config.JWT_ACCESS_EXPIRES_IN) * 60) : 
            (15 * 60); // Default to 15 minutes in seconds
        
        reply.setCookie('accessToken', accessToken, {
            httpOnly: true,
            secure: config.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: accessTokenExpiry,
            path: '/'
        });
        
        const refreshTokenExpiry = config.JWT_REFRESH_EXPIRES_IN ? 
            (parseInt(config.JWT_REFRESH_EXPIRES_IN) * 24 * 60 * 60) : 
            (7 * 24 * 60 * 60); // Default to 7 days in seconds
        
        reply.setCookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: config.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: refreshTokenExpiry,
            path: '/'
        });
        
        return reply.code(200).send({ 
            user: {
                id: user.id,
                email: email
            },
            expiresIn: 900,
            tokenType: "Bearer"
        });
    });
    
    fastify.post('/login/2fa', {
        config: {
            rateLimit: {
                max: 5,
                timeWindow: '1m'
            }
        },
        schema: {
            description: 'Complete login process with 2FA token. Requires valid pre-2FA token from initial login.',
            tags: ['Two-Factor'],
            summary: 'Complete Login with 2FA',
            body: { $ref: 'TwoFATokenBody#' },
            response: {
                200: {
                    description: 'Login completed successfully with 2FA',
                    type: 'object',
                    properties: {
                        user: {
                            type: 'object',
                            description: 'User information',
                            properties: {
                                id: { 
                                    type: 'integer',
                                    description: 'User ID',
                                    example: 27
                                },
                                email: { 
                                    type: 'string',
                                    description: 'User email address',
                                    example: 'user@example.com'
                                }
                            },
                            required: ['id', 'email']
                        },
                        expiresIn: { 
                            type: 'integer',
                            description: 'Access token expiration time in seconds',
                            example: 900
                        },
                        tokenType: { 
                            type: 'string',
                            description: 'Token type for authorization header',
                            example: 'Bearer'
                        }
                    },
                    required: ['user', 'expiresIn', 'tokenType']
                },
                400: {
                    description: '2FA not enabled or invalid request',
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error message',
                            example: '2FA not enabled'
                        }
                    },
                    required: ['error']
                },
                401: {
                    description: 'Invalid or expired token, or missing pre-2FA token',
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error message',
                            example: 'Invalid or expired token'
                        }
                    },
                    required: ['error']
                }
            }
        }
    }, async (req, reply) => {
        try {
            const pre2fa = req.cookies.pre2faToken;
            if (!pre2fa) return reply.code(401).send({ error: 'Pre-2FA token not found' });
            
            const payload = fastify.jwt.verify(pre2fa);
            if (payload.scope !== 'needs_2fa') return reply.code(401).send({ error: 'Invalid pre2FA scope' });
            
            const userId = payload.sub;
            const { token } = req.body;
            
            const row = await new Promise((resolve, reject) => {
                fastify.db.get('SELECT email, twofa_secret, is_verified FROM users WHERE id = ?' , [userId],
                (err, r) => err ? reject(err) : resolve(r));
            });
            
            console.log('🔐 [Login Debug] Row:', row);
            
            if (!row?.is_verified) {
                return reply.code(403).send({
                    error: 'Email not verified',
                    requiresEmailVerification: true
                });
            }
            
            if (!row || !row.twofa_secret) return reply.code(400).send({ error: '2FA not enabled '});
            
            const { verifyTOTP } = require('../utils/twofa');
            const ok = verifyTOTP({ secret: row.twofa_secret, token });
            if (!ok) return reply.code(401).send({ error: 'Invalid or expired token' });
            
            const config = require('../config');
            const accessToken = fastify.jwt.sign({ sub: userId }, { expiresIn: config.JWT_ACCESS_EXPIRES_IN });
            const refreshToken = fastify.jwt.sign({ sub: userId }, { expiresIn: config.JWT_REFRESH_EXPIRES_IN });
            
            const refreshExpirySeconds = config.JWT_REFRESH_EXPIRES_IN ?
                (parseInt(config.JWT_REFRESH_EXPIRES_IN) * 24 * 60 * 60) :
                (7 * 24 * 60 * 60); // Default to 7 days in seconds
            const expiresAt = Math.floor(Date.now() / 1000) + refreshExpirySeconds;
            
            await new Promise((res, rej) => {
                fastify.db.run('INSERT INTO refresh_tokens(user_id, token, expires_at) VALUES (?, ?, ?)', 
                [userId, refreshToken, expiresAt], 
                (err) => err ? rej(err) : res());
            });
            
            const accessTokenExpiry = config.JWT_ACCESS_EXPIRES_IN ? 
                (parseInt(config.JWT_ACCESS_EXPIRES_IN) * 60) : 
                (15 * 60); // Default to 15 minutes in seconds
            return reply
            .clearCookie('pre2faToken', { path: '/' })
            .setCookie('accessToken', accessToken, { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'strict', maxAge: accessTokenExpiry, path: '/' })
            .setCookie('refreshToken', refreshToken, { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'strict', maxAge: refreshExpirySeconds, path: '/' })
            .code(200)
            .send({
                user: {
                    id: userId,
                    email: row.email
                },
                expiresIn: accessTokenExpiry,
                tokenType: "Bearer"
            });
        } catch (e) {
            return reply.code(401).send({ error: 'Invalid token' });
        }
    });
};
