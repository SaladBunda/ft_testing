const Fastify = require("fastify");
const fastifyWebsocket = require("@fastify/websocket");
const WebSocketHandler = require('./WebSocketHandler');

// Initialize Fastify server with CORS enabled
const fastify = Fastify({
  logger: false
});

// Manual CORS handling for all routes
fastify.addHook('preHandler', async (request, reply) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  reply.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    reply.status(200).send();
  }
});

fastify.register(fastifyWebsocket);

// Add health check endpoint
fastify.get('/health', async (request, reply) => {
  return { status: 'healthy', timestamp: new Date().toISOString() };
});

// Setup WebSocket handling
const wsHandler = new WebSocketHandler(fastify);
wsHandler.setupWebSocket();

// Add test endpoint for debugging stats
fastify.get('/test-stats/:userId', async (request, reply) => {
  try {
    const { userId } = request.params;
    const statsHandler = wsHandler.gameManager.statsHandler;
    
    // Test getting user stats
    const currentStats = await statsHandler.getUserStats(parseInt(userId));
    
    // Test simulating a game result between user and another real user
    const otherUserId = parseInt(userId) === 1 ? 4 : 1; // Switch between bunda(1) and tester(4)
    const testGameResult = {
      player1Id: parseInt(userId),
      player2Id: otherUserId,
      player1Score: 10,
      player2Score: 5,
      gameMode: 'matchmaking',
      gameDuration: 120
    };
    
    await statsHandler.processGameCompletion(testGameResult);
    const updatedStats = await statsHandler.getUserStats(parseInt(userId));
    
    return {
      before: currentStats,
      testGame: testGameResult,
      after: updatedStats
    };
  } catch (error) {
    console.error('❌ Test stats error:', error);
    return { error: error.message };
  }
});

// Player stats API endpoint
fastify.get('/api/player-stats', async (request, reply) => {
  try {
    // Extract JWT token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid authorization header' });
    }
    
    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    
    // Verify JWT token to get user ID
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (jwtError) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
    
    const userId = decoded.sub || decoded.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token payload' });
    }
    
    // Get player statistics from database
    const statsHandler = wsHandler.gameManager.statsHandler;
    const stats = await statsHandler.getUserStats(parseInt(userId));
    
    if (!stats) {
      return reply.status(404).send({ error: 'Player stats not found' });
    }
    
    // Calculate additional derived stats
    const winRate = stats.games_played > 0 ? (stats.games_won / stats.games_played) * 100 : 0;
    
    const enhancedStats = {
      ...stats,
      win_rate: Math.round(winRate * 10) / 10, // Round to 1 decimal place
      games_lost: stats.games_played - stats.games_won,
    };
    
    return { 
      success: true,
      stats: enhancedStats 
    };
  } catch (error) {
    console.error('❌ Player stats API error:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

// Start the game update loop
wsHandler.startGameUpdateLoop();

const port = process.env.GAME_BACKEND_PORT || 4322;
fastify.listen({ port: parseInt(port), host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server running at ${address}`);
});