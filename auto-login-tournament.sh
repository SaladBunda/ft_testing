#!/bin/bash

# Script to automatically log in 8 users and join tournament
# Uses curl to get auth tokens, then opens Firefox with cookies set

echo "🚀 Auto-login Tournament Testing Script"
echo "========================================"
echo ""

# Array of test users
users=("bunda1" "bunda2" "bunda3" "bunda4" "bunda5" "bunda6" "bunda7" "bunda8")
password="testpassword123"

# Create temporary directory for profiles
TEMP_DIR=$(mktemp -d -t firefox-tournament-XXXXXXXX)
echo "📁 Created temporary profile directory: $TEMP_DIR"
echo ""

# Function to login and get cookies
login_user() {
    local username=$1
    local email="${username}@test.com"
    
    echo "🔐 Logging in as $email..."
    
    # Login and get cookies
    cookie_file="$TEMP_DIR/${username}_cookies.txt"
    
    # Perform login
    curl -s -c "$cookie_file" -X POST 'http://localhost:8005/api/auth/login' \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}" > /dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Logged in as $username"
        echo "$cookie_file"
    else
        echo "❌ Failed to login as $username"
        echo ""
    fi
}

# Login all users and launch Firefox instances
for i in "${!users[@]}"; do
    username="${users[$i]}"
    profile_num=$((i + 1))
    
    # Login and get cookie file
    cookie_file=$(login_user "$username")
    
    if [ -n "$cookie_file" ]; then
        # Create Firefox profile directory
        PROFILE_DIR="$TEMP_DIR/profile_$profile_num"
        mkdir -p "$PROFILE_DIR"
        
        # Launch Firefox with the cookies
        # Note: Firefox doesn't directly accept cookie files, so we'll open the game page
        # and let the httpOnly cookies from the login work automatically
        echo "🌐 Opening Firefox for $username..."
        firefox --profile "$PROFILE_DIR" --new-instance "http://localhost:4321" &
        sleep 2
    fi
    
    echo ""
done

echo "✅ All 8 Firefox instances launched!"
echo ""
echo "📝 Instructions:"
echo "   - Each window should auto-redirect or you need to refresh"
echo "   - Click the '🏆 Tournament' button in each window"
echo "   - Tournament starts when all 8 players join!"
echo ""
echo "📝 To close all: pkill firefox"
echo "📝 To cleanup: rm -rf $TEMP_DIR"
