const GameState = require('./GameState');
const GameLoop = require('./GameLoop');
const GameStatsHandler = require('./GameStatsHandler');
const WinScreenData = require('./WinScreenData');
const TournamentManager = require('./TournamentManager');
























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
    this.winScreenData = new WinScreenData(this.statsHandler, this.statsHandler.progression);
    
    // Initialize tournament manager
    this.tournamentManager = new TournamentManager();
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
    } else if (gameMode === 'tournament') {
      // Add to tournament queue
      return this.addToTournamentQueue(connection, connectionId, user);
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

  // Add authenticated user to tournament queue
  addToTournamentQueue(connection, connectionId, user) {
    console.log(`🏆 Adding ${user.username} to tournament queue`);
    
    // Add player to tournament manager
    const result = this.tournamentManager.addPlayerToQueue(connection, user);
    
    // Store player data
    this.players.set(connectionId, {
      roomId: null,
      role: 'tournament_waiting',
      connection,
      user,
      tournamentId: result.tournamentId || null
    });
    
    if (result.status === 'tournament_started') {
      console.log(`🎪 Tournament ${result.tournamentId} starting with 8 players!`);
      
      // Notify all players that tournament is starting
      const tournament = this.tournamentManager.getTournament(result.tournamentId);
      if (tournament) {
        // Create first round matches (quarter-finals)
        this.createTournamentMatches(tournament);
      }
      
      // Clean bracket data - remove connection objects to avoid circular JSON
      const cleanBracket = {
        quarterFinals: result.bracket.quarterFinals.map(match => ({
          match: match.match,
          player1: { username: match.player1.user.username, id: match.player1.user.id },
          player2: { username: match.player2.user.username, id: match.player2.user.id },
          winner: match.winner
        })),
        semiFinals: result.bracket.semiFinals.map(match => ({
          match: match.match,
          player1: match.player1 ? { username: match.player1.user.username, id: match.player1.user.id } : null,
          player2: match.player2 ? { username: match.player2.user.username, id: match.player2.user.id } : null,
          winner: match.winner
        })),
        finals: {
          match: result.bracket.finals.match,
          player1: result.bracket.finals.player1 ? { username: result.bracket.finals.player1.user.username, id: result.bracket.finals.player1.user.id } : null,
          player2: result.bracket.finals.player2 ? { username: result.bracket.finals.player2.user.username, id: result.bracket.finals.player2.user.id } : null,
          winner: result.bracket.finals.winner
        }
      };
      
      return {
        started: true,
        tournamentId: result.tournamentId,
        bracket: cleanBracket
      };
    } else {
      console.log(`� ${user.username} joined tournament queue (${result.position}/8)`);
      
      return {
        queued: true,
        queuePosition: result.position,
        queueSize: result.position,
        playerList: result.queuedPlayers
      };
    }
  }

  // Create tournament matches for the current round
  createTournamentMatches(tournament) {
    console.log(`📋 Creating matches for tournament ${tournament.id}, status: ${tournament.status}`);
    console.log(`📊 Current players in GameManager: ${this.players.size}`);
    
    let matches = [];
    
    if (tournament.status === 'quarter_finals') {
      matches = tournament.bracket.quarterFinals;
    } else if (tournament.status === 'semi_finals') {
      matches = tournament.bracket.semiFinals;
    } else if (tournament.status === 'finals') {
      matches = [tournament.bracket.finals];
    }
    
    console.log(`🎯 Found ${matches.length} matches to create`);
    
    // Create game rooms for each match
    for (const match of matches) {
      if (match.player1 && match.player2 && !match.winner) {
        console.log(`🔨 Creating match ${match.match}: ${match.player1.user.username} vs ${match.player2.user.username}`);
        this.createTournamentMatch(tournament.id, match);
      }
    }
  }

  // Create a single tournament match
  createTournamentMatch(tournamentId, match) {
    const roomId = this.generateRoomId();
    const gameState = new GameState('tournament');
    const gameLoop = new GameLoop(gameState);
    
    const player1Data = match.player1;
    const player2Data = match.player2;
    
    console.log(`🔍 Looking for connections - P1: ${player1Data.user.username} (ID: ${player1Data.user.id}), P2: ${player2Data.user.username} (ID: ${player2Data.user.id})`);
    
    // Find connection IDs for these players
    let player1ConnectionId = null;
    let player2ConnectionId = null;
    
    for (const [connId, playerInfo] of this.players.entries()) {
      console.log(`   Checking connection ${connId}: user ${playerInfo.user?.username} (ID: ${playerInfo.user?.id}), role: ${playerInfo.role}`);
      if (playerInfo.user && playerInfo.user.id === player1Data.user.id) {
        player1ConnectionId = connId;
        console.log(`   ✅ Found P1 connection: ${connId}`);
      }
      if (playerInfo.user && playerInfo.user.id === player2Data.user.id) {
        player2ConnectionId = connId;
        console.log(`   ✅ Found P2 connection: ${connId}`);
      }
    }
    
    if (!player1ConnectionId || !player2ConnectionId) {
      console.log(`❌ Could not find connections for tournament match ${match.match} - P1: ${player1ConnectionId}, P2: ${player2ConnectionId}`);
      return;
    }
    
    const gameRoom = {
      mode: 'tournament',
      tournamentId: tournamentId,
      matchId: match.match,
      gameState,
      gameLoop,
      players: new Set([player1ConnectionId, player2ConnectionId]),
      spectators: new Set(),
      authenticatedPlayers: new Map([
        [player1ConnectionId, player1Data.user],
        [player2ConnectionId, player2Data.user]
      ]),
      gameStartTime: Date.now(),
      wasActive: false,
      gameProcessed: false
    };

    this.games.set(roomId, gameRoom);
    
    // Update player data with room assignment
    this.players.set(player1ConnectionId, {
      roomId,
      role: 'player1',
      connection: player1Data.connection,
      user: player1Data.user,
      tournamentId: tournamentId,
      matchId: match.match
    });
    
    this.players.set(player2ConnectionId, {
      roomId,
      role: 'player2',
      connection: player2Data.connection,
      user: player2Data.user,
      tournamentId: tournamentId,
      matchId: match.match
    });

    // Initialize game
    gameState.resetBall();

    console.log(`🏆 Created tournament match ${match.match}: ${player1Data.user.username} vs ${player2Data.user.username} (Room: ${roomId})`);
    
    // Send match start messages to both players
    const matchStartMsg = {
      type: 'tournamentMatchReady',
      tournamentId: tournamentId,
      matchId: match.match,
      roomId: roomId,
      round: this.tournamentManager.getTournament(tournamentId).status,
      gameState: gameState.getState()
    };
    
    if (player1Data.connection) {
      player1Data.connection.send(JSON.stringify({
        ...matchStartMsg,
        playerRole: 'player1',
        opponent: {
          id: player2Data.user.id,
          username: player2Data.user.username
        }
      }));
    }
    
    if (player2Data.connection) {
      player2Data.connection.send(JSON.stringify({
        ...matchStartMsg,
        playerRole: 'player2',
        opponent: {
          id: player1Data.user.id,
          username: player1Data.user.username
        }
      }));
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
    console.log(`🎮 createMultiplayerGameAuth called:`);
    console.log(`  👤 Player1 (first to join): ${player1Data.user.username} (ID: ${player1Data.user.id}) → role: player1`);
    console.log(`  👤 Player2 (second to join): ${player2Data.user.username} (ID: ${player2Data.user.id}) → role: player2`);
    
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
      const isTournament = !!gameRoom.tournamentId;
      
      // Debug all player inputs
      console.log(`🎮 GameManager received from ${connectionId} (${player.role}):`, inputData);
      
      if (player.role === 'player1') {
        console.log(`➡️ Calling updatePlayerMovement for Player 1: p1DY=${inputData.player1DY || 0}`);
        gameRoom.gameState.updatePlayerMovement(inputData.player1DY || 0, null, 'player1', false, isTournament);
      } else if (player.role === 'player2') {
        console.log(`➡️ Calling updatePlayerMovement for Player 2: p2DY=${inputData.player2DY || 0}`);
        gameRoom.gameState.updatePlayerMovement(null, inputData.player2DY || 0, 'player2', false, isTournament);
      } else if (player.role === 'both') {
        console.log(`➡️ Calling updatePlayerMovement for Solo: p1DY=${inputData.player1DY || 0}, p2DY=${inputData.player2DY || 0}`);
        // Solo mode - handle both players
        gameRoom.gameState.updatePlayerMovement(inputData.player1DY || 0, inputData.player2DY || 0, null, true, false);
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
          // Game had meaningful progress - award win to remaining player
          console.log(`⚡ Player disconnected mid-game in ${player.roomId} - awarding win to remaining player`);
          
          const remainingPlayers = Array.from(gameRoom.players);
          if (remainingPlayers.length === 1) {
            const winnerId = remainingPlayers[0];
            const winnerData = this.players.get(winnerId);
            const disconnectedData = player;
            
            if (winnerData) {
              // Determine which player role disconnected
              const winnerRole = winnerData.role;
              const loserRole = disconnectedData.role;
              
              // Set final scores - winner gets 5, disconnected player keeps current score
              const currentState = gameRoom.gameState.getState();
              const winnerScore = 5; // Max score
              const loserScore = winnerRole === 'player1' ? currentState.player2.score : currentState.player1.score;
              
              // Update game state to reflect the win
              gameRoom.finalScores = {
                player1Score: winnerRole === 'player1' ? winnerScore : loserScore,
                player2Score: winnerRole === 'player2' ? winnerScore : loserScore
              };
              
              // Mark game as finished - update scores in the actual state
              if (winnerRole === 'player1') {
                currentState.player1.score = winnerScore;
                currentState.player2.score = loserScore;
              } else {
                currentState.player1.score = loserScore;
                currentState.player2.score = winnerScore;
              }
              currentState.winner = winnerRole === 'player1' ? 'Player 1' : 'Player 2';
              currentState.gameActive = false;
              gameRoom.gameEndTime = Date.now();
              
              console.log(`🏆 Awarding win by disconnection: ${winnerData.user.username} defeats ${disconnectedData.user.username} (${winnerScore}-${loserScore})`);
              
              // Check if this is a tournament match
              if (gameRoom.mode === 'tournament') {
                console.log(`🏆 Tournament match - will be processed as tournament result`);
                // Tournament matches are processed by processTournamentMatch in updateAllGames
              }
              
              // Notify winner
              if (winnerData.connection && winnerData.connection.readyState === 1) {
                winnerData.connection.send(JSON.stringify({
                  type: 'opponentDisconnected',
                  message: 'Your opponent disconnected. You win!',
                  winner: true
                }));
              }
              
              // Game will be processed normally by updateAllGames()
            }
          }
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

  // Process tournament match completion
  async processTournamentMatch(roomId, gameRoom, gameState) {
    try {
      console.log(`🏆 Processing tournament match: ${gameRoom.matchId} in tournament ${gameRoom.tournamentId}`);
      
      // Determine winner based on score
      // gameState is the raw state object, not the class instance
      const scores = {
        player1: gameRoom.finalScores?.player1Score || gameState.player1?.score || 0,
        player2: gameRoom.finalScores?.player2Score || gameState.player2?.score || 0
      };
      
      console.log(`📊 Tournament match scores: P1=${scores.player1}, P2=${scores.player2}`);
      
      let winnerId = null;
      let loserId = null;
      
      // Get player IDs from connection IDs
      const playerIds = Array.from(gameRoom.players.keys());
      const player1Id = playerIds[0];
      const player2Id = playerIds[1];
      
      if (scores.player1 > scores.player2) {
        winnerId = player1Id;
        loserId = player2Id;
      } else if (scores.player2 > scores.player1) {
        winnerId = player2Id;
        loserId = player1Id;
      } else {
        // Tie - should not happen in tournament, but handle gracefully
        console.log(`⚠️ Tournament match ${gameRoom.matchId} ended in a tie, using player1 as winner`);
        winnerId = player1Id;
        loserId = player2Id;
      }

      // Get user data for both players
      const winnerData = this.players.get(winnerId);
      const loserData = this.players.get(loserId);
      
      if (!winnerData || !loserData) {
        console.error('❌ Missing player data for tournament match');
        return;
      }

      // Record match result in tournament manager
      const result = this.tournamentManager.recordMatchResult(
        gameRoom.tournamentId,
        gameRoom.matchId,
        winnerData.user.id
      );

      if (!result.success) {
        console.error(`❌ Failed to record tournament match result: ${result.message}`);
        return;
      }

      console.log(`✅ Tournament match recorded: ${winnerData.user.username} defeats ${loserData.user.username}`);
      
      // Apply tournament rewards to both players
      const winnerRewards = result.winnerRewards;
      const loserRewards = result.loserRewards;
      
      await this.gameStatsHandler.applyTournamentRewards(winnerData.user.id, winnerRewards, true);
      await this.gameStatsHandler.applyTournamentRewards(loserData.user.id, loserRewards, false);
      
      console.log(`💰 Applied rewards - Winner: +${winnerRewards.rating_change} RR, +${winnerRewards.xp_gain} XP | Loser: ${loserRewards.rating_change} RR, ${loserRewards.xp_gain} XP`);
      
      // Get updated stats for both players
      const winnerStats = await this.gameStatsHandler.getPlayerStats(winnerData.user.id);
      const loserStats = await this.gameStatsHandler.getPlayerStats(loserData.user.id);
      
      // Determine if winner needs to wait for next match
      const hasNextRound = result.nextRound && !result.tournamentComplete;
      
      // Send match result to winner
      if (winnerData.connection && winnerData.connection.readyState === 1) {
        winnerData.connection.send(JSON.stringify({
          type: 'tournamentMatchResult',
          won: true,
          opponentUsername: loserData.user.username,
          ratingChange: winnerRewards.rating_change,
          xpGain: winnerRewards.xp_gain,
          round: result.round,
          tournamentComplete: result.tournamentComplete,
          isTournamentWinner: result.tournamentComplete && result.tournamentWinner === winnerData.user.id,
          waitingForNextRound: hasNextRound,
          newRating: winnerStats.ranked_rating,
          newXp: winnerStats.xp,
          newLevel: winnerStats.level
        }));
      }
      
      // Send match result to loser
      if (loserData.connection && loserData.connection.readyState === 1) {
        loserData.connection.send(JSON.stringify({
          type: 'tournamentMatchResult',
          won: false,
          opponentUsername: winnerData.user.username,
          ratingChange: loserRewards.rating_change,
          xpGain: loserRewards.xp_gain,
          round: result.round,
          tournamentComplete: false, // Loser is out
          isTournamentWinner: false,
          waitingForNextRound: false,
          newRating: loserStats.ranked_rating,
          newXp: loserStats.xp,
          newLevel: loserStats.level
        }));
        
        // Update loser's role to 'waiting' so they can rejoin queue
        this.players.set(loserId, {
          ...loserData,
          roomId: null,
          role: 'waiting',
          tournamentId: null,
          matchId: null
        });
      }
      
      // If tournament is complete, notify winner
      if (result.tournamentComplete && result.tournamentWinner) {
        const championData = this.players.get(result.tournamentWinner.toString());
        if (championData && championData.connection && championData.connection.readyState === 1) {
          championData.connection.send(JSON.stringify({
            type: 'tournamentChampion',
            username: championData.user.username
          }));
        }
      }
      
      // If tournament has next round, create next matches after a delay
      if (result.nextRound && !result.tournamentComplete) {
        console.log(`🎯 Tournament ${gameRoom.tournamentId} advancing to ${result.nextRound}`);
        setTimeout(() => {
          this.createTournamentMatches(this.tournamentManager.getTournament(gameRoom.tournamentId));
        }, 3000); // 3 second delay before next round
      }
      
    } catch (error) {
      console.error('❌ Error processing tournament match:', error);
    }
  }

  // Process game completion and update player statistics
  async processGameCompletion(roomId, gameRoom, gameState) {
    try {
      console.log(`🎯 Processing completion for game ${roomId}`);
      
      // Check if this is a tournament match
      if (gameRoom.mode === 'tournament' && gameRoom.tournamentId && gameRoom.matchId) {
        return await this.processTournamentMatch(roomId, gameRoom, gameState);
      }
      
      // Calculate game duration for logging
      const gameDuration = gameRoom.gameStartTime 
        ? Math.floor((gameRoom.gameEndTime - gameRoom.gameStartTime) / 1000)
        : 0;
      
      console.log(`🔍 Duration debug:`, {
        gameStartTime: gameRoom.gameStartTime,
        gameEndTime: gameRoom.gameEndTime,
        rawDuration: gameRoom.gameEndTime - gameRoom.gameStartTime,
        calculatedDuration: gameDuration
      });
      
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
      let actualPlayer1Score, actualPlayer2Score;
      
      // Handle cases where one or both players might have disconnected
      if (player1Info && player2Info) {
        // Both players present - use normal role mapping
        if (player1Info.role === 'player1' && player2Info.role === 'player2') {
          actualPlayer1Info = player1Info;
          actualPlayer2Info = player2Info;
          actualPlayer1Score = gameState.player1.score;
          actualPlayer2Score = gameState.player2.score;
        } else if (player1Info.role === 'player2' && player2Info.role === 'player1') {
          // FIXED: Swap both players AND their scores
          actualPlayer1Info = player2Info;  // player2Info has role 'player1'
          actualPlayer2Info = player1Info;  // player1Info has role 'player2'
          actualPlayer1Score = gameState.player1.score;  // player1 score goes to actual player1
          actualPlayer2Score = gameState.player2.score;  // player2 score goes to actual player2
        } else {
          // Fallback mapping
          const playerList = [player1Info, player2Info];
          actualPlayer1Info = playerList.find(p => p.role === 'player1') || player1Info;
          actualPlayer2Info = playerList.find(p => p.role === 'player2') || player2Info;
          actualPlayer1Score = gameState.player1.score;
          actualPlayer2Score = gameState.player2.score;
        }
      } else if (player1Info && !player2Info) {
        // Only player1 present
        actualPlayer1Info = player1Info.role === 'player1' ? player1Info : null;
        actualPlayer2Info = player1Info.role === 'player2' ? player1Info : null;
        actualPlayer1Score = gameState.player1.score;
        actualPlayer2Score = gameState.player2.score;
      } else if (!player1Info && player2Info) {
        // Only player2 present  
        actualPlayer1Info = player2Info.role === 'player1' ? player2Info : null;
        actualPlayer2Info = player2Info.role === 'player2' ? player2Info : null;
        actualPlayer1Score = gameState.player1.score;
        actualPlayer2Score = gameState.player2.score;
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
        player1Score: actualPlayer1Score,
        player2Score: actualPlayer2Score,
        gameMode: gameMode,
        aiDifficulty: gameRoom.gameState.aiDifficulty,
        gameDuration: gameDuration,
        totalVolleys: gameState.totalVolleys || 0  // Add volleys count
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
        
        // Generate win screen data BEFORE applying stats (to show before/after comparison)
        const winScreenData = await this.winScreenData.generateWinScreenData(
          gameResult, 
          actualPlayer1Info, 
          actualPlayer2Info
        );
        
        console.log(`🎯 Win screen mapping:`, {
          player1Info: actualPlayer1Info?.user?.username || 'null',
          player2Info: actualPlayer2Info?.user?.username || 'null',
          player1Score: gameResult.player1Score,
          player2Score: gameResult.player2Score,
          player1Won: gameResult.player1Score > gameResult.player2Score,
          player2Won: gameResult.player2Score > gameResult.player1Score,
          winScreenPlayer1Result: winScreenData?.player1?.result,
          winScreenPlayer2Result: winScreenData?.player2?.result
        });
        
        await this.statsHandler.processGameCompletion(gameResult);
        
        // Send win screen data to connected players
        if (winScreenData) {
          this.sendWinScreenData(actualPlayer1Info, actualPlayer2Info, winScreenData);
        }
        
        // Send updated stats to connected players
        await this.sendUpdatedStats(actualPlayer1Info, actualPlayer2Info, gameMode);
      } else {
        console.log(`⚠️ Skipping stats update - missing player IDs`);
      }

    } catch (error) {
      console.error(`❌ Error processing game completion for ${roomId}:`, error);
    }
  }

  // Send win screen data to connected players
  sendWinScreenData(player1Info, player2Info, winScreenData) {
    try {
      if (player1Info?.connection && winScreenData.player1) {
        player1Info.connection.send(JSON.stringify({
          type: 'gameResult',
          data: winScreenData.player1,
          matchData: winScreenData.matchData
        }));
        console.log(`🎉 Sent win screen data to ${winScreenData.player1.username}: ${winScreenData.player1.result}`);
      }

      if (player2Info?.connection && winScreenData.player2) {
        player2Info.connection.send(JSON.stringify({
          type: 'gameResult',
          data: winScreenData.player2,
          matchData: winScreenData.matchData
        }));
        console.log(`🎉 Sent win screen data to ${winScreenData.player2.username}: ${winScreenData.player2.result}`);
      }
    } catch (error) {
      console.error('❌ Error sending win screen data:', error);
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