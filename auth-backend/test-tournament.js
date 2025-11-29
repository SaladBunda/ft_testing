const WebSocket = require('ws');
const fetch = require('node-fetch');

// Test users
const users = [
  { email: 'bunda1@test.com', password: 'testpassword123', username: 'bunda1' },
  { email: 'bunda2@test.com', password: 'testpassword123', username: 'bunda2' },
  { email: 'bunda3@test.com', password: 'testpassword123', username: 'bunda3' },
  { email: 'bunda4@test.com', password: 'testpassword123', username: 'bunda4' },
  { email: 'bunda5@test.com', password: 'testpassword123', username: 'bunda5' },
  { email: 'bunda6@test.com', password: 'testpassword123', username: 'bunda6' },
  { email: 'bunda7@test.com', password: 'testpassword123', username: 'bunda7' },
  { email: 'bunda8@test.com', password: 'testpassword123', username: 'bunda8' }
];

const players = [];

// Get auth token for a user
async function getAuthToken(user) {
  try {
    const response = await fetch('http://localhost:8005/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        password: user.password
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${user.username} logged in successfully`);
      return data.accessToken;
    } else {
      const error = await response.json();
      console.log(`❌ ${user.username} login failed:`, error);
      return null;
    }
  } catch (error) {
    console.log(`❌ ${user.username} login error:`, error.message);
    return null;
  }
}

// Connect player to tournament
function connectPlayer(user, token, index) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:4322/ws?token=${token}`);
    
    const player = {
      username: user.username,
      ws: ws,
      token: token,
      authenticated: false,
      tournamentJoined: false,
      inGame: false,
      currentMatch: null
    };

    ws.on('open', () => {
      console.log(`🔌 ${user.username} connected to WebSocket`);
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      // Authentication successful
      if (message.type === 'authenticated') {
        console.log(`✅ ${user.username} authenticated`);
        player.authenticated = true;
        
        // Join tournament
        setTimeout(() => {
          console.log(`🏆 ${user.username} joining tournament...`);
          ws.send(JSON.stringify({ type: 'join', gameMode: 'tournament' }));
        }, 500 * index); // Stagger joins slightly
      }
      
      // Tournament queue joined
      else if (message.type === 'tournamentQueued' || message.status === 'queued') {
        console.log(`🎪 ${user.username} added to tournament queue (${message.position}/8)`);
        player.tournamentJoined = true;
      }
      
      // Tournament started
      else if (message.type === 'tournamentStarted' || message.status === 'tournament_started') {
        console.log(`🎉 ${user.username}: Tournament starting!`);
        console.log(`📋 Tournament ID: ${message.tournamentId}`);
      }
      
      // Tournament match ready
      else if (message.type === 'tournamentMatchReady') {
        console.log(`⚔️ ${user.username}: Match ${message.matchId} ready! (${message.round})`);
        console.log(`   Opponent: ${message.opponent.username}`);
        player.inGame = true;
        player.currentMatch = message.matchId;
        
        // Simulate some gameplay by sending random paddle movements
        simulateGameplay(player);
      }
      
      // Tournament match result
      else if (message.type === 'tournamentMatchResult') {
        console.log(`🏁 ${user.username}: Match ${message.matchId} finished - ${message.result.toUpperCase()}`);
        console.log(`   Rewards: ${message.rewards.rankPoints} RR, ${message.rewards.experience} XP`);
        console.log(`   Round: ${message.round}`);
        console.log(`   Tournament status: ${message.tournamentStatus}`);
        player.inGame = false;
        player.currentMatch = null;
      }
      
      // Tournament update
      else if (message.type === 'tournamentUpdate') {
        console.log(`🎪 ${user.username}: Tournament update - ${message.status}`);
        if (message.champion) {
          console.log(`👑 CHAMPION: ${message.champion.username}`);
        }
      }
      
      // Game state updates
      else if (message.ball && message.player1 && message.player2) {
        // Game state - don't log to avoid spam
      }
      
      // Other messages
      else if (message.type) {
        console.log(`📨 ${user.username}: ${message.type}`, message);
      }
    });

    ws.on('error', (error) => {
      console.error(`❌ ${user.username} WebSocket error:`, error.message);
      reject(error);
    });

    ws.on('close', () => {
      console.log(`🔌 ${user.username} disconnected`);
    });

    players.push(player);
    resolve(player);
  });
}

// Simulate gameplay (random paddle movements)
function simulateGameplay(player) {
  if (!player.inGame) return;
  
  const moveInterval = setInterval(() => {
    if (!player.inGame || player.ws.readyState !== WebSocket.OPEN) {
      clearInterval(moveInterval);
      return;
    }
    
    // Random movement
    const movement = Math.random() > 0.5 ? 5 : -5;
    
    player.ws.send(JSON.stringify({
      type: 'update',
      player1DY: player.role === 'player1' ? movement : 0,
      player2DY: player.role === 'player2' ? movement : 0
    }));
  }, 100); // Send movement updates every 100ms
}

// Main test function
async function runTournamentTest() {
  console.log('🏆 Starting Tournament Test with 8 Players\n');
  
  // Step 1: Login all users and get tokens
  console.log('📝 Step 1: Logging in all users...\n');
  const tokens = [];
  
  for (const user of users) {
    const token = await getAuthToken(user);
    if (!token) {
      console.log(`❌ Failed to get token for ${user.username}, aborting test`);
      return;
    }
    tokens.push({ user, token });
    await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between logins
  }
  
  console.log('\n✅ All users logged in successfully!\n');
  
  // Step 2: Connect all players to tournament
  console.log('🔌 Step 2: Connecting players to WebSocket and joining tournament...\n');
  
  for (let i = 0; i < tokens.length; i++) {
    const { user, token } = tokens[i];
    await connectPlayer(user, token, i);
    await new Promise(resolve => setTimeout(resolve, 300)); // Delay between connections
  }
  
  console.log('\n✅ All players connected!\n');
  console.log('🎪 Tournament should start automatically when all 8 players join...\n');
  console.log('📊 Watch the logs above for tournament progression!\n');
  console.log('Press Ctrl+C to stop the test\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping tournament test...');
  
  // Close all WebSocket connections
  players.forEach(player => {
    if (player.ws && player.ws.readyState === WebSocket.OPEN) {
      player.ws.close();
    }
  });
  
  console.log('✅ All connections closed. Goodbye!');
  process.exit(0);
});

// Run the test
runTournamentTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
