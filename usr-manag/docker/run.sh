#!/bin/sh
set -e

# Prevent writing lockfile into bind-mounted source
export NPM_CONFIG_PACKAGE_LOCK=false

# Clean install to ensure native modules match container libc
rm -rf node_modules package-lock.json
npm install --no-package-lock --legacy-peer-deps

# Rebuild native deps if needed (sqlite3)
# npm rebuild sqlite3 --build-from-source || true

# Start the service in dev mode
npm run dev