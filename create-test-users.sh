#!/bin/bash

# Create 8 test users using the auth backend API

echo "🔄 Creating 8 test users via auth backend API..."
echo ""

for i in {1..8}; do
    echo "Creating test$i..."
    
    response=$(curl -s -X POST http://localhost:8005/api/register \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"test${i}@test.com\",
            \"password\": \"test123\",
            \"username\": \"test${i}\",
            \"firstName\": \"Test\",
            \"lastName\": \"User${i}\"
        }")
    
    if echo "$response" | grep -q "error"; then
        echo "⚠️  test$i: $(echo $response | grep -o '"message":"[^"]*"' || echo 'Already exists or error')"
    else
        echo "✅ test$i created successfully"
    fi
done

echo ""
echo "✅ All test users processed!"
echo "📧 Email: test1@test.com, test2@test.com, ... test8@test.com"
echo "🔑 Password: test123 (for all users)"
