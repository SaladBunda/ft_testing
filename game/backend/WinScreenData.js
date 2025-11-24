/**
 * Win Screen Data Generator
 * Generates customized win/loss screen data with XP, rank points, and player progression
 */
class WinScreenData {
    constructor(statsHandler, progressionSystem) {
        this.statsHandler = statsHandler;
        this.progression = progressionSystem;
    }

    /**
     * Generate win screen data for both players
     * @param {object} gameResult - Game completion data
     * @param {object} player1Info - Player 1 connection info
     * @param {object} player2Info - Player 2 connection info
     * @returns {object} Win screen data for both players
     */
    async generateWinScreenData(gameResult, player1Info, player2Info) {
        try {
            const { player1Id, player2Id, player1Score, player2Score } = gameResult;
            
            // Determine who won
            const player1Won = player1Score > player2Score;
            const player2Won = player2Score > player1Score;
            
            // Get current stats for both players (before the game rewards are applied)
            const player1StatsBefore = player1Id ? await this.statsHandler.getUserStats(player1Id) : null;
            const player2StatsBefore = player2Id ? await this.statsHandler.getUserStats(player2Id) : null;
            
            // Calculate rewards that will be applied
            const player1Rewards = player1StatsBefore ? 
                this.progression.calculateGameRewards(player1Won, true, player1StatsBefore.current_streak || 0) : null;
            const player2Rewards = player2StatsBefore ? 
                this.progression.calculateGameRewards(player2Won, true, player2StatsBefore.current_streak || 0) : null;
            
            // Calculate new stats after rewards
            const player1StatsAfter = this.calculateStatsAfter(player1StatsBefore, player1Rewards, player1Won);
            const player2StatsAfter = this.calculateStatsAfter(player2StatsBefore, player2Rewards, player2Won);
            
            return {
                player1: this.generatePlayerWinData(
                    player1Info?.user,
                    player1Won,
                    player1Score,
                    player2Score,
                    player1StatsBefore,
                    player1StatsAfter,
                    player1Rewards
                ),
                player2: this.generatePlayerWinData(
                    player2Info?.user,
                    player2Won,
                    player2Score,
                    player1Score,
                    player2StatsBefore,
                    player2StatsAfter,
                    player2Rewards
                ),
                matchData: {
                    duration: this.formatDuration(gameResult.gameDuration || 0),
                    winnerName: player1Won ? (player1Info?.user?.username || 'Player 1') : 
                               player2Won ? (player2Info?.user?.username || 'Player 2') : 'Draw',
                    player1Score: player1Score,
                    player2Score: player2Score,
                    totalVolleys: gameResult.totalVolleys || 0,
                    gameMode: gameResult.gameMode || 'matchmaking',
                    timestamp: Date.now()
                }
            };
        } catch (error) {
            console.error('❌ Error generating win screen data:', error);
            return null;
        }
    }

    /**
     * Generate win screen data for a single player
     */
    generatePlayerWinData(user, won, playerScore, opponentScore, statsBefore, statsAfter, rewards) {
        if (!user || !statsBefore || !statsAfter || !rewards) {
            return null;
        }

        const rankBefore = this.progression.getRankInfo(statsBefore.rank_points || 0);
        const rankAfter = this.progression.getRankInfo(statsAfter.rank_points || 0);
        const rankChanged = rankBefore.tier !== rankAfter.tier || rankBefore.level !== rankAfter.level;

        return {
            userId: user.id,
            username: user.username,
            result: won ? 'victory' : 'defeat',
            score: {
                player: playerScore,
                opponent: opponentScore
            },
            rewards: {
                experience: rewards.experience,
                rankPoints: rewards.rankPoints,
                rankPointsChange: rewards.rankPoints >= 0 ? `+${rewards.rankPoints}` : `${rewards.rankPoints}`
            },
            progression: {
                before: {
                    level: statsBefore.player_level || 1,
                    experience: statsBefore.experience_points || 0,
                    rank: `${rankBefore.tier} ${rankBefore.level}`,
                    rankPoints: statsBefore.rank_points || 0,
                    gamesPlayed: statsBefore.games_played || 0,
                    gamesWon: statsBefore.games_won || 0,
                    gamesLost: statsBefore.games_lost || 0,
                    winRate: statsBefore.win_rate || 0,
                    currentStreak: statsBefore.current_streak || 0
                },
                after: {
                    level: statsAfter.player_level || 1,
                    experience: statsAfter.experience_points || 0,
                    rank: `${rankAfter.tier} ${rankAfter.level}`,
                    rankPoints: statsAfter.rank_points || 0,
                    gamesPlayed: statsAfter.games_played || 0,
                    gamesWon: statsAfter.games_won || 0,
                    gamesLost: statsAfter.games_lost || 0,
                    winRate: statsAfter.win_rate || 0,
                    currentStreak: statsAfter.current_streak || 0
                },
                changes: {
                    experienceGained: rewards.experience,
                    rankPointsChanged: rewards.rankPoints,
                    rankChanged: rankChanged,
                    newRank: rankChanged ? `${rankAfter.tier} ${rankAfter.level}` : null,
                    streakChanged: (statsAfter.current_streak || 0) - (statsBefore.current_streak || 0)
                }
            }
        };
    }

    /**
     * Calculate what stats will look like after applying rewards
     */
    calculateStatsAfter(statsBefore, rewards, won) {
        if (!statsBefore || !rewards) return null;

        const newGamesPlayed = statsBefore.games_played + 1;
        const newGamesWon = statsBefore.games_won + (won ? 1 : 0);
        const newGamesLost = statsBefore.games_lost + (won ? 0 : 1);
        const newExperience = statsBefore.experience_points + rewards.experience;
        const newRankPoints = Math.max(0, Math.min(999, (statsBefore.rank_points || 0) + rewards.rankPoints));
        const newStreak = this.progression.updateStreak(statsBefore.current_streak || 0, won);
        const newWinRate = newGamesPlayed > 0 ? (newGamesWon / newGamesPlayed * 100) : 0;

        return {
            ...statsBefore,
            player_level: statsBefore.player_level || 1,
            experience_points: newExperience,
            rank_points: newRankPoints,
            games_played: newGamesPlayed,
            games_won: newGamesWon,
            games_lost: newGamesLost,
            win_rate: Math.round(newWinRate * 100) / 100,
            current_streak: newStreak
        };
    }

    /**
     * Format duration from milliseconds to readable string
     */
    formatDuration(milliseconds) {
        if (!milliseconds) return '0s';
        
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        }
        return `${seconds}s`;
    }
}

module.exports = WinScreenData;