#!/bin/bash
# run-migration.sh - Script to run the game stats migration

echo "🎮 Running Game Statistics Migration..."
echo "======================================"

# Set the database path environment variable
export DATABASE_PATH="/usr/src/app/db/shared.sqlite"

# Run the migration script
node addGameStats.js

echo ""
echo "🔍 Migration completed. Check the output above for results."