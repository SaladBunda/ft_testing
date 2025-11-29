#!/bin/bash

# Script to launch 8 Firefox instances for tournament testing
# Each instance will use a temporary profile created on-the-fly

echo "🚀 Launching 8 Firefox instances for tournament testing..."
echo "Please log in to each as:"
echo "  Window 1: bunda1@test.com"
echo "  Window 2: bunda2@test.com"
echo "  Window 3: bunda3@test.com"
echo "  Window 4: bunda4@test.com"
echo "  Window 5: bunda5@test.com"
echo "  Window 6: bunda6@test.com"
echo "  Window 7: bunda7@test.com"
echo "  Window 8: bunda8@test.com"
echo "All passwords: testpassword123"
echo ""
echo "After logging in, navigate to http://localhost:4321 and click Tournament mode"
echo ""

# Create temporary directory for profiles
TEMP_DIR=$(mktemp -d -t firefox-tournament-XXXXXXXX)
echo "📁 Created temporary profile directory: $TEMP_DIR"

# Launch 8 Firefox instances with auto-created temporary profiles
for i in {1..8}; do
    PROFILE_DIR="$TEMP_DIR/profile_$i"
    mkdir -p "$PROFILE_DIR"
    echo "Launching Firefox instance $i with profile at $PROFILE_DIR..."
    firefox --profile "$PROFILE_DIR" --new-instance "http://localhost:3010/login" &
    sleep 2
done

echo ""
echo "✅ All 8 Firefox instances launched!"
echo "📝 Profile directory: $TEMP_DIR"
echo "📝 To close all instances later, run: pkill firefox"
echo "📝 To clean up profiles, run: rm -rf $TEMP_DIR"
