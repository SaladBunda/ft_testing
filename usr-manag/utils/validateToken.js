const jwt = require('jsonwebtoken');
const config = require('../config');

const validateToken = (token) => {
    if (!token) {
        return {
            valid: false,
            error: 'No token provided'
        }
    }

    try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        return {
            valid: true,
            userId: decoded.sub,
            type: decoded.type,
        }
    } catch (error) {
        return {
            valid: false,
            error: error.message || 'Invalid token'
        }
    }
}

module.exports = {
    validateToken
}