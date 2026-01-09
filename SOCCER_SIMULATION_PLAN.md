# Soccer Simulation Plan

## Current State

### What Exists
1. **Basic simulator in `sportSimulators.ts`** (lines 295-357)
   - Attribute-driven (WEIGHTS_ATTACK, WEIGHTS_DEFENSE, WEIGHTS_GOALKEEPING)
   - Calculates expected goals based on team strengths
   - Returns basic box score (goals, shots, possession, corners)
   - **NOT BEING USED** - GameContext uses random scores instead

2. **Types defined** (`src/data/types.ts`)
   - `SoccerTacticalSettings`: formation, startingXI, positions, attackingStyle, defensiveLine, pressing
   - `SoccerLineupConfig`: starters, formation, positions
   - Position types: GK, CB, LB, RB, CDM, CM, CAM, LW, RW, ST

3. **Attribute weights defined** (sportSimulators.ts)
   - Attack: throw_accuracy (shot accuracy), arm_strength (power), agility, creativity, finesse, awareness, composure
   - Defense: awareness, reactions, agility, core_strength, determination, teamwork
   - Goalkeeping: reactions, height, agility, awareness, composure, hand_eye_coordination

### What's Missing
- Player-level statistics (who scored, who assisted)
- Event-by-event simulation (like baseball at-bats)
- Half structure (45+45 minutes)
- Formation effects on gameplay
- Set pieces (corners, free kicks, penalties)
- Cards/fouls system
- Integration with GameContext

---

## Proposed Approach: Phased Implementation

### Phase 1: Quick Integration (Day 1)
**Goal: Get soccer working with attribute-driven results NOW**

1. **Update GameContext.tsx** to use existing `simulateSoccerGame()`
   - Replace random scores (lines 866-878) with simulator call
   - Map box score to proper structure
   - Generate basic play-by-play

2. **Update ConnectedMatchResultScreen.tsx**
   - Display soccer box score (possession, shots, corners)
   - Show final score with team names

**Deliverable:** Soccer matches are attribute-driven instead of random

---

### Phase 2: Event-Based Simulation (Days 2-3)
**Goal: Build proper match engine with events**

#### New Module Structure
```
src/simulation/soccer/
├── index.ts                 # Exports
├── types.ts                 # Soccer-specific types
├── constants.ts             # Weights, probabilities
├── systems/
│   ├── possession.ts        # Possession flow
│   ├── shooting.ts          # Shot generation and conversion
│   ├── passing.ts           # Pass success rates
│   └── defending.ts         # Tackles, interceptions
└── game/
    ├── matchSimulation.ts   # Main simulation loop
    ├── halfSimulation.ts    # 45-minute halves
    └── boxScore.ts          # Stats aggregation
```

#### Core Types
```typescript
interface SoccerMatchResult {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  winner: string | null; // null = draw
  halfTimeScore: { home: number; away: number };
  boxScore: SoccerBoxScore;
  events: MatchEvent[];
  playByPlay: string[];
}

interface SoccerBoxScore {
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  corners: { home: number; away: number };
  fouls: { home: number; away: number };
  yellowCards: { home: number; away: number };
  redCards: { home: number; away: number };
  offsides: { home: number; away: number };
  saves: { home: number; away: number };
  // Player-level stats
  playerStats: Record<string, SoccerPlayerStats>;
}

interface SoccerPlayerStats {
  minutesPlayed: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  passAccuracy: number;
  tackles: number;
  interceptions: number;
  saves: number; // GK only
  yellowCards: number;
  redCards: number;
}

interface MatchEvent {
  minute: number;
  type: 'goal' | 'shot' | 'save' | 'corner' | 'foul' | 'yellow_card' | 'red_card' | 'substitution' | 'half_time' | 'full_time';
  team: 'home' | 'away';
  player?: Player;
  assistPlayer?: Player;
  description: string;
}
```

#### Simulation Flow
```
Match Start
├── First Half (45 min simulation)
│   ├── Possession cycles (attack → defend → transition)
│   ├── Shot opportunities generated
│   ├── Goals, saves, misses calculated
│   └── Events logged (goals, cards, etc.)
├── Half Time
└── Second Half (45 min simulation)
    └── Same as first half
```

---

### Phase 3: Formation & Tactics (Day 4)
**Goal: Make formations matter**

1. **Formation bonuses**
   - 4-3-3: +attack, -defense solidity
   - 4-4-2: Balanced
   - 5-3-2: +defense, -attack width
   - 3-5-2: +midfield control, -defensive width

2. **Tactical matchups**
   - Possession vs Counter: Counter gets breakaway chances
   - High line vs Direct: Direct exploits space behind
   - Pressing vs Possession: Pressing causes turnovers

3. **Position-based attribute weights**
   - Strikers: finesse, composure for finishing
   - Wingers: top_speed, agility for dribbling
   - Midfielders: creativity, awareness for playmaking
   - Defenders: core_strength, reactions for tackling
   - Goalkeeper: reactions, height for saves

---

### Phase 4: UI Integration (Day 5)
**Goal: Match result screen parity with baseball**

1. **ConnectedMatchResultScreen.tsx updates**
   - Half-time / Full-time score display
   - Possession bar visualization
   - Shot map or shot statistics
   - Key events timeline (goals, cards)
   - Player ratings based on performance
   - Expandable full box score

2. **Play-by-play display**
   - Minute-by-minute events
   - Goal celebrations with scorer/assister
   - Card notifications

---

## Scope Boundaries

### IN SCOPE
- Event-based simulation with goals, shots, saves
- Player-level statistics
- Half structure (45+45)
- Basic formation effects
- Basic tactics effects
- Box score display
- Play-by-play events

### OUT OF SCOPE (Future)
- Extra time / Penalties (for cup competitions)
- Injuries during match
- In-game tactical changes
- Substitutions
- VAR / referee decisions
- Weather effects
- Home advantage modifiers
- Set piece specialization (corner takers, free kick specialists)

---

## Estimated Effort

| Phase | Days | Deliverable |
|-------|------|-------------|
| Phase 1: Quick Integration | 1 | Attribute-driven scores |
| Phase 2: Event Simulation | 2 | Player stats, events |
| Phase 3: Formations/Tactics | 1 | Tactical depth |
| Phase 4: UI Integration | 1 | Full box score display |
| **Total** | **5 days** | Complete soccer simulation |

---

## Risk Mitigation

1. **Scope creep** - Phases are independent. Can ship Phase 1 immediately, iterate on 2-4.

2. **Balancing** - Use basketball/baseball as reference for "feel". Soccer should be low-scoring (1-3 goals typical).

3. **Complexity** - Start with simple possession→shot→outcome loop. Add nuance in later phases.

---

## Success Criteria

1. **Phase 1 Complete:** Soccer matches use attributes, not random
2. **Phase 2 Complete:** Can see who scored, who assisted
3. **Phase 3 Complete:** Formation choice affects results
4. **Phase 4 Complete:** Box score matches baseball quality

---

## Alternative: Minimal Viable Soccer

If timeline is tight, we could stop at Phase 1 + partial Phase 4:
- Use existing `simulateSoccerGame()`
- Add player-level goal attribution (pick random attackers)
- Display basic box score

**Estimated effort: 1-2 days**
**Trade-off:** Less depth than baseball, but functional
