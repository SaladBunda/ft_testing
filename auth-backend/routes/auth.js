const refreshRoutes = require('./refresh');
const registerRoutes = require('./register');
const loginRoutes = require('./login');
const meRoutes = require('./me');
const logoutRoutes = require('./logout');
const twofaRoutes = require('./twofa');
const googleOauthRoutes = require('./google-oauth');
const verifyEmailRoutes = require('./verify-email');
const setPasswordRoutes = require('./set-password');
const usersRoutes = require('./users');

module.exports = async function (fastify) {
    await fastify.register(refreshRoutes);
    await fastify.register(registerRoutes);
    await fastify.register(loginRoutes);
    await fastify.register(meRoutes);
    await fastify.register(logoutRoutes);
    await fastify.register(twofaRoutes);
    await fastify.register(googleOauthRoutes);
    await fastify.register(verifyEmailRoutes);
    await fastify.register(setPasswordRoutes);
    await fastify.register(usersRoutes);
};