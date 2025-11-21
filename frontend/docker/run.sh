#!/bin/sh
set -e

echo "🚀 Starting frontend service..."

# Prevent writing lockfile into bind-mounted source
export NPM_CONFIG_PACKAGE_LOCK=false

# Clean install to ensure native modules match container libc
rm -rf node_modules package-lock.json
npm install --no-package-lock

# Start in dev mode
npm run dev

