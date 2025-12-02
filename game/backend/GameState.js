// Game constants
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 100;
const BALL_SIZE = 10;

class GameState {
  constructor(gameMode = 'multiplayer', aiDifficulty = null) {
    this.gameState = {
      ball: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: 0, dy: 0 },
      player1: { x: 20, y: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2, dy: 0, score: 0 },
      player2: { x: CANVAS_WIDTH - 20 - PADDLE_WIDTH, y: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2, dy: 0, score: 0 },
      winner: null,
      countdown: 0,
      gameActive: false,
      totalVolleys: 0,  // Track ball exchanges between paddles
    };
    
    this.baseSpeed = 1.5;
    this.movementSpeed = 0;
    this.lastSpeedIncrease = Date.now();
    this.countdownInterval = null;
    this.gameMode = gameMode;
    this.aiDifficulty = aiDifficulty;
    
    // Initialize AI if needed
    if (gameMode === 'ai' && aiDifficulty) {
      const { AIFactory, AI_CONFIG } = require('./AIFactory');
      
      // You can change AI_CONFIG.defaultType in AIFactory.js to switch between:
      // 'original' - smooth, responsive AI (current working version)
      // 'subject-compliant' - follows subject requirements (1s refresh, keyboard simulation)
      this.ai = AIFactory.createAI(AI_CONFIG.defaultType, aiDifficulty);
      console.log(`🤖 AI initialized: ${AI_CONFIG.defaultType} AI with difficulty: ${aiDifficulty}`);
    }
  }

  // Get current game state
  getState() {
    return this.gameState;
  }

  // Update player movement
  updatePlayerMovement(player1DY, player2DY, playerRole = null, isSolo = false, isTournament = false) {
    // Block movement during countdown for ALL game modes
    if (this.gameState.countdown > 0) {
      return; // Don't allow movement during countdown
    }

    // In solo mode, allow movement of both paddles
    if (isSolo) {
      if (typeof player1DY === "number") this.gameState.player1.dy = player1DY;
      if (typeof player2DY === "number") this.gameState.player2.dy = player2DY;
      return;
    }

    // Map player role to correct paddle (works for all multiplayer modes)
    if (playerRole === 'player1' && typeof player1DY === "number") {
      this.gameState.player1.dy = player1DY;
    }
    if (playerRole === 'player2' && typeof player2DY === "number") {
      this.gameState.player2.dy = player2DY;
    }
    
    // Backward compatibility for older code without playerRole
    if (!playerRole) {
      if (typeof player1DY === "number") this.gameState.player1.dy = player1DY;
      if (typeof player2DY === "number") this.gameState.player2.dy = player2DY;
    }
  }

  // Reset ball for a new round
  resetBall(loser = null) {
    console.log(`Resetting ball, loser: ${loser}`);
    
    // Clear any existing countdown
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    const startY = Math.random() < 0.5 ? CANVAS_HEIGHT / 4 : (3 * CANVAS_HEIGHT) / 4;
    let dx = loser === "player1" ? -this.baseSpeed : this.baseSpeed;
    if (!loser) dx = Math.random() < 0.5 ? -this.baseSpeed : this.baseSpeed;
    let dy = Math.random() < 0.5 ? -this.baseSpeed : this.baseSpeed;

    this.gameState.ball = { x: CANVAS_WIDTH / 2, y: startY, dx: 0, dy: 0 };
    this.gameState.countdown = 3; // 3 second countdown
    this.gameState.gameActive = false;

    // Reset paddles to center
    this.gameState.player1.y = (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2;
    this.gameState.player2.y = (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2;
    this.gameState.player1.dy = 0;
    this.gameState.player2.dy = 0;

    this.countdownInterval = setInterval(() => {
      this.gameState.countdown -= 1;
      console.log(`Countdown: ${this.gameState.countdown}`);
      
      if (this.gameState.countdown <= 0) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
        
        this.gameState.ball.dx = dx;
        this.gameState.ball.dy = dy;
        this.gameState.gameActive = true;
        
        if (loser) {
          this.baseSpeed += 0.2; // Only increase speed on actual scoring, not restart
          
          // Speed cap for AI mode
          if (this.gameMode === 'ai') {
            const maxBaseSpeed = 2.0; // Cap baseSpeed at 2.0 for AI mode
            if (this.baseSpeed > maxBaseSpeed) {
              this.baseSpeed = maxBaseSpeed;
              console.log(`⚡ AI Mode: Base speed capped at ${maxBaseSpeed}`);
            }
          }
        }
        
        this.movementSpeed = 0;
        this.lastSpeedIncrease = Date.now();
        
        console.log(`Game started! Ball speed: dx=${dx}, dy=${dy}, baseSpeed=${this.baseSpeed}`);
      }
    }, 1000);
  }

  // Reset entire game
  resetGame() {
    console.log("FULL GAME RESET");
    
    // Clear any existing countdown
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    // Reset ALL game state
    this.gameState = {
      ball: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: 0, dy: 0 },
      player1: { x: 20, y: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2, dy: 0, score: 0 },
      player2: { x: CANVAS_WIDTH - 20 - PADDLE_WIDTH, y: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2, dy: 0, score: 0 },
      winner: null,
      countdown: 0,
      gameActive: false,
    };
    
    // Reset speeds
    this.baseSpeed = 2;
    this.movementSpeed = 0;
    this.lastSpeedIncrease = Date.now();
    
    console.log("Starting new game...");
    this.resetBall();
  }

  // Clean up intervals
  cleanup() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  // Get game constants
  static getConstants() {
    return {
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      PADDLE_WIDTH,
      PADDLE_HEIGHT,
      BALL_SIZE
    };
  }
}

module.exports = GameState;