// UserAuth.js - User authentication for game WebSocket connections using existing auth-backend
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');

class UserAuth {
    constructor() {
        this.dbPath = process.env.DATABASE_PATH || '/usr/src/app/db/shared.sqlite';
        this.authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-backend:8005';
        this.jwtSecret = process.env.JWT_SECRET || 'UJq44uXahz4yd8v9UpLz+rH0EA3ZJ8dhRi/0isY1qhc=';
    }

    /**
     * Get database connection
     */
    getDb() {
        const db = new sqlite3.Database(this.dbPath);
        db.run('PRAGMA foreign_keys = ON');
        return db;
    }

    /**
     * Verify JWT token using the existing auth service approach
     */
    async verifyToken(token) {
        try {
            // Use the same JWT verification as auth-backend
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, this.jwtSecret);
            return { success: true, user: decoded };
        } catch (error) {
            console.error('JWT verification failed:', error.message);
            return { success: false, error: 'Invalid token' };
        }
    }

    /**
     * Get user by ID from shared database (same as auth-backend uses)
     */
    getUserById(userId) {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            db.get(`
                SELECT id, email, username, name, first_name, last_name, 
                       profile_pic, is_online, player_level, experience_points,
                       rank_points, rank_tier, games_played, games_won, games_lost,
                       win_rate, current_streak, profile_completed
                FROM users 
                WHERE id = ?
            `, [userId], (err, row) => {
                db.close();
                if (err) {
                    console.error('Database error getting user:', err);
                    reject(err);
                } else {
                    resolve(row || null);
                }
            });
        });
    }

    /**
     * Authenticate WebSocket connection using access token from cookies or URL
     * Supports both cookie-based (like auth-backend) and token param (for WebSocket)
     */
    async authenticateConnection(request) {
        try {
            let token = null;
            
            // Method 1: Try to get token from URL parameters (for WebSocket)
            if (request.url) {
                const urlObj = new URL(request.url, 'http://localhost');
                token = urlObj.searchParams.get('token');
            }
            
            // Method 2: Try to get token from Authorization header
            if (!token && request.headers && request.headers.authorization) {
                const authHeader = request.headers.authorization;
                if (authHeader.startsWith('Bearer ')) {
                    token = authHeader.substring(7);
                }
            }

            // Method 3: Try to get token from cookies (same as auth-backend)
            if (!token && request.headers && request.headers.cookie) {
                const cookies = this.parseCookies(request.headers.cookie);
                token = cookies.accessToken;
            }
            
            if (!token) {
                return { 
                    success: false, 
                    error: 'No authentication token provided',
                    code: 'NO_TOKEN'
                };
            }

            // Verify JWT token
            const tokenResult = await this.verifyToken(token);
            if (!tokenResult.success) {
                return { 
                    success: false, 
                    error: 'Invalid authentication token',
                    code: 'INVALID_TOKEN'
                };
            }

            // Get user from database
            const userId = tokenResult.user.sub; // JWT uses 'sub' for user ID
            const user = await this.getUserById(userId);
            if (!user) {
                return { 
                    success: false, 
                    error: 'User not found',
                    code: 'USER_NOT_FOUND'
                };
            }

            return { 
                success: true, 
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username || `User${user.id}`,
                    name: user.name || user.first_name || 'Unknown',
                    profilePic: user.profile_pic,
                    profileCompleted: user.profile_completed,
                    gameStats: {
                        level: user.player_level,
                        xp: user.experience_points,
                        rankPoints: user.rank_points,
                        rankTier: user.rank_tier,
                        gamesPlayed: user.games_played,
                        gamesWon: user.games_won,
                        gamesLost: user.games_lost,
                        winRate: user.win_rate,
                        currentStreak: user.current_streak
                    }
                }
            };

        } catch (error) {
            console.error('Authentication error:', error);
            return { 
                success: false, 
                error: 'Authentication failed',
                code: 'AUTH_ERROR'
            };
        }
    }

    /**
     * Parse cookies from cookie header
     */
    parseCookies(cookieHeader) {
        const cookies = {};
        if (cookieHeader) {
            cookieHeader.split(';').forEach(cookie => {
                const [name, value] = cookie.trim().split('=');
                cookies[name] = value;
            });
        }
        return cookies;
    }

    /**
     * Update user's online status (same table as auth-backend)
     */
    setUserOnlineStatus(userId, isOnline) {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            db.run('UPDATE users SET is_online = ? WHERE id = ?', [isOnline ? 1 : 0, userId], function(err) {
                db.close();
                if (err) {
                    console.error('Error updating online status:', err);
                    reject(err);
                } else {
                    resolve(true);
                }
            });
        });
    }

    /**
     * Update user's game statistics after a game (using shared database)
     */
    updateGameStats(userId, gameResult) {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            
            // Get current stats
            db.get(`
                SELECT games_played, games_won, games_lost, current_streak, 
                       experience_points, player_level, rank_points
                FROM users WHERE id = ?
            `, [userId], (err, currentStats) => {
                if (err) {
                    db.close();
                    return reject(err);
                }

                if (!currentStats) {
                    db.close();
                    return reject(new Error('User not found'));
                }

                // Calculate new stats
                const newGamesPlayed = currentStats.games_played + 1;
                let newGamesWon = currentStats.games_won;
                let newGamesLost = currentStats.games_lost;
                let newStreak = currentStats.current_streak;
                let newXP = currentStats.experience_points;
                let newLevel = currentStats.player_level;
                let newRankPoints = currentStats.rank_points;

                if (gameResult.won) {
                    newGamesWon++;
                    newStreak++;
                    // XP rewards based on performance
                    const baseXP = 50;
                    const streakBonus = Math.min(newStreak * 5, 50); // Max 50 bonus XP
                    const performanceBonus = gameResult.score ? Math.floor(gameResult.score / 10) : 0;
                    newXP += baseXP + streakBonus + performanceBonus;
                    
                    // Rank points
                    const baseRankPoints = 25;
                    const difficultyBonus = gameResult.difficulty === 'hard' ? 10 : 0;
                    newRankPoints += baseRankPoints + difficultyBonus;
                } else {
                    newGamesLost++;
                    newStreak = 0; // Reset streak on loss
                    newXP += gameResult.xpGained || 10; // Small XP for playing
                    newRankPoints = Math.max(0, newRankPoints - (gameResult.rankPointsLost || 15));
                }

                // Calculate new level (every 100 XP = 1 level)
                newLevel = Math.floor(newXP / 100) + 1;

                // Calculate win rate
                const newWinRate = newGamesWon / newGamesPlayed;

                // Determine rank tier based on rank points
                let rankTier = 'Bronze';
                if (newRankPoints >= 2500) rankTier = 'Diamond';
                else if (newRankPoints >= 2000) rankTier = 'Platinum';
                else if (newRankPoints >= 1500) rankTier = 'Gold';
                else if (newRankPoints >= 1000) rankTier = 'Silver';

                // Update database
                db.run(`
                    UPDATE users SET 
                        games_played = ?, games_won = ?, games_lost = ?,
                        win_rate = ?, current_streak = ?, experience_points = ?,
                        player_level = ?, rank_points = ?, rank_tier = ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                `, [newGamesPlayed, newGamesWon, newGamesLost,
                    newWinRate, newStreak, newXP,
                    newLevel, newRankPoints, rankTier, userId], function(updateErr) {
                    
                    db.close();
                    
                    if (updateErr) {
                        reject(updateErr);
                    } else {
                        resolve({
                            success: true,
                            newStats: {
                                gamesPlayed: newGamesPlayed,
                                gamesWon: newGamesWon,
                                gamesLost: newGamesLost,
                                winRate: newWinRate,
                                currentStreak: newStreak,
                                level: newLevel,
                                xp: newXP,
                                rankPoints: newRankPoints,
                                rankTier: rankTier
                            }
                        });
                    }
                });
            });
        });
    }

    /**
     * Get leaderboard data
     */
    getLeaderboard(limit = 10) {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            db.all(`
                SELECT id, username, name, rank_points, rank_tier, 
                       games_won, games_played, win_rate, current_streak,
                       player_level
                FROM users 
                WHERE games_played > 0
                ORDER BY rank_points DESC, win_rate DESC
                LIMIT ?
            `, [limit], (err, rows) => {
                db.close();
                if (err) {
                    console.error('Error getting leaderboard:', err);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }
}

module.exports = UserAuth;