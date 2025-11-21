const WebSocket = require('ws');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsImlhdCI6MTc2MzQzMjQyMiwiZXhwIjoxNzYzNDMzMzIyfQ.jVcQJcrLGoxogZNQ5fGX5GuNuaQbT-rS2w1uZH4ja7k';

console.log('🔌 Connecting to WebSocket with authentication...');

// Create WebSocket connection with token in query params
const ws = new WebSocket(`ws://localhost:4322/ws?token=${token}`);

ws.on('open', function open() {
  console.log('✅ WebSocket connection established');
});

ws.on('message', function message(data) {
  const msg = JSON.parse(data.toString());
  console.log('📩 Received message:', JSON.stringify(msg, null, 2));
  
  if (msg.type === 'authenticated') {
    console.log('🎉 Authentication successful!');
    console.log(`👤 User: ${msg.user.username} (Level ${msg.user.gameStats.level})`);
    
    // Try to join a solo game
    console.log('🎮 Joining solo game...');
    ws.send(JSON.stringify({
      type: 'join',
      gameMode: 'solo'
    }));
  } else if (msg.type === 'gameJoined') {
    console.log('🕹️ Successfully joined game!');
    console.log('🎯 Sending test input...');
    
    // Send some test input
    ws.send(JSON.stringify({
      type: 'update',
      player1DY: 5
    }));
    
    // Close connection after 2 seconds
    setTimeout(() => {
      console.log('👋 Closing connection...');
      ws.close();
    }, 2000);
  } else if (msg.type === 'authError') {
    console.log('❌ Authentication failed:', msg.error);
    ws.close();
  }
});

ws.on('error', function error(err) {
  console.error('💥 WebSocket error:', err);
});

ws.on('close', function close() {
  console.log('🔌 WebSocket connection closed');
});