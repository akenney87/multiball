# Phase 3: AI & Season Flow - Usage Guide

**Created:** 2025-11-21
**Status:** Phase 3 Complete

This guide covers how to use the AI decision engine, season management, and league systems implemented in Phase 3.

---

## Quick Start

### Initialize a Season

```typescript
import {
  generateSeasonSchedule,
  createInitialStandings,
  processMatchResult,
} from './src/season';
import { createAIConfig } from './src/ai/personality';

// Create team IDs
const teamIds = Array.from({ length: 20 }, (_, i) => `team-${i + 1}`);

// Generate schedule (all 3 sports)
const schedule = generateSeasonSchedule(teamIds, 'season-2025');

// Initialize standings
const standings = createInitialStandings(teamIds);

// Create season object
const season = {
  id: 'season-2025',
  seasonNumber: 1,
  startDate: new Date(),
  endDate: new Date(Date.now() + 40 * 7 * 24 * 60 * 60 * 1000),
  status: 'regular_season',
  currentWeek: 1,
  matches: schedule.matches,
  standings,
  transferWindowOpen: false,
};
```

---

## AI Decision Engine

### AI Personalities

Three personality types control AI team behavior:

| Personality | Roster Decisions | Tactical Style | Risk Tolerance |
|-------------|-----------------|----------------|----------------|
| `conservative` | Keep veterans, sign proven players | Zone defense, slow pace | Low |
| `balanced` | Mix of youth and experience | Adaptable tactics | Medium |
| `aggressive` | Target youth, high potential | Press defense, fast pace | High |

### Creating AI Configurations

```typescript
import { createAIConfig, getDecisionThresholds } from './src/ai/personality';

// Create AI config for a team
const conservativeAI = createAIConfig('conservative');
const balancedAI = createAIConfig('balanced');
const aggressiveAI = createAIConfig('aggressive');

// Get decision thresholds for roster decisions
const thresholds = getDecisionThresholds(conservativeAI);
// Returns: { releasePlayerRating, signPlayerRating, promoteYouthRating }
```

### Player Evaluation

```typescript
import { calculateOverallRating, evaluatePlayer, comparePlayersByPosition } from './src/ai/evaluation';

// Simple overall rating (0-100)
const rating = calculateOverallRating(player);

// Full evaluation with context
const context = {
  week: 10,
  transferWindowOpen: true,
  finance: { available: 5000000, total: 20000000 },
};
const evaluation = evaluatePlayer(player, context, config);
// Returns: { playerId, overall, positionFit, ageFactor, potential, valueFactor, compositeScore }

// Compare players at a position
const pgRankings = comparePlayersByPosition(roster, 'PG', context, config);
// Returns players sorted by composite score (best first)
```

### Roster Decisions

```typescript
import {
  shouldReleasePlayer,
  shouldOfferContract,
  prioritizeScouting,
  shouldPromoteYouth,
} from './src/ai/roster';

// Should we release this player?
const releaseDecision = shouldReleasePlayer(player, roster, context, config);
// Returns: { shouldRelease: boolean, reason: string }

// Should we sign this free agent?
const contractOffer = shouldOfferContract(freeAgent, roster, context, config);
// Returns: ContractOffer | null

// What positions should we scout?
const scoutingPriorities = prioritizeScouting(roster, context, config);
// Returns: Position[] (e.g., ['C', 'PF', 'SG'])

// Should we promote this youth player?
const promote = shouldPromoteYouth(youthPlayer, roster, context, config);
// Returns: boolean
```

### Tactical Decisions

```typescript
import {
  selectStartingLineup,
  choosePaceStrategy,
  setDefenseStrategy,
  allocateMinutes,
} from './src/ai/tactical';

// Select starting 5
const lineup = selectStartingLineup(roster, context, config);
// Returns: { starters: Player[5], bench: Player[], reason: string }

// Choose pace strategy based on roster athleticism
const paceDecision = choosePaceStrategy(roster, context, config);
// Returns: { pace: 'slow' | 'normal' | 'fast', reason: string }

// Set defensive strategy
const defenseDecision = setDefenseStrategy(roster, context, config);
// Returns: { defense: 'man' | 'zone' | 'press', reason: string }

// Allocate minutes across roster
const minutes = allocateMinutes(roster, context, config);
// Returns: { allocation: Record<playerId, minutes>, totalMinutes: 240, starters, rotation, deepBench }
```

---

## Season Management

### Schedule Generation

```typescript
import { generateSeasonSchedule, type ScheduleOptions } from './src/season';

// Basic schedule (all 3 sports)
const schedule = generateSeasonSchedule(teamIds, 'season-id');

// With options
const options: ScheduleOptions = {
  seed: 12345,           // For reproducibility
  startDate: new Date(), // Season start
  totalWeeks: 40,        // Season length
};
const seededSchedule = generateSeasonSchedule(teamIds, 'season-id', options);

// Schedule contains:
// - matches: Match[] (all scheduled games)
// - matchesByWeek: Map<number, Match[]> (grouped by week)
// - startDate, endDate
```

### Match Processing

```typescript
import { processMatchResult } from './src/season';

// After simulating a match
const result = {
  matchId: match.id,
  homeScore: 105,
  awayScore: 98,
  winner: match.homeTeamId,
  boxScore: { /* sport-specific stats */ },
  playByPlay: ['Q1: Home takes early lead...'],
};

// Update season state
season = processMatchResult(season, match.id, result);
// This updates:
// - match.status = 'completed'
// - match.result = result
// - standings (wins, losses, points)
// - rankings
```

### Standings

```typescript
import { createInitialStandings, updateStandings } from './src/season';

// Standings are keyed by team ID
const standings = createInitialStandings(teamIds);
// Returns: Record<teamId, TeamStanding>

// Each standing contains:
// - teamId, wins, losses, points, rank

// Re-rank after updates
const ranked = updateStandings(standings);
// Sorts by: points (desc) → wins (desc) → teamId (stability)
```

---

## Transfer Market

### Market State

```typescript
import {
  createTransferMarketState,
  openTransferMarket,
  closeTransferMarket,
  submitTransferOffer,
  getPlayerMarketValue,
} from './src/season';

// Create market (closed initially)
let market = createTransferMarketState(false, currentWeek);

// Open transfer window
market = openTransferMarket(market, eventEmitter);

// Get player's market value
const value = getPlayerMarketValue(player);

// Submit an offer
const { state, offer } = submitTransferOffer(
  market,
  player,
  'buying-team-id',
  'Buying Team',
  'selling-team-id',
  'Selling Team',
  2.0, // multiplier
  'neutral', // urgency
  eventEmitter
);

// Close window (expires pending offers)
market = closeTransferMarket(market, eventEmitter);
```

### Free Agent Market

```typescript
import {
  createFreeAgentMarketState,
  signFreeAgent,
  releaseToFreeAgency,
  getTopAvailableFreeAgents,
  identifyFreeAgentTargets,
} from './src/season';

// Initialize pool
let freeAgentState = createFreeAgentMarketState(currentWeek, poolSize);

// Get top available free agents
const topAgents = getTopAvailableFreeAgents(freeAgentState, 10);

// AI identifies targets
const targets = identifyFreeAgentTargets(freeAgentState, roster, aiConfig, budget);

// Sign a free agent
const { state, players } = signFreeAgent(
  freeAgentState,
  allPlayers,
  agentId,
  'team-id',
  'Team Name',
  salary,
  eventEmitter
);

// Release a player to free agency
const result = releaseToFreeAgency(freeAgentState, allPlayers, playerId, eventEmitter);
```

---

## Event System

### Event Types

Phase 3 emits these events:

| Category | Event Types |
|----------|-------------|
| Season | `season:weekAdvanced`, `season:started`, `season:ended` |
| Match | `match:scheduled`, `match:started`, `match:completed` |
| Transfer | `season:transferWindowOpened`, `season:transferWindowClosed`, `transfer:offerSubmitted`, `transfer:completed` |
| Contract | `contract:offered`, `contract:signed`, `contract:rejected`, `contract:expired` |
| Free Agent | `freeAgent:signed`, `freeAgent:released` |

### Listening to Events

```typescript
import { GameEventEmitter } from './src/season';

const emitter = new GameEventEmitter();

// Listen to specific event
emitter.on('match:completed', (event) => {
  console.log(`${event.homeTeamId} vs ${event.awayTeamId}: ${event.homeScore}-${event.awayScore}`);
});

// Listen to all events
emitter.onAll((event) => {
  console.log(`[${event.type}] at ${event.timestamp}`);
});

// Emit an event
emitter.emit({
  type: 'season:weekAdvanced',
  timestamp: new Date(),
  previousWeek: 1,
  currentWeek: 2,
  season: 2025,
});
```

---

## Hooks System

Hooks allow custom logic at key game lifecycle points:

```typescript
import { HookRegistry, createDefaultHookRegistry } from './src/season';

const registry = new HookRegistry();

// Pre-match hook (validate rosters, apply buffs)
registry.registerPreMatch(async (context) => {
  // context: { match, homeRoster, awayRoster, ... }
  return {
    canProceed: true,
    warnings: [],
    modifiedHomeRoster: context.homeRoster,
    modifiedAwayRoster: context.awayRoster,
  };
});

// Post-match hook (process injuries, update stats)
registry.registerPostMatch(async (context) => {
  // context: { match, result, homeRoster, awayRoster, ... }
  return {
    injuries: [],
    xpGains: {},
    notifications: [],
  };
});

// Pre-week hook (training, maintenance)
registry.registerPreWeek(async (context) => {
  // context: { week, teams, ... }
  return { canProceed: true, warnings: [] };
});

// Post-week hook (standings update, events)
registry.registerPostWeek(async (context) => {
  // context: { week, results, standings, ... }
  return { notifications: [] };
});
```

---

## Promotion & Relegation

The league uses a simple promotion/relegation system:

- **5 Divisions** (Division 5 is lowest, Division 1 is highest)
- **20 Teams per Division**
- **Points:** 3 per win, 0 per loss (combined across all 3 sports)
- **End of Season:**
  - Top 3 teams: Promoted to higher division (except Division 1)
  - Bottom 3 teams: Relegated to lower division (except Division 5)

```typescript
import { calculatePromotionRelegation } from './src/season';

// At end of season
const { promoted, relegated } = calculatePromotionRelegation(standings, division);

// promoted: teamId[] (top 3)
// relegated: teamId[] (bottom 3)
```

---

## Multi-Sport Note

Phase 3 fully simulates **basketball** matches using the Phase 1/2 simulation engine.

**Baseball** and **soccer** matches currently use placeholder random results. Full simulations for these sports are planned for Phase 5.

```typescript
// Basketball: Full simulation with play-by-play
// Baseball: Random score generation (placeholder)
// Soccer: Random score generation (placeholder)
```

---

## Performance Tips

1. **Use seeded schedules** for reproducibility during testing
2. **Batch process matches** by week rather than one-at-a-time
3. **Cache AI configs** - create once per team, reuse throughout season
4. **Event listeners** - unsubscribe when no longer needed to prevent memory leaks

---

## Common Patterns

### Simulate a Full Week

```typescript
async function simulateWeek(season: Season, week: number) {
  const weekMatches = season.matches.filter(m => m.week === week && m.status === 'scheduled');

  for (const match of weekMatches) {
    // Simulate match (basketball uses full sim, others use placeholders)
    const result = await simulateMatch(match);

    // Update season
    season = processMatchResult(season, match.id, result);
  }

  return season;
}
```

### AI Team Turn

```typescript
function processAITeamTurn(team: Team, roster: Player[], context: DecisionContext) {
  const config = createAIConfig(team.aiPersonality.name);

  // Check for releases
  for (const player of roster) {
    const decision = shouldReleasePlayer(player, roster, context, config);
    if (decision.shouldRelease) {
      // Process release
    }
  }

  // Check free agent market
  const targets = identifyFreeAgentTargets(freeAgentState, roster, config, budget);
  for (const target of targets) {
    const offer = shouldOfferContract(target.player, roster, context, config);
    if (offer) {
      // Process signing attempt
    }
  }

  // Set tactics for upcoming match
  const lineup = selectStartingLineup(roster, context, config);
  const pace = choosePaceStrategy(roster, context, config);
  const defense = setDefenseStrategy(roster, context, config);

  return { lineup, pace, defense };
}
```

---

## API Reference

See the TypeScript source files for complete type definitions:

- `src/ai/types.ts` - AI interfaces (AIConfig, DecisionContext, etc.)
- `src/ai/personality.ts` - Personality creation and thresholds
- `src/ai/evaluation.ts` - Player evaluation functions
- `src/ai/roster.ts` - Roster decision functions
- `src/ai/tactical.ts` - Tactical decision functions
- `src/season/index.ts` - Season management exports
- `src/season/events.ts` - Event types and emitter
- `src/season/hooks.ts` - Hook system

---

**Last Updated:** 2025-11-21
