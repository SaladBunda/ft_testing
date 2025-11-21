const speakeasy = require('speakeasy');
const qrcode = require('qrcode'); 

/**
 * Generate a new TOTP secret for a user.
 * @param {string} email – Used only for the “account name” in authenticator apps.
 * @returns {object} { base32, otpauth_url, ascii, hex }
 */
exports.generateSecret = (email) => {
  return speakeasy.generateSecret({
    name: `Transcendance (${email})`, // what the app shows in the account list
    length: 32
  });
};

/**
 * Convert the otpauth:// URL into a data-URL QR image for easy embedding.
 * @param {string} otpauthURL
 * @returns {Promise<string>} data:image/png;base64,....
 */
exports.toDataURL = async (otpauthURL) => {
  return qrcode.toDataURL(otpauthURL);
};

/**
 * Verify a 6-digit TOTP code from the user.
 * @param {object} opts { secret, token }
 * @returns {boolean} true if valid within ±30 s window
 */
exports.verifyTOTP = ({ secret, token }) => {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1 // allow 30 s before or after
  });
};