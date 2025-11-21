module.exports = async function (fastify) {
    // Get all users (admin endpoint)
    fastify.get('/users', {
        preHandler: [fastify.authenticate],
        schema: {
            description: 'Get list of all users',
            tags: ['User Management'],
            summary: 'List all users',
            security: [{ Bearer: [], CSRF: [] }],
            querystring: {
                type: 'object',
                properties: {
                    page: {
                        type: 'integer',
                        minimum: 1,
                        default: 1,
                        description: 'Page number for pagination'
                    },
                    limit: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 100,
                        default: 20,
                        description: 'Number of users per page'
                    },
                    search: {
                        type: 'string',
                        description: 'Search term for email or name'
                    },
                    verified: {
                        type: 'boolean',
                        description: 'Filter by verification status'
                    },
                    twofa_enabled: {
                        type: 'boolean',
                        description: 'Filter by 2FA status'
                    }
                }
            },
            response: {
                200: {
                    type: 'object',
                    description: 'List of users',
                    properties: {
                        users: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'integer', description: 'User ID' },
                                    email: { type: 'string', format: 'email', description: 'User email' },
                                    name: { type: 'string', nullable: true, description: 'User display name' },
                                    avatar_url: { type: 'string', nullable: true, description: 'User avatar URL' },
                                    is_verified: { type: 'boolean', description: 'Email verification status' },
                                    twofa_enabled: { type: 'boolean', description: '2FA enabled status' },
                                    twofa_confirmed: { type: 'boolean', description: '2FA confirmed status' },
                                    google_id: { type: 'string', nullable: true, description: 'Google OAuth ID' },
                                    created_at: { type: 'string', format: 'date-time', description: 'Account creation date' },
                                    last_password_changed_at: { type: 'integer', nullable: true, description: 'Last password change timestamp' }
                                }
                            }
                        },
                        pagination: {
                            type: 'object',
                            properties: {
                                page: { type: 'integer', description: 'Current page' },
                                limit: { type: 'integer', description: 'Items per page' },
                                total: { type: 'integer', description: 'Total number of users' },
                                total_pages: { type: 'integer', description: 'Total number of pages' }
                            }
                        }
                    }
                },
                401: {
                    type: 'object',
                    description: 'Unauthorized',
                    properties: {
                        error: { type: 'string', example: 'Unauthorized' },
                        message: { type: 'string', example: 'Bearer token missing or invalid' }
                    }
                },
                403: {
                    type: 'object',
                    description: 'Forbidden',
                    properties: {
                        error: { type: 'string', example: 'Forbidden' },
                        message: { type: 'string', example: 'Insufficient permissions' }
                    }
                },
                500: {
                    type: 'object',
                    description: 'Internal server error',
                    properties: {
                        error: { type: 'string', example: 'Internal server error' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { page = 1, limit = 20, search, verified, twofa_enabled } = request.query;
            const offset = (page - 1) * limit;

            // Build query with filters
            let whereConditions = [];
            let queryParams = [];

            if (search) {
                whereConditions.push('(email LIKE ? OR name LIKE ?)');
                const searchTerm = `%${search}%`;
                queryParams.push(searchTerm, searchTerm);
            }

            if (verified !== undefined) {
                whereConditions.push('is_verified = ?');
                queryParams.push(verified ? 1 : 0);
            }

            if (twofa_enabled !== undefined) {
                whereConditions.push('twofa_enabled = ?');
                queryParams.push(twofa_enabled ? 1 : 0);
            }

            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

            // Get total count
            const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
            const countResult = await new Promise((resolve, reject) => {
                fastify.db.get(countQuery, queryParams, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            const total = countResult.total;
            const totalPages = Math.ceil(total / limit);

            // Get users with pagination
            const usersQuery = `
                SELECT 
                    id, email, name, avatar_url, is_verified, 
                    twofa_enabled, twofa_confirmed, google_id, 
                    created_at, last_password_changed_at
                FROM users 
                ${whereClause}
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            `;

            const users = await new Promise((resolve, reject) => {
                fastify.db.all(usersQuery, [...queryParams, limit, offset], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            // Format response
            const formattedUsers = users.map(user => ({
                id: user.id,
                email: user.email,
                name: user.name || null,
                avatar_url: user.avatar_url || null,
                is_verified: Boolean(user.is_verified),
                twofa_enabled: Boolean(user.twofa_enabled),
                twofa_confirmed: Boolean(user.twofa_confirmed),
                google_id: user.google_id || null,
                created_at: user.created_at,
                last_password_changed_at: user.last_password_changed_at || null
            }));

            return reply.send({
                users: formattedUsers,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    total_pages: totalPages
                }
            });

        } catch (error) {
            fastify.log.error('Error fetching users:', error);
            return reply.code(500).send({
                error: 'Internal server error',
                message: 'Failed to fetch users'
            });
        }
    });

    // Get user by ID
    fastify.get('/users/:id', {
        preHandler: [fastify.authenticate],
        schema: {
            description: 'Get user by ID',
            tags: ['User Management'],
            summary: 'Get specific user details',
            security: [{ Bearer: [], CSRF: [] }],
            params: {
                type: 'object',
                properties: {
                    id: {
                        type: 'integer',
                        description: 'User ID'
                    }
                },
                required: ['id']
            },
            response: {
                200: {
                    type: 'object',
                    description: 'User details',
                    properties: {
                        id: { type: 'integer', description: 'User ID' },
                        email: { type: 'string', format: 'email', description: 'User email' },
                        name: { type: 'string', nullable: true, description: 'User display name' },
                        avatar_url: { type: 'string', nullable: true, description: 'User avatar URL' },
                        is_verified: { type: 'boolean', description: 'Email verification status' },
                        twofa_enabled: { type: 'boolean', description: '2FA enabled status' },
                        twofa_confirmed: { type: 'boolean', description: '2FA confirmed status' },
                        google_id: { type: 'string', nullable: true, description: 'Google OAuth ID' },
                        created_at: { type: 'string', format: 'date-time', description: 'Account creation date' },
                        last_password_changed_at: { type: 'integer', nullable: true, description: 'Last password change timestamp' }
                    }
                },
                401: {
                    type: 'object',
                    description: 'Unauthorized',
                    properties: {
                        error: { type: 'string', example: 'Unauthorized' }
                    }
                },
                404: {
                    type: 'object',
                    description: 'User not found',
                    properties: {
                        error: { type: 'string', example: 'User not found' }
                    }
                },
                500: {
                    type: 'object',
                    description: 'Internal server error',
                    properties: {
                        error: { type: 'string', example: 'Internal server error' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { id } = request.params;

            const userQuery = `
                SELECT 
                    id, email, name, avatar_url, is_verified, 
                    twofa_enabled, twofa_confirmed, google_id, 
                    created_at, last_password_changed_at
                FROM users 
                WHERE id = ?
            `;

            const user = await new Promise((resolve, reject) => {
                fastify.db.get(userQuery, [id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!user) {
                return reply.code(404).send({
                    error: 'User not found'
                });
            }

            // Format response (exclude sensitive data)
            const formattedUser = {
                id: user.id,
                email: user.email,
                name: user.name || null,
                avatar_url: user.avatar_url || null,
                is_verified: Boolean(user.is_verified),
                twofa_enabled: Boolean(user.twofa_enabled),
                twofa_confirmed: Boolean(user.twofa_confirmed),
                google_id: user.google_id || null,
                created_at: user.created_at,
                last_password_changed_at: user.last_password_changed_at || null
            };

            return reply.send(formattedUser);

        } catch (error) {
            fastify.log.error('Error fetching user:', error);
            return reply.code(500).send({
                error: 'Internal server error',
                message: 'Failed to fetch user'
            });
        }
    });
};
