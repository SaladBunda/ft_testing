const WebSocket = require('ws');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsImlhdCI6MTc2MzQzMDk2MywiZXhwIjoxNzYzNDMxODYzfQ.-iyWu4KtO7mybLS6NrsGuqYGnYkX15wgwR0rtOsWvH0';

// Test WebSocket connection with JWT token
const ws = new WebSocket(`ws://localhost:4322/ws?token=${token}`);

ws.on('open', function open() {
  console.log('✅ WebSocket connected successfully!');
  
  // Try to join a solo game
  console.log('🎮 Requesting to join solo game...');
  ws.send(JSON.stringify({
    type: 'join',
    gameMode: 'solo'
  }));
});

ws.on('message', function message(data) {
  const msg = JSON.parse(data.toString());
  console.log('📨 Received:', msg);
  
  if (msg.type === 'authenticated') {
    console.log(`🔑 Authenticated as: ${msg.user.username} (${msg.user.name})`);
    console.log(`📊 Game Stats: Level ${msg.user.gameStats.level}, Rank: ${msg.user.gameStats.rankTier}`);
  } else if (msg.type === 'gameJoined') {
    console.log(`🎮 Joined game: ${msg.gameMode || 'unknown'} mode`);
    console.log(`🏓 Room: ${msg.roomId}, Role: ${msg.playerRole}`);
    
    // Send a few test movements
    setTimeout(() => {
      console.log('⬆️ Moving paddle up...');
      ws.send(JSON.stringify({
        type: 'update',
        player1DY: -5
      }));
    }, 1000);
    
    setTimeout(() => {
      console.log('⬇️ Moving paddle down...');
      ws.send(JSON.stringify({
        type: 'update',
        player1DY: 5
      }));
    }, 2000);
    
    setTimeout(() => {
      console.log('🛑 Stopping paddle...');
      ws.send(JSON.stringify({
        type: 'update',
        player1DY: 0
      }));
      
      // Close connection after test
      setTimeout(() => {
        console.log('🔌 Closing connection...');
        ws.close();
      }, 1000);
    }, 3000);
  }
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close(code, reason) {
  console.log(`🔌 WebSocket closed: ${code} ${reason}`);
  process.exit(0);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏰ Test timeout');
  ws.close();
}, 10000);