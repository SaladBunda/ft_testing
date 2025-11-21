const fp = require('fastify-plugin');
const crypto = require('crypto');
const config = require('../config');

async function jwtPlugin(fastify) {
    // Register the JWT plugin and wait for it to be fully loaded
    await fastify.register(require('@fastify/jwt'), {
        secret: config.JWT_SECRET,
        sign: {
            expiresIn: config.JWT_ACCESS_EXPIRES_IN,
        },
        verify: {
            algorithms: ['HS256'],
        },
        cookie: {
            cookieName: 'accessToken',
        }
    });
    
    // Helper function to attempt token refresh
    async function attemptTokenRefresh(req, rep) {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return false; // No refresh token available
        }
        
        try {
            // Verify refresh token
            const decoded = fastify.jwt.verify(refreshToken);
            if (!decoded) {
                return false;
            }
        } catch (err) {
            return false; // Invalid refresh token
        }
        
        // Check if refresh token exists in database and is not expired
        const tokenRecord = await new Promise((resolve, reject) => {
            fastify.db.get('SELECT user_id FROM refresh_tokens WHERE token = ? AND expires_at > ?', 
                [refreshToken, Math.floor(Date.now() / 1000)], 
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!tokenRecord) {
            // Clean up expired tokens
            await new Promise((resolve, reject) => {
                fastify.db.run('DELETE FROM refresh_tokens WHERE expires_at <= ?', 
                    [Math.floor(Date.now() / 1000)], 
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            return false;
        }
        
        // Verify user still exists
        const user = await new Promise((resolve, reject) => {
            fastify.db.get('SELECT id FROM users WHERE id = ?', [tokenRecord.user_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!user) {
            return false;
        }
        
        // Generate new tokens
        const newAccessToken = fastify.jwt.sign({ sub: user.id }, { expiresIn: config.JWT_ACCESS_EXPIRES_IN });
        const newRefreshToken = fastify.jwt.sign({ sub: user.id }, { expiresIn: config.JWT_REFRESH_EXPIRES_IN });
        
        // Update refresh token in database
        await new Promise((resolve, reject) => {
            fastify.db.run('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        const expiresAt = Math.floor(Date.now() / 1000) + (parseInt(config.JWT_REFRESH_EXPIRES_IN) || 7 * 24 * 60 * 60);
        await new Promise((resolve, reject) => {
            fastify.db.run('INSERT INTO refresh_tokens(user_id, token, expires_at) VALUES (?, ?, ?)', 
                [user.id, newRefreshToken, expiresAt], 
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Set new cookies
        const accessTokenExpiry = config.JWT_ACCESS_EXPIRES_IN ? 
            (parseInt(config.JWT_ACCESS_EXPIRES_IN) * 60) : 
            (15 * 60); // Default to 15 minutes in seconds
        
        const refreshTokenExpiry = config.JWT_REFRESH_EXPIRES_IN ? 
            (parseInt(config.JWT_REFRESH_EXPIRES_IN) * 24 * 60 * 60) : 
            (7 * 24 * 60 * 60); // Default to 7 days in seconds

        rep.setCookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: config.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: accessTokenExpiry,
            path: '/'
        });
        
        rep.setCookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: config.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: refreshTokenExpiry,
            path: '/'
        });
        
        // Set the new token in headers for JWT verification
        req.headers.authorization = `Bearer ${newAccessToken}`;
        
        return true; // Successfully refreshed
    }
    
    // Decorate the authenticate function with automatic refresh capability
    fastify.decorate('authenticate', async function(req, rep) {
        try {
            const token = req.cookies.accessToken;
            
            // If no access token, try to refresh
            if (!token) {
                const refreshed = await attemptTokenRefresh(req, rep);
                if (refreshed) {
                    // Token was refreshed, verify the new token
                    await req.jwtVerify();
                    return; // Continue to next handler
                } else {
                    return rep.code(401).send({
                        error: 'Authentication required',
                        message: 'No valid access token or refresh token found. Please login again.'
                    });
                }
            }
            
            // Set the token in headers for JWT verification
            req.headers.authorization = `Bearer ${token}`;
            
            // Try to verify the access token
            await req.jwtVerify();
            
            // Continue to the next handler
            return;
            
        } catch (err) {
            // If token is expired or invalid, try to refresh
            if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
                const refreshed = await attemptTokenRefresh(req, rep);
                if (refreshed) {
                    // Token was refreshed, verify the new token
                    await req.jwtVerify();
                    return; // Continue to next handler
                } else {
                    return rep.code(401).send({
                        error: 'Token expired',
                        message: 'Your session has expired. Please login again.'
                    });
                }
            }
            
            return rep.code(401).send({
                error: 'Authentication failed',
                message: 'Unable to authenticate your request.'
            });
        }
    });
    
    // Verify the decoration worked
    console.log('JWT plugin: authenticate function decorated with auto-refresh:', typeof fastify.authenticate);
}

module.exports = fp(jwtPlugin);