import React, { useEffect, useRef, useState } from "react";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [screen, setScreen] = useState<"start" | "waiting" | "game" | "end" | "tournamentWaiting" | "tournamentMatchReady">("start");
  const [isConnected, setIsConnected] = useState(false);
  const [playerInfo, setPlayerInfo] = useState<any>(null);
  const [playerStats, setPlayerStats] = useState<any>(null);
  const [gameMode, setGameMode] = useState<"solo" | "matchmaking" | "ai" | "tournament">("matchmaking");
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard" | "impossible">("medium");
  const [authError, setAuthError] = useState<string | null>(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [winScreenData, setWinScreenData] = useState<any>(null);
  const [tournamentQueue, setTournamentQueue] = useState<any>(null);
  const [tournamentBracket, setTournamentBracket] = useState<any>(null);
  const [matchReadyInfo, setMatchReadyInfo] = useState<any>(null);

  // This old function has been replaced by connectWebSocketWithMode

  // Get authentication token by calling auth backend
  const getAuthToken = async () => {
    console.log('🔍 Checking authentication with auth backend...');
    
    // First check manual token input
    if (manualToken && manualToken.trim()) {
      console.log('✅ Using manual token');
      return manualToken.trim();
    }
    
    try {
      // Call the new game-token endpoint to get access token
      const response = await fetch('http://localhost:8005/api/game-token', {
        method: 'GET',
        credentials: 'include', // Include httpOnly cookies
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Got token from auth backend:', data.user);
        
        // Store user info for display
        if (data.user) {
          setPlayerInfo(data.user);
          setIsAuthenticated(true);
        }
        
        return data.token;
      } else {
        const error = await response.json().catch(() => ({}));
        console.log('❌ Failed to get token from auth backend:', response.status, error);
        return null;
      }
    } catch (error) {
      console.log('❌ Error calling auth backend:', error);
        return null;
    }
  };

  // Fetch player statistics from the game backend with automatic token refresh
  const fetchPlayerStats = async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        console.log('❌ No token available for stats fetch');
        return;
      }

      const makeRequest = async (authToken: string) => {
        return await fetch('http://localhost:4322/api/player-stats', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        });
      };

      let response = await makeRequest(token);

      // If we get 401, try to refresh token and retry
      if (response.status === 401) {
        console.log('🔄 Token expired, attempting to refresh...');
        try {
          const refreshResponse = await fetch('http://localhost:8005/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });

          if (refreshResponse.ok) {
            console.log('✅ Token refreshed successfully, retrying stats request...');
            const newToken = await getAuthToken();
            if (newToken) {
              response = await makeRequest(newToken);
            } else {
              console.log('❌ Could not get new token after refresh');
              return;
            }
          } else {
            console.log('❌ Token refresh failed');
            return;
          }
        } catch (refreshError) {
          console.log('💥 Error during token refresh:', refreshError);
          return;
        }
      }

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Got player stats:', data);
        setPlayerStats(data.stats);
      } else {
        console.log('❌ Failed to fetch player stats:', response.status);
      }
    } catch (error) {
      console.error('❌ Error fetching player stats:', error);
    }
  };

  // Calculate rank info based on rank points (Valorant-style ranking)
  const getRankInfo = (rankPoints: number) => {
    const ranks = [
      { tier: "Bronze", level: 1, minPoints: 0, maxPoints: 19, color: "#CD7F32" },
      { tier: "Bronze", level: 2, minPoints: 20, maxPoints: 39, color: "#CD7F32" },
      { tier: "Bronze", level: 3, minPoints: 40, maxPoints: 59, color: "#CD7F32" },
      { tier: "Silver", level: 1, minPoints: 60, maxPoints: 79, color: "#C0C0C0" },
      { tier: "Silver", level: 2, minPoints: 80, maxPoints: 99, color: "#C0C0C0" },
      { tier: "Silver", level: 3, minPoints: 100, maxPoints: 119, color: "#C0C0C0" },
      { tier: "Gold", level: 1, minPoints: 120, maxPoints: 139, color: "#FFD700" },
      { tier: "Gold", level: 2, minPoints: 140, maxPoints: 159, color: "#FFD700" },
      { tier: "Gold", level: 3, minPoints: 160, maxPoints: 179, color: "#FFD700" },
      { tier: "Platinum", level: 1, minPoints: 180, maxPoints: 199, color: "#E5E4E2" },
      { tier: "Platinum", level: 2, minPoints: 200, maxPoints: 219, color: "#E5E4E2" },
      { tier: "Platinum", level: 3, minPoints: 220, maxPoints: 239, color: "#E5E4E2" },
      { tier: "Diamond", level: 1, minPoints: 240, maxPoints: 259, color: "#B9F2FF" },
      { tier: "Diamond", level: 2, minPoints: 260, maxPoints: 279, color: "#B9F2FF" },
      { tier: "Diamond", level: 3, minPoints: 280, maxPoints: 299, color: "#B9F2FF" },
      { tier: "Immortal", level: 1, minPoints: 300, maxPoints: 319, color: "#FF6B6B" },
      { tier: "Immortal", level: 2, minPoints: 320, maxPoints: 339, color: "#FF6B6B" },
      { tier: "Immortal", level: 3, minPoints: 340, maxPoints: 359, color: "#FF6B6B" },
      { tier: "Radiant", level: 1, minPoints: 360, maxPoints: 999, color: "#FFFF00" }
    ];

    const points = Math.max(0, Math.min(999, rankPoints || 0));
    
    for (const rank of ranks) {
      if (points >= rank.minPoints && points <= rank.maxPoints) {
        return {
          ...rank,
          points: points,
          progressToNext: points - rank.minPoints,
          pointsNeededForNext: rank.maxPoints - points
        };
      }
    }
    
    return ranks[0]; // Fallback to Bronze 1
  };

  // Check if we have a valid token on component mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = await getAuthToken();
      if (token) {
        console.log('🎉 Valid token detected on page load, clearing auth error');
        setAuthError(null);
        setIsAuthenticated(true);
        // Fetch player stats when authenticated
        fetchPlayerStats();
      } else {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, [manualToken]); // Re-check when manual token changes

  // Handle page refresh/close - disconnect from websocket and clean up
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only send disconnect if we're actually leaving the page
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('🔌 Page unloading - closing WebSocket');
        wsRef.current.close();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []); // Only attach once

  // Separate render function
  const renderGame = (state: any) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Center line
    ctx.strokeStyle = "gray";
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Paddles + ball
    ctx.fillStyle = "white";
    ctx.fillRect(state.player1.x, state.player1.y, 10, 100);
    ctx.fillRect(state.player2.x, state.player2.y, 10, 100);
    ctx.fillRect(state.ball.x, state.ball.y, 10, 10);

    // Player role indicators
    if (playerInfo?.role) {
      ctx.fillStyle = "yellow";
      ctx.font = "12px Arial";
      ctx.textAlign = "left";
      
      if (playerInfo.role === 'player1' || playerInfo.role === 'both') {
        ctx.fillText("YOU", 25, 25);
      }
      if (playerInfo.role === 'player2' || playerInfo.role === 'both') {
        ctx.textAlign = "right";
        ctx.fillText(playerInfo.role === 'both' ? "YOU" : "YOU", canvas.width - 25, 25);
      }
    }

    // Countdown
    if (state.countdown > 0) {
      ctx.fillStyle = "yellow";
      ctx.font = "30px Arial";
      ctx.textAlign = "center";
      ctx.fillText(state.countdown.toString(), canvas.width / 2, canvas.height / 2);
    }
  };

  // Handle restart
  const handleRestart = () => {
    console.log("Restarting game...");
    
    if (playerInfo?.gameType === 'solo') {
      // Solo mode: just reset the game
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "reset" }));
      }
      setGameState(null);
      setScreen("game");
    } else {
      // Multiplayer mode: leave game and return to start
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "reset" }));
      }
      // The server will send a 'gameLeft' message which will handle the screen change
    }
  };

  // Handle start game modes
  const handleStartSolo = async () => {
    console.log("🎮 Starting solo game...");
    await connectWebSocketWithMode('solo');
  };

  const handleStartMultiplayer = async () => {
    console.log("🎮 Starting multiplayer matchmaking...");
    await connectWebSocketWithMode('matchmaking');
  };

  const handleStartAI = async () => {
    console.log("🎮 Starting AI game...");
    await connectWebSocketWithMode('ai', aiDifficulty);
  };

  // Connect with specific game mode
  // Cancel matchmaking function
  const cancelMatchmaking = () => {
    console.log("🚫 Cancelling matchmaking...");
    
    // Send cancel message to backend
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'cancel'
      }));
      console.log("📤 Sent cancel message to backend");
    }
    
    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    // Reset to start screen
    setScreen("start");
    console.log("✅ Matchmaking cancelled locally");
  };

  const connectWebSocketWithMode = async (gameMode: string, aiDifficultyParam?: string) => {
    console.log(`🔗 Attempting to connect with game mode: ${gameMode}`);
    
    // Close existing connection if any
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        console.log("🔌 Closing existing WebSocket connection");
        wsRef.current.close();
      }
      wsRef.current = null;
      setIsConnected(false);
    }

    // Get authentication token
    const token = await getAuthToken();
    if (!token) {
      console.log("❌ No auth token found");
      setAuthError('Please log in first. Visit the main site to authenticate.');
      return;
    }

    // Clear any previous auth errors
    setAuthError(null);
    console.log("✅ Token found, proceeding with connection");

    // Dynamic WebSocket URL with fallback
    let wsUrl = `ws://${window.location.hostname}:4322/ws`;
    
    // Add token as query parameter
    wsUrl += `?token=${encodeURIComponent(token)}`;
    
    // If accessing from host OS and VM IP is known, you can hardcode it
    // Replace 'YOUR_VM_IP' with your actual VM IP if needed
    // wsUrl = 'ws://10.0.2.15:4322/ws'; // Uncomment and set your VM IP
    
    console.log(`🔗 Connecting to WebSocket: ${wsUrl.replace(/token=[^&]+/, 'token=***')}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("🔌 WebSocket connected");
      setIsConnected(true);
      // Don't send join message here - wait for authentication first
    };

    ws.onclose = (event) => {
      console.log("🔌 WebSocket disconnected. Code:", event.code, "Reason:", event.reason, "Was clean:", event.wasClean);
      setIsConnected(false);
      // Only set auth error if it's an authentication-related closure
      if (event.code === 1008 || event.code === 4001) {
        setAuthError('Authentication failed. Please check your token.');
      }
    };

    ws.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
      setAuthError('Connection error. Please try again.');
    };

    ws.onmessage = (event) => {
      console.log("📨 Received WebSocket message:", event.data);
      const message = JSON.parse(event.data);
      console.log("📨 Parsed message:", message);

      if (message.type === 'authError') {
        // Authentication failed
        console.error('❌ Authentication error:', message.error);
        setAuthError(message.error || 'Authentication failed. Please log in.');
        setIsConnected(false);
        ws.close();
        return;
      }

      if (message.type === 'authSuccess' || message.type === 'authenticated') {
        // Authentication successful
        console.log('✅ Authentication successful:', message);
        setPlayerInfo(message.user);
        setAuthError(null); // Clear any previous auth errors
        setIsAuthenticated(true);
        
        // Now send the join message after authentication
        const joinMessage: any = { type: "join", gameMode };
        if (gameMode === 'ai' && aiDifficultyParam) {
          joinMessage.aiDifficulty = aiDifficultyParam;
        }
        console.log("📤 Sending join message after auth:", joinMessage);
        ws.send(JSON.stringify(joinMessage));
      } else if (message.type === 'waiting' || message.type === 'waitingForOpponent') {
        // Player is waiting for opponent
        console.log("⏳ Waiting for opponent...", message);
        setScreen("waiting");
        
        // Preserve user data while waiting
        const waitingData = {
          ...message,
          user: playerInfo?.user || message.user // Preserve existing user data
        };
        
        setPlayerInfo(waitingData);
      } else if (message.type === 'gameJoined') {
        // Game started
        console.log("🎮 Game joined! Message:", message);
        setScreen("game");
        
        // Restructure the player info for proper frontend handling
        const playerData = {
          role: message.playerRole,
          roomId: message.roomId,
          gameType: message.gameMode || 'multiplayer',
          opponent: message.opponent,
          user: playerInfo?.user // Preserve user data from auth
        };
        
        setPlayerInfo(playerData);
        setGameState(message.gameState);
      } else if (message.type === 'tournamentQueued') {
        // Player joined tournament queue
        console.log("🏆 Joined tournament queue:", message);
        setScreen("tournamentWaiting");
        setTournamentQueue({
          queuePosition: message.queuePosition,
          queueSize: message.queueSize,
          playerList: message.playerList
        });
      } else if (message.type === 'tournamentStarted') {
        // Tournament has started, show bracket
        console.log("🎯 Tournament started:", message);
        setTournamentBracket(message.bracket);
        // Keep tournamentQueue so we can show player list, but bracket presence indicates tournament started
        setScreen("tournamentWaiting"); // Stay on waiting screen, update to show "Tournament Starting!"
        // Screen will change to "game" when tournamentMatchReady arrives
      } else if (message.type === 'tournamentMatchReady') {
        // Tournament match is ready to play
        console.log("🎮 Tournament match ready:", message);
        
        // Store match info and show match ready screen
        setMatchReadyInfo({
          opponent: message.opponent,
          playerRole: message.playerRole,
          round: message.round,
          matchId: message.matchId
        });
        setScreen("tournamentMatchReady");
        
        // Send the match data back to backend so it can set playerInfo
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'tournamentMatchReady',
            matchData: message.matchData
          }));
        }
        
        // After 3 seconds, start the game
        setTimeout(() => {
          setScreen("game");
          
          const playerData = {
            role: message.playerRole,
            roomId: message.roomId,
            gameType: 'tournament',
            opponent: message.opponent,
            user: playerInfo?.user,
            tournamentId: message.tournamentId,
            round: message.round
          };
          
          setPlayerInfo(playerData);
          setGameState(message.gameState);
        }, 3000);
      } else if (message.type === 'tournamentMatchResult') {
        // Tournament match ended
        console.log("🏆 Tournament match result:", message);
        setWinScreenData({
          playerData: {
            won: message.won,
            opponent: message.opponentUsername,
            ratingChange: message.ratingChange,
            xpGain: message.xpGain,
            stats: message.stats // Contains oldRating, newRating, oldXp, newXp, etc.
          },
          matchData: {
            round: message.round,
            tournamentComplete: message.tournamentComplete,
            isTournamentWinner: message.isTournamentWinner,
            waitingForNextRound: message.waitingForNextRound
          },
          isTournament: true
        });
        setScreen("end");
        
        // Auto-advance winners to next round after 10 seconds
        if (message.won && message.waitingForNextRound) {
          setTimeout(() => {
            setWinScreenData(null);
            setScreen("tournamentWaiting");
          }, 10000);
        }
      } else if (message.type === 'tournamentChampion') {
        // Player won the tournament!
        console.log("👑 Tournament champion:", message);
        alert(`🎉 Congratulations! You are the Tournament Champion!`);
      } else if (message.type === 'gameLeft') {
        // Player left the game, return to start screen
        setScreen("start");
        setPlayerInfo(null);
        setGameState(null);
      } else if (message.type === 'playerLeft') {
        // Opponent left, show message and return to start
        alert(message.message);
        setScreen("start");
        setPlayerInfo(null);
        setGameState(null);
      } else if (message.type === 'matchCancelled') {
        // Matchmaking was cancelled successfully
        console.log("✅ Match cancellation confirmed:", message.message);
        setScreen("start");
        setPlayerInfo(null);
        setGameState(null);
      } else if (message.type === 'opponentDisconnected') {
        // Opponent disconnected mid-game - we won!
        console.log("🏆 Opponent disconnected - you win!");
        alert(message.message || "Your opponent disconnected. You win!");
        setScreen("start");
        setPlayerInfo(null);
        setGameState(null);
        setWinScreenData(null);
      } else if (message.type === 'gameAborted') {
        // Game was aborted (early disconnection)
        console.log("🚫 Game aborted:", message.message);
        alert(message.message || "Game was cancelled due to disconnection.");
        setScreen("start");
        setPlayerInfo(null);
        setGameState(null);
        setWinScreenData(null);
      } else if (message.type === 'gameResult') {
        // Win screen data received
        console.log("🎉 Game result received:", message);
        
        // Don't show normal win screen for tournament games - wait for tournamentMatchResult instead
        if (playerInfo?.gameType === 'tournament') {
          console.log("⏭️ Skipping normal win screen for tournament game");
          return;
        }
        
        setWinScreenData({
          playerData: message.data,
          matchData: message.matchData
        });
        setScreen("end");
      } else if (message.type) {
        // Handle any other message types with debugging
        console.log("🤔 Unknown message type:", message.type, message);
        
        // Check if it's a game state update (no type property)
        if (message.ball && message.player1 && message.player2) {
          const state = message;
          setGameState(state);
          renderGame(state);
          
          // Check for winner and switch to end screen
          // BUT: Don't auto-switch for tournament games - wait for tournamentMatchResult
          if (state.winner && screen !== "end" && playerInfo?.gameType !== 'tournament') {
            setScreen("end");
          }
        }
      } else {
        // Regular game state update
        const state = message;
        setGameState(state);

        // Render the game
        renderGame(state);

        // Check for winner and switch to end screen
        // BUT: Don't auto-switch for tournament games - wait for tournamentMatchResult
        if (state.winner && screen !== "end" && playerInfo?.gameType !== 'tournament') {
          setScreen("end");
        }
      }
    };
  };

  // This effect has been replaced by connectWebSocketWithMode

  // Set up keyboard controls
  useEffect(() => {
    if (screen !== "game") return;
    
    console.log("Setting up controls for player:", playerInfo?.role);

    const keysPressed = new Set<string>();
    
    const sendUpdate = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      
      let player1DY = 0;
      let player2DY = 0;
      
      // Calculate movement - both control schemes work for any player
      let myMovement = 0;
      if (keysPressed.has("w") || keysPressed.has("W") || keysPressed.has("ArrowUp")) {
        myMovement -= 5;
      }
      if (keysPressed.has("s") || keysPressed.has("S") || keysPressed.has("ArrowDown")) {
        myMovement += 5;
      }
      
      // Send movement based on player role
      if (playerInfo?.role === 'player1') {
        player1DY = myMovement; // Player 1 can use either WASD or Arrows
      } else if (playerInfo?.role === 'player2') {
        player2DY = myMovement; // Player 2 can use either WASD or Arrows
      } else if (playerInfo?.role === 'both') {
        // Coop mode: Local multiplayer with specific key assignments
        if (keysPressed.has("w") || keysPressed.has("W")) player1DY -= 5; // Left paddle: WASD
        if (keysPressed.has("s") || keysPressed.has("S")) player1DY += 5;
        if (keysPressed.has("ArrowUp")) player2DY -= 5; // Right paddle: Arrows
        if (keysPressed.has("ArrowDown")) player2DY += 5;
      }
      
      // Debug all player movements
      if ((player1DY !== 0 || player2DY !== 0)) {
        console.log(`🎮 Frontend sending: role=${playerInfo?.role}, p1DY=${player1DY}, p2DY=${player2DY}, keys=[${Array.from(keysPressed)}]`);
      }
      
      wsRef.current.send(JSON.stringify({ type: "update", player1DY, player2DY }));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      keysPressed.add(e.key);
      sendUpdate();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      keysPressed.delete(e.key);
      sendUpdate();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [screen, playerInfo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Win Screen Component
  const renderWinScreen = () => {
    // Handle tournament results
    if (winScreenData?.isTournament) {
      const { playerData, matchData } = winScreenData;
      const isWinner = playerData.won;
      const isChampion = matchData.isTournamentWinner;
      const waitingForNext = matchData.waitingForNextRound;
      const stats = playerData.stats;
      
      // Calculate win rate
      const winRate = stats.totalMatches > 0 ? ((stats.wins / stats.totalMatches) * 100).toFixed(1) : '0.0';
      
      return (
        <div style={{
          padding: "30px",
          backgroundColor: "#1a1a1a",
          borderRadius: "15px",
          border: `3px solid ${isWinner ? "#28a745" : "#dc3545"}`,
          maxWidth: "700px",
          margin: "0 auto",
          textAlign: "center"
        }}>
          {/* Header */}
          <h1 style={{
            fontSize: "48px",
            color: isWinner ? "#ffd700" : "#dc3545",
            textShadow: isWinner ? "0 0 20px #ffd700" : "0 0 20px #dc3545",
            marginBottom: "10px",
            fontWeight: "bold"
          }}>
            {isChampion ? "👑 TOURNAMENT CHAMPION! 👑" : 
             isWinner ? "🎉 VICTORY! 🎉" : 
             "💔 ELIMINATED 💔"}
          </h1>
          
          <p style={{ fontSize: "18px", color: "#ccc", marginBottom: "20px" }}>
            <strong>vs</strong> {playerData.opponent}
          </p>
          
          {/* Stats Changes */}
          <div style={{
            backgroundColor: "#2a2a2a",
            padding: "25px",
            borderRadius: "10px",
            marginBottom: "20px"
          }}>
            <h3 style={{ color: "#ffc107", marginTop: 0, marginBottom: "20px" }}>
              📊 Stats Update
            </h3>
            
            {/* Ranked Rating */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px",
              backgroundColor: "#1a1a1a",
              borderRadius: "8px",
              marginBottom: "15px"
            }}>
              <span style={{ fontSize: "16px", color: "#aaa" }}>Ranked Rating</span>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px", color: "#fff" }}>{stats.oldRating}</span>
                <span style={{ 
                  fontSize: "20px", 
                  color: playerData.ratingChange >= 0 ? "#28a745" : "#dc3545",
                  fontWeight: "bold"
                }}>
                  →
                </span>
                <span style={{ 
                  fontSize: "20px", 
                  color: playerData.ratingChange >= 0 ? "#28a745" : "#dc3545",
                  fontWeight: "bold"
                }}>
                  {stats.newRating} ({playerData.ratingChange >= 0 ? '+' : ''}{playerData.ratingChange})
                </span>
              </div>
            </div>
            
            {/* Experience */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px",
              backgroundColor: "#1a1a1a",
              borderRadius: "8px",
              marginBottom: "15px"
            }}>
              <span style={{ fontSize: "16px", color: "#aaa" }}>Experience</span>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px", color: "#fff" }}>{stats.oldXp}</span>
                <span style={{ fontSize: "20px", color: "#17a2b8", fontWeight: "bold" }}>→</span>
                <span style={{ fontSize: "20px", color: "#17a2b8", fontWeight: "bold" }}>
                  {stats.newXp} (+{playerData.xpGain})
                </span>
              </div>
            </div>
            
            {/* Level */}
            {stats.newLevel > stats.oldLevel && (
              <div style={{
                padding: "12px",
                backgroundColor: "#ffc107",
                borderRadius: "8px",
                marginBottom: "15px",
                border: "2px solid #ff9800"
              }}>
                <span style={{ fontSize: "18px", color: "#000", fontWeight: "bold" }}>
                  🎊 LEVEL UP! Level {stats.oldLevel} → {stats.newLevel} 🎊
                </span>
              </div>
            )}
            
            {/* Match Stats */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "10px",
              marginTop: "15px"
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "14px", color: "#aaa" }}>Matches</div>
                <div style={{ fontSize: "20px", color: "#fff", fontWeight: "bold" }}>{stats.totalMatches}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "14px", color: "#aaa" }}>Wins</div>
                <div style={{ fontSize: "20px", color: "#28a745", fontWeight: "bold" }}>{stats.wins}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "14px", color: "#aaa" }}>Win Rate</div>
                <div style={{ fontSize: "20px", color: "#17a2b8", fontWeight: "bold" }}>{winRate}%</div>
              </div>
            </div>
          </div>
          
          {/* Special Messages */}
          {isChampion && (
            <div style={{
              backgroundColor: "#2a2a2a",
              padding: "20px",
              borderRadius: "10px",
              marginBottom: "20px",
              border: "3px solid #ffd700",
              boxShadow: "0 0 20px #ffd700"
            }}>
              <p style={{ fontSize: "24px", color: "#ffd700", fontWeight: "bold", margin: 0 }}>
                🏆 You are the Tournament Champion! 🏆
              </p>
              <p style={{ fontSize: "14px", color: "#ccc", marginTop: "10px", marginBottom: 0 }}>
                Congratulations on your flawless victory!
              </p>
            </div>
          )}
          
          {isWinner && waitingForNext && !isChampion && (
            <div style={{
              backgroundColor: "#2a2a2a",
              padding: "18px",
              borderRadius: "10px",
              marginBottom: "20px",
              border: "2px solid #28a745"
            }}>
              <p style={{ fontSize: "18px", color: "#28a745", fontWeight: "bold", margin: 0 }}>
                ✅ You've Advanced to the Next Round!
              </p>
              <p style={{ fontSize: "14px", color: "#ccc", marginTop: "10px", marginBottom: 0 }}>
                Next match starting in 10 seconds...
              </p>
            </div>
          )}
          
          {!isWinner && (
            <div style={{
              backgroundColor: "#2a2a2a",
              padding: "18px",
              borderRadius: "10px",
              marginBottom: "20px",
              border: "2px solid #dc3545"
            }}>
              <p style={{ fontSize: "16px", color: "#dc3545", margin: 0 }}>
                You have been eliminated from the tournament.
              </p>
              <p style={{ fontSize: "14px", color: "#aaa", marginTop: "10px", marginBottom: 0 }}>
                Better luck next time!
              </p>
            </div>
          )}
          
          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "15px", justifyContent: "center", marginTop: "20px" }}>
            {isWinner && waitingForNext ? (
              // Winner waiting for next round - show Continue button with auto-advance
              <button
                onClick={() => {
                  // Continue is automatic, this just speeds it up
                  setWinScreenData(null);
                  setScreen("tournamentWaiting");
                }}
                style={{
                  padding: "15px 30px",
                  fontSize: "18px",
                  backgroundColor: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.3)"
                }}
              >
                ➡️ Continue (10s)
              </button>
            ) : (
              // Loser or champion - return to lobby
              <button
                onClick={() => {
                  setScreen("start");
                  setPlayerInfo(null);
                  setGameState(null);
                  setWinScreenData(null);
                  setTournamentQueue(null);
                  setTournamentBracket(null);
                  if (wsRef.current) {
                    wsRef.current.close();
                    wsRef.current = null;
                  }
                }}
                style={{
                  padding: "15px 30px",
                  fontSize: "18px",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.3)"
                }}
              >
                🏠 Return to Main Menu
              </button>
            )}
          </div>
        </div>
      );
    }
    
    if (!winScreenData) {
      // Fallback for AI games or when no win screen data available
      return (
        <div style={{
          padding: "30px",
          backgroundColor: "#1a1a1a",
          borderRadius: "15px",
          border: "2px solid #333",
          maxWidth: "600px",
          margin: "0 auto",
          textAlign: "center"
        }}>
          <h1 style={{
            fontSize: "48px",
            color: gameState?.winner === 'Player 1' ? "#28a745" : "#dc3545",
            textShadow: "0 0 20px",
            marginBottom: "20px",
            fontWeight: "bold"
          }}>
            🎉 {gameState?.winner} Wins! 🎉
          </h1>
          
          <p style={{ fontSize: "24px", marginBottom: "30px" }}>
            Final Score: {gameState?.player1?.score || 0} - {gameState?.player2?.score || 0}
          </p>
          
          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "15px", justifyContent: "center" }}>
            <button
              onClick={handleRestart}
              style={{
                padding: "12px 25px",
                fontSize: "16px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              🎮 Play Again
            </button>
            <button
              onClick={() => {
                setScreen("start");
                setPlayerInfo(null);
                setGameState(null);
                setWinScreenData(null);
                if (wsRef.current) {
                  wsRef.current.close();
                  wsRef.current = null;
                }
              }}
              style={{
                padding: "12px 25px",
                fontSize: "16px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              🏠 Main Menu
            </button>
          </div>
        </div>
      );
    }

    const { playerData, matchData } = winScreenData;
    
    return (
      <div style={{
        padding: "30px",
        backgroundColor: "#1a1a1a",
        borderRadius: "15px",
        border: "2px solid #333",
        maxWidth: "600px",
        margin: "0 auto"
      }}>
        {/* Victory/Defeat Title */}
        <h1 style={{
          fontSize: "48px",
          color: playerData.result === 'victory' ? "#28a745" : "#dc3545",
          textShadow: "0 0 20px",
          marginBottom: "20px",
          textTransform: "uppercase",
          fontWeight: "bold"
        }}>
          🎉 {playerData.result?.toUpperCase() || 'GAME OVER'} 🎉
        </h1>

        {/* Match Summary */}
        <div style={{ 
          backgroundColor: "#2a2a2a", 
          padding: "20px", 
          borderRadius: "10px", 
          marginBottom: "25px" 
        }}>
          <h3 style={{ color: "#ffd700", marginBottom: "15px" }}>Match Summary</h3>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <span><strong>Duration:</strong> {matchData.duration}</span>
            <span><strong>Winner:</strong> {matchData.winnerName}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span><strong>Final Score:</strong> {matchData.player1Score} - {matchData.player2Score}</span>
            <span><strong>Total Volleys:</strong> {matchData.totalVolleys}</span>
          </div>
        </div>

        {/* Player Performance */}
        <div style={{ 
          backgroundColor: "#2a2a2a", 
          padding: "20px", 
          borderRadius: "10px", 
          marginBottom: "25px" 
        }}>
          <h3 style={{ color: "#17a2b8", marginBottom: "15px" }}>Your Performance</h3>
          
          {/* XP Progress */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span><strong>Experience Points:</strong></span>
              <span style={{ color: playerData.rewards?.experience >= 0 ? "#28a745" : "#dc3545", fontSize: "18px" }}>
                {playerData.rewards?.experience >= 0 ? "+" : ""}{playerData.rewards?.experience || 0} XP
              </span>
            </div>
            <div style={{ 
              backgroundColor: "#444", 
              height: "20px", 
              borderRadius: "10px", 
              marginTop: "5px",
              overflow: "hidden"
            }}>
              <div style={{
                backgroundColor: "#17a2b8",
                height: "100%",
                width: `${Math.min(100, (playerData.progression?.after?.experience / 1000) * 100)}%`,
                borderRadius: "10px",
                transition: "width 0.5s ease"
              }}></div>
            </div>
            <div style={{ fontSize: "14px", color: "#ccc", marginTop: "5px" }}>
              {playerData.progression?.before?.experience || 0} → {playerData.progression?.after?.experience || 0} XP
            </div>
          </div>

          {/* Rank Progress */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span><strong>Rank Points:</strong></span>
              <span style={{ color: playerData.rewards?.rankPoints >= 0 ? "#28a745" : "#dc3545", fontSize: "18px" }}>
                {playerData.rewards?.rankPointsChange || 0} RP
              </span>
            </div>
            <div style={{ fontSize: "16px", marginTop: "10px" }}>
              <span style={{ color: "#ffd700" }}>
                {playerData.progression?.before?.rank || "Unknown"}
              </span>
              {playerData.progression?.before?.rank !== playerData.progression?.after?.rank && (
                <span style={{ color: "#28a745", margin: "0 10px" }}>
                  → {playerData.progression?.after?.rank || "Unknown"} 🎉
                </span>
              )}
            </div>
            <div style={{ fontSize: "14px", color: "#ccc", marginTop: "5px" }}>
              {playerData.progression?.before?.rankPoints || 0} → {playerData.progression?.after?.rankPoints || 0} RP
            </div>
          </div>

          {/* Game Stats */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
              <span>Games Played:</span>
              <span>{playerData.progression?.after?.gamesPlayed || 0} (+1)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
              <span>Games Won:</span>
              <span>{playerData.progression?.after?.gamesWon || 0} ({playerData.result === 'victory' ? '+1' : '+0'})</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Win Rate:</span>
              <span>{playerData.progression?.after?.winRate?.toFixed(1) || '0.0'}%</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "15px", justifyContent: "center" }}>
          <button
            onClick={handleRestart}
            style={{
              padding: "12px 25px",
              fontSize: "16px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            🎮 Play Again
          </button>
          <button
            onClick={() => {
              setScreen("start");
              setPlayerInfo(null);
              setGameState(null);
              setWinScreenData(null);
              if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
              }
            }}
            style={{
              padding: "12px 25px",
              fontSize: "16px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            🏠 Main Menu
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ 
      textAlign: "center", 
      height: "100vh", 
      background: "black", 
      color: "white",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center"
    }}>
      {screen === "start" && (
        <div>
          <h1>Pong Game</h1>
          
          {/* Player Statistics Card */}
          {isAuthenticated && playerStats && (
            <div style={{ 
              marginBottom: "25px",
              padding: "20px",
              backgroundColor: "#1a1a1a",
              borderRadius: "12px",
              border: "2px solid #333",
              maxWidth: "600px",
              margin: "0 auto 25px auto"
            }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: "15px"
              }}>
                <h3 style={{ margin: 0, color: "#ffc107" }}>Player Statistics</h3>
                {playerInfo?.username && (
                  <div style={{ 
                    fontSize: "16px", 
                    color: "#4CAF50",
                    fontWeight: "bold",
                    padding: "5px 12px",
                    backgroundColor: "#2a2a2a",
                    borderRadius: "6px",
                    border: "1px solid #4CAF50"
                  }}>
                    @{playerInfo.username}
                  </div>
                )}
              </div>
              
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", 
                gap: "15px",
                textAlign: "center"
              }}>
                {/* Rank Display */}
                {(() => {
                  const rankInfo = getRankInfo(playerStats.rank_points);
                  return (
                    <div style={{ 
                      padding: "12px",
                      backgroundColor: "#2a2a2a",
                      borderRadius: "8px",
                      border: `2px solid ${rankInfo.color}`,
                    }}>
                      <div style={{ fontSize: "12px", color: "#ccc" }}>Rank</div>
                      <div style={{ 
                        fontSize: "16px", 
                        fontWeight: "bold", 
                        color: rankInfo.color 
                      }}>
                        {rankInfo.tier} {rankInfo.level}
                      </div>
                      <div style={{ fontSize: "11px", color: "#999" }}>
                        {playerStats.rank_points} RP
                      </div>
                    </div>
                  );
                })()}
                
                {/* Level & XP */}
                <div style={{ 
                  padding: "12px",
                  backgroundColor: "#2a2a2a",
                  borderRadius: "8px",
                  border: "1px solid #444"
                }}>
                  <div style={{ fontSize: "12px", color: "#ccc" }}>Level</div>
                  <div style={{ fontSize: "16px", fontWeight: "bold", color: "#00bfff" }}>
                    {playerStats.player_level}
                  </div>
                  <div style={{ fontSize: "11px", color: "#999" }}>
                    {playerStats.experience_points} XP
                  </div>
                </div>

                {/* Win/Loss */}
                <div style={{ 
                  padding: "12px",
                  backgroundColor: "#2a2a2a",
                  borderRadius: "8px",
                  border: "1px solid #444"
                }}>
                  <div style={{ fontSize: "12px", color: "#ccc" }}>Record</div>
                  <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                    <span style={{ color: "#28a745" }}>{playerStats.games_won}W</span>
                    <span style={{ color: "#666" }}> - </span>
                    <span style={{ color: "#dc3545" }}>{playerStats.games_lost || 0}L</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#999" }}>
                    {playerStats.win_rate?.toFixed(1) || 0}% WR
                  </div>
                </div>

                {/* Current Streak */}
                <div style={{ 
                  padding: "12px",
                  backgroundColor: "#2a2a2a",
                  borderRadius: "8px",
                  border: "1px solid #444"
                }}>
                  <div style={{ fontSize: "12px", color: "#ccc" }}>Streak</div>
                  <div style={{ 
                    fontSize: "16px", 
                    fontWeight: "bold",
                    color: playerStats.current_streak > 0 ? "#ffc107" : "#666"
                  }}>
                    {playerStats.current_streak || 0}
                  </div>
                  <div style={{ fontSize: "11px", color: "#999" }}>
                    {playerStats.current_streak > 0 ? 'Win' : playerStats.current_streak < 0 ? 'Loss' : 'None'}
                  </div>
                </div>

                {/* Games Played */}
                <div style={{ 
                  padding: "12px",
                  backgroundColor: "#2a2a2a",
                  borderRadius: "8px",
                  border: "1px solid #444"
                }}>
                  <div style={{ fontSize: "12px", color: "#ccc" }}>Played</div>
                  <div style={{ fontSize: "16px", fontWeight: "bold", color: "#fff" }}>
                    {playerStats.games_played || 0}
                  </div>
                  <div style={{ fontSize: "11px", color: "#999" }}>
                    Total Games
                  </div>
                </div>
              </div>

              {/* Refresh Stats Button */}
              <div style={{ marginTop: "15px" }}>
                <button
                  onClick={fetchPlayerStats}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  Refresh Stats
                </button>
              </div>
            </div>
          )}
          
          {/* Debug Token Info */}
          <div style={{ marginBottom: "10px" }}>
            <button
              onClick={async () => {
                console.log('=== TOKEN DEBUG ===');
                console.log('All cookies:', document.cookie);
                console.log('localStorage accessToken:', localStorage.getItem('accessToken'));
                console.log('localStorage token:', localStorage.getItem('token'));
                console.log('Manual token:', manualToken);
                const token = await getAuthToken();
                console.log('Final token:', token ? token.substring(0, 20) + '...' : 'NONE');
                alert('Check browser console for token debug info');
              }}
              style={{
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                padding: "5px 10px",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "11px"
              }}
            >
              Debug Tokens
            </button>
            
            <button
              onClick={() => {
                setAuthError(null);
                console.log('🧹 Auth error cleared manually');
              }}
              style={{
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                padding: "5px 10px",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "11px",
                marginLeft: "10px"
              }}
            >
              Clear Error
            </button>
            
            <button
              onClick={() => {
                // Try to sync token from main site
                window.open('http://localhost:3010/profile', '_blank');
                alert('After logging in on the main site, come back and use Debug Tokens to copy the token manually');
              }}
              style={{
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                padding: "5px 10px",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "11px",
                marginLeft: "10px"
              }}
            >
              Get Token
            </button>
          </div>
          
          {/* Authentication Error */}
          {authError && !isAuthenticated && (
            <div style={{ 
              backgroundColor: "#dc3545", 
              color: "white", 
              padding: "15px", 
              margin: "20px 0", 
              borderRadius: "5px",
              maxWidth: "500px"
            }}>
              <h3>Authentication Required</h3>
              <p>{authError}</p>
              <p>
                <a 
                  href="http://localhost:3010/login" 
                  style={{ color: "#ffc107", textDecoration: "underline" }}
                  target="_blank"
                >
                  Click here to log in
                </a>
              </p>
              
              {/* Manual Token Input */}
              <div style={{ marginTop: "15px" }}>
                <button
                  onClick={() => setShowTokenInput(!showTokenInput)}
                  style={{
                    backgroundColor: "#17a2b8",
                    color: "white",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  {showTokenInput ? 'Hide' : 'Use Manual Token'}
                </button>
                
                {showTokenInput && (
                  <div style={{ marginTop: "10px" }}>
                    <input
                      type="text"
                      placeholder="Paste your JWT token here"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        marginBottom: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                        backgroundColor: "#f8f9fa",
                        color: "#000"
                      }}
                    />
                    <div style={{ fontSize: "11px", color: "#ffc107" }}>
                      Tip: Open browser dev tools → Application → Cookies/Storage → Copy accessToken value
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Game Mode Selection */}
          <div style={{ marginBottom: "20px" }}>
            <h3>Select Game Mode:</h3>
            <div style={{ display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap" }}>
              <div style={{ textAlign: "center" }}>
                <button
                  onClick={() => setGameMode("matchmaking")}
                  style={{
                    padding: "10px 15px",
                    fontSize: "14px",
                    backgroundColor: gameMode === "matchmaking" ? "#28a745" : "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    display: "block",
                    marginBottom: "5px"
                  }}
                >
                  🎮 Find Opponent
                </button>
                <small style={{ color: "#ccc", fontSize: "12px" }}>
                  Play online vs another player<br/>
                  (W/S or ↑/↓ keys work)
                </small>
              </div>
              <div style={{ textAlign: "center" }}>
                <button
                  onClick={() => setGameMode("ai")}
                  style={{
                    padding: "10px 15px",
                    fontSize: "14px",
                    backgroundColor: gameMode === "ai" ? "#28a745" : "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    display: "block",
                    marginBottom: "5px"
                  }}
                >
                  🤖 vs AI
                </button>
                <small style={{ color: "#ccc", fontSize: "12px" }}>
                  Play against computer<br/>
                  (Choose difficulty below)
                </small>
              </div>
              <div style={{ textAlign: "center" }}>
                <button
                  onClick={() => setGameMode("solo")}
                  style={{
                    padding: "10px 15px",
                    fontSize: "14px",
                    backgroundColor: gameMode === "solo" ? "#28a745" : "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    display: "block",
                    marginBottom: "5px"
                  }}
                >
                  👥 Coop Mode
                </button>
                <small style={{ color: "#ccc", fontSize: "12px" }}>
                  Local 2-player game<br/>
                  (W/S vs ↑/↓ keys)
                </small>
              </div>
              <div style={{ textAlign: "center" }}>
                <button
                  onClick={() => setGameMode("tournament")}
                  style={{
                    padding: "10px 15px",
                    fontSize: "14px",
                    backgroundColor: gameMode === "tournament" ? "#28a745" : "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    display: "block",
                    marginBottom: "5px"
                  }}
                >
                  🏆 Tournament
                </button>
                <small style={{ color: "#ccc", fontSize: "12px" }}>
                  8-player bracket<br/>
                  (Special rewards!)
                </small>
              </div>
            </div>
          </div>

          {/* AI Difficulty Selection */}
          {gameMode === "ai" && (
            <div style={{ marginBottom: "20px" }}>
              <h4>AI Difficulty:</h4>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                {["easy", "medium", "hard", "impossible"].map((difficulty) => (
                  <button
                    key={difficulty}
                    onClick={() => setAiDifficulty(difficulty)}
                    style={{
                      padding: "8px 12px",
                      fontSize: "12px",
                      backgroundColor: aiDifficulty === difficulty ? "#007bff" : "#6c757d",
                      color: "white",
                      border: "none",
                      borderRadius: "3px",
                      cursor: "pointer",
                      textTransform: "capitalize"
                    }}
                  >
                    {difficulty === "impossible" ? "🔥 Impossible" : 
                     difficulty === "hard" ? "💪 Hard" :
                     difficulty === "medium" ? "⚖️ Medium" : "😊 Easy"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button 
            onClick={() => {
              if (gameMode === "matchmaking") handleStartMultiplayer();
              else if (gameMode === "ai") handleStartAI();
              else if (gameMode === "tournament") connectWebSocketWithMode('tournament');
              else handleStartSolo();
            }}
            style={{
              padding: "15px 30px",
              fontSize: "18px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            {gameMode === "matchmaking" ? "🎮 Find Opponent" : 
             gameMode === "ai" ? `🤖 Fight ${aiDifficulty.toUpperCase()} AI` : 
             gameMode === "tournament" ? "🏆 Join Tournament" :
             "👥 Start Coop"}
          </button>
        </div>
      )}

      {screen === "waiting" && (
        <div>
          <h2>🔍 Looking for opponent...</h2>
          <div style={{ 
            marginBottom: "20px",
            padding: "20px",
            border: "2px dashed #ffc107",
            borderRadius: "10px"
          }}>
            <p>Waiting for another player to join...</p>
            <div style={{ 
              width: "50px", 
              height: "50px", 
              border: "3px solid #ffc107", 
              borderTop: "3px solid transparent", 
              borderRadius: "50%", 
              animation: "spin 1s linear infinite",
              margin: "10px auto"
            }}></div>
          </div>
          <button
            onClick={cancelMatchmaking}
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {screen === "tournamentWaiting" && (
        <div>
          <h2>🏆 Tournament Queue</h2>
          <div style={{ 
            marginBottom: "20px",
            padding: "25px",
            border: "3px solid #ffc107",
            borderRadius: "12px",
            backgroundColor: "#1a1a1a"
          }}>
            {tournamentBracket ? (
              // Tournament has started, waiting for match assignment
              <>
                <h3 style={{ color: "#ffc107", marginTop: 0 }}>
                  🎪 Tournament Starting!
                </h3>
                <p style={{ color: "#ccc", fontSize: "14px" }}>
                  Preparing your match...
                </p>
                <div style={{ 
                  marginTop: "20px",
                  fontSize: "16px",
                  color: "#17a2b8",
                  animation: "pulse 1s infinite"
                }}>
                  ⏳ Match assignment incoming...
                </div>
              </>
            ) : (
              // Still waiting in queue
              <>
                <h3 style={{ color: "#ffc107", marginTop: 0 }}>
                  Waiting for Players... {tournamentQueue?.queueSize || 0}/8
                </h3>
                <p style={{ color: "#ccc", fontSize: "14px" }}>
                  You are #{tournamentQueue?.queuePosition || 0} in queue
                </p>
              </>
            )}
            
            {/* Player List - only show if we have queue data */}
            {tournamentQueue?.playerList && (
              <div style={{
                marginTop: "20px",
                padding: "15px",
                backgroundColor: "#2a2a2a",
                borderRadius: "8px"
              }}>
                <h4 style={{ marginTop: 0, color: "#fff" }}>Players Ready:</h4>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: "10px"
                }}>
                  {tournamentQueue.playerList.map((player: any, index: number) => (
                    <div key={index} style={{
                      padding: "10px",
                      backgroundColor: "#333",
                      borderRadius: "6px",
                      border: player.username === playerInfo?.username ? "2px solid #ffc107" : "1px solid #444",
                      textAlign: "center"
                    }}>
                      <div style={{ fontSize: "14px", fontWeight: "bold", color: "#fff" }}>
                        {player.username}
                      </div>
                      <div style={{ fontSize: "11px", color: "#999" }}>
                        Rank: {player.rank || 'Unranked'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div style={{ 
              marginTop: "15px",
              padding: "12px",
              backgroundColor: "#2a2a2a",
              borderRadius: "8px",
              fontSize: "13px",
              color: "#ccc"
            }}>
              <strong style={{ color: "#ffc107" }}>🎯 Tournament Format:</strong><br/>
              • 8 players compete in a single-elimination bracket<br/>
              • Quarterfinals → Semifinals → Finals<br/>
              • Special reward structure for each round!
            </div>
          </div>
          <button
            onClick={cancelMatchmaking}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            Leave Queue
          </button>
        </div>
      )}

      {screen === "tournamentMatchReady" && matchReadyInfo && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "400px",
          padding: "40px"
        }}>
          <h2 style={{ 
            fontSize: "36px", 
            color: "#ffc107", 
            marginBottom: "30px",
            textTransform: "uppercase",
            letterSpacing: "2px"
          }}>
            🎮 Match Ready!
          </h2>
          
          <div style={{
            backgroundColor: "#1a1a1a",
            border: "3px solid #ffc107",
            borderRadius: "15px",
            padding: "40px",
            textAlign: "center",
            maxWidth: "600px",
            width: "100%"
          }}>
            <div style={{ fontSize: "20px", marginBottom: "30px", color: "#ccc" }}>
              <strong style={{ color: "#ffc107" }}>
                {matchReadyInfo.round === 'quarter_finals' ? 'Quarter Finals' : 
                 matchReadyInfo.round === 'semi_finals' ? 'Semi Finals' : 'Finals'}
              </strong>
              <span style={{ margin: "0 10px", color: "#666" }}>•</span>
              Match #{matchReadyInfo.matchId}
            </div>
            
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
              fontSize: "24px",
              marginBottom: "40px"
            }}>
              <div style={{ 
                flex: 1, 
                padding: "20px",
                backgroundColor: "#28a745",
                borderRadius: "10px",
                border: "2px solid #20c997"
              }}>
                <div style={{ fontSize: "14px", color: "#ccc", marginBottom: "10px" }}>YOU</div>
                <div style={{ fontSize: "28px", fontWeight: "bold" }}>
                  {playerInfo?.username || "Player"}
                </div>
                <div style={{ fontSize: "12px", color: "#ccc", marginTop: "5px" }}>
                  {matchReadyInfo.playerRole === 'player1' ? 'Left Paddle' : 'Right Paddle'}
                </div>
              </div>
              
              <div style={{ 
                margin: "0 30px", 
                fontSize: "40px", 
                color: "#ffc107",
                fontWeight: "bold"
              }}>
                VS
              </div>
              
              <div style={{ 
                flex: 1, 
                padding: "20px",
                backgroundColor: "#dc3545",
                borderRadius: "10px",
                border: "2px solid #e74c3c"
              }}>
                <div style={{ fontSize: "14px", color: "#ccc", marginBottom: "10px" }}>OPPONENT</div>
                <div style={{ fontSize: "28px", fontWeight: "bold" }}>
                  {matchReadyInfo.opponent?.username || "Opponent"}
                </div>
                <div style={{ fontSize: "12px", color: "#ccc", marginTop: "5px" }}>
                  {matchReadyInfo.playerRole === 'player1' ? 'Right Paddle' : 'Left Paddle'}
                </div>
              </div>
            </div>
            
            <div style={{ 
              fontSize: "18px", 
              color: "#17a2b8",
              animation: "pulse 1s infinite"
            }}>
              ⏳ Game starting in 3 seconds...
            </div>
          </div>
        </div>
      )}

      {screen === "game" && (
        <div>
          <div style={{ marginBottom: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontWeight: "bold" }}>Player 1: {gameState?.player1?.score || 0}</div>
                <div style={{ fontSize: "12px", color: "#aaa" }}>
                  {playerInfo?.role === 'player1' 
                    ? `👤 ${playerInfo?.user?.username || 'You'}` 
                    : `👤 ${playerInfo?.opponent?.username || 'Opponent'}`}
                </div>
              </div>
              <span style={{ 
                padding: "2px 8px", 
                backgroundColor: playerInfo?.gameType === 'solo' ? "#ffc107" : "#17a2b8",
                borderRadius: "12px", 
                fontSize: "12px" 
              }}>
                {playerInfo?.gameType === 'solo' ? "Practice Mode" : `Multiplayer - You are ${playerInfo?.role}`}
              </span>
              <div style={{ flex: 1, textAlign: "right" }}>
                <div style={{ fontWeight: "bold" }}>Player 2: {gameState?.player2?.score || 0}</div>
                <div style={{ fontSize: "12px", color: "#aaa" }}>
                  {playerInfo?.role === 'player2' 
                    ? `👤 ${playerInfo?.user?.username || 'You'}` 
                    : `👤 ${playerInfo?.opponent?.username || 'Opponent'}`}
                </div>
              </div>
            </div>
            
            <p>Connection: {isConnected ? "🟢 Connected" : "🔴 Disconnected"}</p>
            
            <p style={{ fontSize: "12px" }}>
              {playerInfo?.role === 'player1' && "Your paddle (Left): W/S or ↑/↓"}
              {playerInfo?.role === 'player2' && "Your paddle (Right): W/S or ↑/↓"}
              {playerInfo?.role === 'both' && "Left paddle: W/S | Right paddle: ↑/↓"}
            </p>
          </div>
          <canvas 
            ref={canvasRef} 
            width={600} 
            height={400} 
            style={{ border: "2px solid white" }} 
          />
        </div>
      )}

      {screen === "end" && renderWinScreen()}
    </div>
  );
}