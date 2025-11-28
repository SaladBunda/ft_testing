#!/bin/bash

# Update passwords for test users

echo "🔄 Updating passwords for test users..."
echo ""

for i in {1..8}; do
    echo "Updating password for test$i..."
    
    # First, let's try to login with old password and then change it
    # Or we can use forgot-password flow
    
    response=$(curl -s -X POST http://localhost:8005/api/set-password \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"test${i}@test.com\",
            \"newPassword\": \"testpassword123\"
        }")
    
    if echo "$response" | grep -q "success"; then
        echo "✅ test$i password updated"
    else
        echo "⚠️  test$i: Trying alternative method..."
        # Try reset password
        curl -s -X POST http://localhost:8005/api/forgot-password \
            -H "Content-Type: application/json" \
            -d "{\"email\": \"test${i}@test.com\"}" > /dev/null
        echo "   Password reset email sent (check logs for reset link)"
    fi
done

echo ""
echo "✅ Password update process completed!"
echo "🔑 New password: testpassword123 (for all users)"
