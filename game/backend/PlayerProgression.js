class PlayerProgression {
    constructor() {
        // Define rank tiers and their point requirements (Valorant-style: 20 points per rank)
        this.ranks = [
            // Bronze Tier (0-59 points)
            { tier: "Bronze", level: 1, minPoints: 0, maxPoints: 19 },
            { tier: "Bronze", level: 2, minPoints: 20, maxPoints: 39 },
            { tier: "Bronze", level: 3, minPoints: 40, maxPoints: 59 },
            
            // Silver Tier (60-119 points)
            { tier: "Silver", level: 1, minPoints: 60, maxPoints: 79 },
            { tier: "Silver", level: 2, minPoints: 80, maxPoints: 99 },
            { tier: "Silver", level: 3, minPoints: 100, maxPoints: 119 },
            
            // Gold Tier (120-179 points)
            { tier: "Gold", level: 1, minPoints: 120, maxPoints: 139 },
            { tier: "Gold", level: 2, minPoints: 140, maxPoints: 159 },
            { tier: "Gold", level: 3, minPoints: 160, maxPoints: 179 },
            
            // Platinum Tier (180-239 points)
            { tier: "Platinum", level: 1, minPoints: 180, maxPoints: 199 },
            { tier: "Platinum", level: 2, minPoints: 200, maxPoints: 219 },
            { tier: "Platinum", level: 3, minPoints: 220, maxPoints: 239 },
            
            // Diamond Tier (240-299 points)
            { tier: "Diamond", level: 1, minPoints: 240, maxPoints: 259 },
            { tier: "Diamond", level: 2, minPoints: 260, maxPoints: 279 },
            { tier: "Diamond", level: 3, minPoints: 280, maxPoints: 299 },
            
            // Immortal Tier (300-359 points)
            { tier: "Immortal", level: 1, minPoints: 300, maxPoints: 319 },
            { tier: "Immortal", level: 2, minPoints: 320, maxPoints: 339 },
            { tier: "Immortal", level: 3, minPoints: 340, maxPoints: 359 },
            
            // Radiant Tier (360+ points)
            { tier: "Radiant", level: 1, minPoints: 360, maxPoints: 999 }
        ];
    }

    /**
     * Calculate rewards for a game outcome
     */
    calculateGameRewards(won, isRanked = true, currentStreak = 0) {
        let baseExp = 10;
        let baseRankPoints = 0;

        if (won) {
            // Win rewards
            baseExp = 25;
            baseRankPoints = isRanked ? 3 : 0;
            
            // Win streak bonus
            if (currentStreak > 0) {
                const streakBonus = Math.min(currentStreak * 2, 10);
                baseExp += streakBonus;
                baseRankPoints += Math.min(Math.floor(currentStreak / 2), 2);
            }
        } else {
            // Loss penalties
            baseExp = 10;
            baseRankPoints = isRanked ? -2 : 0;
        }

        return {
            experience: Math.max(baseExp, 5), // Minimum 5 XP
            rankPoints: baseRankPoints
        };
    }

    /**
     * Update player's win streak
     */
    updateStreak(currentStreak, won) {
        if (won) {
            // Increment win streak
            return (currentStreak >= 0 ? currentStreak : 0) + 1;
        } else {
            // Reset win streak to 0 on loss
            return 0;
        }
    }

    /**
     * Get rank information based on rank points
     */
    getRankInfo(rankPoints) {
        // Clamp points between 0 and 999
        const points = Math.max(0, Math.min(999, rankPoints));
        
        for (const rank of this.ranks) {
            if (points >= rank.minPoints && points <= rank.maxPoints) {
                return {
                    tier: rank.tier,
                    level: rank.level,
                    points: points,
                    minPoints: rank.minPoints,
                    maxPoints: rank.maxPoints,
                    progressToNext: points - rank.minPoints,
                    pointsNeededForNext: rank.maxPoints - points
                };
            }
        }
        
        // Fallback to Bronze 1 if no match found
        return {
            tier: "Bronze",
            level: 1,
            points: points,
            minPoints: 0,
            maxPoints: 19,
            progressToNext: points,
            pointsNeededForNext: 19 - points
        };
    }

    /**
     * Get complete player progression status
     */
    getPlayerProgression(playerStats) {
        const {
            experience_points = 0,
            rank_points = 0,
            games_played = 0,
            games_won = 0,
            games_lost = 0,
            win_streak = 0,
            loss_streak = 0,
            current_streak = 0,
            player_level = 1
        } = playerStats;

        const rankInfo = this.getRankInfo(rank_points);
        
        // Calculate win rate
        const winRate = games_played > 0 ? (games_won / games_played * 100) : 0;
        
        return {
            rank: rankInfo,
            stats: {
                gamesPlayed: games_played,
                gamesWon: games_won,
                gamesLost: games_lost,
                winRate: Math.round(winRate * 100) / 100,
                winStreak: win_streak,
                lossStreak: loss_streak,
                currentStreak: current_streak
            }
        };
    }

    /**
     * Validate rank points are within valid range
     */
    clampRankPoints(rankPoints) {
        return Math.max(0, Math.min(999, rankPoints));
    }

    /**
     * Get rank tier color for UI display
     * @param {string} tier - Rank tier name
     * @returns {string} Hex color code
     */
    getRankColor(tier) {
        const colors = {
            'Bronze': '#CD7F32',
            'Silver': '#C0C0C0', 
            'Gold': '#FFD700',
            'Platinum': '#E5E4E2',
            'Diamond': '#B9F2FF',
            'Immortal': '#FF6B6B',
            'Radiant': '#FFFF00'
        };
        
        return colors[tier] || colors['Bronze'];
    }
}

module.exports = PlayerProgression;
