# Data Module Documentation

Complete data modeling system for Multiball, including TypeScript types, storage, validation, and test data generation.

## Overview

This module provides the foundational data structures for the entire game. All other systems depend on these types.

### File Structure

```
src/data/
├── types.ts          - All TypeScript interfaces (Player, Franchise, Season, etc.)
├── storage.ts        - AsyncStorage wrapper for local saves
├── validation.ts     - Runtime data validation
├── factories.ts      - Test data generators
├── migrations.ts     - Data migration system
├── index.ts          - Centralized exports
└── README.md         - This file
```

---

## Types (`types.ts`)

Complete TypeScript interface definitions for all game entities.

### Core Entities

#### Player/Athlete

25 attributes across 3 categories:
- **Physical (12)**: grip_strength, arm_strength, core_strength, agility, acceleration, top_speed, jumping, reactions, stamina, balance, height, durability
- **Mental (7)**: awareness, creativity, determination, bravery, consistency, composure, patience
- **Technical (6)**: hand_eye_coordination, throw_accuracy, form_technique, finesse, deception, teamwork

```typescript
import { Player, PlayerAttributes } from '@/data';

const player: Player = {
  id: 'uuid',
  name: 'John Smith',
  age: 25,
  attributes: { /* 25 attributes */ },
  potentials: { physical: 85, mental: 80, technical: 90 }, // Hidden
  peakAges: { physical: 26, technical: 28, mental: 30 },
  // ... other fields
};
```

#### Franchise/Team

```typescript
import { Franchise } from '@/data';

const franchise: Franchise = {
  id: 'user', // 'user' for user team, UUID for AI teams
  name: 'My Team',
  division: 5, // 1-5
  budget: {
    total: 1000000,
    allocated: { salaries: 500000, coaching: 100000, /* ... */ },
    available: 400000,
  },
  rosterIds: ['player-id-1', 'player-id-2', /* ... */],
  tacticalSettings: { /* pace, defense, scoring options */ },
  // ... other fields
};
```

#### Season & Matches

```typescript
import { Season, Match } from '@/data';

const season: Season = {
  id: 'uuid',
  seasonNumber: 1,
  status: 'regular_season',
  matches: [/* 57 matches: 19 opponents × 3 sports */],
  standings: { /* team standings */ },
  transferWindowOpen: true,
  currentWeek: 5,
};

const match: Match = {
  id: 'uuid',
  homeTeamId: 'user',
  awayTeamId: 'ai-team-1',
  sport: 'basketball',
  status: 'completed',
  result: { homeScore: 95, awayScore: 88, /* ... */ },
};
```

#### Contract

```typescript
import { Contract } from '@/data';

const contract: Contract = {
  id: 'uuid',
  playerId: 'player-id',
  teamId: 'user',
  salary: 100000,
  signingBonus: 50000,
  contractLength: 3, // years
  performanceBonuses: { /* optional bonuses */ },
  releaseClause: 500000,
  // ... other fields
};
```

#### Injury

```typescript
import { Injury } from '@/data';

const injury: Injury = {
  id: 'uuid',
  playerId: 'player-id',
  injuryType: 'moderate',
  injuryName: 'Hamstring Strain',
  occurredDate: new Date(),
  recoveryWeeks: 4,
  returnDate: new Date(/* +4 weeks */),
  doctorReport: 'Expected recovery: 4 weeks',
};
```

### Complete Type List

- **Player System**: Player, PlayerAttributes, PlayerPotentials, PeakAges, TrainingFocus, WeeklyXP, PlayerCareerStats
- **Contract System**: Contract, ContractOffer, ContractNegotiation
- **Injury System**: Injury
- **Franchise System**: Franchise, Budget, TacticalSettings, AIPersonality
- **Season System**: Season, Match, MatchResult, TeamStanding
- **Scouting System**: ScoutingReport, ScoutingTarget, ScoutingFilters
- **Youth Academy**: YouthProspect
- **Transfer System**: TransferOffer
- **News System**: NewsItem
- **Game Save**: GameSave, SeasonHistory

### Type Guards

Utility functions for type checking:

```typescript
import { isYouthProspect, isFreeAgent, isUserPlayer, isAITeam } from '@/data';

if (isFreeAgent(player)) {
  // Player is free agent
}

if (isUserPlayer(player)) {
  // Player is on user's team
}

if (isAITeam(franchise)) {
  // Franchise is AI-controlled
}
```

---

## Storage (`storage.ts`)

AsyncStorage wrapper for saving/loading game state.

### Game Storage

```typescript
import { gameStorage, GameSave } from '@/data';

// Save game
await gameStorage.saveGame(gameState);

// Load game
const gameState = await gameStorage.loadGame();

// Check if save exists
const hasSave = await gameStorage.hasSaveGame();

// Delete save
await gameStorage.deleteGame();

// Get storage stats
const stats = await gameStorage.getStorageStats();
// { totalKeys: 5, estimatedSize: 524288 }
```

### Settings Storage

```typescript
import { settingsStorage, UserSettings } from '@/data';

// Load settings
const settings = await settingsStorage.loadSettings();

// Save settings
await settingsStorage.saveSettings({
  soundEnabled: true,
  musicEnabled: false,
  autoSaveEnabled: true,
  // ... other settings
});
```

### Tutorial Storage

```typescript
import { tutorialStorage } from '@/data';

// Check if tutorial completed
const completed = await tutorialStorage.isTutorialCompleted();

// Mark tutorial complete
await tutorialStorage.markTutorialCompleted();

// Reset tutorial
await tutorialStorage.resetTutorial();
```

### Error Handling

```typescript
import { gameStorage, SaveNotFoundError, SaveCorruptedError, StorageQuotaError } from '@/data';

try {
  const gameState = await gameStorage.loadGame();
} catch (error) {
  if (error instanceof SaveNotFoundError) {
    // No save found, start new game
  } else if (error instanceof SaveCorruptedError) {
    // Save corrupted, prompt user to delete
  } else if (error instanceof StorageQuotaError) {
    // Storage full, prompt user to free space
  }
}
```

### Performance Optimizations

- **Caching**: Recently accessed data cached for 5 seconds
- **Date Serialization**: Automatic Date ↔ ISO string conversion
- **Metadata**: Lightweight save metadata for quick loading
- **Compression**: Ready for future gzip/lz4 compression

### Cloud Save Compatibility (Future)

Architecture supports future cloud saves:

```typescript
// Stub for future implementation
export interface ICloudSaveManager {
  uploadSave(save: GameSave): Promise<void>;
  downloadSave(saveId: string): Promise<GameSave>;
  syncSaves(): Promise<void>;
  isCloudNewer(saveId: string): Promise<boolean>;
  resolveConflict(saveId: string, resolution: 'local' | 'cloud'): Promise<void>;
}
```

---

## Validation (`validation.ts`)

Runtime validation for all game entities.

### Player Validation

```typescript
import { validatePlayer, validatePlayerAttributes, ValidationError } from '@/data';

try {
  validatePlayer(player);
  // Player is valid
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`Validation failed: ${error.message}`);
    console.error(`Field: ${error.field}`);
  }
}
```

### Attribute Validation

```typescript
import { validatePlayerAttributes, validatePlayerPotentials, validatePeakAges } from '@/data';

validatePlayerAttributes(player.attributes);
// Ensures all 25 attributes present and in range 1-100

validatePlayerPotentials(player.potentials);
// Ensures physical/mental/technical potentials valid

validatePeakAges(player.peakAges);
// Ensures peak ages within realistic ranges
```

### Training Focus Validation

```typescript
import { validateTrainingFocus } from '@/data';

validateTrainingFocus({ physical: 33, mental: 33, technical: 34 });
// Must sum to 100
```

### Complete Validation Suite

```typescript
import { validateGameSave } from '@/data';

validateGameSave(gameState);
// Validates entire game state:
// - Franchise
// - All players
// - All youth prospects
// - All AI teams
// - Season
// - Contracts
// - Injuries
// - etc.
```

### Utility Validators

```typescript
import {
  validateUUID,
  validateHexColor,
  validatePercentage,
  validateNonNegative,
  validateFutureDate,
  validateDateRange,
} from '@/data';

validateUUID('550e8400-e29b-41d4-a716-446655440000'); // true
validateHexColor('#FF5733'); // true
validatePercentage(75); // true
validateNonNegative(-5); // false
validateFutureDate(new Date('2025-12-31')); // true
validateDateRange(startDate, endDate); // true if end > start
```

---

## Factories (`factories.ts`)

Test data generators for development and testing.

### Player Factories

```typescript
import { createStarterPlayer, createRandomPlayer, createElitePlayer } from '@/data';

// Starter player (attributes 1-25, poor quality)
const starter = createStarterPlayer();

// Random player (custom attribute range)
const random = createRandomPlayer(40, 80);

// Elite player (attributes 70-100)
const elite = createElitePlayer();

// With overrides
const customPlayer = createStarterPlayer({
  name: 'Custom Name',
  age: 25,
  position: 'PG',
});
```

### Attribute Factories

```typescript
import { createRandomAttributes, createRandomPotentials, createRandomPeakAges } from '@/data';

// Random attributes
const attributes = createRandomAttributes(1, 100, 'tall'); // archetype: tall/quick/strong/balanced

// Random potentials (respecting current attributes)
const potentials = createRandomPotentials(attributes);

// Random peak ages
const peakAges = createRandomPeakAges();
```

### Training Factories

```typescript
import { createBalancedTrainingFocus, createRandomTrainingFocus } from '@/data';

// Balanced (33/33/34)
const balanced = createBalancedTrainingFocus();

// Random (sums to 100)
const random = createRandomTrainingFocus();
```

### Franchise Factories

```typescript
import { createUserFranchise, createAIFranchise } from '@/data';

// User franchise
const userTeam = createUserFranchise('My Team', { primary: '#FF0000', secondary: '#0000FF' });

// AI franchise
const aiTeam = createAIFranchise(5); // Division 5
```

### Contract & Injury Factories

```typescript
import { createRandomContract, createRandomInjury } from '@/data';

const contract = createRandomContract('player-id', 'team-id');
const injury = createRandomInjury('player-id');
```

### Complete Game Save Factory

```typescript
import { createNewGameSave } from '@/data';

// Create complete initial game state
const gameSave = createNewGameSave(
  'My Save',
  'My Team',
  { primary: '#FF5733', secondary: '#33FF57' }
);

// Includes:
// - User franchise
// - 50 starter players
// - 19 AI teams (each with 50 players)
// - Initial season
// - Empty standings
// - Welcome news
```

---

## Migrations (`migrations.ts`)

Data migration system for upgrading save files between versions.

### Auto-Migration on Load

```typescript
import { autoMigrate } from '@/data';

// Automatically migrate save data
const gameState = await gameStorage.loadGame();
const migratedState = autoMigrate(gameState);
```

### Manual Migration

```typescript
import { migrateData, CURRENT_VERSION } from '@/data';

const result = migrateData(oldSaveData, CURRENT_VERSION);

if (result.success) {
  console.log(`Migrated from ${result.fromVersion} to ${result.toVersion}`);
  console.log('Applied migrations:', result.appliedMigrations);
} else {
  console.error('Migration failed:', result.error);
}
```

### Version Checking

```typescript
import { needsMigration, isVersionSupported } from '@/data';

if (needsMigration('0.1.0')) {
  // Migration needed
}

if (isVersionSupported('0.0.5')) {
  // Version can be migrated to current
}
```

### Adding New Migrations

```typescript
// In migrations.ts, add to migrations array:
{
  fromVersion: '0.2.0',
  toVersion: '0.3.0',
  description: 'Add baseball simulation support',
  migrate: (old: any): GameSave => {
    return {
      ...old,
      version: '0.3.0',
      // Add new fields
      baseballSettings: { /* ... */ },
      // Transform existing fields
      players: old.players.map((p: any) => ({
        ...p,
        baseballStats: createEmptyBaseballStats(),
      })),
    };
  },
}
```

### Testing Migrations

```typescript
import { testAllMigrations } from '@/data';

// Test all migrations
const results = testAllMigrations();
console.log(`${results.passed} passed, ${results.failed} failed`);
```

---

## Critical Design Decisions

### 1. Alignment with Basketball-Sim

Player attributes **exactly match** basketball-sim's 25 attributes:

```python
# basketball-sim/src/constants.py
ALL_ATTRIBUTES = [
    'grip_strength', 'arm_strength', 'core_strength', 'agility',
    'acceleration', 'top_speed', 'jumping', 'reactions',
    'stamina', 'balance', 'height', 'durability',
    'awareness', 'creativity', 'determination', 'bravery',
    'consistency', 'composure', 'patience',
    'hand_eye_coordination', 'throw_accuracy', 'form_technique',
    'finesse', 'deception', 'teamwork',
]
```

TypeScript interfaces use **identical field names** for seamless translation.

### 2. Mobile Performance

- **Lazy loading**: Don't load full game state at once
- **Caching**: 5-second TTL for frequently accessed data
- **Indexing**: Player lookups by ID, team, age, etc.
- **Virtualization**: Large lists (50+ players) use pagination

### 3. TypeScript Strict Mode

- **No `any` types** (except sport-specific box scores, extensible for future)
- **Explicit null handling**: Use `| null` for optional fields
- **Type guards**: Runtime type checking with type narrowing
- **Readonly where appropriate**: Prevent accidental mutations

### 4. Future Cloud Save Support

Storage architecture designed for cloud saves:

- **UUID-based IDs**: Globally unique, cloud-compatible
- **Conflict resolution**: Metadata tracks local/cloud versions
- **Serialization**: JSON-safe (Dates converted to ISO strings)
- **Stub interfaces**: `ICloudSaveManager` defines contract

### 5. Data Normalization

- **IDs stored, not full objects**: Prevents duplication
- **Roster IDs array**: `rosterIds: string[]` instead of `players: Player[]`
- **Lookups**: Use indexing for O(1) player lookups

Example:
```typescript
// DON'T: Duplicate player objects
franchise.roster = [player1, player2, player3];

// DO: Store IDs, lookup when needed
franchise.rosterIds = ['id1', 'id2', 'id3'];
const player = players.find(p => p.id === 'id1');
```

---

## Usage Examples

### Creating New Game

```typescript
import { createNewGameSave, gameStorage } from '@/data';

// Create new game
const gameSave = createNewGameSave('My First Season', 'Dream Team');

// Save to storage
await gameStorage.saveGame(gameSave);
```

### Loading Game

```typescript
import { gameStorage, autoMigrate, validateGameSave } from '@/data';

// Load and migrate
const savedData = await gameStorage.loadGame();
const gameState = autoMigrate(savedData);

// Validate
validateGameSave(gameState);
```

### Managing Players

```typescript
import { Player, isFreeAgent, isUserPlayer } from '@/data';

// Filter free agents
const freeAgents = gameState.players.filter(isFreeAgent);

// Get user's roster
const userRoster = gameState.players.filter(isUserPlayer);

// Get player by ID
const player = gameState.players.find(p => p.id === playerId);
```

### Updating Budget

```typescript
// Update budget allocation
gameState.franchise.budget.allocated.coaching = 150000;
gameState.franchise.budget.available =
  gameState.franchise.budget.total -
  Object.values(gameState.franchise.budget.allocated).reduce((a, b) => a + b, 0);

// Validate
validateBudget(gameState.franchise.budget);
```

### Adding News

```typescript
import { createNewsItem } from '@/data';

const news = createNewsItem(
  'injury',
  'critical',
  'John Smith Injured',
  'Star player John Smith suffered a severe injury and will miss 8 weeks.'
);

gameState.newsItems.push(news);
```

---

## Notes for Other Agents

### Agent 1: Python-to-TypeScript Translation Specialist

**Player Structure Alignment:**
- TypeScript `Player` interface matches Python `player` dictionary
- All 25 attributes have **identical names** (snake_case)
- `position` field: 'PG', 'SG', 'SF', 'PF', 'C' (same as Python)
- Tactical settings match `TacticalSettings` dataclass

**Data Flow:**
```
Python Sim Input → TypeScript Player
Python Sim Output → TypeScript MatchResult
```

### Agent 2: Game Systems Architect

**System Integration:**
- Training system: Uses `TrainingFocus` and `WeeklyXP`
- Contract system: Uses `Contract` and `ContractNegotiation`
- Transfer system: Uses `TransferOffer`
- Scouting system: Uses `ScoutingReport` and `ScoutingTarget`
- Youth academy: Uses `YouthProspect`
- Injury system: Uses `Injury`

**Budget Constraints:**
- Enforce `Budget` validation
- Total allocated cannot exceed total budget
- Update `available` funds after transactions

### Agent 3: Mobile UI/UX Designer

**Display Optimization:**
- Use `SaveMetadata` for quick save selection screen
- Lazy load full game state only when needed
- Virtualize player lists (50+ players)
- Show `NewsItem` priority with color coding

**Type Safety:**
- All UI components should accept typed props
- Use type guards for runtime checks
- Never mutate state directly (immutable updates)

### Agent 6: AI Team Behavior Designer

**AI Personality:**
- Each AI team has `AIPersonality` with trait values (0-100)
- Traits affect decision-making (spending, youth focus, defense, etc.)
- Multi-sport specialists have `multi_sport_specialist: true`

**Decision Data:**
- Access `Franchise.budget` for spending decisions
- Access `Franchise.rosterIds` for roster management
- Use scouting reports for transfer targets

### Agent 7: Season & Schedule Manager

**Season Structure:**
- 57 matches per season (19 opponents × 3 sports)
- Standings track combined points across all sports
- Transfer window open July 1 - January 1

**Match Generation:**
- Create `Match` entities with `sport: 'basketball' | 'baseball' | 'soccer'`
- Store results in `MatchResult`
- Update `TeamStanding` after each match

---

## Testing

### Unit Tests (Recommended)

```typescript
import { createStarterPlayer, validatePlayer } from '@/data';

describe('Player Factory', () => {
  it('creates valid starter player', () => {
    const player = createStarterPlayer();
    expect(() => validatePlayer(player)).not.toThrow();
    expect(player.attributes.height).toBeGreaterThanOrEqual(1);
    expect(player.attributes.height).toBeLessThanOrEqual(25);
  });
});
```

### Integration Tests

```typescript
import { createNewGameSave, validateGameSave, gameStorage } from '@/data';

describe('Game Save', () => {
  it('creates and validates complete game save', () => {
    const save = createNewGameSave('Test', 'Test Team');
    expect(() => validateGameSave(save)).not.toThrow();
    expect(save.players).toHaveLength(1000); // 50 × 20 teams
  });

  it('saves and loads game', async () => {
    const save = createNewGameSave('Test', 'Test Team');
    await gameStorage.saveGame(save);
    const loaded = await gameStorage.loadGame();
    expect(loaded).toEqual(save);
  });
});
```

---

## Performance Benchmarks

Target performance (React Native on mid-range phone):

- **Save game**: < 500ms
- **Load game**: < 1000ms
- **Validate save**: < 100ms
- **Create new game**: < 200ms
- **Player attribute lookup**: < 1ms

### Optimization Tips

1. **Use indexing** for frequent lookups
2. **Cache computed values** (overall ratings, etc.)
3. **Virtualize lists** in UI (react-native-virtualized-list)
4. **Batch updates** instead of saving after every change
5. **Compress saves** (gzip) for storage efficiency

---

## Changelog

### 0.1.0 (2025-11-17)
- Initial data modeling system
- All 25 player attributes
- Complete game save structure
- AsyncStorage integration
- Validation system
- Test data factories
- Migration system
- TypeScript strict mode compliance
