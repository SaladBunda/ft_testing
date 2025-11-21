const config = require('../config');
const { transporter } = require('../utils/email');
const crypto = require('crypto');


module.exports = async function (fastify) {
    fastify.post('/verify-email/request', {
        schema: {
            description: 'Request email verification link to be sent again',
            tags: ['Authentication'],
            summary: 'Request verification email',
            body: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
            response: {
                200: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] }
            }
        }
    }, async (req, reply) => {
        const { email } = req.body || {};
        try {
            const user = await new Promise((resolve, reject) => {
                fastify.db.get('SELECT id, is_verified FROM users WHERE email = ?', [email], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (user && !user.is_verified) {
                const token = crypto.randomBytes(32).toString('hex');
                const emailVerificationTokenExpiresAt = Math.floor(Date.now() / 1000) + 3600;

                await new Promise((resolve, reject) => {
                    fastify.db.run('INSERT INTO email_verification_tokens(token, user_id, expires_at) VALUES (?, ?, ?)', [token, user.id, emailVerificationTokenExpiresAt], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                const link = `${config.BACKEND_URL}/api/auth/verify-email/confirm?token=${token}`;
                try {
                    await fastify.trackExternal('smtp', () => transporter.sendMail({
                        from: config.EMAIL_FROM,
                        to: email,
                        subject: 'Verify your email',
                        text: `Click the link to verify your email: ${link}`,
                        html: `<p>Click the link to verify your email: <a href="${link}">${link}</a></p>`
                    }));
                } catch (_e) { /* ignore send errors to not leak info */ }
            }
        } catch (_e) { /* ignore */ }
        // Always return generic 200 to avoid account enumeration
        return reply.code(200).send({ message: 'If the account exists, an email was sent.' });
    });

    // POST /api/auth/verify-email/confirm { token }
	fastify.post('/verify-email/confirm', {
        schema: {
            description: 'Confirm email verification via token in request body',
            tags: ['Authentication'],
            summary: 'Confirm email (body token)',
            body: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
            response: {
                200: { type: 'object', properties: { message: { type: 'string' }, error: { type: 'string' } } },
                400: { type: 'object', properties: { error: { type: 'string' } }, required: ['error'] }
            }
        }
    }, async (req, reply) => {
		const { token } = req.body || {};
		
		const tokenRecord = await new Promise((resolve, reject) => {
			fastify.db.get('SELECT user_id, expires_at FROM email_verification_tokens WHERE token = ?', [token], (err, row) => {
				if (err) reject(err);
				else resolve(row);
			});
		});

		if (!tokenRecord || tokenRecord.expires_at < Math.floor(Date.now() / 1000)) {
			return reply.code(200).send({ error: 'Invalid or expired token' });
		}

		const user = await new Promise((resolve, reject) => {
			fastify.db.get('SELECT id FROM users WHERE id = ?', [tokenRecord.user_id], (err, row) => {
				if (err) reject(err);
				else resolve(row);
			});
		});
		
        if (user && user.is_verified) {
			return reply.code(200).send({ error: 'User already verified' });
		}
		
		// find token, check expiry/unused → set users.is_verified = 1, mark used_at
        await new Promise((resolve, reject) => {
            fastify.db.run('UPDATE users SET is_verified = 1 WHERE id = ?', [tokenRecord.user_id], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
		
		await new Promise((resolve, reject) => {
			fastify.db.run('DELETE FROM email_verification_tokens WHERE token = ?', [token], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
		
		return reply.code(200).send({ message: 'Email verified' });
		
	});

    // GET /api/auth/verify-email/confirm?token=...
    fastify.get('/verify-email/confirm', {
        schema: {
            description: 'Confirm email verification via token in querystring',
            tags: ['Authentication'],
            summary: 'Confirm email (query token)',
            querystring: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
            response: {
                302: { description: 'Redirect to frontend on success' },
                400: { type: 'object', properties: { error: { type: 'string' } }, required: ['error'] }
            }
        }
    }, async (req, reply) => {
        const q = req.query || {};
        const token = q.token;
        if (!token || typeof token !== 'string') {
            return reply.code(400).send({ error: 'Invalid token' });
        }

        const tokenRecord = await new Promise((resolve, reject) => {
            fastify.db.get('SELECT user_id, expires_at FROM email_verification_tokens WHERE token = ?', [token], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!tokenRecord || tokenRecord.expires_at < Math.floor(Date.now() / 1000)) {
            return reply.code(400).send({ error: 'Invalid or expired token' });
        }

        await new Promise((resolve, reject) => {
            fastify.db.run('UPDATE users SET is_verified = 1 WHERE id = ?', [tokenRecord.user_id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        await new Promise((resolve, reject) => {
            fastify.db.run('DELETE FROM email_verification_tokens WHERE token = ?', [token], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Redirect to frontend success page (avoid redirect helper signature issues)
        const url = `${config.FRONTEND_URL}/verify-success`;
        reply.code(302).header('Location', url).send();
        return;
    });
};