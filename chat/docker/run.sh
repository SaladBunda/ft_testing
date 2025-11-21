#!/bin/sh
set -e

echo "🚀 Starting chat service..."


# Prevent writing lockfile into bind-mounted source
export NPM_CONFIG_PACKAGE_LOCK=false

# Clean install to ensure native modules match container libc
rm -rf node_modules package-lock.json
npm install --no-package-lock

# Rebuild native deps if needed (better-sqlite3)
npm rebuild better-sqlite3 --build-from-source || true

# Start in dev mode for hot reload
npm run dev
