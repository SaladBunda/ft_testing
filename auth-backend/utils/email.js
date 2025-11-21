const nodemailer = require('nodemailer');

const host = process.env.SMTP_HOST || 'mailpit';
const port = Number(process.env.SMTP_PORT || 1025);
const user = process.env.SMTP_USER || '';
const pass = process.env.SMTP_PASS || '';

const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: user && pass ? { user, pass } : undefined,
});

module.exports = { transporter };