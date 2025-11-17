# Agent 5: Data Modeling Specialist

## Role
Design efficient, scalable data structures and local storage architecture for all game entities, optimized for mobile performance.

## Context
Read and understand:
- `PROJECT_CONTEXT.md` - All game systems and data requirements
- React Native AsyncStorage best practices
- Mobile performance constraints

## Primary Objectives
1. Design clean, TypeScript-first data models for all entities
2. Implement efficient local storage (AsyncStorage)
3. Optimize for mobile performance (fast reads/writes)
4. Plan for future cloud save compatibility
5. Support data migration for updates

## Core Data Models

### 1. Player/Athlete

```typescript
interface Player {
    id: string;  // UUID
    name: string;
    age: number;
    dateOfBirth: Date;

    // 25 attributes (1-100)
    attributes: {
        // Physical (12)
        grip_strength: number;
        arm_strength: number;
        core_strength: number;
        agility: number;
        acceleration: number;
        top_speed: number;
        jumping: number;
        reactions: number;
        stamina: number;
        balance: number;
        height: number;  // normalized 1-100
        durability: number;

        // Mental (7)
        awareness: number;
        creativity: number;
        determination: number;
        bravery: number;
        consistency: number;
        composure: number;
        patience: number;

        // Technical (6)
        hand_eye_coordination: number;
        throw_accuracy: number;
        form_technique: number;
        finesse: number;
        deception: number;
        teamwork: number;
    };

    // Hidden potentials (not visible to user)
    potentials: {
        physical: number;    // 1-100
        mental: number;      // 1-100
        technical: number;   // 1-100
    };

    // Peak ages (randomly determined at creation)
    peakAges: {
        physical: number;    // 22-30
        mental: number;      // 26-34
        technical: number;   // 24-32
    };

    // Contract
    contract: Contract | null;

    // Injury status
    injury: Injury | null;

    // Training
    trainingFocus: TrainingFocus | null;  // null = use team default
    weeklyXP: {
        physical: number;
        mental: number;
        technical: number;
    };

    // Stats tracking
    careerStats: PlayerCareerStats;
    currentSeasonStats: PlayerSeasonStats;

    // Metadata
    teamId: string;  // 'user' or AI team ID or 'free_agent' or 'youth_academy'
    acquisitionType: 'starter' | 'draft' | 'trade' | 'free_agent' | 'youth';
    acquisitionDate: Date;
}

interface TrainingFocus {
    physical: number;    // 0-100%
    mental: number;      // 0-100%
    technical: number;   // 0-100%
}

interface Contract {
    id: string;
    playerId: string;
    teamId: string;
    salary: number;              // Annual
    signingBonus: number;
    contractLength: number;      // Years (1-5)
    startDate: Date;
    expiryDate: Date;
    performanceBonuses: {
        pointsPerGame?: { threshold: number; bonus: number };
        championships?: number;
        playingTime?: { threshold: number; bonus: number };
    };
    releaseClause: number | null;
    salaryIncreases: number[];   // Percentage per year
}

interface Injury {
    id: string;
    playerId: string;
    injuryType: 'minor' | 'moderate' | 'severe';
    injuryName: string;
    occurredDate: Date;
    recoveryWeeks: number;
    returnDate: Date;
    doctorReport: string;
}

interface PlayerCareerStats {
    gamesPlayed: {
        basketball: number;
        baseball: number;
        soccer: number;
    };
    totalPoints: {
        basketball: number;
        baseball: number;
        soccer: number;
    };
    // ... other career stats
}
```

### 2. Team/Franchise

```typescript
interface Franchise {
    id: string;  // 'user' for user's team
    name: string;
    colors: {
        primary: string;   // Hex color
        secondary: string; // Hex color
    };

    // Division/League
    division: 1 | 2 | 3 | 4 | 5;
    divisionHistory: Array<{
        season: number;
        division: number;
        finish: number;  // 1-20
    }>;

    // Budget
    budget: {
        total: number;
        allocated: {
            salaries: number;
            coaching: number;
            medical: number;
            youthAcademy: number;
            scouting: number;
            freeAgentTryouts: number;
        };
        available: number;  // Mid-season available funds
    };

    // Roster
    rosterIds: string[];  // Player IDs

    // Youth Academy
    youthAcademyIds: string[];  // Youth prospect IDs

    // Settings
    tacticalSettings: TacticalSettings;
    trainingSettings: {
        teamWide: TrainingFocus;
    };
    scoutingSettings: ScoutingSettings;

    // AI-specific (null for user)
    aiPersonality: AIPersonality | null;

    // Metadata
    createdDate: Date;
    currentSeason: number;
}

interface TacticalSettings {
    pace: 'fast' | 'standard' | 'slow';
    manDefensePct: number;  // 0-100
    scoringOptions: [string?, string?, string?];  // Player IDs
    minutesAllotment: Record<string, number>;
    reboundingStrategy: 'crash_glass' | 'standard' | 'prevent_transition';
    closers: string[];  // Player IDs for end-game
    timeoutStrategy: 'aggressive' | 'standard' | 'conservative';
}

interface ScoutingSettings {
    budgetAllocation: number;  // Percentage
    depthVsBreadth: number;    // 0-100
    targets: ScoutingTarget[];
}

interface AIPersonality {
    name: string;  // "Develops Youth", "Splashes Cash", etc.
    traits: {
        youth_development_focus: number;  // 0-100
        spending_aggression: number;      // 0-100
        defensive_preference: number;     // 0-100
        multi_sport_specialist: boolean;
        // ... other traits
    };
}
```

### 3. Season & Schedule

```typescript
interface Season {
    id: string;
    seasonNumber: number;
    startDate: Date;
    endDate: Date;
    status: 'pre_season' | 'regular_season' | 'post_season' | 'off_season';

    // Schedule
    matches: Match[];

    // Standings
    standings: Record<string, TeamStanding>;  // teamId -> standing

    // Events
    transferWindowOpen: boolean;
    currentWeek: number;
}

interface Match {
    id: string;
    seasonId: string;
    homeTeamId: string;
    awayTeamId: string;
    sport: 'basketball' | 'baseball' | 'soccer';
    scheduledDate: Date;
    status: 'scheduled' | 'in_progress' | 'completed';
    result: MatchResult | null;
}

interface MatchResult {
    matchId: string;
    homeScore: number;
    awayScore: number;
    winner: string;  // team ID
    boxScore: any;  // Detailed stats
    playByPlay: string[];
}

interface TeamStanding {
    teamId: string;
    wins: number;
    losses: number;
    points: number;  // Combined across all sports
    rank: number;    // 1-20
}
```

### 4. Scouting

```typescript
interface ScoutingReport {
    id: string;
    playerId: string;
    scoutedDate: Date;
    scoutingQuality: number;  // 0-100

    // Attribute ranges
    attributeRanges: {
        [key: string]: {
            min: number;
            max: number;
        };
    };

    // Overall sport ratings (ranges)
    overallRatings: {
        basketball: { min: number; max: number };
        baseball: { min: number; max: number };
        soccer: { min: number; max: number };
    };

    // Player info
    playerSnapshot: {
        name: string;
        age: number;
        currentTeam: string;  // 'free_agent' or team ID
        contractStatus: 'free_agent' | 'under_contract' | 'youth';
    };
}

interface ScoutingTarget {
    id: string;
    targetType: 'free_agent' | 'team_player' | 'general';
    filters: {
        ageMin?: number;
        ageMax?: number;
        attributeFilters?: Record<string, { min: number; max: number }>;
        heightMin?: number;
        heightMax?: number;
        teams?: string[];
    };
    status: 'active' | 'completed';
}
```

### 5. Youth Academy

```typescript
interface YouthProspect {
    id: string;
    name: string;
    age: number;  // 15-18
    dateOfBirth: Date;

    // Attributes (lower than regular players)
    attributes: PlayerAttributes;  // Same structure as Player

    // Potentials (hidden, generally higher than current)
    potentials: {
        physical: number;
        mental: number;
        technical: number;
    };

    // Academy info
    joinedAcademyDate: Date;
    mustPromoteBy: Date;  // 19th birthday
    trainingFocus: TrainingFocus | null;  // null = default academy training

    // Metadata
    academyId: string;  // Which team's academy
}
```

### 6. Transfer & Negotiation

```typescript
interface TransferOffer {
    id: string;
    offeringTeamId: string;
    receivingTeamId: string;
    playerId: string;
    transferFee: number;
    status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired';
    createdDate: Date;
    expiryDate: Date;
    counterOffer?: {
        amount: number;
        counteredBy: string;  // team ID
        counteredDate: Date;
    };
    negotiationHistory: Array<{
        amount: number;
        from: string;
        timestamp: Date;
    }>;
}

interface ContractNegotiation {
    id: string;
    playerId: string;
    teamId: string;
    status: 'pending' | 'accepted' | 'rejected' | 'countered';
    offer: ContractOffer;
    counterOffer?: ContractOffer;
    negotiationHistory: Array<{
        offer: ContractOffer;
        from: 'team' | 'player';
        timestamp: Date;
    }>;
}

interface ContractOffer {
    salary: number;
    contractLength: number;
    signingBonus: number;
    performanceBonuses: Contract['performanceBonuses'];
    releaseClause: number | null;
}
```

### 7. News/Alerts

```typescript
interface NewsItem {
    id: string;
    type: 'injury' | 'contract' | 'scouting' | 'transfer' | 'match' | 'youth' | 'general';
    priority: 'critical' | 'important' | 'info';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    relatedEntityId?: string;  // Player ID, match ID, etc.
}
```

### 8. Game Save State

```typescript
interface GameSave {
    version: string;  // For migrations
    saveId: string;
    saveName: string;
    lastSaved: Date;

    // Core game state
    franchise: Franchise;
    players: Player[];
    youthProspects: YouthProspect[];
    season: Season;
    aiTeams: Franchise[];

    // Active negotiations
    transferOffers: TransferOffer[];
    contractNegotiations: ContractNegotiation[];

    // Scouting
    scoutingReports: ScoutingReport[];
    scoutingTargets: ScoutingTarget[];

    // News
    newsItems: NewsItem[];

    // Historical data
    seasonHistory: SeasonHistory[];
}

interface SeasonHistory {
    seasonNumber: number;
    division: number;
    finish: number;
    wins: number;
    losses: number;
    revenue: number;
    championshipWon: boolean;
}
```

## Storage Strategy

### AsyncStorage Keys
```typescript
const STORAGE_KEYS = {
    GAME_SAVE: '@multiball:game_save',
    SETTINGS: '@multiball:settings',
    TUTORIAL_COMPLETED: '@multiball:tutorial',
};
```

### Save/Load Operations
```typescript
class GameStorage {
    async saveGame(gameState: GameSave): Promise<void> {
        const serialized = JSON.stringify(gameState);
        await AsyncStorage.setItem(STORAGE_KEYS.GAME_SAVE, serialized);
    }

    async loadGame(): Promise<GameSave | null> {
        const serialized = await AsyncStorage.getItem(STORAGE_KEYS.GAME_SAVE);
        if (!serialized) return null;
        return JSON.parse(serialized);
    }

    async deleteGame(): Promise<void> {
        await AsyncStorage.removeItem(STORAGE_KEYS.GAME_SAVE);
    }
}
```

### Data Migration Strategy
```typescript
interface MigrationHandler {
    fromVersion: string;
    toVersion: string;
    migrate: (oldData: any) => GameSave;
}

const migrations: MigrationHandler[] = [
    {
        fromVersion: '0.1',
        toVersion: '0.2',
        migrate: (old) => {
            // Add new fields, transform data
            return { ...old, version: '0.2' };
        }
    },
    // ... more migrations
];

function migrateData(data: any, targetVersion: string): GameSave {
    let current = data;
    for (const migration of migrations) {
        if (current.version === migration.fromVersion) {
            current = migration.migrate(current);
        }
    }
    return current;
}
```

## Performance Optimization

### Large Collections
For lists with 50+ players:
```typescript
// Use pagination/virtualization
interface PlayerListPage {
    players: Player[];
    page: number;
    totalPages: number;
}

// Index common queries
interface PlayerIndex {
    byId: Record<string, Player>;
    byTeam: Record<string, string[]>;  // teamId -> playerIds
    byAge: Record<number, string[]>;   // age -> playerIds
    freeAgents: string[];
}
```

### Lazy Loading
```typescript
// Don't load full game state at once
async loadDashboardData() {
    // Load only what's needed for dashboard
    const franchise = await this.loadFranchise();
    const nextMatch = await this.loadNextMatch();
    const alerts = await this.loadRecentAlerts();
    return { franchise, nextMatch, alerts };
}
```

### Caching
```typescript
class CachedGameData {
    private cache: Map<string, { data: any; timestamp: number }> = new Map();

    get(key: string, ttl: number = 5000): any | null {
        const cached = this.cache.get(key);
        if (!cached) return null;
        if (Date.now() - cached.timestamp > ttl) {
            this.cache.delete(key);
            return null;
        }
        return cached.data;
    }

    set(key: string, data: any): void {
        this.cache.set(key, { data, timestamp: Date.now() });
    }
}
```

## Cloud Save Compatibility

**Design for future cloud saves:**
```typescript
interface CloudSaveMetadata {
    saveId: string;
    userId: string;
    platform: 'ios' | 'android';
    lastSyncedAt: Date;
    localVersion: number;
    cloudVersion: number;
}

// Conflict resolution strategy
enum ConflictResolution {
    USE_LOCAL,
    USE_CLOUD,
    MANUAL,
}
```

## Deliverables
- [ ] Complete TypeScript interfaces for all entities
- [ ] AsyncStorage implementation (save/load/delete)
- [ ] Data migration system
- [ ] Performance optimization (indexing, lazy loading, caching)
- [ ] Cloud save compatibility layer (stub for future)
- [ ] Data validation schemas
- [ ] Documentation of all data models

## Collaboration
- **Agent 1 (Translation):** Player/simulation data structures
- **Agent 2 (Game Systems):** All management system data structures
- **Agent 3 (UI/UX):** Display-optimized data formats
- **Agent 6 (AI):** AI team data structures
- **Agent 7 (Season):** Schedule/season data structures
- **Agent 10 (Overseer):** Schema validation and consistency
