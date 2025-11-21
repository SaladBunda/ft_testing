import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface PlayerStats {
  id: number;
  username: string;
  player_level: number;
  experience_points: number;
  rank_points: number;
  rank_tier: string;
  games_played: number;
  games_won: number;
  games_lost: number;
  win_rate: number;
  current_streak: number;
  is_online: boolean;
}

interface RankInfo {
  tier: string;
  level: number;
  points: number;
  minPoints: number;
  maxPoints: number;
  progressToNext: number;
  pointsNeededForNext: number;
}

export default function PlayerStatsCard() {
  const { user, isLoggedIn } = useAuth();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [rankInfo, setRankInfo] = useState<RankInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !user?.id) {
      setLoading(false);
      return;
    }

    fetchPlayerStats();
  }, [isLoggedIn, user?.id]);

  const fetchPlayerStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch player stats from auth backend (which has the unified users table)
      const response = await fetch(`http://localhost:3001/api/auth/me`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch player stats');
      }

      const data = await response.json();
      setStats(data.user);

      // Calculate rank info based on rank points
      if (data.user?.rank_points !== undefined) {
        const rankInfo = calculateRankInfo(data.user.rank_points);
        setRankInfo(rankInfo);
      }
    } catch (err) {
      console.error('Error fetching player stats:', err);
      setError('Failed to load player statistics');
    } finally {
      setLoading(false);
    }
  };

  const calculateRankInfo = (rankPoints: number): RankInfo => {
    // Valorant-style ranking system (20 points per rank)
    const ranks = [
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

    const points = Math.max(0, Math.min(999, rankPoints));
    
    for (const rank of ranks) {
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
    
    // Fallback to Bronze 1
    return {
      tier: "Bronze",
      level: 1,
      points: points,
      minPoints: 0,
      maxPoints: 19,
      progressToNext: points,
      pointsNeededForNext: 19 - points
    };
  };

  const getRankColor = (tier: string): string => {
    const colors = {
      'Bronze': '#CD7F32',
      'Silver': '#C0C0C0',
      'Gold': '#FFD700',
      'Platinum': '#E5E4E2',
      'Diamond': '#B9F2FF',
      'Immortal': '#FF6B6B',
      'Radiant': '#FFFF00'
    };
    
    return colors[tier as keyof typeof colors] || colors['Bronze'];
  };

  if (loading) {
    return (
      <div style={{ 
        padding: '20px', 
        border: '1px solid #ddd', 
        borderRadius: '12px', 
        backgroundColor: '#f9f9f9',
        textAlign: 'center'
      }}>
        <p>Loading player statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        border: '1px solid #ff6b6b', 
        borderRadius: '12px', 
        backgroundColor: '#ffe6e6',
        color: '#d63031'
      }}>
        <p>{error}</p>
        <button 
          onClick={fetchPlayerStats}
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            background: '#d63031',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div style={{ 
      padding: '24px', 
      border: '2px solid #ddd', 
      borderRadius: '16px', 
      backgroundColor: '#ffffff',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      marginBottom: '24px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px',
        borderBottom: '1px solid #eee',
        paddingBottom: '16px'
      }}>
        <div>
          <h2 style={{ 
            margin: '0 0 8px 0', 
            fontSize: '24px', 
            fontWeight: 'bold',
            color: '#2d3436'
          }}>
            Player Statistics
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ 
              fontSize: '18px', 
              fontWeight: 'bold', 
              color: '#636e72' 
            }}>
              @{stats.username}
            </span>
            <span style={{
              display: 'inline-block',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: stats.is_online ? '#00b894' : '#636e72'
            }}></span>
            <span style={{ 
              fontSize: '14px', 
              color: stats.is_online ? '#00b894' : '#636e72',
              fontWeight: '500'
            }}>
              {stats.is_online ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Rank Display */}
        {rankInfo && (
          <div style={{ 
            textAlign: 'center',
            padding: '16px',
            backgroundColor: '#f8f9fa',
            borderRadius: '12px',
            border: `3px solid ${getRankColor(rankInfo.tier)}`,
            minWidth: '140px'
          }}>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: getRankColor(rankInfo.tier),
              textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
            }}>
              {rankInfo.tier}
            </div>
            <div style={{ 
              fontSize: '18px', 
              fontWeight: 'bold', 
              color: '#2d3436'
            }}>
              {rankInfo.level}
            </div>
            <div style={{ 
              fontSize: '12px', 
              color: '#636e72',
              marginTop: '4px'
            }}>
              {rankInfo.points} RP
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px' 
      }}>
        {/* Level & XP */}
        <div style={{ 
          padding: '16px', 
          backgroundColor: '#e3f2fd', 
          borderRadius: '8px',
          border: '1px solid #90caf9'
        }}>
          <div style={{ fontSize: '14px', color: '#1976d2', fontWeight: '600' }}>Level & Experience</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0d47a1' }}>Level {stats.player_level}</div>
          <div style={{ fontSize: '14px', color: '#1976d2' }}>{stats.experience_points} XP</div>
        </div>

        {/* Rank Progress */}
        {rankInfo && (
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#f3e5f5', 
            borderRadius: '8px',
            border: '1px solid #ce93d8'
          }}>
            <div style={{ fontSize: '14px', color: '#7b1fa2', fontWeight: '600' }}>Rank Progress</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4a148c' }}>
              {rankInfo.progressToNext}/{rankInfo.maxPoints - rankInfo.minPoints + 1} RP
            </div>
            <div style={{ 
              marginTop: '8px',
              height: '6px',
              backgroundColor: '#e1bee7',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                backgroundColor: getRankColor(rankInfo.tier),
                width: `${(rankInfo.progressToNext / (rankInfo.maxPoints - rankInfo.minPoints + 1)) * 100}%`,
                transition: 'width 0.3s ease'
              }}></div>
            </div>
            <div style={{ fontSize: '12px', color: '#7b1fa2', marginTop: '4px' }}>
              {rankInfo.pointsNeededForNext + 1} RP to next rank
            </div>
          </div>
        )}

        {/* Win/Loss Record */}
        <div style={{ 
          padding: '16px', 
          backgroundColor: '#e8f5e8', 
          borderRadius: '8px',
          border: '1px solid #a5d6a7'
        }}>
          <div style={{ fontSize: '14px', color: '#2e7d32', fontWeight: '600' }}>Match Record</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ color: '#1b5e20', fontWeight: 'bold' }}>{stats.games_won}W</span>
            <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>{stats.games_lost}L</span>
          </div>
          <div style={{ fontSize: '14px', color: '#2e7d32' }}>
            {stats.games_played} games played
          </div>
          <div style={{ fontSize: '14px', color: '#2e7d32' }}>
            {stats.win_rate.toFixed(1)}% win rate
          </div>
        </div>

        {/* Current Streak */}
        <div style={{ 
          padding: '16px', 
          backgroundColor: stats.current_streak > 0 ? '#fff3e0' : '#ffebee',
          borderRadius: '8px',
          border: `1px solid ${stats.current_streak > 0 ? '#ffcc02' : '#ef5350'}`
        }}>
          <div style={{ 
            fontSize: '14px', 
            color: stats.current_streak > 0 ? '#f57c00' : '#c62828',
            fontWeight: '600' 
          }}>
            Current Streak
          </div>
          <div style={{ 
            fontSize: '20px', 
            fontWeight: 'bold', 
            color: stats.current_streak > 0 ? '#e65100' : '#b71c1c'
          }}>
            {stats.current_streak === 0 ? '0' : `${Math.abs(stats.current_streak)} ${stats.current_streak > 0 ? 'Win' : 'Loss'}${Math.abs(stats.current_streak) !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ 
        marginTop: '20px', 
        paddingTop: '16px', 
        borderTop: '1px solid #eee',
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <button 
          onClick={fetchPlayerStats}
          style={{
            padding: '10px 20px',
            background: '#0984e3',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          Refresh Stats
        </button>
        <button 
          onClick={() => window.open('http://localhost:4322', '_blank')}
          style={{
            padding: '10px 20px',
            background: '#00b894',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          Play Game
        </button>
      </div>
    </div>
  );
}