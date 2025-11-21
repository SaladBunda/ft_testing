module.exports = {
    NEXT_PUBLIC_API_BASE: process.env.AUTH_BACKEND_URL ?? 'http://localhost:8005',
    NEXT_PUBLIC_USER_MGMT_API_BASE: process.env.USR_MANAG_URL ?? 'http://localhost:4000',
}