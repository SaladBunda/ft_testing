/**
 * AI Configuration and Factory
 * 
 * This file allows easy switching between different AI implementations:
 * - AIPlayer: Original working AI (smooth, responsive)
 * - SubjectCompliantAI: Subject-requirement AI (1-second refresh, keyboard simulation)
 */

const AIPlayer = require('./AIPlayer');
const SubjectCompliantAI = require('./SubjectCompliantAI');

class AIFactory {
  /**
   * Create AI instance based on configuration
   * 
   * @param {string} aiType - 'original' or 'subject-compliant'
   * @param {string} difficulty - 'easy', 'medium', 'hard', 'impossible'
   * @returns AI instance
   */
  static createAI(aiType = 'original', difficulty = 'medium') {
    console.log(`🏭 Creating AI: ${aiType} (${difficulty} difficulty)`);
    
    switch (aiType.toLowerCase()) {
      case 'original':
      case 'smooth':
      case 'responsive':
        return new AIPlayer(difficulty);
        
      case 'subject':
      case 'subject-compliant':
      case 'compliant':
      case 'academic':
        return new SubjectCompliantAI(difficulty);
        
      default:
        console.warn(`⚠️ Unknown AI type '${aiType}', defaulting to 'original'`);
        return new AIPlayer(difficulty);
    }
  }
  
  /**
   * Get available AI types
   */
  static getAvailableTypes() {
    return [
      {
        type: 'original',
        name: 'Original AI',
        description: 'Smooth, responsive AI with normal reaction times'
      },
      {
        type: 'subject-compliant',
        name: 'Subject-Compliant AI', 
        description: 'AI that follows subject requirements (1s refresh, keyboard simulation)'
      }
    ];
  }
  
  /**
   * Get available difficulties
   */
  static getAvailableDifficulties() {
    return [
      {
        level: 'easy',
        name: 'Easy',
        description: 'Slow movement, makes mistakes, minimal prediction'
      },
      {
        level: 'medium',
        name: 'Medium',
        description: 'Balanced gameplay, decent prediction'
      },
      {
        level: 'hard',
        name: 'Hard',
        description: 'Fast movement, accurate, good prediction'
      },
      {
        level: 'impossible',
        name: 'Impossible',
        description: 'Nearly perfect AI, excellent prediction'
      }
    ];
  }
}

// Configuration - Change these values to switch AI implementations
const AI_CONFIG = {
  // Set to 'original' for smooth AI or 'subject-compliant' for academic requirements
  defaultType: 'subject-compliant',
  
  // Default difficulty level
  defaultDifficulty: 'medium',
  
  // Enable debug logging
  debug: true
};

module.exports = {
  AIFactory,
  AI_CONFIG
};