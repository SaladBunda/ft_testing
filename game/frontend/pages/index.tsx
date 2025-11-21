import React, { useEffect, useRef, useState } from "react";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [screen, setScreen] = useState<"start" | "waiting" | "game" | "end">("start");
  const [isConnected, setIsConnected] = useState(false);
  const [playerInfo, setPlayerInfo] = useState<any>(null);
  const [playerStats, setPlayerStats] = useState<any>(null);
  const [gameMode, setGameMode] = useState<"solo" | "matchmaking" | "ai">("matchmaking");
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard" | "impossible">("medium");
  const [authError, setAuthError] = useState<string | null>(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
      } else if (message.type) {
        // Handle any other message types with debugging
        console.log("🤔 Unknown message type:", message.type, message);
        
        // Check if it's a game state update (no type property)
        if (message.ball && message.player1 && message.player2) {
          const state = message;
          setGameState(state);
          renderGame(state);
          
          // Check for winner and switch to end screen
          if (state.winner && screen !== "end") {
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
        if (state.winner && screen !== "end") {
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
              <h3 style={{ margin: "0 0 15px 0", color: "#ffc107" }}>Player Statistics</h3>
              
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

      {screen === "game" && (
        <div>
          <div style={{ marginBottom: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
              <span>Player 1: {gameState?.player1?.score || 0}</span>
              <span style={{ 
                padding: "2px 8px", 
                backgroundColor: playerInfo?.gameType === 'solo' ? "#ffc107" : "#17a2b8",
                borderRadius: "12px", 
                fontSize: "12px" 
              }}>
                {playerInfo?.gameType === 'solo' ? "Practice Mode" : `Multiplayer - You are ${playerInfo?.role}`}
              </span>
              <span>Player 2: {gameState?.player2?.score || 0}</span>
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

      {screen === "end" && (
        <div>
          <h1>{gameState?.winner} Wins!</h1>
          <p>Final Score: {gameState?.player1?.score || 0} - {gameState?.player2?.score || 0}</p>
          <button
            onClick={handleRestart}
            style={{
              padding: "10px 20px",
              fontSize: "18px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              marginRight: "10px"
            }}
          >
            Play Again
          </button>
          <button
            onClick={() => {
              setScreen("start");
              setPlayerInfo(null);
              setGameState(null);
              if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
              }
            }}
            style={{
              padding: "10px 20px",
              fontSize: "18px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            Main Menu
          </button>
        </div>
      )}
    </div>
  );
}