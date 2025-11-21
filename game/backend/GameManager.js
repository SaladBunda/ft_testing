const GameState = require('./GameState');
const GameLoop = require('./GameLoop');
const GameStatsHandler = require('./GameStatsHandler');
























class GameManager {
  constructor(userAuth) {
    // Store all game rooms
    this.games = new Map(); // roomId -> { gameState, gameLoop, players: Set(), spectators: Set() }
    this.players = new Map(); // connectionId -> { roomId, role, connection }
    this.waitingPlayers = []; // Players waiting to be matched
    this.nextGameId = 1;
    
    // Initialize stats handler
    this.userAuth = userAuth;
    this.statsHandler = new GameStatsHandler(userAuth);
  }

  // Generate unique connection ID
  generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate unique room ID
  generateRoomId() {
    return `room_${this.nextGameId++}`;
  }

  // Add a new authenticated player connection
  addAuthenticatedPlayer(connection, user, gameMode = 'matchmaking', aiDifficulty = null) {
    // Check if user is already connected
    const existingPlayer = this.findPlayerByUserId(user.id);
    if (existingPlayer) {
      console.log(`User ${user.username} is already connected, disconnecting old connection`);
      this.removePlayer(existingPlayer.connectionId);
    }

    const connectionId = this.generateConnectionId();
    
    if (gameMode === 'solo') {
      // Create a solo game (practice mode)
      return this.createSoloGameAuth(connection, connectionId, user, 'solo');
    } else if (gameMode === 'ai') {
      // Create an AI game
      return this.createSoloGameAuth(connection, connectionId, user, 'ai', aiDifficulty);
    } else {
      // Add to matchmaking queue
      return this.addToMatchmakingAuth(connection, connectionId, user);
    }
  }

  // Find player by user ID
  findPlayerByUserId(userId) {
    for (const [connectionId, playerData] of this.players.entries()) {
      if (playerData.user && playerData.user.id === userId) {
        return { connectionId, ...playerData };
      }
    }
    return null;
  }

  // Add a new player connection (legacy method, keep for compatibility)
  addPlayer(connection, gameMode = 'matchmaking', aiDifficulty = null) {
    const connectionId = this.generateConnectionId();
    
    if (gameMode === 'solo') {
      // Create a solo game (practice mode)
      return this.createSoloGame(connection, connectionId, 'solo');
    } else if (gameMode === 'ai') {
      // Create an AI game
      return this.createSoloGame(connection, connectionId, 'ai', aiDifficulty);
    } else {
      // Add to matchmaking queue
      return this.addToMatchmaking(connection, connectionId);
    }
  }

  // Create a solo game for practice
  createSoloGame(connection, connectionId, gameType = 'solo', aiDifficulty = null) {
    const roomId = this.generateRoomId();
    const gameState = new GameState(gameType, aiDifficulty);
    const gameLoop = new GameLoop(gameState, true); // Pass true for solo mode
    
    const game = {
      mode: gameType || 'solo',
      players: new Set([connectionId]),
      spectators: new Set(),
      gameState,
      gameLoop,
      createdAt: Date.now(),
      gameStartTime: Date.now(),
      wasActive: false,
      gameProcessed: false
    };

    this.games.set(roomId, game);
    
    // Register the player
    this.players.set(connectionId, {
      roomId,
      role: 'both',
      connection
    });

    // Initialize the game
    gameState.resetBall();

    console.log(`Created solo game ${roomId} for player ${connectionId}`);
    
    return {
      connectionId,
      roomId,
      role: 'both',
      gameType: 'solo',
      gameState: gameState.getState()
    };
  }

  // Create a solo game for authenticated user
  createSoloGameAuth(connection, connectionId, user, gameType = 'solo', aiDifficulty = null) {
    const roomId = this.generateRoomId();
    const gameState = new GameState(gameType, aiDifficulty);
    const gameLoop = new GameLoop(gameState, true); // Pass true for solo mode
    
    const game = {
      mode: gameType || 'solo',
      players: new Set([connectionId]),
      spectators: new Set(),
      gameState,
      gameLoop,
      createdAt: Date.now(),
      gameStartTime: Date.now(),
      wasActive: false,
      gameProcessed: false,
      authenticatedPlayers: new Map([[connectionId, user]])
    };

    this.games.set(roomId, game);
    
    // Register the authenticated player
    this.players.set(connectionId, {
      roomId,
      role: 'both',
      connection,
      user
    });

    // Initialize the game
    gameState.resetBall();

    console.log(`Created ${gameType} game ${roomId} for user ${user.username} (${user.id})`);
    
    return {
      connectionId,
      roomId,
      role: 'both',
      user,
      gameType,
      gameState: gameState.getState()
    };
  }

  // Add player to matchmaking queue
  addToMatchmaking(connection, connectionId) {
    // Check if there's a waiting player
    if (this.waitingPlayers.length > 0) {
      // Match with waiting player
      const waitingPlayer = this.waitingPlayers.shift();
      return this.createMultiplayerGame(waitingPlayer, { connection, connectionId });
    } else {
      // Add to waiting queue
      this.waitingPlayers.push({ connection, connectionId });
      
      this.players.set(connectionId, {
        roomId: null,
        role: 'waiting',
        connection
      });

      console.log(`Player ${connectionId} added to waiting queue`);
      
      return {
        connectionId,
        roomId: null,
        role: 'waiting',
        gameType: 'multiplayer',
        gameState: null
      };
    }
  }

  // Add authenticated user to matchmaking queue
  addToMatchmakingAuth(connection, connectionId, user) {
    console.log(`🎯 addToMatchmakingAuth called for ${user.username} (${user.id})`);
    console.log(`📊 Current waiting queue length: ${this.waitingPlayers.length}`);
    
    // Check if there's a waiting player
    if (this.waitingPlayers.length > 0) {
      console.log(`🎮 Found waiting player, attempting to create match...`);
      // Match with waiting player
      const waitingPlayer = this.waitingPlayers.shift();
      console.log(`🔗 Matching ${user.username} with ${waitingPlayer.user.username}`);
      return this.createMultiplayerGameAuth(waitingPlayer, { connection, connectionId, user });
    } else {
      console.log(`⏳ No waiting players, adding ${user.username} to queue`);
      // Add to waiting queue
      this.waitingPlayers.push({ connection, connectionId, user });
      
      this.players.set(connectionId, {
        roomId: null,
        role: 'waiting',
        connection,
        user
      });

      console.log(`User ${user.username} (${user.id}) added to waiting queue`);
      
      return {
        connectionId,
        roomId: null,
        role: 'waiting',
        user,
        gameType: 'multiplayer',
        gameState: null
      };
    }
  }

  // Create a multiplayer game between two players
  createMultiplayerGame(player1Data, player2Data) {
    const roomId = this.generateRoomId();
    const gameState = new GameState();
    const gameLoop = new GameLoop(gameState);
    
    const gameRoom = {
      mode: 'multiplayer',
      gameState,
      gameLoop,
      players: new Set([player1Data.connectionId, player2Data.connectionId]),
      spectators: new Set(),
      gameStartTime: Date.now(),
      wasActive: false,
      gameProcessed: false
    };

    this.games.set(roomId, gameRoom);
    
    // Assign roles
    this.players.set(player1Data.connectionId, {
      roomId,
      role: 'player1',
      connection: player1Data.connection
    });
    
    this.players.set(player2Data.connectionId, {
      roomId,
      role: 'player2',
      connection: player2Data.connection
    });

    // Initialize game
    gameState.resetBall();

    console.log(`Created multiplayer game ${roomId}: ${player1Data.connectionId} vs ${player2Data.connectionId}`);
    
    // Return info for both players
    return {
      player1: {
        connectionId: player1Data.connectionId,
        roomId,
        role: 'player1',
        gameType: 'multiplayer',
        gameState: gameState.getState()
      },
      player2: {
        connectionId: player2Data.connectionId,
        roomId,
        role: 'player2',
        gameType: 'multiplayer',
        gameState: gameState.getState()
      }
    };
  }

  // Create an authenticated multiplayer game between two users
  createMultiplayerGameAuth(player1Data, player2Data) {
    console.log(`🎮 createMultiplayerGameAuth called: ${player1Data.user.username} vs ${player2Data.user.username}`);
    const roomId = this.generateRoomId();
    const gameState = new GameState();
    const gameLoop = new GameLoop(gameState);
    
    const gameRoom = {
      mode: 'multiplayer',
      gameState,
      gameLoop,
      players: new Set([player1Data.connectionId, player2Data.connectionId]),
      spectators: new Set(),
      authenticatedPlayers: new Map([
        [player1Data.connectionId, player1Data.user],
        [player2Data.connectionId, player2Data.user]
      ])
    };

    this.games.set(roomId, gameRoom);
    
    // Assign roles with user data
    this.players.set(player1Data.connectionId, {
      roomId,
      role: 'player1',
      connection: player1Data.connection,
      user: player1Data.user
    });
    
    this.players.set(player2Data.connectionId, {
      roomId,
      role: 'player2',
      connection: player2Data.connection,
      user: player2Data.user
    });

    // Initialize game
    gameState.resetBall();

    console.log(`Created authenticated multiplayer game ${roomId}: ${player1Data.user.username} vs ${player2Data.user.username}`);
    
    // Return info for both players with opponent data
    return {
      player1: {
        connectionId: player1Data.connectionId,
        roomId,
        role: 'player1',
        user: player1Data.user,
        connection: player1Data.connection, // Include connection for message sending
        gameType: 'multiplayer',
        gameState: gameState.getState(),
        opponent: {
          id: player2Data.user.id,
          username: player2Data.user.username,
          name: player2Data.user.name,
          level: player2Data.user.gameStats?.level || 1,
          rankTier: player2Data.user.gameStats?.rankTier || 'Bronze'
        }
      },
      player2: {
        connectionId: player2Data.connectionId,
        roomId,
        role: 'player2',
        user: player2Data.user,
        connection: player2Data.connection, // Include connection for message sending
        gameType: 'multiplayer',
        gameState: gameState.getState(),
        opponent: {
          id: player1Data.user.id,
          username: player1Data.user.username,
          name: player1Data.user.name,
          level: player1Data.user.gameStats?.level || 1,
          rankTier: player1Data.user.gameStats?.rankTier || 'Bronze'
        }
      }
    };
  }

  // Handle player input
  handlePlayerInput(connectionId, inputData) {
    const player = this.players.get(connectionId);
    if (!player || !player.roomId) return;

    const gameRoom = this.games.get(player.roomId);
    if (!gameRoom) return;

    if (inputData.type === 'update') {
      // Handle movement based on player role and game mode
      const isSolo = gameRoom.mode === 'solo';
      
      // Debug all player inputs
      console.log(`🎮 GameManager received from ${connectionId} (${player.role}):`, inputData);
      
      if (player.role === 'player1') {
        console.log(`➡️ Calling updatePlayerMovement for Player 1: p1DY=${inputData.player1DY || 0}`);
        gameRoom.gameState.updatePlayerMovement(inputData.player1DY || 0, null, 'player1', false);
      } else if (player.role === 'player2') {
        console.log(`➡️ Calling updatePlayerMovement for Player 2: p2DY=${inputData.player2DY || 0}`);
        gameRoom.gameState.updatePlayerMovement(null, inputData.player2DY || 0, 'player2', false);
      } else if (player.role === 'both') {
        console.log(`➡️ Calling updatePlayerMovement for Solo: p1DY=${inputData.player1DY || 0}, p2DY=${inputData.player2DY || 0}`);
        // Solo mode - handle both players
        gameRoom.gameState.updatePlayerMovement(inputData.player1DY || 0, inputData.player2DY || 0, null, true);
      }
    } else if (inputData.type === 'reset') {
      console.log(`Reset requested by ${connectionId} in room ${player.roomId}`);
      
      if (gameRoom.mode === 'solo') {
        // In solo mode, just reset the game
        gameRoom.gameState.resetGame();
      } else {
        // In multiplayer mode, remove player from game and return to waiting
        this.removePlayerFromGame(connectionId);
        
        // Send player back to game selection
        player.connection.send(JSON.stringify({
          type: 'gameLeft',
          message: 'You left the game. Choose a new game mode.'
        }));
      }
    }
  }

  // Update all games
  updateAllGames() {
    for (const [roomId, gameRoom] of this.games) {
      const gameState = gameRoom.gameState.getState();
      const wasActive = gameRoom.wasActive !== false; // Track if game was previously active
      
      // Store final scores if game just finished
      if (gameState.winner && wasActive && !gameRoom.gameProcessed && !gameRoom.finalScores) {
        gameRoom.finalScores = {
          player1Score: gameState.player1.score,
          player2Score: gameState.player2.score,
          winner: gameState.winner,
          timestamp: Date.now()
        };
        console.log(`🎯 FINAL SCORES STORED for ${roomId}: P1=${gameRoom.finalScores.player1Score}, P2=${gameRoom.finalScores.player2Score}, Winner: ${gameRoom.finalScores.winner}`);
      }
      
      // Check if game just ended (only process when there's actually a winner)
      if (gameState.winner && wasActive && !gameRoom.gameProcessed) {
        console.log(`🏁 Game ${roomId} just ended! Winner: ${gameState.winner}`);
        console.log(`🎯 Final scores at game end: P1=${gameState.player1.score}, P2=${gameState.player2.score}`);
        console.log(`🎯 RAW GAME STATE AT END:`, JSON.stringify(gameState, null, 2));
        
        // Use stored final scores if available, otherwise use current game state
        const finalP1Score = gameRoom.finalScores ? gameRoom.finalScores.player1Score : gameState.player1.score;
        const finalP2Score = gameRoom.finalScores ? gameRoom.finalScores.player2Score : gameState.player2.score;
        console.log(`🎯 USING SCORES: P1=${finalP1Score}, P2=${finalP2Score} (from ${gameRoom.finalScores ? 'stored' : 'current'} data)`);
        
        // Check if game was aborted due to early disconnection
        if (gameRoom.aborted) {
          console.log(`🚫 Game ${roomId} was aborted - skipping all processing`);
          gameRoom.gameProcessed = true;
          gameRoom.gameEndTime = Date.now();
          continue;
        }
        
        // Only process stats if game actually had meaningful gameplay
        // Check if someone reached the winning score (5 points) or if there was actual scoring
        const totalScore = finalP1Score + finalP2Score;
        const someoneReachedWinningScore = finalP1Score >= 5 || finalP2Score >= 5;
        const hadMeaningfulGameplay = totalScore >= 1 || someoneReachedWinningScore;
        
        console.log(`🔍 Game completion validation:`, {
          totalScore,
          someoneReachedWinningScore,
          hadMeaningfulGameplay,
          winner: gameState.winner,
          countdown: gameState.countdown,
          aborted: gameRoom.aborted
        });
        
        // Mark game as processed to prevent multiple processing
        gameRoom.gameProcessed = true;
        gameRoom.gameEndTime = Date.now();
        
        if (hadMeaningfulGameplay) {
          // Create a snapshot of the final game state with captured scores
          const finalGameState = {
            ...gameState,
            player1: { ...gameState.player1, score: finalP1Score },
            player2: { ...gameState.player2, score: finalP2Score }
          };
          
          console.log(`✅ Processing stats for completed game with meaningful gameplay`);
          // Process game completion for stats (pass scores immediately to avoid reset issues)
          this.processGameCompletion(roomId, gameRoom, finalGameState)
            .catch(err => console.error(`❌ Error processing game completion for ${roomId}:`, err));
        } else {
          console.log(`⚠️ Skipping stats processing - game ended without meaningful gameplay (disconnection during countdown/early game)`);
        }
        
        continue;
      }
      
      // Skip updating if game has a winner (truly finished), but clean up after timeout
      if (gameState.winner) {
        // Remove finished games after 5 seconds to prevent infinite logging
        const timeSinceEnd = gameRoom.gameEndTime ? (Date.now() - gameRoom.gameEndTime) : 0;
        if (timeSinceEnd > 5000) {
          console.log(`🧹 Cleaning up finished game ${roomId} (${timeSinceEnd}ms old)`);
          this.games.delete(roomId);
          continue;
        }
        
        gameRoom.wasActive = false;
        continue;
      }
      
      // Mark game as active (including countdown periods)
      gameRoom.wasActive = true;
      
      // Update game physics (this will handle countdown internally)
      gameRoom.gameLoop.updateGame();
      
      // Broadcast to all players in this room
      this.broadcastToRoom(roomId, gameState);
    }
  }

  // Broadcast message to all players in a room
  broadcastToRoom(roomId, message) {
    const gameRoom = this.games.get(roomId);
    if (!gameRoom) return;

    const messageStr = JSON.stringify(message);
    
    // Send to all players
    for (const connectionId of gameRoom.players) {
      const player = this.players.get(connectionId);
      if (player && player.connection.readyState === 1) { // WebSocket.OPEN
        player.connection.send(messageStr);
      }
    }
    
    // Send to spectators
    for (const connectionId of gameRoom.spectators) {
      const spectator = this.players.get(connectionId);
      if (spectator && spectator.connection.readyState === 1) {
        spectator.connection.send(messageStr);
      }
    }
  }

  // Remove player from current game but keep connection alive
  removePlayerFromGame(connectionId) {
    const player = this.players.get(connectionId);
    if (!player || !player.roomId) return;

    const gameRoom = this.games.get(player.roomId);
    if (gameRoom) {
      // Remove from game room
      gameRoom.players.delete(connectionId);
      
      // Clean up game if no players left
      if (gameRoom.players.size === 0) {
        gameRoom.gameState.cleanup();
        this.games.delete(player.roomId);
        console.log(`Deleted empty game room ${player.roomId}`);
      } else {
        // Notify remaining players
        const remainingPlayers = Array.from(gameRoom.players);
        for (const playerId of remainingPlayers) {
          const otherPlayer = this.players.get(playerId);
          if (otherPlayer && otherPlayer.connection.readyState === 1) {
            otherPlayer.connection.send(JSON.stringify({
              type: 'playerLeft',
              message: 'Your opponent left the game.'
            }));
          }
        }
      }
    }

    // Update player info to remove room assignment
    this.players.set(connectionId, {
      ...player,
      roomId: null,
      role: 'waiting'
    });
  }

  // Remove player and clean up
  removePlayer(connectionId) {
    const player = this.players.get(connectionId);
    if (!player) return;

    // Remove from waiting queue if present
    this.waitingPlayers = this.waitingPlayers.filter(p => p.connectionId !== connectionId);

    if (player.roomId) {
      const gameRoom = this.games.get(player.roomId);
      if (gameRoom) {
        const gameState = gameRoom.gameState.getState();
        const totalScore = gameState.player1.score + gameState.player2.score;
        const gameHadMeaningfulProgress = totalScore > 0 || gameState.countdown === 0;
        
        console.log(`🔌 Player disconnection in room ${player.roomId}:`, {
          playersRemaining: gameRoom.players.size - 1,
          totalScore,
          countdown: gameState.countdown,
          gameHadMeaningfulProgress,
          gameActive: gameState.gameActive
        });
        
        // Remove from game room
        gameRoom.players.delete(connectionId);
        gameRoom.spectators.delete(connectionId);
        
        // Clean up game state
        gameRoom.gameState.cleanup();
        
        // If no players left, remove the game
        if (gameRoom.players.size === 0) {
          console.log(`Removing empty game room ${player.roomId}`);
          this.games.delete(player.roomId);
        } else if (!gameHadMeaningfulProgress) {
          // If game hadn't started yet (still in countdown or no scoring), just end it cleanly without stats processing
          console.log(`🚫 Aborting game ${player.roomId} - no meaningful progress made (disconnection during countdown/early game)`);
          gameRoom.gameProcessed = true; // Mark as processed to prevent stats processing
          gameRoom.aborted = true; // Flag as aborted rather than completed
          
          // Notify remaining player
          const remainingPlayers = Array.from(gameRoom.players);
          for (const playerId of remainingPlayers) {
            const otherPlayer = this.players.get(playerId);
            if (otherPlayer && otherPlayer.connection.readyState === 1) {
              otherPlayer.connection.send(JSON.stringify({
                type: 'gameAborted',
                message: 'Game was cancelled due to early disconnection. No stats affected.',
                reason: 'early_disconnection'
              }));
            }
          }
        } else {
          console.log(`Player ${connectionId} left room ${player.roomId}, ${gameRoom.players.size} players remaining`);
          // Game had meaningful progress, normal disconnection handling continues
        }
      }
    }

    this.players.delete(connectionId);
    console.log(`Player ${connectionId} removed from game manager`);
  }

  // Get player info
  getPlayerInfo(connectionId) {
    return this.players.get(connectionId);
  }

  // Get game room info
  getGameRoom(roomId) {
    return this.games.get(roomId);
  }

  // Get stats
  getStats() {
    return {
      totalGames: this.games.size,
      totalPlayers: this.players.size,
      waitingPlayers: this.waitingPlayers.length,
      games: Array.from(this.games.entries()).map(([roomId, room]) => ({
        roomId,
        playerCount: room.players.size,
        type: room.type
      }))
    };
  }

  // Process game completion and update player statistics
  async processGameCompletion(roomId, gameRoom, gameState) {
    try {
      console.log(`🎯 Processing completion for game ${roomId}`);
      
      // Calculate game duration for logging
      const gameDuration = gameRoom.gameStartTime 
        ? Math.floor((gameRoom.gameEndTime - gameRoom.gameStartTime) / 1000)
        : 0;
      const totalScore = gameState.player1.score + gameState.player2.score;
      
      console.log(`📊 Game ${roomId} stats: duration=${gameDuration}s, total_score=${totalScore}, winner=${gameState.winner}`);
      
      // Get players in this room
      const players = Array.from(gameRoom.players);
      console.log(`👥 Players in room: ${players.length}`);
      
      // Process stats even if only 1 player (disconnection = loss for disconnected player)
      if (players.length === 0) {
        console.log(`⚠️ No players found for game ${roomId}, skipping`);
        return;
      }

      // Get player data - handle disconnected players gracefully
      const player1Info = this.players.get(players[0]);
      const player2Info = players[1] ? this.players.get(players[1]) : null;

      console.log(`👥 Player info: P1=${!!player1Info} P2=${!!player2Info}`);

      // For disconnected players, we still want to process stats
      // If only 1 player, they win by default
      if (!player1Info && !player2Info) {
        console.log(`⚠️ No valid player info for game ${roomId}`);
        return;
      }

      // Determine game mode
      let gameMode = 'matchmaking';
      if (gameRoom.gameState.gameMode === 'solo') {
        gameMode = 'solo';
      } else if (gameRoom.gameState.gameMode === 'ai') {
        gameMode = 'ai';
      }

      // Create game result object - Map players correctly, handling disconnections
      let actualPlayer1Info, actualPlayer2Info;
      
      // Handle cases where one or both players might have disconnected
      if (player1Info && player2Info) {
        // Both players present - use normal role mapping
        if (player1Info.role === 'player1' && player2Info.role === 'player2') {
          actualPlayer1Info = player1Info;
          actualPlayer2Info = player2Info;
        } else if (player1Info.role === 'player2' && player2Info.role === 'player1') {
          actualPlayer1Info = player2Info;
          actualPlayer2Info = player1Info;
        } else {
          // Fallback mapping
          const playerList = [player1Info, player2Info];
          actualPlayer1Info = playerList.find(p => p.role === 'player1') || player1Info;
          actualPlayer2Info = playerList.find(p => p.role === 'player2') || player2Info;
        }
      } else if (player1Info && !player2Info) {
        // Only player1 present
        actualPlayer1Info = player1Info.role === 'player1' ? player1Info : null;
        actualPlayer2Info = player1Info.role === 'player2' ? player1Info : null;
      } else if (!player1Info && player2Info) {
        // Only player2 present  
        actualPlayer1Info = player2Info.role === 'player1' ? player2Info : null;
        actualPlayer2Info = player2Info.role === 'player2' ? player2Info : null;
      } else {
        console.log(`❌ No valid players for ${roomId}`);
        return;
      }

      console.log(`🔍 Role debugging:`, {
        originalPlayer1: player1Info ? `${player1Info.user?.username} (role: ${player1Info.role})` : 'DISCONNECTED',
        originalPlayer2: player2Info ? `${player2Info.user?.username} (role: ${player2Info.role})` : 'DISCONNECTED',
        mappedPlayer1: actualPlayer1Info ? `${actualPlayer1Info.user?.username} (role: ${actualPlayer1Info.role})` : 'NULL',
        mappedPlayer2: actualPlayer2Info ? `${actualPlayer2Info.user?.username} (role: ${actualPlayer2Info.role})` : 'NULL'
      });

      const gameResult = {
        player1Id: actualPlayer1Info?.user?.id || null,
        player2Id: actualPlayer2Info?.user?.id || null,
        player1Score: gameState.player1.score,
        player2Score: gameState.player2.score,
        gameMode: gameMode,
        aiDifficulty: gameRoom.gameState.aiDifficulty,
        gameDuration: gameDuration
      };

      console.log(`🎯 CRITICAL DEBUG - Game completion data:`, {
        roomId: roomId,
        gameEndTime: gameRoom.gameEndTime,
        gameState: {
          player1Score: gameState.player1.score,
          player2Score: gameState.player2.score,
          winner: gameState.winner,
          gameActive: gameState.gameActive
        },
        actualPlayer1: actualPlayer1Info ? `${actualPlayer1Info.user?.username} (ID: ${actualPlayer1Info.user?.id}) (role: ${actualPlayer1Info.role})` : 'NULL',
        actualPlayer2: actualPlayer2Info ? `${actualPlayer2Info.user?.username} (ID: ${actualPlayer2Info.user?.id}) (role: ${actualPlayer2Info.role})` : 'NULL',
        finalGameResult: {
          player1Id: gameResult.player1Id,
          player2Id: gameResult.player2Id,
          player1Score: gameResult.player1Score,
          player2Score: gameResult.player2Score,
          whoWon: gameResult.player1Score > gameResult.player2Score ? 
            `Player1 (${actualPlayer1Info?.user?.username || 'disconnected'})` : 
            `Player2 (${actualPlayer2Info?.user?.username || 'disconnected'})`
        }
      });

      console.log(`🎯 Mapped players correctly:`, {
        actualPlayer1: actualPlayer1Info ? `${actualPlayer1Info.user?.username} (role: ${actualPlayer1Info.role})` : 'NULL',
        actualPlayer2: actualPlayer2Info ? `${actualPlayer2Info.user?.username} (role: ${actualPlayer2Info.role})` : 'NULL',
        scores: `${gameResult.player1Score}-${gameResult.player2Score}`,
        rawGameState: {
          player1Score: gameState.player1.score,
          player2Score: gameState.player2.score,
          winner: gameState.winner,
          gameActive: gameState.gameActive
        }
      });

      // Process stats for any authenticated players (including disconnected scenarios)
      if (gameResult.player1Id || gameResult.player2Id) {
        console.log(`🏆 Processing stats for game result:`, gameResult);
        await this.statsHandler.processGameCompletion(gameResult);
        
        // Send updated stats to connected players
        await this.sendUpdatedStats(actualPlayer1Info, actualPlayer2Info, gameMode);
      } else {
        console.log(`⚠️ Skipping stats update - missing player IDs`);
      }

    } catch (error) {
      console.error(`❌ Error processing game completion for ${roomId}:`, error);
    }
  }

  // Send updated player statistics after game completion
  async sendUpdatedStats(player1Info, player2Info, gameMode) {
    try {
      if (player1Info?.user?.id && player1Info?.connection) {
        const p1Stats = await this.statsHandler.getPlayerProgression(player1Info.user.id);
        player1Info.connection.send(JSON.stringify({
          type: 'statsUpdated',
          stats: p1Stats
        }));
      }

      if (player2Info?.user?.id && player2Info?.connection && gameMode === 'matchmaking') {
        const p2Stats = await this.statsHandler.getPlayerProgression(player2Info.user.id);
        player2Info.connection.send(JSON.stringify({
          type: 'statsUpdated',
          stats: p2Stats
        }));
      }
    } catch (error) {
      console.error('❌ Error sending updated stats:', error);
    }
  }
}

module.exports = GameManager;