const { hashPassword } = require('../utils/hash');
const { validatePassword } = require('../utils/passwordPolicy');
const config = require('../config');
const { transporter } = require('../utils/email');
const crypto = require('crypto');

module.exports = async function (fastify) {
    fastify.post(
        '/register',
        {
            schema: {
                description: 'Register a new user account with email and password',
                tags: ['Authentication'],
                summary: 'User Registration',
                body: { $ref: 'AuthRegisterBody#' },
                response: {
                    201: {
                        description: 'User registered successfully',
                        type: 'object', 
                        properties: { 
                            message: { 
                                type: 'string',
                                description: 'Success message',
                                example: 'Account created successfully, Login to continue'
                            } 
                        }, 
                        required: ['message'] 
                    },
                    400: {
                        description: 'Validation error or missing fields',
                        type: 'object', 
                        properties: { 
                            error: { 
                                type: 'string',
                                description: 'Error message',
                                example: 'Email and password are required'
                            },
                            details: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Detailed validation errors',
                                example: ['Password must be at least 12 characters long']
                            }
                        }, 
                        required: ['error'] 
                    },
                    403: {
                        description: 'User registered successfully, but email is not verified',
                        type: 'object',
                        properties: {
                            message: {
                                type: 'string',
                                description: 'Success message',
                                example: 'Account created successfully, but email is not verified'
                            }
                        },
                        required: ['message']
                    },
                    409: { 
                        description: 'User already exists',
                        type: 'object', 
                        properties: { 
                            message: { 
                                type: 'string',
                                description: 'Conflict message',
                                example: 'User already exists'
                            } 
                        }, 
                        required: ['message'] 
                    },
                    500: {
                        description: 'Internal server error',
                        type: 'object',
                        properties: {
                            error: {
                                type: 'string',
                                description: 'Error message',
                                example: 'Failed to create account'
                            }
                        },
                        required: ['error']
                    }
                }
            },
            preValidation: async (request, reply) => {
                const { password, email } = request.body || {};
                
                if (password) {
                    const validation = validatePassword(password, email);
                    if (!validation.isValid) {
                        return reply.code(400).send({
                            error: validation.errors[0], // Show first error
                            details: validation.errors // Include all errors for reference
                        });
                    }
                }
            }
        }, 
        async (req, reply) => {
            const { email, password } = req.body || {};
            if (!email || !password) {
                return reply.code(400).send({ error: 'Email and password are required' });
            }

            // Check if user exists
            const existing = await new Promise((resolve, reject) => {
                fastify.db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (existing) return reply.code(409).send({ error: 'User already exists', message: 'User already exists' });

            const password_hash = await hashPassword(password);
            
            // Insert new user
            const info = await new Promise((resolve, reject) => {
                fastify.db.run('INSERT INTO users(email, password_hash) VALUES (?, ?)', [email, password_hash], function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes, lastID: this.lastID });
                });
            });

            if (info.changes > 0) {
                const userId = info.lastID;
                const emailVerificationToken = crypto.randomBytes(32).toString('hex');
                const emailVerificationTokenExpiresAt = Math.floor(Date.now() / 1000) + 3600;
                await new Promise((resolve, reject) => {
                    fastify.db.run(
                        'INSERT INTO email_verification_tokens(token, user_id, expires_at) VALUES (?, ?, ?)',
                        [emailVerificationToken, userId, emailVerificationTokenExpiresAt],
                        function(err) { if (err) reject(err); else resolve(); }
                    );
                });
                
                const link = `${config.BACKEND_URL}/api/auth/verify-email/confirm?token=${emailVerificationToken}`;
                try {
                    await fastify.trackExternal('smtp', () => transporter.sendMail({
                        from: config.EMAIL_FROM,
                        to: email,
                        subject: 'Verify your email',
                        text: `Click the link to verify your email: ${link}`,
                        html: `<p>Click the link to verify your email: <a href="${link}">${link}</a></p>`
                    }));
                } catch (_e) { /* ignore send errors to not leak info */ }

                return reply.code(201).send({ message: 'Account created successfully. Please verify your email.' });
            }
            return reply.code(500).send({ error: "Failed to create account" });
        }
    );
};
