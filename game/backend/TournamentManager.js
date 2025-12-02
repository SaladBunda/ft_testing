/**
 * TournamentManager - Manages 8-player single-elimination tournaments
 * 
 * Tournament Structure:
 * - Quarter-finals: 8 players → 4 winners
 * - Semi-finals: 4 players → 2 winners  
 * - Finals: 2 players → 1 champion
 * 
 * Reward Structure (Rank Points):
 * - Quarter loss: -15 RR (harsh penalty)
 * - Quarter win: +2 RR (small reward for advancing)
 * - Semi loss: 0 RR (no penalty, made it far)
 * - Semi win: +5 RR (decent reward)
 * - Final loss: +3 RR (runner-up still rewarded)
 * - Final win: +10 RR (champion bonus)
 * 
 * XP Structure (similar scaling):
 * - Quarter loss: +5 XP (participation)
 * - Quarter win: +15 XP (advanced)
 * - Semi loss: +25 XP (top 4)
 * - Semi win: +40 XP (finalist)
 * - Final loss: +60 XP (runner-up)
 * - Final win: +100 XP (champion)
 */

class TournamentManager {
  constructor() {
    this.tournaments = new Map(); // tournamentId -> Tournament
    this.playerQueue = []; // Players waiting for next tournament
    this.nextTournamentId = 1;
    this.REQUIRED_PLAYERS = 8;
  }

  /**
   * Add a player to the tournament queue
   * @returns {Object} Status object with queue info or tournament started info
   */
  addPlayerToQueue(connection, user) {
    // Check if player already in queue
    const existingIndex = this.playerQueue.findIndex(p => p.user.id === user.id);
    if (existingIndex !== -1) {
      console.log(`⚠️ Player ${user.username} already in tournament queue`);
      return {
        status: 'already_queued',
        position: existingIndex + 1,
        playersNeeded: this.REQUIRED_PLAYERS - this.playerQueue.length
      };
    }

    // Add player to queue
    const playerData = {
      connection,
      user,
      joinedAt: Date.now()
    };
    
    this.playerQueue.push(playerData);
    console.log(`🎪 ${user.username} joined tournament queue (${this.playerQueue.length}/${this.REQUIRED_PLAYERS})`);

    // Check if we have enough players to start
    if (this.playerQueue.length >= this.REQUIRED_PLAYERS) {
      return this.startTournament();
    }

    return {
      status: 'queued',
      position: this.playerQueue.length,
      playersNeeded: this.REQUIRED_PLAYERS - this.playerQueue.length,
      queuedPlayers: this.playerQueue.map(p => ({
        username: p.user.username,
        id: p.user.id
      }))
    };
  }

  /**
   * Remove player from tournament queue
   */
  removePlayerFromQueue(userId) {
    const index = this.playerQueue.findIndex(p => p.user.id === userId);
    if (index !== -1) {
      const removed = this.playerQueue.splice(index, 1)[0];
      console.log(`🚫 ${removed.user.username} left tournament queue`);
      return true;
    }
    return false;
  }

  /**
   * Start a new tournament with 8 players
   */
  startTournament() {
    if (this.playerQueue.length < this.REQUIRED_PLAYERS) {
      console.log(`❌ Not enough players to start tournament (${this.playerQueue.length}/${this.REQUIRED_PLAYERS})`);
      return null;
    }

    // Take first 8 players from queue (keep any extras for next tournament)
    const players = this.playerQueue.splice(0, this.REQUIRED_PLAYERS);
    
    console.log(`🎪 Starting tournament with 8 players. Remaining in queue: ${this.playerQueue.length}`);
    
    // Shuffle players for random bracket seeding
    this.shuffleArray(players);

    const tournamentId = `tournament_${this.nextTournamentId++}`;
    
    const tournament = {
      id: tournamentId,
      status: 'quarter_finals', // quarter_finals | semi_finals | finals | completed
      startedAt: Date.now(),
      players: players,
      bracket: this.createBracket(players),
      currentRound: [],
      results: {
        quarterFinals: [],
        semiFinals: [],
        finals: []
      },
      champion: null
    };

    this.tournaments.set(tournamentId, tournament);
    
    console.log(`🏆 Tournament ${tournamentId} started with ${players.length} players!`);
    console.log(`📋 Bracket:`, this.getBracketDisplay(tournament));

    return {
      status: 'tournament_started',
      tournamentId: tournamentId,
      bracket: tournament.bracket,
      players: players.map(p => ({
        username: p.user.username,
        id: p.user.id
      }))
    };
  }

  /**
   * Create initial tournament bracket (quarter-finals)
   */
  createBracket(players) {
    return {
      quarterFinals: [
        { match: 1, player1: players[0], player2: players[1], winner: null },
        { match: 2, player1: players[2], player2: players[3], winner: null },
        { match: 3, player1: players[4], player2: players[5], winner: null },
        { match: 4, player1: players[6], player2: players[7], winner: null }
      ],
      semiFinals: [
        { match: 5, player1: null, player2: null, winner: null }, // Winner of match 1 vs match 2
        { match: 6, player1: null, player2: null, winner: null }  // Winner of match 3 vs match 4
      ],
      finals: { match: 7, player1: null, player2: null, winner: null }
    };
  }

  /**
   * Get next match for a player in a tournament
   */
  getNextMatch(tournamentId, userId) {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return null;

    // Check current round matches
    let currentMatches = [];
    
    if (tournament.status === 'quarter_finals') {
      currentMatches = tournament.bracket.quarterFinals;
    } else if (tournament.status === 'semi_finals') {
      currentMatches = tournament.bracket.semiFinals;
    } else if (tournament.status === 'finals') {
      currentMatches = [tournament.bracket.finals];
    }

    // Find match where this player is participating and hasn't been played yet
    return currentMatches.find(match => 
      match.winner === null && 
      (match.player1?.user.id === userId || match.player2?.user.id === userId)
    );
  }

  /**
   * Record match result and advance tournament
   */
  recordMatchResult(tournamentId, matchId, winnerId, loserId, gameData) {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) {
      console.log(`❌ Tournament ${tournamentId} not found`);
      return null;
    }

    let match = null;
    let round = null;

    // Find the match
    if (tournament.status === 'quarter_finals') {
      match = tournament.bracket.quarterFinals.find(m => m.match === matchId);
      round = 'quarterFinals';
    } else if (tournament.status === 'semi_finals') {
      match = tournament.bracket.semiFinals.find(m => m.match === matchId);
      round = 'semiFinals';
    } else if (tournament.status === 'finals') {
      if (tournament.bracket.finals.match === matchId) {
        match = tournament.bracket.finals;
        round = 'finals';
      }
    }

    if (!match) {
      console.log(`❌ Match ${matchId} not found in tournament ${tournamentId}`);
      return null;
    }

    // Set winner
    const winner = match.player1.user.id === winnerId ? match.player1 : match.player2;
    const loser = match.player1.user.id === loserId ? match.player1 : match.player2;
    match.winner = winner;

    // Calculate rewards based on round
    const rewards = this.calculateRewards(round, 'winner');
    const loserRewards = this.calculateRewards(round, 'loser');

    // Store result
    const result = {
      match: matchId,
      round: round,
      winner: winner.user,
      loser: loser.user,
      gameData: gameData,
      timestamp: Date.now(),
      rewards: {
        winner: rewards,
        loser: loserRewards
      }
    };

    // Convert round name from snake_case to camelCase for results object
    const resultsKey = round === 'quarter_finals' ? 'quarterFinals' : 
                       round === 'semi_finals' ? 'semiFinals' : 'finals';
    tournament.results[resultsKey].push(result);

    console.log(`✅ Match ${matchId} result: ${winner.user.username} defeats ${loser.user.username}`);
    console.log(`💰 Rewards - Winner: ${rewards.rankPoints} RR, ${rewards.experience} XP | Loser: ${loserRewards.rankPoints} RR, ${loserRewards.experience} XP`);

    // Advance tournament (pass rewards to include in return)
    return this.advanceTournament(tournament, match, winner, round, rewards, loserRewards);
  }

  /**
   * Calculate rewards based on round and outcome
   */
  calculateRewards(round, outcome) {
    const rewards = {
      quarterFinals: {
        winner: { rankPoints: 2, experience: 15 },
        loser: { rankPoints: -5, experience: 5 }
      },
      semiFinals: {
        winner: { rankPoints: 5, experience: 40 },
        loser: { rankPoints: 0, experience: 25 }
      },
      finals: {
        winner: { rankPoints: 10, experience: 100 },
        loser: { rankPoints: 3, experience: 60 }
      }
    };

    const reward = rewards[round][outcome];
    
    // Convert to format expected by GameStatsHandler
    return {
      rating_change: reward.rankPoints,
      xp_gain: reward.experience,
      // Keep original names for display
      rankPoints: reward.rankPoints,
      experience: reward.experience
    };
  }

  /**
   * Advance tournament to next round
   */
  advanceTournament(tournament, completedMatch, winner, round, winnerRewards, loserRewards) {
    if (round === 'quarterFinals') {
      // Check if all quarter-final matches are complete
      const allQuartersComplete = tournament.bracket.quarterFinals.every(m => m.winner !== null);
      
      if (allQuartersComplete) {
        // Set up semi-finals
        tournament.bracket.semiFinals[0].player1 = tournament.bracket.quarterFinals[0].winner;
        tournament.bracket.semiFinals[0].player2 = tournament.bracket.quarterFinals[1].winner;
        tournament.bracket.semiFinals[1].player1 = tournament.bracket.quarterFinals[2].winner;
        tournament.bracket.semiFinals[1].player2 = tournament.bracket.quarterFinals[3].winner;
        
        tournament.status = 'semi_finals';
        console.log(`🎯 Tournament ${tournament.id} advancing to SEMI-FINALS`);
        
        return {
          success: true,
          status: 'round_complete',
          nextRound: 'semi_finals',
          bracket: tournament.bracket,
          message: 'Quarter-finals complete! Semi-finals starting...',
          winnerRewards: winnerRewards,
          loserRewards: loserRewards
        };
      }
    } else if (round === 'semiFinals') {
      // Check if all semi-final matches are complete
      const allSemisComplete = tournament.bracket.semiFinals.every(m => m.winner !== null);
      
      if (allSemisComplete) {
        // Set up finals
        tournament.bracket.finals.player1 = tournament.bracket.semiFinals[0].winner;
        tournament.bracket.finals.player2 = tournament.bracket.semiFinals[1].winner;
        
        tournament.status = 'finals';
        console.log(`🏆 Tournament ${tournament.id} advancing to FINALS`);
        
        return {
          success: true,
          status: 'round_complete',
          nextRound: 'finals',
          bracket: tournament.bracket,
          message: 'Semi-finals complete! FINALS starting...',
          winnerRewards: winnerRewards,
          loserRewards: loserRewards
        };
      }
    } else if (round === 'finals') {
      // Tournament complete!
      tournament.status = 'completed';
      tournament.champion = winner.user;
      tournament.completedAt = Date.now();
      
      console.log(`👑 Tournament ${tournament.id} COMPLETE! Champion: ${winner.user.username}`);
      
      return {
        success: true,
        status: 'tournament_complete',
        champion: winner.user,
        bracket: tournament.bracket,
        message: `Tournament complete! ${winner.user.username} is the CHAMPION!`,
        winnerRewards: winnerRewards,
        loserRewards: loserRewards,
        tournamentComplete: true
      };
    }

    return {
      success: true,
      status: 'match_complete',
      winner: winner.user,
      bracket: tournament.bracket,
      winnerRewards: winnerRewards,
      loserRewards: loserRewards
    };
  }

  /**
   * Get tournament status
   */
  getTournament(tournamentId) {
    return this.tournaments.get(tournamentId);
  }

  /**
   * Get player's active tournament
   */
  getPlayerTournament(userId) {
    for (const [id, tournament] of this.tournaments.entries()) {
      if (tournament.status !== 'completed') {
        const isInTournament = tournament.players.some(p => p.user.id === userId);
        if (isInTournament) {
          return tournament;
        }
      }
    }
    return null;
  }

  /**
   * Get bracket display for logging
   */
  getBracketDisplay(tournament) {
    const display = {
      quarterFinals: tournament.bracket.quarterFinals.map(m => 
        `Match ${m.match}: ${m.player1.user.username} vs ${m.player2.user.username}${m.winner ? ` → Winner: ${m.winner.user.username}` : ''}`
      ),
      semiFinals: tournament.bracket.semiFinals.map(m => {
        if (!m.player1 || !m.player2) return `Match ${m.match}: TBD`;
        return `Match ${m.match}: ${m.player1.user.username} vs ${m.player2.user.username}${m.winner ? ` → Winner: ${m.winner.user.username}` : ''}`;
      }),
      finals: tournament.bracket.finals.player1 && tournament.bracket.finals.player2
        ? `Match ${tournament.bracket.finals.match}: ${tournament.bracket.finals.player1.user.username} vs ${tournament.bracket.finals.player2.user.username}${tournament.bracket.finals.winner ? ` → CHAMPION: ${tournament.bracket.finals.winner.user.username}` : ''}`
        : 'Finals: TBD'
    };
    return display;
  }

  /**
   * Shuffle array (Fisher-Yates algorithm)
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Clean up completed tournaments (call periodically)
   */
  cleanupOldTournaments() {
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    
    for (const [id, tournament] of this.tournaments.entries()) {
      if (tournament.status === 'completed' && (now - tournament.completedAt > ONE_HOUR)) {
        this.tournaments.delete(id);
        console.log(`🧹 Cleaned up old tournament ${id}`);
      }
    }
  }
}

module.exports = TournamentManager;
