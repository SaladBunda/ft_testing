const { hashPassword } = require('../utils/hash');
const { validatePassword } = require('../utils/passwordPolicy');
const config = require('../config');

module.exports = async function (fastify) {

    fastify.post('/set-password', {
        schema: {
            description: 'Set password for OAuth users or reset password using token',
            tags: ['Authentication'],
            summary: 'Set password',
            body: {
                type: 'object',
                properties: {
                    token: { type: 'string' },
                    password: { type: 'string' }
                },
                required: ['token', 'password']
            }
        }
    }, async (req, reply) => {
        const { token, password } = req.body || {};

        if (!token || !password) {
            return reply.code(400).send({ error: 'Token and password are required' });
        }

        let userId, userEmail, isOAuthFlow = false;
        
        try {
            // Try to decode as JWT token (for OAuth users)
            const decoded = fastify.jwt.verify(token);
            if (decoded.scope === 'set_password') {
                userId = decoded.sub;
                userEmail = decoded.email;
                isOAuthFlow = true;
                
                // Verify user exists and has no password
                const user = await new Promise((resolve, reject) => {
                    fastify.db.get('SELECT id, email, password_hash FROM users WHERE id = ?', [userId], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
                
                if (!user || user.password_hash) {
                    return reply.code(400).send({ error: 'Invalid token or user already has a password' });
                }
            }
        } catch (jwtError) {
            // Not a JWT token, try as password reset token
        }
        
        if (!isOAuthFlow) {
            // Handle password reset token
            const now = Math.floor(Date.now() / 1000);
            
            const tokenRecord = await new Promise((resolve, reject) => {
                fastify.db.get(
                    'SELECT user_id, expires_at, used_at FROM password_reset_tokens WHERE token = ?',
                    [token],
                    (err, row) => (err ? reject(err) : resolve(row))
                );
            });
            
            if (!tokenRecord || tokenRecord.expires_at <= now || tokenRecord.used_at != null) {
                return reply.code(400).send({ error: 'Invalid or expired token' });
            }

            const user = await new Promise((resolve, reject) => {
                fastify.db.get('SELECT id, email FROM users WHERE id = ?', [tokenRecord.user_id], (err, row) => (err ? reject(err) : resolve(row)));
            });
            
            if (!user) {
                return reply.code(404).send({ error: 'User not found' });
            }
            
            userId = user.id;
            userEmail = user.email;
        }
        
        // Validate password policy
        const validation = validatePassword(password, userEmail);
        if (!validation.isValid) {
            return reply.code(400).send({
                error: validation.errors[0],
                details: validation.errors
            });
        }
        
        // Hash and update password
        const password_hash = await hashPassword(password);
        const now = Math.floor(Date.now() / 1000);
        
        await new Promise((resolve, reject) => {
            fastify.db.run('UPDATE users SET password_hash = ?, last_password_changed_at = ? WHERE id = ?', 
                [password_hash, now, userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        if (isOAuthFlow) {
            // For OAuth users, redirect to login
            return reply.code(200).send({ 
                message: 'Password set successfully', 
                redirect: `${config.FRONTEND_URL}/login` 
            });
        } else {
            // For password reset, mark token as used and revoke refresh tokens
            await new Promise((resolve, reject) => {
                fastify.db.run('UPDATE password_reset_tokens SET used_at = ? WHERE token = ?', [now, token], (err) => (err ? reject(err) : resolve()));
            });

            // Revoke refresh tokens
            await new Promise((resolve, reject) => {
                fastify.db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [userId], (err) => (err ? reject(err) : resolve()));
            });
            
            return reply.code(200).send({ message: 'Password reset successfully' });
        }
    });

}