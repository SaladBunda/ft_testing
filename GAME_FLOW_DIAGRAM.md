# Game System Architecture & Flow Diagram

## 🔐 Authentication Flow
```
User Login/Register
    ↓
Auth Backend (Fastify)
    ↓
JWT Token Generation
    ↓
Cookie Storage (httpOnly, 2h expiry)
    ↓
WebSocket Connection
    ↓
Token Verification
    ↓
User Authenticated ✅
```

**Key Functions:**
- `auth-backend/routes/login.js` - User login
- `auth-backend/routes/register.js` - User registration
- `auth-backend/plugins/jwt.js` - JWT token handling
- `game/backend/WebSocketHandler.js` - Token verification
- `game/backend/UserAuth.js` - Database user validation

**Database Tables:**
- `users` table in `shared.sqlite`
- Fields: id, username, email, password_hash, rank_points, experience_points, player_level, games_played, games_won, games_lost, current_streak

---

## 🎮 Game Mode Flows

### 1️⃣ SOLO/COOP MODE (Local Play)
```
Player Clicks "Coop Mode"
    ↓
Frontend: connectWebSocketWithMode('solo')
    ↓
Backend: GameManager.addPlayer()
    ↓
GameManager.createSoloGame()
    ↓
GameState.js - Initialize game
    ↓
Game Loop (16ms updates)
    ↓
Player Controls (W/S + Arrow Keys)
    ↓
Game Ends (5 points)
    ↓
NO STATS UPDATE (local only)
```

**Key Functions:**
- `GameManager.createSoloGame()` - Create local game
- `GameState.js` - Physics & ball movement
- Frontend keyboard controls - Both paddles controlled

**Database:** None (local play only)

---

### 2️⃣ AI MODE (vs Computer)
```
Player Selects AI Difficulty (Easy/Medium/Hard/Impossible)
    ↓
Frontend: connectWebSocketWithMode('ai')
    ↓
Backend: GameManager.addPlayer()
    ↓
GameManager.createAIGame(difficulty)
    ↓
AIPlayer.js - AI opponent logic
    ↓
Game Loop with AI updates
    ↓
Game Ends (5 points)
    ↓
GameStatsHandler.processGameCompletion()
    ↓
Database Update (RR, XP, Levels)
    ↓
WinScreenData.generateWinScreenData()
    ↓
Frontend: Display Win Screen
```

**Key Functions:**
- `GameManager.createAIGame()` - Setup AI opponent
- `AIPlayer.js` - AI paddle movement logic (difficulty based)
- `GameStatsHandler.processGameCompletion()` - Update player stats
- `PlayerProgression.calculateLevel()` - XP → Level conversion
- `PlayerProgression.calculateGameRewards()` - Win/loss rewards

**Database Operations:**
```sql
UPDATE users SET 
  rank_points = ?, 
  experience_points = ?, 
  player_level = ?,
  games_played = games_played + 1,
  games_won = games_won + ?,
  games_lost = games_lost + ?,
  current_streak = ?
WHERE id = ?
```

---

### 3️⃣ MATCHMAKING MODE (Online 1v1)
```
Player Clicks "Quick Match"
    ↓
Frontend: connectWebSocketWithMode('matchmaking')
    ↓
Backend: GameManager.addPlayer()
    ↓
Player added to waitingPlayers queue
    ↓
GameManager.matchPlayers() (auto-runs)
    ↓
If 2 players waiting → Create Match
    ↓
GameManager.createGame(player1, player2)
    ↓
Send "gameJoined" to both players
    ↓
Game Loop starts (16ms updates)
    ↓
WebSocket sends game state to both
    ↓
Players send paddle movements
    ↓
Game Ends (5 points)
    ↓
GameManager.processGameCompletion()
    ↓
GameStatsHandler.processGameCompletion()
    ↓
WinScreenData.generateWinScreenData()
    ↓
Send "gameResult" with winScreenData
    ↓
Frontend: Display Win/Loss Screen
```

**Key Functions:**
- `GameManager.addPlayer()` - Add to queue
- `GameManager.matchPlayers()` - Match 2 players
- `GameManager.createGame()` - Create game room
- `GameState.js` - Game physics
- `GameManager.updateAllGames()` - 16ms game loop
- `GameStatsHandler.processGameCompletion()` - Stats update
- `WinScreenData.generateWinScreenData()` - Win screen data
- `PlayerProgression.calculateGameRewards()` - RR/XP calculation

**Database Operations:**
```sql
-- Get stats before game
SELECT rank_points, experience_points, player_level, 
       games_played, games_won, games_lost, current_streak 
FROM users WHERE id = ?

-- Update stats after game
UPDATE users SET 
  rank_points = ?, 
  experience_points = ?, 
  player_level = ?,
  games_played = games_played + 1,
  games_won = games_won + ?,
  games_lost = games_lost + ?,
  current_streak = ?
WHERE id = ?

-- Log game
INSERT INTO game_history (...)
```

**Reward Calculation:**
- Win: +3 to +5 RR, +15 to +30 XP (based on streak)
- Loss: -2 to -4 RR, +5 to +10 XP

---

### 4️⃣ TOURNAMENT MODE (8-Player Bracket)
```
Player Clicks "Join Tournament"
    ↓
Frontend: connectWebSocketWithMode('tournament')
    ↓
Backend: TournamentManager.addPlayerToQueue()
    ↓
Send "tournamentQueued" (position, playerList)
    ↓
Frontend: Show Queue Screen
    ↓
When 8 players queued:
    ↓
TournamentManager.startTournament()
    ↓
Create bracket (4 quarter-final matches)
    ↓
Send "tournamentStarted" with bracket
    ↓
GameManager.createTournamentMatches()
    ↓
Create 4 game rooms (room_1, room_2, room_3, room_4)
    ↓
Send "tournamentMatchReady" to 8 players
    ↓
Frontend: Show Match Ready Screen (3 sec countdown)
    ↓
Frontend: Transition to Game Screen
    ↓
4 Games Running Simultaneously
    ↓
Game Ends (5 points)
    ↓
GameManager.processTournamentMatch()
    ↓
TournamentManager.recordMatchResult()
    ↓
Calculate tournament rewards (round-based)
    ↓
GameStatsHandler.processGameCompletion()
    ↓
WinScreenData.generateWinScreenData()
    ↓
Send "tournamentMatchResult" to both players
    ↓
Frontend: Show Tournament Win/Loss Screen
    ↓
Winners: Auto-advance to "tournamentWaiting" (10 sec)
    ↓
Losers: Eliminated
    ↓
When all 4 matches complete:
    ↓
TournamentManager.advanceTournament()
    ↓
Create Semi-Final matches (2 games)
    ↓
[Repeat process]
    ↓
Finals (1 game)
    ↓
Champion Crowned! 👑
```

**Key Functions:**
- `TournamentManager.addPlayerToQueue()` - Queue player
- `TournamentManager.startTournament()` - Start when 8 ready
- `TournamentManager.createBracket()` - Create bracket structure
- `GameManager.createTournamentMatches()` - Create all matches for round
- `GameManager.processTournamentMatch()` - Process match end
- `TournamentManager.recordMatchResult()` - Record winner
- `TournamentManager.calculateRewards()` - Round-based rewards
- `TournamentManager.advanceTournament()` - Advance to next round
- `GameStatsHandler.processGameCompletion()` - Update stats
- `WinScreenData.generateWinScreenData()` - Win screen data

**Tournament Rewards:**
- **Quarter Finals**: Winner +2 RR/+15 XP, Loser -5 RR/+5 XP
- **Semi Finals**: Winner +5 RR/+40 XP, Loser +0 RR/+25 XP
- **Finals**: Winner +10 RR/+100 XP, Loser +3 RR/+60 XP

**Database Operations:**
Same as matchmaking mode, but with tournament-specific rewards

**Tournament Structure:**
```
Quarter Finals (4 matches)
├─ Match 1: Player 1 vs Player 2
├─ Match 2: Player 3 vs Player 4
├─ Match 3: Player 5 vs Player 6
└─ Match 4: Player 7 vs Player 8
    ↓
Semi Finals (2 matches)
├─ Match 5: Winner 1 vs Winner 2
└─ Match 6: Winner 3 vs Winner 4
    ↓
Finals (1 match)
└─ Match 7: Winner 5 vs Winner 6
    ↓
Champion! 🏆
```

---

## 📊 Core System Components

### GameManager.js (Central Hub)
**Responsibilities:**
- Player connection management
- Matchmaking queue
- Game room creation
- Game loop orchestration
- Stats processing coordination

**Key Data Structures:**
```javascript
players: Map<connectionId, playerData>
waitingPlayers: Array<playerData>
games: Map<roomId, gameRoom>
tournamentManager: TournamentManager instance
statsHandler: GameStatsHandler instance
winScreenData: WinScreenData instance
```

### TournamentManager.js
**Responsibilities:**
- Tournament queue management
- Bracket creation
- Match result recording
- Round advancement
- Champion determination

**Key Data Structures:**
```javascript
playerQueue: Array<playerData>
tournaments: Map<tournamentId, tournament>
tournament: {
  id, status, players, bracket,
  results: { quarterFinals[], semiFinals[], finals[] }
}
```

### GameState.js (Physics Engine)
**Responsibilities:**
- Ball physics
- Paddle movement
- Collision detection
- Score tracking
- Countdown timer

**Update Loop:** 16ms (62.5 FPS)

### GameStatsHandler.js (Stats Manager)
**Responsibilities:**
- Fetch player stats from DB
- Calculate game rewards
- Update player stats in DB
- Level progression calculation
- Streak management

**Key Methods:**
- `processGameCompletion()` - Main stats update
- `getUserStats()` - Fetch player data
- `applyTournamentRewards()` - Tournament-specific

### PlayerProgression.js (Progression System)
**Responsibilities:**
- Level calculation (XP → Level)
- Rank calculation (RP → Rank tier)
- Reward calculation (Win/Loss)
- Streak bonuses

**Level System:**
- Level 1→2: 150 XP
- Level 2→3: 200 XP (150 × 1.35)
- Level 3→4: 270 XP
- Scales by 1.35× each level

**Rank Tiers:**
- Bronze: 0-99 RP
- Silver: 100-299 RP
- Gold: 300-599 RP
- Platinum: 600-899 RP
- Radiant: 900-999 RP

### WinScreenData.js (Win Screen Generator)
**Responsibilities:**
- Generate before/after stats comparison
- Calculate stat changes
- Format data for frontend display

**Output Structure:**
```javascript
{
  player1: {
    userId, username, result,
    rewards: { experience, rankPoints },
    progression: {
      before: { level, experience, rankPoints, ... },
      after: { level, experience, rankPoints, ... },
      changes: { experienceGained, rankPointsChanged, ... }
    }
  },
  player2: { ... },
  matchData: { duration, winnerName, scores, ... }
}
```

---

## 🗄️ Database Schema

### users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  rank_points INTEGER DEFAULT 0,
  experience_points INTEGER DEFAULT 0,
  player_level INTEGER DEFAULT 1,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  games_lost INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  win_rate REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### game_history Table
```sql
CREATE TABLE game_history (
  id INTEGER PRIMARY KEY,
  player1_id INTEGER,
  player2_id INTEGER,
  winner_id INTEGER,
  player1_score INTEGER,
  player2_score INTEGER,
  game_mode TEXT,
  game_duration INTEGER,
  played_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

---

## 🔄 WebSocket Message Types

### Client → Server
- `join` - Join game mode
- `update` - Paddle movement
- `cancel` - Leave queue
- `tournamentMatchReady` - Acknowledge match ready

### Server → Client
- `authenticated` - Auth success
- `waiting` / `waitingForOpponent` - In queue
- `gameJoined` - Match found
- `tournamentQueued` - In tournament queue
- `tournamentStarted` - Tournament begins
- `tournamentMatchReady` - Match ready (3 sec countdown)
- `tournamentMatchResult` - Match ended with stats
- `tournamentChampion` - Won tournament
- `gameResult` - Matchmaking win screen
- `gameAborted` - Game cancelled
- `matchCancelled` - Queue exit confirmed

---

## 📈 Stats Update Flow
```
Game Ends
    ↓
Get Before Stats
    ↓
Calculate Rewards
    ├─ Win/Loss determination
    ├─ Streak calculation
    ├─ RR/XP rewards
    └─ Level progression
    ↓
Update Database
    ├─ rank_points
    ├─ experience_points
    ├─ player_level
    ├─ games_played
    ├─ games_won/lost
    └─ current_streak
    ↓
Get After Stats
    ↓
Generate Win Screen Data
    ├─ Before/After comparison
    ├─ Stat changes
    └─ Rank changes
    ↓
Send to Frontend
```

---

## 🎯 Key Architectural Decisions

1. **WebSocket Communication**: Real-time game state updates
2. **16ms Game Loop**: Smooth 60 FPS gameplay
3. **Centralized GameManager**: Single source of truth for game state
4. **Separate Tournament Manager**: Isolated bracket logic
5. **Reusable Stats Handler**: Shared between all modes
6. **Progressive Rewards**: Level/Rank scaling for engagement
7. **httpOnly Cookies**: Secure authentication
8. **SQLite Database**: Simple, file-based persistence

---

## 🐛 Common Flows & Edge Cases

### Player Disconnection Mid-Game
```
Player Disconnects
    ↓
Check game progress (totalScore > 0?)
    ↓
If early (no progress):
    └─ Abort game, no stats
    ↓
If mid-game:
    └─ Award win to remaining player
    └─ Update stats as win/loss
```

### Tournament Queue Cancellation
```
Player Clicks "Leave Queue"
    ↓
Send 'cancel' message
    ↓
GameManager.removePlayer()
    ↓
TournamentManager.removePlayerFromQueue()
    ↓
Player removed from queue
```

### Timeout Race Condition (Fixed)
```
Tournament Match Ends
    ↓
Show Win Screen
    ↓
Set timeout (10 sec) → tournamentWaiting
    ↓
Next match ready arrives (3 sec later)
    ↓
Clear previous timeout ✅
    ↓
Show match ready screen
    ↓
Start game
```

---

This diagram covers all major flows, functions, and database operations across all game modes!
