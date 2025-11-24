const GameState = require('./GameState');

class GameLoop {
  constructor(gameState, isSolo = false) {
    this.gameState = gameState;
    this.constants = GameState.getConstants();
    this.isSolo = isSolo;
  }

  // Update game physics for one frame
  updateGame() {
    const state = this.gameState.getState();
    
    // Always update paddle positions (even during countdown in solo mode)
    this.updatePaddles();
    
    // Don't update ball physics during countdown or when game is over
    if (state.countdown > 0 || state.winner || !state.gameActive) {
      return;
    }

    // Increase movement speed gradually
    if (Date.now() - this.gameState.lastSpeedIncrease >= 2000) { // Every 2 seconds instead of 1
      this.gameState.movementSpeed += 0.2; // Smaller increments
      this.gameState.lastSpeedIncrease = Date.now();
    }

    // Ball movement
    state.ball.x += Math.sign(state.ball.dx) * (this.gameState.movementSpeed + this.gameState.baseSpeed);
    state.ball.y += Math.sign(state.ball.dy) * (this.gameState.movementSpeed + this.gameState.baseSpeed);

    // Handle collisions
    this.handleCollisions();

    // Handle scoring
    this.handleScoring();
  }

  // Update paddle positions (called every frame, even during countdown)
  updatePaddles() {
    const state = this.gameState.getState();
    
    // Handle AI movement for Player 2 if in AI mode
    if (this.gameState.gameMode === 'ai' && this.gameState.ai) {
      const aiMovement = this.gameState.ai.getMovement(state);
      state.player2.dy = aiMovement;
      
      // Debug AI calls for impossible difficulty
      if (this.gameState.aiDifficulty === 'impossible' && Math.random() < 0.01) { // Log 1% of calls to avoid spam
        console.log(`🎮 GameLoop: AI getMovement called, returned ${aiMovement}, gameActive=${state.gameActive}`);
      }
    }
    
    // Paddle movement
    state.player1.y += state.player1.dy;
    state.player2.y += state.player2.dy;

    // Clamp paddles to screen
    state.player1.y = Math.max(0, Math.min(this.constants.CANVAS_HEIGHT - this.constants.PADDLE_HEIGHT, state.player1.y));
    state.player2.y = Math.max(0, Math.min(this.constants.CANVAS_HEIGHT - this.constants.PADDLE_HEIGHT, state.player2.y));
  }

  // Handle ball collisions with walls and paddles
  handleCollisions() {
    const state = this.gameState.getState();
    const { CANVAS_HEIGHT, PADDLE_WIDTH, PADDLE_HEIGHT, BALL_SIZE } = this.constants;

    // Ball collisions with top/bottom walls
    if (state.ball.y <= 0 || state.ball.y + BALL_SIZE >= CANVAS_HEIGHT) {
      state.ball.dy *= -1;
    }

    // Ball collision with player1 paddle (left)
    if (
      state.ball.x <= state.player1.x + PADDLE_WIDTH &&
      state.ball.x + BALL_SIZE >= state.player1.x &&
      state.ball.y + BALL_SIZE >= state.player1.y &&
      state.ball.y <= state.player1.y + PADDLE_HEIGHT
    ) {
      state.ball.x = state.player1.x + PADDLE_WIDTH;
      state.ball.dx *= -1;
    }

    // Ball collision with player2 paddle (right)
    if (
      state.ball.x + BALL_SIZE >= state.player2.x &&
      state.ball.x <= state.player2.x + PADDLE_WIDTH &&
      state.ball.y + BALL_SIZE >= state.player2.y &&
      state.ball.y <= state.player2.y + PADDLE_HEIGHT
    ) {
      state.ball.x = state.player2.x - BALL_SIZE;
      state.ball.dx *= -1;
    }
  }

  // Handle scoring logic
  handleScoring() {
    const state = this.gameState.getState();
    const { CANVAS_WIDTH } = this.constants;

    // Scoring - Player 2 scores (ball goes off left side)
    if (state.ball.x < 0) {
      state.player2.score++;
      console.log(`Player 2 scored! Score: ${state.player1.score} - ${state.player2.score}`);
      
      if (state.player2.score >= 5) {
        state.winner = "Player 2";
        state.gameActive = false;
        console.log("Player 2 wins!");
        console.log(`🏆 GAME WON BY PLAYER 2 - Final Scores: P1=${state.player1.score}, P2=${state.player2.score}`);
      } else {
        this.gameState.resetBall("player1");
      }
    }
    
    // Scoring - Player 1 scores (ball goes off right side)
    if (state.ball.x > CANVAS_WIDTH) {
      state.player1.score++;
      console.log(`Player 1 scored! Score: ${state.player1.score} - ${state.player2.score}`);
      
      if (state.player1.score >= 5) {
        state.winner = "Player 1";
        state.gameActive = false;
        console.log("Player 1 wins!");
        console.log(`🏆 GAME WON BY PLAYER 1 - Final Scores: P1=${state.player1.score}, P2=${state.player2.score}`);
      } else {
        this.gameState.resetBall("player2");
      }
    }
  }
}

module.exports = GameLoop;