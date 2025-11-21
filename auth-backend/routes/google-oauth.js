const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const config = require('../config');

/**
    Route starts the google oauth2.0 login flow
    visiting /google 
        generates a random state for csrf protection
        stores that state in a secure cookie
        bulid google oauth login url
        redirects the user to google consent screen
*/

module.exports = async function (fastify) {
    const client = new OAuth2Client(
        config.GOOGLE_CLIENT_ID,
        config.GOOGLE_CLIENT_SECRET,
        config.GOOGLE_REDIRECT_URI
    );
    
    fastify.get('/google', {
        schema: {
            description: 'Initiate Google OAuth2.0 login flow. Generates CSRF state token and redirects to Google consent screen.',
            tags: ['OAuth'],
            summary: 'Google OAuth Login',
            response: {
                302: {
                    description: 'Redirect to Google OAuth consent screen',
                    headers: {
                        Location: {
                            type: 'string',
                            description: 'Google OAuth authorization URL'
                        },
                        'Set-Cookie': {
                            type: 'string',
                            description: 'Sets oauth_state cookie for CSRF protection'
                        }
                    }
                },
                500: {
                    description: 'Internal server error during OAuth initialization',
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error message',
                            example: 'Failed to initialize OAuth flow'
                        }
                    },
                    required: ['error']
                }
            }
        }
    }, async (req, rep) => {
    
        const state = crypto.randomBytes(16).toString('hex');

        // rep.setCookie('oauth_state', state, {
        //     httpOnly: true,
        //     secure: config.NODE_ENV === 'production',
        //     sameSite: 'strict',
        //     maxAge: 600, // 10 minutes
        //     path: '/'
        // });
        
        rep.setCookie('oauth_state', state, {
            httpOnly: true,
            secure: false,         // only use true in production with https
            sameSite: 'lax',       // strict may break OAuth redirects
            maxAge: 600,
            path: '/'
        });
        
        const authUrl = client.generateAuthUrl({
            access_type: 'offline',
            scope: ['profile', 'email'],
            state: state,
        });
        
        console.log(' ++++++ google stuff ++++++ : authUrl', authUrl);
        
        return rep.redirect(authUrl);
    });
    
    fastify.get('/google/callback', {
        schema: {
            description: 'Handle Google OAuth2.0 callback. Verifies state parameter, exchanges code for tokens, and creates/updates user account.',
            tags: ['OAuth'],
            summary: 'Google OAuth Callback',
            querystring: { $ref: 'OAuthCallbackQuery#' },
            response: {
                302: {
                    description: 'Redirect to frontend with success or error status',
                    headers: {
                        Location: {
                            type: 'string',
                            description: 'Frontend URL with login status'
                        },
                        'Set-Cookie': {
                            type: 'string',
                            description: 'Sets accessToken and refreshToken cookies on success'
                        }
                    }
                },
                400: {
                    description: 'Invalid state parameter or OAuth error',
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error message',
                            example: 'Invalid state parameter'
                        }
                    },
                    required: ['error']
                },
                500: {
                    description: 'Internal server error during OAuth processing',
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error message',
                            example: 'OAuth processing failed'
                        }
                    },
                    required: ['error']
                }
            },
        },
    }, async (req, reply) => {
        const { code, state, error } = req.query;
        
        if (error) {
            console.log('🔐 +++++++++++++++++++ [OAuth Debug] Error:', error);
            return reply.redirect(`${config.FRONTEND_URL}/login?error=oauth_cancelled`);
        }
        
        const storedState = req.cookies.oauth_state;
        if (!state || !storedState || state !== storedState) {
            return reply.code(400).send({ error: 'Invalid state parameter' });
        }
        
        reply.clearCookie('oauth_state', {path: '/'});
        
        try {
            const { tokens } = await fastify.trackExternal('google-oauth', () => client.getToken(code));
            client.setCredentials(tokens);

            const ticket = await fastify.trackExternal('google-oauth', () => client.verifyIdToken({
                idToken: tokens.id_token,
                audience: config.GOOGLE_CLIENT_ID
            }));
            
            const payload = ticket.getPayload();
            
            const googleUser = {
                googleId: payload.sub,
                email: payload.email,
            };
            
            // Check if user exists by email (primary identifier)
            const existingUser = await new Promise((resolve, reject) => {
                fastify.db.get(
                    'SELECT id, email, google_id, password_hash, twofa_enabled, twofa_confirmed, is_verified FROM users WHERE email = ?',
                    [googleUser.email],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                )
            })
            
            
            let userId;

            if (existingUser) {
                // User exists - link Google ID if not already linked
                userId = existingUser.id;
                if (!existingUser.google_id) {
                    await new Promise((resolve, reject) => {
                        fastify.db.run(
                            'UPDATE users SET google_id = ? WHERE id = ?',
                            [googleUser.googleId, userId],
                            (err) => {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    })
                }

                // If user has no password, redirect to set-password
                if (!existingUser.password_hash) {
                    const token = fastify.jwt.sign({ 
                        sub: existingUser.id, 
                        email: existingUser.email,
                        scope: 'set_password' 
                    }, { expiresIn: config.JWT_ACCESS_EXPIRES_IN });
                    
                    return reply.redirect(`${config.FRONTEND_URL}/set-password?token=${token}`);
                }
                
                // User has password, continue with normal OAuth flow
            } else {
                // New user - create account and redirect to set-password
                const userId = await new Promise((resolve, reject) => {
                    fastify.db.run(
                        'INSERT INTO users (email, google_id, is_verified) VALUES (?, ?, 1)',
                        [googleUser.email, googleUser.googleId],
                        function(err) {
                            if (err) reject(err);
                            else resolve(this.lastID);
                        }
                    );
                });
                
                const token = fastify.jwt.sign({ 
                    sub: userId, 
                    email: googleUser.email,
                    scope: 'set_password' 
                }, { expiresIn: config.JWT_ACCESS_EXPIRES_IN });

                return reply.redirect(`${config.FRONTEND_URL}/set-password?token=${token}`);
            }
            
            // Check if user has 2FA enabled and requires verification
            if (existingUser && existingUser.twofa_enabled && existingUser.twofa_confirmed) {
                console.log('🔐 [OAuth Debug] User has 2FA enabled and requires verification');
                console.log('🔐 [OAuth Debug] User ID:', userId, '2FA Enabled:', existingUser.twofa_enabled, '2FA Confirmed:', existingUser.twofa_confirmed);
                
                // User has 2FA enabled - require 2FA verification
                const pre2faExpiresIn = 5 * 60; // 5 minutes
                const pre2faToken = fastify.jwt.sign({ sub: userId, scope: 'needs_2fa' }, { expiresIn: pre2faExpiresIn });

                console.log('🔐 [OAuth Debug] Setting pre2faToken cookie for user:', userId);
                reply.setCookie('pre2faToken', pre2faToken, {
                    httpOnly: true,
                    secure: config.NODE_ENV === 'production',
                    sameSite: 'lax',  // Must be 'lax' for cross-origin OAuth redirects
                    maxAge: pre2faExpiresIn,
                    path: '/'
                });

                console.log('🔐 [OAuth Debug] Redirecting to:', `${config.FRONTEND_URL}/twofa?oauth=true`);
                return reply.redirect(`${config.FRONTEND_URL}/twofa?oauth=true`);
            }

            if (!existingUser?.is_verified) {
                return reply.redirect(`${config.FRONTEND_URL}/login?error=email_not_verified`);
            }

            console.log(' XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX  ');

            // Check if user has 2FA enabled but not confirmed (incomplete setup)
            if (existingUser && existingUser.twofa_enabled && !existingUser.twofa_confirmed) {
                return reply.redirect(`${config.FRONTEND_URL}/login?error=2fa_setup_required`);
            }
            
            const accessToken = fastify.jwt.sign({ sub: userId }, { expiresIn: config.JWT_ACCESS_EXPIRES_IN });
            const refreshToken = fastify.jwt.sign({ sub: userId }, { expiresIn: config.JWT_REFRESH_EXPIRES_IN });
            
            const refreshExpirySeconds = config.JWT_REFRESH_EXPIRES_IN ? 
            (parseInt(config.JWT_REFRESH_EXPIRES_IN) * 24 * 60 * 60) : 
            (7 * 24 * 60 * 60); // Default to 7 days in seconds
            const expiresAt = Math.floor(Date.now() / 1000) + refreshExpirySeconds;
            
            await new Promise((resolve, reject) => {
                fastify.db.run('INSERT INTO refresh_tokens(user_id, token, expires_at) VALUES (?, ?, ?)', 
                    [userId, refreshToken, expiresAt], 
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            
             // Set cookies
            const accessTokenExpiry = config.JWT_ACCESS_EXPIRES_IN ? 
             (parseInt(config.JWT_ACCESS_EXPIRES_IN) * 60) : 
             (15 * 60); // Default to 15 minutes in seconds

            const refreshTokenExpiry = config.JWT_REFRESH_EXPIRES_IN ? 
             (parseInt(config.JWT_REFRESH_EXPIRES_IN) * 24 * 60 * 60) : 
             (7 * 24 * 60 * 60); // Default to 7 days in seconds

            reply
            .setCookie('accessToken', accessToken, {
                httpOnly: true,
                secure: config.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: accessTokenExpiry,
                path: '/'
            })
            .setCookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: config.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: refreshTokenExpiry,
                path: '/'
            });
        
            return reply.redirect(`${config.FRONTEND_URL}?login=success`);

        } catch (error) {
            console.error('Google OAuth error:', error);
            return reply.redirect(`${config.FRONTEND_URL}/login?error=oauth_failed`);
        }
    })
};