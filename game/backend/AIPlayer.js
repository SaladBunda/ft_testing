class AIPlayer {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
    this.lastUpdate = Date.now();
    this.reactionDelay = 0;
    this.nextMove = 0;
    this.calculationCount = 0;
    this.lastLogTime = Date.now();
    
    // Configure AI based on difficulty
    this.setDifficulty(difficulty);
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty;
    
    switch(difficulty) {
      case 'easy':
        this.speed = 3;           // Slower movement
        this.reactionTime = 300;  // 300ms reaction delay
        this.accuracy = 0.7;      // 70% accuracy
        this.prediction = 0.1;    // Minimal prediction
        break;
        
      case 'medium':
        this.speed = 4;           // Normal movement
        this.reactionTime = 150;  // 150ms reaction delay
        this.accuracy = 0.85;     // 85% accuracy
        this.prediction = 0.3;    // Some prediction
        break;
        
      case 'hard':
        this.speed = 5;           // Fast movement
        this.reactionTime = 50;   // 50ms reaction delay
        this.accuracy = 0.95;     // 95% accuracy
        this.prediction = 0.6;    // Good prediction
        break;
        
      case 'impossible':
        this.speed = 5.2;           // Very fast
        this.reactionTime = 0;    // Instant reaction
        this.accuracy = 0.99;     // Nearly perfect
        this.prediction = 0.8;    // Excellent prediction
        break;
        
      default:
        this.setDifficulty('medium');
    }
  }

  // Calculate AI paddle movement
  calculateMove(gameState) {
    const now = Date.now();
    const ball = gameState.ball;
    const aiPaddle = gameState.player2; // AI controls player2
    const paddleCenter = aiPaddle.y + 50; // Paddle height / 2
    
    // Don't update too frequently (reaction time simulation + performance)
    // This prevents AI from recalculating every frame
    if (now - this.lastUpdate < Math.max(this.reactionTime, 50)) { // Minimum 50ms between calculations
      return this.nextMove;
    }
    
    this.lastUpdate = now;
    this.calculationCount++;
    
    // Debug: Log calculation frequency every 2 seconds
    if (now - this.lastLogTime > 2000) {
      console.log(`🤖 AI calculations per 2s: ${this.calculationCount} (${this.difficulty} difficulty)`);
      this.calculationCount = 0;
      this.lastLogTime = now;
    }
    
    // Calculate target position (optimized)
    let targetY = ball.y;
    
    // Add prediction based on difficulty (only if ball is close)
    if (this.prediction > 0 && ball.dx > 0 && (aiPaddle.x - ball.x) < 200) {
      // Simplified prediction calculation
      const timeToReach = (aiPaddle.x - ball.x) / Math.abs(ball.dx);
      targetY = ball.y + (ball.dy * timeToReach * this.prediction);
    }
    
    // Add some randomness based on accuracy (less frequent)
    if (Math.random() > this.accuracy) {
      targetY += (Math.random() - 0.5) * 80; // Reduced error range
    }
    
    // Calculate movement direction
    const difference = targetY - paddleCenter;
    
    if (Math.abs(difference) < 10) {
      this.nextMove = 0; // Close enough, don't move
    } else if (difference > 0) {
      this.nextMove = this.speed; // Move down
    } else {
      this.nextMove = -this.speed; // Move up
    }
    
    return this.nextMove;
  }

  // Get AI movement for current frame
  getMovement(gameState) {
    // Only move if game is active and ball exists
    if (!gameState.gameActive || !gameState.ball) {
      this.nextMove = 0;
      return 0;
    }
    
    // Quick optimization: if ball is moving away from AI, don't calculate
    if (gameState.ball.dx < 0) { // Ball moving toward player 1
      // Gradually stop moving when ball goes away
      this.nextMove = this.nextMove * 0.8;
      if (Math.abs(this.nextMove) < 0.5) this.nextMove = 0;
      return Math.round(this.nextMove);
    }
    
    return this.calculateMove(gameState);
  }
}

module.exports = AIPlayer;