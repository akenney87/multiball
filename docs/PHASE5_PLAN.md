# Phase 5: Integration Layer - Implementation Plan

**Created:** 2025-11-21
**Status:** In Progress
**Goal:** Connect React Native UI to Phase 1-3 game engine

## Progress Tracking

| Week | Status | Grade | Tests | Authorization |
|------|--------|-------|-------|---------------|
| Week 1 | Complete | A | 31 tests | PHASE5-WEEK1-APPROVED-OVERSEER-2025-1121-GAMECONTEXT |
| Week 2 | Complete | - | 23 tests | PENDING-REVIEW |
| Week 3 | Complete | - | 20 tests | PENDING-REVIEW |
| Week 4 | Complete | - | 23 tests | PENDING-REVIEW |

## Overview

Phase 5 bridges the UI (Phase 4) with the game systems (Phases 1-3). Currently, all screens use mock data. This phase replaces mocks with real game state and wires up all user actions to modify that state.

---

## Prerequisites

### From Phase 4:
- 13 screens (Dashboard, Roster, Player Detail, Match Preview/Sim/Result, Schedule, Standings, Transfer, Budget, Settings, New Game)
- Theme system with light/dark support
- Persistence layer (GameStorage)
- Confirmation modals for destructive actions

### From Phases 1-3:
- Basketball simulation engine
- AI decision engine (3 personalities)
- Season management (schedule, standings)
- Transfer/free agent markets
- Event system (16 event types)
- Hooks system

---

## Timeline: 4 Weeks

### Week 1: GameContext & Core State

**Goal:** Create central state management that connects to all screens

**Tasks:**

1. **GameContext Provider**
   - Create GameContext with full game state
   - State shape: season, teams, players, market, settings
   - Actions: startNewGame, loadGame, saveGame
   - Integration with GameStorage for persistence

2. **useGame Hook**
   - Access game state from any component
   - Expose dispatchers for state changes
   - Memoized selectors for performance

3. **Game Initialization**
   - Generate initial roster (12-15 players)
   - Create AI opponent teams (19 teams)
   - Initialize season schedule
   - Set initial standings

4. **New Game Flow Integration**
   - Wire NewGameScreen to create real game state
   - Apply team name, colors, difficulty
   - Save initial state to AsyncStorage

5. **Load/Continue Game**
   - Load saved state on app start
   - Hydrate GameContext from AsyncStorage
   - Handle migration for version updates

**Deliverables:**
- Working GameContext with real state
- New game creates actual season
- Save/load cycle works
- ~25 tests for context and initialization

---

### Week 2: Dashboard & Match Integration

**Goal:** Connect dashboard and match flow to real simulation

**Tasks:**

1. **Dashboard Integration**
   - Replace mock data with GameContext selectors
   - Real next match from schedule
   - Real budget from team state
   - Real injury alerts from player state
   - Real news from event history

2. **Match Preview Integration**
   - Load actual opponent roster
   - Real lineup selection (persisted)
   - Player stats from actual player data

3. **Match Simulation Integration**
   - Connect to basketball simulation engine
   - Real play-by-play generation
   - Quarter-by-quarter score updates
   - Live stats accumulation

4. **Match Result Integration**
   - Store result in season state
   - Update standings after match
   - Record player stats to career
   - Generate post-match events

5. **Quick Sim Integration**
   - Batch simulate matches without UI
   - Progress callback for UI updates
   - Sim week / sim to date options

**Deliverables:**
- Dashboard shows real game state
- Full match simulation works
- Results persist to standings
- ~30 tests for match integration

---

### Week 3: Roster & Season Integration

**Goal:** Connect roster management and season progression

**Tasks:**

1. **Roster Screen Integration**
   - Load players from GameContext
   - Real overall ratings
   - Real contract data
   - Filter/sort on actual data

2. **Player Detail Integration**
   - Show all 25 attributes
   - Display career stats
   - Training focus persists
   - Release player action works

3. **Lineup Management Integration**
   - Starting lineup persists
   - Position validation
   - Lineup affects match simulation

4. **Schedule Screen Integration**
   - Real matches from season
   - Past results displayed
   - Future matches scheduled

5. **Standings Screen Integration**
   - Real standings from season state
   - User team highlighted
   - Promotion/relegation zones accurate

6. **Season Progression**
   - Advance week action
   - AI teams play their matches
   - End of season processing
   - Promotion/relegation execution

**Deliverables:**
- Roster management fully functional
- Season advances correctly
- Standings update in real-time
- ~30 tests for roster/season

---

### Week 4: Market & Polish

**Goal:** Complete market systems and final integration polish

**Tasks:**

1. **Transfer Market Integration**
   - Real available players
   - Make offer creates actual offer
   - AI responses to offers
   - Accept/reject incoming offers

2. **Free Agent Integration**
   - Real free agent pool
   - Sign player adds to roster
   - Contract creation
   - Salary cap validation

3. **Budget Integration**
   - Real budget from team finances
   - Allocation affects team performance
   - Salary commitments tracked

4. **Settings Integration**
   - Simulation speed affects sim timing
   - Theme persists across sessions
   - Reset game clears all state

5. **AI Team Actions**
   - AI teams make roster moves
   - AI teams set lineups
   - Transfer window AI activity
   - AI scouting targets

6. **Event Feed Integration**
   - Real events from GameEventEmitter
   - Notifications for important events
   - Event history browsable

7. **Final Polish**
   - Loading states during operations
   - Error handling for edge cases
   - Performance optimization

**Deliverables:**
- Complete market functionality
- AI teams act autonomously
- All systems integrated
- ~25 tests for market/polish
- **Total Phase 5: ~110 tests**

---

## Technical Architecture

### State Shape

```typescript
interface GameState {
  // Core
  initialized: boolean;
  version: string;

  // User Team
  userTeam: {
    id: string;
    name: string;
    colors: { primary: string; secondary: string };
    division: number;
    budget: Budget;
    roster: Player[];
    lineup: LineupConfig;
    trainingFocus: TrainingFocus;
  };

  // League
  league: {
    teams: Team[]; // All 20 teams including user
    aiConfigs: Record<string, AIConfig>;
  };

  // Season
  season: {
    id: string;
    number: number;
    currentWeek: number;
    status: SeasonStatus;
    schedule: Match[];
    standings: Record<string, TeamStanding>;
    transferWindowOpen: boolean;
  };

  // Markets
  market: {
    transfers: TransferOffer[];
    freeAgents: Player[];
  };

  // Events
  events: GameEvent[];

  // Settings
  settings: GameSettings;
}
```

### Context API

```typescript
interface GameContextValue {
  state: GameState;

  // Game Management
  startNewGame: (config: NewGameConfig) => Promise<void>;
  loadGame: () => Promise<boolean>;
  saveGame: () => Promise<void>;
  resetGame: () => Promise<void>;

  // Season Actions
  advanceWeek: () => Promise<void>;
  simulateMatch: (matchId: string) => Promise<MatchResult>;
  quickSimWeek: () => Promise<void>;

  // Roster Actions
  setLineup: (lineup: LineupConfig) => void;
  releasePlayer: (playerId: string) => void;
  setTrainingFocus: (focus: TrainingFocus) => void;

  // Market Actions
  makeTransferOffer: (playerId: string, amount: number) => void;
  respondToOffer: (offerId: string, accept: boolean) => void;
  signFreeAgent: (playerId: string, salary: number) => void;

  // Budget Actions
  setBudgetAllocation: (allocation: BudgetAllocation) => void;

  // Selectors (memoized)
  getNextMatch: () => Match | null;
  getTeamRoster: () => Player[];
  getStandings: () => TeamStanding[];
  getRecentEvents: (count: number) => GameEvent[];
}
```

### File Structure

```
src/
  context/
    GameContext.tsx       # Main context provider
    gameReducer.ts        # State reducer
    gameActions.ts        # Action creators
    gameSelectors.ts      # Memoized selectors
    types.ts              # State types
  hooks/
    useGame.ts            # Main game hook
    useMatch.ts           # Match-specific hook
    useRoster.ts          # Roster-specific hook
    useSeason.ts          # Season-specific hook
    useMarket.ts          # Market-specific hook
  integration/
    gameInitializer.ts    # New game setup
    matchRunner.ts        # Match simulation wrapper
    aiController.ts       # AI team actions
    eventProcessor.ts     # Event handling
```

---

## Integration Points

### Screen to Context Mapping

| Screen | Context Data | Context Actions |
|--------|--------------|-----------------|
| Dashboard | nextMatch, budget, alerts, news | simulateMatch, advanceWeek |
| Roster | roster, lineup | setLineup, releasePlayer |
| Player Detail | player, stats | setTrainingFocus, releasePlayer |
| Match Preview | match, rosters | setLineup |
| Match Simulation | match, simulation | (none - read only) |
| Match Result | result, stats | advanceWeek |
| Schedule | schedule, results | simulateMatch |
| Standings | standings | (none - read only) |
| Transfer Market | market, budget | makeOffer, respondToOffer |
| Budget | budget, allocation | setBudgetAllocation |
| Settings | settings | updateSettings, resetGame |
| New Game | (none) | startNewGame |

---

## Testing Strategy

### Unit Tests (60%)
- GameContext state updates
- Action creators
- Selectors
- Individual integration functions

### Integration Tests (30%)
- New game flow (creates valid state)
- Match simulation flow (updates standings)
- Season progression (week advance)
- Save/load cycle

### E2E Tests (10%)
- Full season playthrough
- Market transactions
- AI team behavior

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance with large state | Medium | High | Memoized selectors, lazy loading |
| Match simulation blocking UI | High | Medium | Web Worker or chunked simulation |
| Save data corruption | Low | High | Version migration, backup saves |
| AI making invalid moves | Medium | Medium | Validation layer, conservative defaults |

---

## Success Criteria

1. **Functional:** All UI screens work with real game data
2. **Playable:** Can complete a full season from start to finish
3. **Persistent:** Game saves/loads correctly
4. **Responsive:** No UI blocking during simulation
5. **Testable:** 80%+ coverage on integration layer

---

## Dependencies

No new npm packages required. Uses:
- React Context (built-in)
- AsyncStorage (already installed)
- Phase 1-3 game engine (already built)

---

**Next Step:** Begin Week 1 - GameContext & Core State
