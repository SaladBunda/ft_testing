# AI Implementation Guide

This project now has **two AI implementations** that you can easily switch between:

## 🤖 Available AI Types

### 1. **Original AI** (`AIPlayer.js`)
- **Smooth and responsive** gameplay
- **Normal reaction times** (50-300ms based on difficulty)
- **Real-time calculations** for natural movement
- **Great for gameplay experience**

### 2. **Subject-Compliant AI** (`SubjectCompliantAI.js`)
- **Follows subject requirements exactly**
- **1-second view refresh rate** (as required)
- **Keyboard simulation** (ArrowUp/ArrowDown)
- **Advanced prediction algorithms** with trajectory calculation
- **Strategic decision making** with state machines

## 🔄 How to Switch Between AI Types

### Option 1: Edit Configuration File (Recommended)
1. Open `game/backend/AIFactory.js`
2. Find the `AI_CONFIG` section at the bottom:
```javascript
const AI_CONFIG = {
  defaultType: 'original',  // Change this line!
  defaultDifficulty: 'medium',
  debug: true
};
```
3. Change `defaultType` to:
   - `'original'` for smooth AI
   - `'subject-compliant'` for academic requirements
4. Restart the game backend: `docker-compose restart game_backend`

### Option 2: Direct Factory Call
You can also create specific AI instances in your code:
```javascript
const { AIFactory } = require('./AIFactory');

// Create original AI
const smoothAI = AIFactory.createAI('original', 'hard');

// Create subject-compliant AI  
const academicAI = AIFactory.createAI('subject-compliant', 'medium');
```

## 🎯 AI Algorithms Used

### Subject-Compliant AI Features:
- **Trajectory Prediction**: Calculates ball path with multiple bounces
- **Physics Simulation**: Predicts wall bounces and ball movement
- **State Machine**: OBSERVING → TRACKING → POSITIONING states
- **Fuzzy Logic**: Dynamic dead zones and precision control
- **Pattern Recognition**: Learns player behavior over time
- **Strategic Anticipation**: Looks ahead 2-5 bounces based on difficulty

### No A* Algorithm Used
As per subject requirements, the AI uses alternative algorithms:
- **Trajectory physics simulation** instead of pathfinding
- **Predictive modeling** with error injection
- **Behavioral state machines** for decision making
- **Fuzzy logic controllers** for movement precision

## 🔧 Difficulty Levels

Both AI types support 4 difficulty levels:

| Difficulty | Speed | Accuracy | Prediction | Reaction Time |
|------------|-------|----------|------------|---------------|
| Easy | 3 | 60-70% | Minimal | 300ms |
| Medium | 4 | 75-85% | Moderate | 150ms |
| Hard | 5 | 90-95% | Good | 50ms |
| Impossible | 5.2-5.5 | 95-99% | Excellent | 0-instant |

## 🐛 Easy Removal

If the new AI doesn't work properly:
1. Change `defaultType` back to `'original'` in `AIFactory.js`
2. Restart: `docker-compose restart game_backend`
3. Or delete the new files: `SubjectCompliantAI.js` and `AIFactory.js`

## 📊 Debug Information

Both AIs provide console logging:
- **Original AI**: Calculation frequency and decision making
- **Subject-Compliant AI**: State transitions, predictions, and keyboard simulation

Set `debug: true` in `AIFactory.js` for detailed logging.

## 🚀 Testing the New AI

1. Set `defaultType: 'subject-compliant'` in `AIFactory.js`
2. Restart backend: `docker-compose restart game_backend`
3. Start a game against AI
4. Watch console for AI decision logging
5. Observe the 1-second decision pattern (AI only "sees" once per second)

The Subject-Compliant AI should feel more strategic and anticipatory, making fewer but more calculated moves!