# Game System Flow - Mermaid Diagrams

Copy and paste these diagrams into https://mermaid.live to visualize them!

---

## 🎮 Complete Game System Overview

```mermaid
graph TB
    subgraph "Authentication Layer"
        A[User Login/Register] --> B[Auth Backend]
        B --> C[JWT Token Generation]
        C --> D[Cookie Storage 2h]
        D --> E[WebSocket Connection]
        E --> F{Token Valid?}
        F -->|Yes| G[Authenticated]
        F -->|No| H[Rejected]
    end

    subgraph "Game Modes"
        G --> I[Solo/Coop Mode]
        G --> J[AI Mode]
        G --> K[Matchmaking Mode]
        G --> L[Tournament Mode]
    end

    subgraph "Database Layer"
        M[(SQLite - shared.sqlite)]
        N[users table]
        O[game_history table]
        M --> N
        M --> O
    end

    subgraph "Core Systems"
        P[GameManager]
        Q[TournamentManager]
        R[GameState Physics]
        S[GameStatsHandler]
        T[PlayerProgression]
        U[WinScreenData]
    end

    I --> P
    J --> P
    K --> P
    L --> Q
    Q --> P
    P --> R
    P --> S
    S --> T
    S --> U
    S --> M
```

---

## 🔐 Authentication Flow (Detailed)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant AuthBackend
    participant Database
    participant GameBackend
    participant WebSocket

    User->>Frontend: Enter credentials
    Frontend->>AuthBackend: POST /login
    AuthBackend->>Database: Verify user
    Database-->>AuthBackend: User data
    AuthBackend->>AuthBackend: Generate JWT
    AuthBackend-->>Frontend: Set httpOnly cookie (2h)
    Frontend->>WebSocket: Connect with cookie
    WebSocket->>GameBackend: Verify JWT
    GameBackend-->>WebSocket: Authenticated
    WebSocket-->>Frontend: Connection established
```

---

## 🎯 Matchmaking Mode Flow

```mermaid
flowchart TD
    Start([Player Clicks Quick Match]) --> Connect[WebSocket: join matchmaking]
    Connect --> AddPlayer[GameManager.addPlayer]
    AddPlayer --> Queue[Add to waitingPlayers queue]
    Queue --> Check{2 Players Waiting?}
    Check -->|No| Wait[Send 'waiting' message]
    Wait --> Queue
    Check -->|Yes| Match[GameManager.matchPlayers]
    Match --> Create[GameManager.createGame]
    Create --> Room[Create game room]
    Room --> Notify[Send 'gameJoined' to both]
    Notify --> Loop[Start Game Loop 16ms]
    Loop --> Play[Players control paddles]
    Play --> Update[Send game state updates]
    Update --> Score{Score = 5?}
    Score -->|No| Loop
    Score -->|Yes| End[Game Ends]
    End --> Stats[GameStatsHandler.processGameCompletion]
    Stats --> DB[(Update Database)]
    DB --> Before[Get before stats]
    Before --> Calc[Calculate rewards]
    Calc --> After[Get after stats]
    After --> Win[WinScreenData.generate]
    Win --> Send[Send 'gameResult' with stats]
    Send --> Display[Frontend: Display Win Screen]
```

---

## 🏆 Tournament Mode Flow (Complete)

```mermaid
flowchart TD
    Start([Player Clicks Join Tournament]) --> Connect[WebSocket: join tournament]
    Connect --> AddQ[TournamentManager.addPlayerToQueue]
    AddQ --> Queue[playerQueue.push]
    Queue --> Notify1[Send 'tournamentQueued']
    Notify1 --> Check{8 Players?}
    Check -->|No| Wait[Show Queue Screen]
    Wait --> Queue
    Check -->|Yes| StartT[TournamentManager.startTournament]
    
    StartT --> Bracket[Create bracket structure]
    Bracket --> Quarter[Quarter Finals: 4 matches]
    Quarter --> CreateQ[GameManager.createTournamentMatches]
    CreateQ --> Rooms[Create 4 game rooms]
    Rooms --> Ready1[Send 'tournamentMatchReady']
    Ready1 --> Countdown1[Frontend: 3 sec countdown]
    Countdown1 --> Game1[4 Games Running]
    Game1 --> End1{Game Ends}
    End1 --> Process1[processTournamentMatch]
    Process1 --> Record1[recordMatchResult]
    Record1 --> Reward1[calculateRewards: +2RR/+15XP]
    Reward1 --> StatsQ[processGameCompletion]
    StatsQ --> DBQ[(Update Database)]
    DBQ --> WinQ[generateWinScreenData]
    WinQ --> Result1[Send 'tournamentMatchResult']
    Result1 --> Screen1{Winner or Loser?}
    Screen1 -->|Winner| WaitQ[tournamentWaiting 10sec]
    Screen1 -->|Loser| Elim1[Eliminated]
    
    WaitQ --> AllDone1{All 4 Matches Done?}
    AllDone1 -->|No| WaitQ
    AllDone1 -->|Yes| Advance1[advanceTournament]
    
    Advance1 --> Semi[Semi Finals: 2 matches]
    Semi --> CreateS[Create 2 game rooms]
    CreateS --> Ready2[Send 'tournamentMatchReady']
    Ready2 --> Countdown2[Frontend: 3 sec countdown]
    Countdown2 --> Game2[2 Games Running]
    Game2 --> End2{Game Ends}
    End2 --> Process2[processTournamentMatch]
    Process2 --> Record2[recordMatchResult]
    Record2 --> Reward2[calculateRewards: +5RR/+40XP]
    Reward2 --> StatsS[processGameCompletion]
    StatsS --> DBS[(Update Database)]
    DBS --> WinS[generateWinScreenData]
    WinS --> Result2[Send 'tournamentMatchResult']
    Result2 --> Screen2{Winner or Loser?}
    Screen2 -->|Winner| WaitS[tournamentWaiting 10sec]
    Screen2 -->|Loser| Elim2[Eliminated]
    
    WaitS --> AllDone2{Both Matches Done?}
    AllDone2 -->|No| WaitS
    AllDone2 -->|Yes| Advance2[advanceTournament]
    
    Advance2 --> Finals[Finals: 1 match]
    Finals --> CreateF[Create 1 game room]
    CreateF --> Ready3[Send 'tournamentMatchReady']
    Ready3 --> Countdown3[Frontend: 3 sec countdown]
    Countdown3 --> Game3[Championship Game]
    Game3 --> End3{Game Ends}
    End3 --> Process3[processTournamentMatch]
    Process3 --> Record3[recordMatchResult]
    Record3 --> Reward3[calculateRewards: +10RR/+100XP]
    Reward3 --> StatsF[processGameCompletion]
    StatsF --> DBF[(Update Database)]
    DBF --> WinF[generateWinScreenData]
    WinF --> Champion[Send 'tournamentChampion']
    Champion --> Trophy([🏆 Champion Crowned!])
```

---

## 🤖 AI Mode Flow

```mermaid
flowchart TD
    Start([Player Selects AI Difficulty]) --> Diff{Choose Difficulty}
    Diff --> Easy[Easy]
    Diff --> Medium[Medium]
    Diff --> Hard[Hard]
    Diff --> Impossible[Impossible]
    
    Easy --> Connect[WebSocket: join ai]
    Medium --> Connect
    Hard --> Connect
    Impossible --> Connect
    
    Connect --> Create[GameManager.createAIGame]
    Create --> AI[Initialize AIPlayer]
    AI --> Loop[Game Loop 16ms]
    Loop --> PlayerMove[Player controls paddle]
    Loop --> AIMove[AI calculates move]
    AIMove --> Update[Update game state]
    Update --> Score{Score = 5?}
    Score -->|No| Loop
    Score -->|Yes| End[Game Ends]
    End --> Stats[processGameCompletion]
    Stats --> DB[(Update Database)]
    DB --> Win[generateWinScreenData]
    Win --> Display[Display Win Screen]
```

---

## 📊 Stats Update Flow (Detailed)

```mermaid
flowchart TD
    Start([Game Ends]) --> Fetch[getUserStats for both players]
    Fetch --> Before[Store before stats]
    Before --> Determine{Winner?}
    Determine -->|Player 1| W1[Player 1 wins]
    Determine -->|Player 2| W2[Player 2 wins]
    
    W1 --> Streak1[Update winner streak +1]
    W1 --> StreakL1[Reset loser streak to 0]
    W2 --> Streak2[Update winner streak +1]
    W2 --> StreakL2[Reset loser streak to 0]
    
    Streak1 --> Calc1[calculateGameRewards]
    StreakL1 --> Calc1
    Streak2 --> Calc2[calculateGameRewards]
    StreakL2 --> Calc2
    
    Calc1 --> RR1[Winner: +3 to +5 RR]
    Calc1 --> XP1[Winner: +15 to +30 XP]
    Calc1 --> RR2[Loser: -2 to -4 RR]
    Calc1 --> XP2[Loser: +5 to +10 XP]
    
    Calc2 --> RR1
    Calc2 --> XP1
    Calc2 --> RR2
    Calc2 --> XP2
    
    RR1 --> Apply[Apply rewards]
    XP1 --> Apply
    RR2 --> Apply
    XP2 --> Apply
    
    Apply --> Level[calculateLevel]
    Level --> Check{Level Up?}
    Check -->|Yes| LevelUp[Increment player_level]
    Check -->|No| NoLevel[Keep level]
    
    LevelUp --> UpdateDB[Update Database]
    NoLevel --> UpdateDB
    
    UpdateDB --> SQL[(UPDATE users SET<br/>rank_points, experience_points,<br/>player_level, games_played,<br/>games_won, games_lost,<br/>current_streak)]
    SQL --> After[Fetch after stats]
    After --> Generate[generateWinScreenData]
    Generate --> Compare[Calculate before/after changes]
    Compare --> Result[Return winScreenData]
```

---

## 🗄️ Database Operations

```mermaid
erDiagram
    users ||--o{ game_history : plays
    
    users {
        int id PK
        string username
        string email
        string password_hash
        int rank_points
        int experience_points
        int player_level
        int games_played
        int games_won
        int games_lost
        int current_streak
        real win_rate
        datetime created_at
    }
    
    game_history {
        int id PK
        int player1_id FK
        int player2_id FK
        int winner_id FK
        int player1_score
        int player2_score
        string game_mode
        int game_duration
        datetime played_at
    }
```

---

## 🔄 WebSocket Message Flow

```mermaid
sequenceDiagram
    participant Frontend
    participant WebSocket
    participant GameManager
    participant GameState
    participant Database

    Frontend->>WebSocket: join (mode: matchmaking)
    WebSocket->>GameManager: addPlayer()
    GameManager->>GameManager: Add to waitingPlayers
    GameManager-->>Frontend: waiting
    
    Note over GameManager: When 2nd player joins
    GameManager->>GameManager: matchPlayers()
    GameManager->>GameManager: createGame()
    GameManager->>GameState: new GameState()
    GameManager-->>Frontend: gameJoined
    
    loop Every 16ms
        GameState->>GameState: update()
        GameState-->>Frontend: gameState
    end
    
    Frontend->>WebSocket: update (paddle position)
    WebSocket->>GameState: updatePaddle()
    
    Note over GameState: Score reaches 5
    GameState->>GameManager: Game complete
    GameManager->>Database: processGameCompletion()
    Database-->>GameManager: Updated stats
    GameManager->>GameManager: generateWinScreenData()
    GameManager-->>Frontend: gameResult
```

---

## 🎯 Core Component Relationships

```mermaid
graph TB
    subgraph "GameManager.js"
        GM[GameManager]
        WP[waitingPlayers: Array]
        PL[players: Map]
        GMS[games: Map]
    end
    
    subgraph "TournamentManager.js"
        TM[TournamentManager]
        PQ[playerQueue: Array]
        TR[tournaments: Map]
        BR[bracket: Object]
    end
    
    subgraph "GameState.js"
        GS[GameState]
        BALL[ball: Object]
        P1[player1: Paddle]
        P2[player2: Paddle]
        SC[score: Object]
    end
    
    subgraph "GameStatsHandler.js"
        SH[GameStatsHandler]
        UC[getUserStats]
        PC[processGameCompletion]
    end
    
    subgraph "PlayerProgression.js"
        PP[PlayerProgression]
        CL[calculateLevel]
        CR[calculateGameRewards]
        RT[calculateRankTier]
    end
    
    subgraph "WinScreenData.js"
        WS[WinScreenData]
        GEN[generateWinScreenData]
    end
    
    subgraph "Database"
        DB[(shared.sqlite)]
        USR[users table]
        GH[game_history table]
    end
    
    GM --> TM
    GM --> GS
    GM --> SH
    TM --> GM
    SH --> PP
    SH --> WS
    SH --> DB
    PP --> DB
    WS --> DB
    DB --> USR
    DB --> GH
```

---

## 🏁 Game Loop Architecture

```mermaid
flowchart LR
    subgraph "Server Side - 16ms Intervals"
        Timer[setInterval 16ms] --> Update[GameState.update]
        Update --> Ball[Update ball position]
        Ball --> Collision[Check collisions]
        Collision --> Paddle1[Update paddle 1]
        Collision --> Paddle2[Update paddle 2]
        Paddle1 --> Score[Check score]
        Paddle2 --> Score
        Score --> Broadcast[Broadcast to clients]
        Broadcast --> Timer
    end
    
    subgraph "Client Side"
        Receive[Receive gameState] --> Render[Render canvas]
        Render --> Input[Capture keyboard]
        Input --> Send[Send paddle update]
        Send --> Receive
    end
    
    Broadcast --> Receive
    Send -.WebSocket.-> Paddle1
    Send -.WebSocket.-> Paddle2
```

---

## 🎮 Game Mode Decision Tree

```mermaid
graph TD
    Start([Player on Main Menu]) --> Choose{Choose Mode}
    
    Choose -->|Solo/Coop| Solo[Local Play]
    Choose -->|AI| AISelect{Select Difficulty}
    Choose -->|Quick Match| MM[Join Matchmaking Queue]
    Choose -->|Tournament| Tour[Join Tournament Queue]
    
    Solo --> LocalGame[createSoloGame]
    LocalGame --> NoStats[No stats update]
    
    AISelect -->|Easy| AI1[AIPlayer difficulty=1]
    AISelect -->|Medium| AI2[AIPlayer difficulty=2]
    AISelect -->|Hard| AI3[AIPlayer difficulty=3]
    AISelect -->|Impossible| AI4[AIPlayer difficulty=4]
    AI1 --> StatsAI[Update stats vs AI]
    AI2 --> StatsAI
    AI3 --> StatsAI
    AI4 --> StatsAI
    
    MM --> Queue1[waitingPlayers queue]
    Queue1 --> Match[matchPlayers when 2 ready]
    Match --> StatsMM[Update matchmaking stats]
    
    Tour --> Queue2[TournamentManager.playerQueue]
    Queue2 --> StartT[startTournament when 8 ready]
    StartT --> Bracket[Create 8-player bracket]
    Bracket --> StatsTour[Update tournament stats]
```

---

## 📈 Level & Rank Progression

```mermaid
flowchart TD
    Start([Player earns XP]) --> Total[Add to experience_points]
    Total --> Check[calculateLevel]
    Check --> L1{XP >= 150?}
    L1 -->|No| Level1[Level 1]
    L1 -->|Yes| L2{XP >= 352?}
    L2 -->|No| Level2[Level 2]
    L2 -->|Yes| L3{XP >= 625?}
    L3 -->|No| Level3[Level 3]
    L3 -->|Yes| L4{XP >= 898?}
    L4 -->|No| Level4[Level 4]
    L4 -->|Yes| Higher[Level 5+]
    
    Level1 --> UpdateLevel[Update player_level]
    Level2 --> UpdateLevel
    Level3 --> UpdateLevel
    Level4 --> UpdateLevel
    Higher --> UpdateLevel
    
    UpdateLevel --> Rank[Check rank_points]
    Rank --> R1{RP < 100?}
    R1 -->|Yes| Bronze[Bronze]
    R1 -->|No| R2{RP < 300?}
    R2 -->|Yes| Silver[Silver]
    R2 -->|No| R3{RP < 600?}
    R3 -->|Yes| Gold[Gold]
    R3 -->|No| R4{RP < 900?}
    R4 -->|Yes| Platinum[Platinum]
    R4 -->|No| Radiant[Radiant]
```

---

## 🐛 Error & Edge Case Handling

```mermaid
flowchart TD
    Event{Event Type} --> DC[Player Disconnect]
    Event --> Cancel[Queue Cancel]
    Event --> Timeout[Timeout Issue]
    
    DC --> InGame{In Active Game?}
    InGame -->|Yes| Progress{Game Progress?}
    InGame -->|No| Remove1[Remove from queue]
    
    Progress -->|No score| Abort[Abort game - no stats]
    Progress -->|Has score| Award[Award win to opponent]
    Award --> UpdateStats[Update stats]
    
    Cancel --> Mode{Which Queue?}
    Mode -->|Matchmaking| RemoveWait[Remove from waitingPlayers]
    Mode -->|Tournament| RemoveTour[TournamentManager.removePlayerFromQueue]
    RemoveWait --> Confirm1[Send matchCancelled]
    RemoveTour --> Confirm2[Send matchCancelled]
    
    Timeout --> Screen{Screen State Issue?}
    Screen -->|Old timeout firing| Clear[Clear previous timeout]
    Clear --> New[Set new timeout]
    Screen -->|Race condition| Priority[Prioritize newest event]
```

---

Copy any of these diagrams into https://mermaid.live to visualize them interactively!
