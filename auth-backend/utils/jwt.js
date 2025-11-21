const jwt = require('@fastify/jwt');
require('dotenv').config();

function verifyRefreshToken(fastify, refreshToken) {
    try {
        const decoded = fastify.jwt.verify(refreshToken);
        return decoded;
    } catch (err) {
        return null;
    }
}

module.exports = {
    verifyRefreshToken
};