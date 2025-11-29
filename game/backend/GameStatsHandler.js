const PlayerProgression = require('./PlayerProgression');

class GameStatsHandler {
    constructor(userAuth) {
        this.userAuth = userAuth;
        this.progression = new PlayerProgression();
    }

    /**
     * Process game completion and update player statistics
     * @param {object} gameResult - Game completion data
     * @param {number} gameResult.player1Id - Player 1 user ID
     * @param {number} gameResult.player2Id - Player 2 user ID (null for AI/solo)
     * @param {number} gameResult.player1Score - Player 1 final score
     * @param {number} gameResult.player2Score - Player 2 final score
     * @param {string} gameResult.gameMode - Game mode (matchmaking, ai, solo)
     * @param {string} gameResult.aiDifficulty - AI difficulty if applicable
     * @param {number} gameResult.gameDuration - Game duration in seconds
     */
    async processGameCompletion(gameResult) {
        const { 
            player1Id, 
            player2Id, 
            player1Score, 
            player2Score, 
            gameMode = 'matchmaking',
            aiDifficulty = null,
            gameDuration = 0 
        } = gameResult;

        console.log(`🏆 Processing game completion: P1(${player1Id}): ${player1Score} vs P2(${player2Id}): ${player2Score}`);

        try {
            // Get current player stats
            const player1Stats = await this.getUserStats(player1Id);
            const player2Stats = player2Id ? await this.getUserStats(player2Id) : null;

            // Determine winner - no draws, someone must win
            let player1Won = player1Score > player2Score;
            let player2Won = player2Score > player1Score;
            
            // If scores are tied, player 1 wins (could also randomize this)
            if (player1Score === player2Score) {
                player1Won = true;
                player2Won = false;
            }

            console.log(`🎯 Game result: P1 won: ${player1Won}, P2 won: ${player2Won}`);

            // Update Player 1
            await this.updatePlayerStats(
                player1Id, 
                player1Stats, 
                player1Won, 
                gameMode
            );

            // Update Player 2 (if not AI/solo)
            if (player2Id && player2Stats) {
                await this.updatePlayerStats(
                    player2Id, 
                    player2Stats, 
                    player2Won, 
                    gameMode
                );
            }

            // Log game to history (optional - could be implemented later)
            await this.logGameHistory({
                player1Id,
                player2Id,
                player1Score,
                player2Score,
                gameMode,
                aiDifficulty,
                gameDuration,
                winner: player1Won ? player1Id : player2Id
            });

            console.log(`✅ Game stats updated successfully`);

        } catch (error) {
            console.error('❌ Error processing game completion:', error);
            throw error;
        }
    }

    /**
     * Get current user statistics
     * @param {number} userId - User ID
     * @returns {object} Current user stats
     */
    async getUserStats(userId) {
        return new Promise((resolve, reject) => {
            const db = this.userAuth.getDb();
            const query = `
                SELECT 
                    id, email, username, 
                    player_level, experience_points, rank_points, rank_tier,
                    games_played, games_won, games_lost, win_rate, current_streak
                FROM users 
                WHERE id = ?
            `;
            
            db.get(query, [userId], (err, row) => {
                db.close();
                if (err) {
                    reject(err);
                } else if (!row) {
                    reject(new Error(`User ${userId} not found`));
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Update player statistics after a game
     * @param {number} userId - User ID
     * @param {object} currentStats - Current player stats
     * @param {boolean} won - Whether player won
     * @param {string} gameMode - Game mode
     */
    async updatePlayerStats(userId, currentStats, won, gameMode) {
        const gameOutcome = won ? 'win' : 'loss';
        
        // Calculate rewards using the simplified method signature
        const rewards = this.progression.calculateGameRewards(
            won, 
            true, // isRanked 
            currentStats.current_streak || 0
        );

        // Update game counts
        const newGamesPlayed = currentStats.games_played + 1;
        const newGamesWon = currentStats.games_won + (won ? 1 : 0);
        const newGamesLost = currentStats.games_lost + (won ? 0 : 1);

        // Calculate new values
        const newExperience = currentStats.experience_points + rewards.experience;
        const newRankPoints = this.progression.clampRankPoints((currentStats.rank_points || 0) + rewards.rankPoints);
        const newStreak = this.progression.updateStreak(currentStats.current_streak || 0, won);
        
        // Get rank info from the updated rank points
        const rankInfo = this.progression.getRankInfo(newRankPoints);
        
        // Calculate win rate
        const winRate = newGamesPlayed > 0 ? (newGamesWon / newGamesPlayed * 100) : 0;

        console.log(`📊 ${currentStats.username || 'User'} stats update:`, {
            outcome: gameOutcome,
            experienceGained: rewards.experience,
            rankPointsChange: rewards.rankPoints,
            newRankPoints: newRankPoints,
            newRank: `${rankInfo.tier} ${rankInfo.level}`,
            newStreak: newStreak,
            winRate: Math.round(winRate * 100) / 100
        });

        // Update database
        const updateQuery = `
            UPDATE users SET 
                player_level = ?,
                experience_points = ?,
                rank_points = ?,
                rank_tier = ?,
                games_played = ?,
                games_won = ?,
                games_lost = ?,
                win_rate = ?,
                current_streak = ?,
                updated_at = datetime('now')
            WHERE id = ?
        `;

        const params = [
            1, // Simple level for now
            newExperience,
            newRankPoints,
            `${rankInfo.tier} ${rankInfo.level}`,
            newGamesPlayed,
            newGamesWon,
            newGamesLost,
            Math.round(winRate * 100) / 100,
            newStreak,
            userId
        ];

        return new Promise((resolve, reject) => {
            const db = this.userAuth.getDb();
            
            console.log(`🔧 DEBUG: About to update user ${userId} with:`, {
                newGamesPlayed,
                newGamesWon, 
                newGamesLost,
                newExperience,
                newRankPoints,
                winRate: Math.round(winRate * 100) / 100
            });
            
            db.run(updateQuery, params, function(err) {
                if (err) {
                    console.error(`❌ Database update error for user ${userId}:`, err);
                    db.close();
                    reject(err);
                } else {
                    console.log(`📊 Database update result for user ${userId}: ${this.changes} rows changed`);
                    if (this.changes === 0) {
                        console.warn(`⚠️ No rows were updated for user ${userId} - user may not exist!`);
                    }
                    db.close();
                    console.log(`✅ Updated stats for user ${userId}`);
                    resolve({
                        changes: this.changes,
                        newStats: {
                            level: 1,
                            experience: newExperience,
                            rankPoints: newRankPoints,
                            rank: `${rankInfo.tier} ${rankInfo.level}`,
                            gamesPlayed: newGamesPlayed,
                            gamesWon: newGamesWon,
                            gamesLost: newGamesLost,
                            winRate: Math.round(winRate * 100) / 100,
                            streak: newStreak
                        }
                    });
                }
            });
        });
    }

    /**
     * Log completed game to history (placeholder for future implementation)
     * @param {object} gameData - Game completion data
     */
    async logGameHistory(gameData) {
        // This could be implemented later to track game history
        // For now, just log it
        console.log(`🗃️ Game logged:`, {
            players: `${gameData.player1Id} vs ${gameData.player2Id}`,
            score: `${gameData.player1Score}-${gameData.player2Score}`,
            mode: gameData.gameMode,
            winner: gameData.winner
        });
    }

    /**
     * Get player's rank progression info
     * @param {number} userId - User ID
     * @returns {object} Detailed rank and level info
     */
    async getPlayerProgression(userId) {
        const stats = await this.getUserStats(userId);
        const rankInfo = this.progression.getRankInfo(stats.rank_points);
        const levelInfo = this.progression.calculateLevel(stats.experience_points);

        return {
            userId: stats.id,
            username: stats.username,
            level: levelInfo,
            rank: rankInfo,
            gameStats: {
                played: stats.games_played,
                won: stats.games_won,
                lost: stats.games_lost,
                winRate: stats.win_rate,
                streak: stats.current_streak
            }
        };
    }

    /**
     * Apply tournament rewards (RR and XP) without affecting W/L stats
     * Tournament matches don't count toward games_played/won/lost
     * @param {number} userId - User ID
     * @param {object} rewards - Reward object with rating_change and xp_gain
     * @param {boolean} won - Whether the player won this match
     */
    async applyTournamentRewards(userId, rewards, won) {
        try {
            console.log(`🏆 Applying tournament rewards to user ${userId}: RR${rewards.rating_change >= 0 ? '+' : ''}${rewards.rating_change}, XP+${rewards.xp_gain}`);
            
            // Get current stats
            const stats = await this.getUserStats(userId);
            
            // Calculate new values
            const newRating = Math.max(0, stats.ranked_rating + rewards.rating_change);
            const newXp = stats.xp + rewards.xp_gain;
            
            // Calculate new level
            const newLevelInfo = this.progression.calculateLevel(newXp);
            
            // Calculate new rank
            const newRankInfo = this.progression.calculateRank(newRating);
            
            // Update database - only RR, XP, and level, NOT game counts
            await this.userAuth.db.run(
                `UPDATE users 
                 SET ranked_rating = ?, 
                     xp = ?, 
                     level = ?
                 WHERE id = ?`,
                [newRating, newXp, newLevelInfo.level, userId]
            );
            
            console.log(`✅ Tournament rewards applied: User ${userId} now has ${newRating} RR, ${newXp} XP, Level ${newLevelInfo.level}`);
            
            return {
                success: true,
                newRating,
                newXp,
                newLevel: newLevelInfo.level,
                newRank: newRankInfo.tier
            };
            
        } catch (error) {
            console.error(`❌ Error applying tournament rewards for user ${userId}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get player stats (simplified version for tournament)
     * @param {number} userId - User ID
     * @returns {object} Player stats with ranked_rating, xp, and level
     */
    async getPlayerStats(userId) {
        return new Promise((resolve, reject) => {
            const db = this.userAuth.getDb();
            db.get(
                'SELECT ranked_rating, xp, level FROM users WHERE id = ?',
                [userId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (!row) {
                        reject(new Error(`User ${userId} not found`));
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }
}

module.exports = GameStatsHandler;