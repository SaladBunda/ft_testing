const crypto = require('crypto');
const { transporter } = require('../utils/email');
const config = require('../config');

module.exports = async function (fastify) {
    fastify.post('/forgot-password', {
        schema: {
            description: 'Generate a password reset token and send email with link',
            tags: ['Authentication'],
            summary: 'Request password reset',
            body: {
                type: 'object',
                required: ['email'],
                properties: {
                    email: { type: 'string', format: 'email' }
                }
            },
            response: {
                200: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
                400: { type: 'object', properties: { error: { type: 'string' }, details: { type: 'array', items: { type: 'string' } } }, required: ['error'] },
                500: { type: 'object', properties: { error: { type: 'string' } }, required: ['error'] }
            }
        }, 
        preValidation: async (request, reply) => {
            const { email } = request.body || {};
            if (!email) return reply.code(400).send({ error: 'Email is required' });
        },
    }, async (req, reply) => {
            const { email } = req.body || {};
            
            console.log(email);
            
            if (!email) return reply.code(400).send({ error: 'Email is required' });
            
            // const user = await fastify.db.get('SELECT * FROM users WHERE email = ?', [email]);
            
            const user = await new Promise((resolve, reject) => {
                fastify.db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            console.log(user);
            
            if (!user) return reply.code(500).send({ error: 'Internal server error' });
            
            const alreadyHasToken = await new Promise((resolve, reject) => {
                fastify.db.get(
                    'SELECT token, expires_at FROM password_reset_tokens WHERE user_id = ?',
                    [user.id],
                    (err, row) => (err ? reject(err) : resolve(row))
                );
            });
                
            if (alreadyHasToken) {
                const now = Math.floor(Date.now() / 1000);
                if (alreadyHasToken.expires_at <= now) {
                        await new Promise((resolve, reject) => {
                            fastify.db.run(
                                'DELETE FROM password_reset_tokens WHERE user_id = ? AND expires_at <= ?',
                                [user.id, now],
                                err => (err ? reject(err) : resolve())
                            );
                        });
                    const token = await createToken(user);
                    const link = `${config.FRONTEND_URL}/set-password?token=${token}`;
                    await fastify.trackExternal('smtp', () => transporter.sendMail({
                        from: config.SMTP_FROM,
                        to: email,
                        subject: 'Password Reset',
                        text: `Click the link to reset your password: ${link}`,
                        html: `<p>Click the link to reset your password: <a href="${link}">${link}</a></p>`
                    }));
                    return reply.code(200).send({ message: 'Password reset email sent' });
                } else {
                  // token still valid → return generic 200
                    return reply.code(200).send({ message: ' Token already sent' });
                }
            }

            const token = await createToken(user);
    
            const link = `${config.FRONTEND_URL}/set-password?token=${token}`;
            
            await fastify.trackExternal('smtp', () => transporter.sendMail({
                from: config.SMTP_FROM,
                to: email,
                subject: 'Password Reset',
                text: `Click the link to reset your password: ${link}`,
                html: `<p>Click the link to reset your password: <a href="${link}">${link}</a></p>`
            }));
            return reply.code(200).send({ message: 'Password reset email sent' });
        }
    );
    
    
    const createToken = async (user) => {
        const now = Math.floor(Date.now() / 1000);
        for (let attempt = 0; attempt < 3; attempt++) {
            const token = crypto.randomBytes(32).toString('hex');
            try {
                await new Promise((resolve, reject) => {
                    fastify.db.run(
                        'INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
                        [token, user.id, now + 3600],
                        (err) => (err ? reject(err) : resolve())
                    );
                });
                return token;
            } catch (e) {
                if (String(e && e.code) === 'SQLITE_CONSTRAINT') {
                    continue; // retry with a new token on unique collision
                }
                throw e;
            }
        }
        // As a safety fallback, throw to avoid misleading message
        throw new Error('Failed to generate unique reset token');
    }
    
}