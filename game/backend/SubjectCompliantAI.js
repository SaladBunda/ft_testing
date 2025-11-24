/**
 * Subject-Compliant AI - Always calculates trajectory
 */
class SubjectCompliantAI {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
    this.viewRefreshInterval = 1000; // Back to 1 second as required
    this.lastViewUpdate = 0;
    this.gameSnapshot = null;
    this.predictedInterceptY = null;
    this.currentKeyPressed = null;
    
    // Target position management
    this.targetPosition = null;
    this.hasReachedTarget = false;
    this.positionTolerance = 20;
    this.lastMovementChange = 0; // Track when we last changed movement for reaction delay
    
    switch (difficulty) {
      case 'easy':
        this.movementSpeed = 3;
        this.errorRate = 0.4; // 40% chance of mistakes
        this.bounceLookAhead = 3;
        this.movementInaccuracy = 60; // Large movement errors (±30px)
        this.reactionDelay = 300; // 300ms delay in reactions
        break;
      case 'medium':
        this.movementSpeed = 4;
        this.errorRate = 0.25; // 25% chance of mistakes
        this.bounceLookAhead = 4;
        this.movementInaccuracy = 40; // Medium movement errors (±20px)
        this.reactionDelay = 200; // 200ms delay
        break;
      case 'hard':
        this.movementSpeed = 5;
        this.errorRate = 0.15; // 15% chance of mistakes
        this.bounceLookAhead = 5;
        this.movementInaccuracy = 25; // Small movement errors (±12.5px)
        this.reactionDelay = 100; // 100ms delay
        break;
      case 'impossible':
        this.movementSpeed = 5.5;
        this.errorRate = 0.02; // 2% chance of mistakes
        this.bounceLookAhead = 6;
        this.movementInaccuracy = 10; // Tiny movement errors (±5px)
        this.reactionDelay = 50; // 50ms delay
        break;
    }
  }

  update(gameState) {
    const now = Date.now();
    
    // Take snapshot and calculate new target every 1 second
    if (now - this.lastViewUpdate >= this.viewRefreshInterval) {
      console.log(`🔄 AI: Taking snapshot after ${now - this.lastViewUpdate}ms`);
      this.takeSnapshot(gameState);
      this.calculateTrajectoryAndMove();
      this.lastViewUpdate = now;
    }
    
    // Always try to move toward current target (called every frame)
    this.moveTowardTarget();
  }

  takeSnapshot(gameState) {
    this.gameSnapshot = {
      ball: { x: gameState.ball.x, y: gameState.ball.y, dx: gameState.ball.dx, dy: gameState.ball.dy },
      aiPaddle: { x: gameState.player2.x, y: gameState.player2.y },
      canvasWidth: 800,
      canvasHeight: 400
    };
    console.log(`📷 Snapshot: Ball(${this.gameSnapshot.ball.x.toFixed(1)}, ${this.gameSnapshot.ball.y.toFixed(1)}) Speed(${this.gameSnapshot.ball.dx.toFixed(1)}, ${this.gameSnapshot.ball.dy.toFixed(1)})`);
  }

  calculateTrajectoryAndMove() {
    if (!this.gameSnapshot) return;
    
    // Calculate final intercept position with multiple bounces
    this.predictedInterceptY = this.predictBallWithBounces();
    
    // Only set new target if we don't already have one or if we've reached it
    // Don't change target while we're still moving to prevent oscillation
    if (this.targetPosition === null || this.hasReachedTarget) {
      
      // Apply difficulty-based trajectory prediction error
      let finalTarget = this.predictedInterceptY;
      if (Math.random() < this.errorRate) {
        // Add prediction error (wrong target entirely)
        finalTarget += (Math.random() - 0.5) * this.movementInaccuracy;
      }
      
      // Add movement inaccuracy (overshooting/undershooting)
      const movementError = (Math.random() - 0.5) * (this.movementInaccuracy * 0.5);
      finalTarget += movementError;
      
      // Set new target position
      this.targetPosition = finalTarget;
      this.hasReachedTarget = false;
      
      if (this.difficulty === 'impossible') {
        console.log(`🎯 NEW TARGET: Ball will hit at Y=${this.predictedInterceptY.toFixed(1)}, moving to Y=${this.targetPosition.toFixed(1)} (error=${movementError.toFixed(1)})`);
      }
    } else if (this.difficulty === 'impossible') {
      console.log(`🎯 IGNORING UPDATE: Still moving to target Y=${this.targetPosition.toFixed(1)} (hasReached=${this.hasReachedTarget})`);
    }
  }

  predictBallWithBounces() {
    const ball = this.gameSnapshot.ball;
    const aiPaddleX = this.gameSnapshot.aiPaddle.x;
    
    // If ball moving away, position at center
    if (ball.dx < 0) {
      return this.gameSnapshot.canvasHeight / 2;
    }
    
    let currentX = ball.x;
    let currentY = ball.y;
    let currentDX = ball.dx;
    let currentDY = ball.dy;
    let bounceCount = 0;
    
    // Use the same physics as the actual game
    const ballSize = 10; // Assuming ball size
    const canvasHeight = this.gameSnapshot.canvasHeight;
    
    // Simulate forward with bounces
    for (let step = 0; step < 2000 && bounceCount < this.bounceLookAhead; step++) {
      // Move ball by 1 pixel per step (same as game speed)
      currentX += Math.sign(currentDX);
      currentY += Math.sign(currentDY);
      
      // Handle wall bounces (same logic as GameLoop.js)
      if (currentY <= 0) {
        currentY = 0;
        currentDY = Math.abs(currentDY);
        bounceCount++;
      } else if (currentY + ballSize >= canvasHeight) {
        currentY = canvasHeight - ballSize;
        currentDY = -Math.abs(currentDY);
        bounceCount++;
      }
      
      // Check if we've reached our paddle X position
      if (currentX >= aiPaddleX - 10) { // Account for ball size
        const finalY = currentY + (ballSize / 2); // Center of ball
        
        if (this.difficulty === 'impossible') {
          console.log(`🎯 Ball will hit at Y=${finalY.toFixed(1)} after ${bounceCount} bounces and ${step} steps`);
        }
        
        // Clamp to paddle-reachable area
        return Math.max(50, Math.min(canvasHeight - 50, finalY));
      }
      
      // Stop if ball goes off screen
      if (currentX < 0) {
        break;
      }
    }
    
    return this.gameSnapshot.canvasHeight / 2;
  }

  moveTowardTarget() {
    if (this.targetPosition === null || this.hasReachedTarget) {
      this.currentKeyPressed = null;
      return;
    }
    
    // Use current paddle position from the most recent update, not snapshot
    if (!this.gameSnapshot) {
      this.currentKeyPressed = null;
      return;
    }
    
    const paddleCenter = this.gameSnapshot.aiPaddle.y + 50;
    const difference = this.targetPosition - paddleCenter;
    const now = Date.now();
    
    // Check if we've reached the target - use larger tolerance for stability
    if (Math.abs(difference) <= this.positionTolerance) {
      this.hasReachedTarget = true;
      this.currentKeyPressed = null;
      
      if (this.difficulty === 'impossible') {
        console.log(`✅ REACHED TARGET: paddle=${paddleCenter.toFixed(1)}, target=${this.targetPosition.toFixed(1)}, STOPPING MOVEMENT`);
      }
      return;
    }
    
    // Apply reaction delay - don't change movement too quickly (human-like behavior)
    if (now - this.lastMovementChange < this.reactionDelay) {
      // Keep current movement during reaction delay
      return;
    }
    
    // Determine new movement direction
    let newMovement = null;
    if (difference > 0) {
      newMovement = 'ArrowDown';
    } else {
      newMovement = 'ArrowUp';
    }
    
    // Only update if movement changed (saves on reaction delay)
    if (newMovement !== this.currentKeyPressed) {
      this.currentKeyPressed = newMovement;
      this.lastMovementChange = now;
      
      if (this.difficulty === 'impossible') {
        console.log(`➡️ MOVING: paddle=${paddleCenter.toFixed(1)} → target=${this.targetPosition.toFixed(1)}, diff=${difference.toFixed(1)}, key=${this.currentKeyPressed}, delay=${this.reactionDelay}ms`);
      }
    }
  }

  getMovement(gameState) {
    // Call update to process AI logic
    this.update(gameState);
    
    // Don't move during countdown or when game is not active
    if (gameState.countdown > 0 || !gameState.gameActive || gameState.winner) {
      if (this.difficulty === 'impossible') {
        console.log(`🚫 AI Movement blocked: countdown=${gameState.countdown}, gameActive=${gameState.gameActive}, winner=${gameState.winner}`);
      }
      return 0;
    }
    
    // Check target with real-time paddle position for better accuracy
    if (this.targetPosition !== null && !this.hasReachedTarget) {
      const currentPaddleCenter = gameState.player2.y + 50;
      const difference = this.targetPosition - currentPaddleCenter;
      
      // Update hasReachedTarget with real-time position
      if (Math.abs(difference) <= this.positionTolerance) {
        this.hasReachedTarget = true;
        this.currentKeyPressed = null;
        
        if (this.difficulty === 'impossible') {
          console.log(`✅ TARGET REACHED (real-time): paddle=${currentPaddleCenter.toFixed(1)}, target=${this.targetPosition.toFixed(1)}`);
        }
      }
    }
    
    let movement = 0;
    if (this.currentKeyPressed === 'ArrowUp') {
      movement = -this.movementSpeed;
    } else if (this.currentKeyPressed === 'ArrowDown') {
      movement = this.movementSpeed;
    }
    
    if (this.difficulty === 'impossible') {
      console.log(`🔍 AI Debug: currentKeyPressed=${this.currentKeyPressed}, movement=${movement}, hasReached=${this.hasReachedTarget}, target=${this.targetPosition ? this.targetPosition.toFixed(1) : 'none'}`);
    }
    
    return movement;
  }
}

module.exports = SubjectCompliantAI;