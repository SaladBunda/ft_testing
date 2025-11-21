const fp = require('fastify-plugin');

async function accountLockoutPlugin(fastify) {
    fastify.decorate('accountLockout', {
        async isLocked(identifier) {
            return new Promise((resolve, reject) => {
                fastify.db.get(`
                    SELECT locked_until FROM account_lockouts
                    WHERE identifier = ? AND locked_until > ?
                `, [identifier, Math.floor(Date.now() / 1000)], (err, row) => {
                    if (err) reject(err);
                    else resolve(row && row.locked_until > Math.floor(Date.now() / 1000));
                });
            });
        },

        async recordFailedAttempt(identifier) {
            const now = Math.floor(Date.now() / 1000);
            const maxAttempts = 5; // Maximum failed attempts before lockout
            const lockoutDuration = 15 * 60; // 15 minutes in seconds
            
            // Get current lockout status
            const current = await new Promise((resolve, reject) => {
                fastify.db.get(`
                    SELECT failed_attempts, first_attempt FROM account_lockouts 
                    WHERE identifier = ?
                `, [identifier], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (current) {
                // Update existing record
                const newAttempts = current.failed_attempts + 1;
                let lockedUntil = null;
                
                if (newAttempts >= maxAttempts) {
                    lockedUntil = now + lockoutDuration;
                }
                
                await new Promise((resolve, reject) => {
                    fastify.db.run(`
                        UPDATE account_lockouts 
                        SET failed_attempts = ?, locked_until = ?, updated_at = ?
                        WHERE identifier = ?
                    `, [newAttempts, lockedUntil, now, identifier], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                
                return {
                    failedAttempts: newAttempts,
                    isLocked: lockedUntil !== null,
                    lockedUntil: lockedUntil,
                    remainingAttempts: Math.max(0, maxAttempts - newAttempts)
                };
            } else {
                // Create new record
                const lockedUntil = 1 >= maxAttempts ? now + lockoutDuration : null;
                
                await new Promise((resolve, reject) => {
                    fastify.db.run(`
                        INSERT INTO account_lockouts (identifier, failed_attempts, first_attempt, locked_until, created_at, updated_at)
                        VALUES (?, 1, ?, ?, ?, ?)
                    `, [identifier, now, lockedUntil, now, now], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                
                return {
                    failedAttempts: 1,
                    isLocked: lockedUntil !== null,
                    lockedUntil: lockedUntil,
                    remainingAttempts: maxAttempts - 1
                };
            }
        },

        async resetLockout(identifier) {
            await new Promise((resolve, reject) => {
                fastify.db.run(`
                    DELETE FROM account_lockouts WHERE identifier = ?
                `, [identifier], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        },

        async getLockoutStatus(identifier) {
            const result = await new Promise((resolve, reject) => {
                fastify.db.get(`
                    SELECT failed_attempts, first_attempt, locked_until, updated_at
                    FROM account_lockouts WHERE identifier = ?
                `, [identifier], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (!result) {
                return { isLocked: false, failedAttempts: 0, remainingAttempts: 5 };
            }
            
            const now = Math.floor(Date.now() / 1000);
            const isLocked = result.locked_until && result.locked_until > now;
            const remainingAttempts = Math.max(0, 5 - result.failed_attempts);
            
            return {
                isLocked,
                failedAttempts: result.failed_attempts,
                remainingAttempts,
                lockedUntil: result.locked_until,
                firstAttempt: result.first_attempt,
                updatedAt: result.updated_at
            };
        }
    });
}

module.exports = fp(accountLockoutPlugin);
