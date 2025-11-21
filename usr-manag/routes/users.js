const userRoutes = require('./user');
const profileRoutes = require('./profile');

module.exports = async function (fastify) {
    await fastify.register(userRoutes);
    await fastify.register(profileRoutes);
};
