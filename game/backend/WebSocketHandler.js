const GameManager = require('./GameManager');
const UserAuth = require('./UserAuth');

class WebSocketHandler {
  constructor(fastify) {
    this.fastify = fastify;
    this.userAuth = new UserAuth();
    this.gameManager = new GameManager(this.userAuth);
    
    // Start global game update loop
    this.startGameUpdateLoop();
  }

  // Start the global game update loop for all games
  startGameUpdateLoop() {
    setInterval(() => {
      this.gameManager.updateAllGames();
    }, 16);
  }

  // Setup WebSocket route with authentication
  setupWebSocket() {
    this.fastify.register(async (fastify) => {
      fastify.get("/ws", { websocket: true }, async (connection, req) => {
        console.log("New client attempting to connect...");
        
        // Authenticate the connection
        const authResult = await this.userAuth.authenticateConnection(req);
        
        if (!authResult.success) {
          console.log(`❌ Authentication failed: ${authResult.error}`);
          connection.socket.send(JSON.stringify({
            type: 'authError',
            error: authResult.error,
            code: authResult.code
          }));
          connection.socket.close();
          return;
        }

        const user = authResult.user;
        console.log(`✅ User authenticated: ${user.username} (ID: ${user.id})`);
        
        // Set user online
        await this.userAuth.setUserOnlineStatus(user.id, true);
        
        let playerInfo = null;

        // Send authentication success
        connection.socket.send(JSON.stringify({
          type: 'authenticated',
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            profilePic: user.profilePic,
            gameStats: user.gameStats
          }
        }));

        // Handle incoming messages
        connection.socket.on("message", async (message) => {
          const data = JSON.parse(message.toString());
          
          // Log non-movement messages
          if (data.type !== 'update') {
            console.log(`Received message from ${user.username} (${user.id}):`, data);
          }
          
          if (data.type === "join") {
            // Player wants to join a game with authentication
            const gameMode = data.gameMode || 'matchmaking';
            
            if (gameMode === 'matchmaking') {
              // Use authenticated matchmaking
              const result = this.gameManager.addAuthenticatedPlayer(
                connection.socket, 
                user, 
                'matchmaking'
              );
              
              if (result.player1 && result.player2) {
                // Matched two authenticated players
                const player1 = result.player1;
                const player2 = result.player2;
                
                console.log(`🎮 Match created! P1: ${player1.user.username} (${player1.connectionId}) P2: ${player2.user.username} (${player2.connectionId})`);
                
                // Send match notification to player 1
                if (player1.connection) {
                  player1.connection.send(JSON.stringify({
                    type: 'gameJoined',
                    playerRole: player1.role,
                    roomId: player1.roomId,
                    opponent: player1.opponent,
                    gameState: player1.gameState
                  }));
                  console.log(`📤 Sent gameJoined to ${player1.user.username}`);
                } else {
                  console.log("⚠️ Player 1 connection is null, cannot send gameJoined message");
                }
                
                // Send match notification to player 2  
                if (player2.connection) {
                  player2.connection.send(JSON.stringify({
                    type: 'gameJoined',
                    playerRole: player2.role,
                    roomId: player2.roomId,
                    opponent: player2.opponent,
                    gameState: player2.gameState
                  }));
                  console.log(`📤 Sent gameJoined to ${player2.user.username}`);
                } else {
                  console.log("⚠️ Player 2 connection is null, cannot send gameJoined message");
                }
                
                // Set playerInfo for the current connection
                if (player1.connection === connection.socket) {
                  playerInfo = player1;
                  console.log(`🎯 Current connection is Player 1: ${player1.user.username}`);
                } else if (player2.connection === connection.socket) {
                  playerInfo = player2;
                  console.log(`🎯 Current connection is Player 2: ${player2.user.username}`);
                } else {
                  console.log("⚠️ Could not identify current player connection!");
                }
                
                console.log(`🎮 Matched players: ${player1.user.username} vs ${player2.user.username}`);
              } else {
                // Added to waiting queue
                playerInfo = result;
                
                connection.socket.send(JSON.stringify({
                  type: 'waitingForOpponent',
                  playerRole: result.role,
                  roomId: result.roomId
                }));
                
                console.log(`⏳ ${user.username} added to matchmaking queue`);
              }
              
            } else if (gameMode === 'solo' || gameMode === 'ai') {
              // Create solo/AI game with authentication
              const aiDifficulty = data.aiDifficulty || 'medium';
              const result = this.gameManager.addAuthenticatedPlayer(
                connection.socket, 
                user,
                gameMode,
                aiDifficulty
              );
              
              playerInfo = result;
              
              connection.socket.send(JSON.stringify({
                type: 'gameJoined',
                playerRole: result.role,
                roomId: result.roomId,
                gameMode: gameMode,
                gameState: result.gameState,
                aiDifficulty: gameMode === 'ai' ? aiDifficulty : undefined
              }));
              
              console.log(`🤖 ${user.username} started ${gameMode} game`);
            }
            
          } else if (data.type === "update" || data.type === "reset") {
            // Handle game input if player is in a game
            if (playerInfo && playerInfo.connectionId) {
              this.gameManager.handlePlayerInput(playerInfo.connectionId, data);
            }
          } else if (data.type === "cancel") {
            // Handle matchmaking cancellation
            console.log(`🚫 User ${user.username} (${user.id}) cancelled matchmaking`);
            if (playerInfo && playerInfo.connectionId) {
              // Remove player from matchmaking queue and any games
              this.gameManager.removePlayer(playerInfo.connectionId);
              
              // Send cancellation confirmation
              connection.socket.send(JSON.stringify({
                type: 'matchCancelled',
                message: 'Matchmaking cancelled successfully'
              }));
            }
          }
        });

        // Handle disconnection
        connection.socket.on("close", async () => {
          console.log(`🔌 User ${user.username} (${user.id}) disconnected`);
          
          // Set user offline
          await this.userAuth.setUserOnlineStatus(user.id, false);
          
          // Remove player from game
          if (playerInfo) {
            this.gameManager.removePlayer(playerInfo.connectionId);
          }
        });
      });
    });
  }
}

module.exports = WebSocketHandler;