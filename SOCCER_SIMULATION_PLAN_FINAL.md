# Soccer Simulation Plan - FINAL (Post-Critique)

## Summary

After 3 rounds of critique with the simulation architect, we've agreed on a **3-day implementation** that delivers attribute-driven soccer with player-level statistics.

---

## The Approach

**"Generate outcome → Attribute to players"**

Unlike basketball (possession-by-possession) or baseball (at-bat-by-at-bat), soccer will use a simpler approach:

1. Calculate team strengths (attack, defense, goalkeeping)
2. Determine match outcome (goals, shots, possession)
3. Generate key events (goals with minute markers)
4. Attribute goals/assists to players based on position and attributes

This is sufficient for a management sim and delivers in 3 days.

---

## Day 1: Attribute System & Core Simulation

### Task 1.1: Define Soccer Attribute Weights

Create `src/simulation/soccer/constants.ts`:

```typescript
// Attacking composite (for forwards, wingers, attacking mids)
export const WEIGHTS_SOCCER_ATTACK = {
  finesse: 0.25,           // Finishing touch
  composure: 0.20,         // Finishing under pressure
  agility: 0.15,           // Dribbling
  top_speed: 0.15,         // Pace
  creativity: 0.15,        // Playmaking
  awareness: 0.10,         // Positioning
};

// Midfield composite (for central/defensive mids)
export const WEIGHTS_SOCCER_MIDFIELD = {
  creativity: 0.20,        // Vision and passing
  awareness: 0.20,         // Positioning
  stamina: 0.15,           // Work rate
  teamwork: 0.15,          // Link-up play
  agility: 0.15,           // Ball control
  determination: 0.15,     // Pressing
};

// Defensive composite (for defenders)
export const WEIGHTS_SOCCER_DEFENSE = {
  awareness: 0.25,         // Positioning
  reactions: 0.20,         // Interceptions
  core_strength: 0.15,     // Winning duels
  determination: 0.15,     // Work rate
  agility: 0.15,           // Tackling
  height: 0.10,            // Aerial duels
};

// Goalkeeping composite
export const WEIGHTS_SOCCER_GOALKEEPING = {
  reactions: 0.30,         // Shot stopping
  height: 0.20,            // Reach
  agility: 0.15,           // Diving
  awareness: 0.15,         // Positioning
  composure: 0.10,         // 1v1 situations
  hand_eye_coordination: 0.10, // Catching
};

// Formation modifiers (simple multipliers)
export const FORMATION_MODIFIERS: Record<string, { attack: number; defense: number }> = {
  '4-4-2': { attack: 1.00, defense: 1.00 },  // Balanced
  '4-3-3': { attack: 1.10, defense: 0.95 },  // Attacking
  '4-5-1': { attack: 0.90, defense: 1.10 },  // Defensive
  '3-5-2': { attack: 1.05, defense: 0.95 },  // Midfield control
  '5-3-2': { attack: 0.85, defense: 1.15 },  // Very defensive
  '4-2-3-1': { attack: 1.05, defense: 1.00 }, // Modern balanced
};
```

### Task 1.2: Build Core Simulation

Create `src/simulation/soccer/game/matchSimulation.ts`:

```typescript
export interface SoccerMatchInput {
  homeTeam: SoccerTeamState;
  awayTeam: SoccerTeamState;
}

export interface SoccerTeamState {
  teamId: string;
  lineup: Player[];          // 11 players
  formation: string;         // e.g., "4-3-3"
  positions: Record<string, SoccerPosition>;
  tactics: {
    attackingStyle: 'possession' | 'direct' | 'counter';
    defensiveLine: 'high' | 'medium' | 'low';
  };
}

export interface SoccerMatchResult {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  winner: string | null;     // null = draw
  halfTimeScore: { home: number; away: number };
  events: SoccerEvent[];
  boxScore: SoccerBoxScore;
  playByPlay: string[];
}

export function simulateSoccerMatch(input: SoccerMatchInput): SoccerMatchResult {
  // 1. Calculate team composites
  const homeAttack = calculateTeamAttack(input.homeTeam);
  const homeDefense = calculateTeamDefense(input.homeTeam);
  const homeGK = calculateGoalkeeperRating(input.homeTeam);

  const awayAttack = calculateTeamAttack(input.awayTeam);
  const awayDefense = calculateTeamDefense(input.awayTeam);
  const awayGK = calculateGoalkeeperRating(input.awayTeam);

  // 2. Apply formation modifiers
  const homeMod = FORMATION_MODIFIERS[input.homeTeam.formation] || { attack: 1, defense: 1 };
  const awayMod = FORMATION_MODIFIERS[input.awayTeam.formation] || { attack: 1, defense: 1 };

  // 3. Calculate expected goals (Poisson-like)
  const homeXG = calculateExpectedGoals(homeAttack * homeMod.attack, awayDefense * awayMod.defense, awayGK);
  const awayXG = calculateExpectedGoals(awayAttack * awayMod.attack, homeDefense * homeMod.defense, homeGK);

  // 4. Generate actual goals with variance
  const homeGoals = generateGoals(homeXG);
  const awayGoals = generateGoals(awayXG);

  // 5. Generate events (goals with scorers/assisters)
  const events = generateMatchEvents(input, homeGoals, awayGoals);

  // 6. Build box score
  const boxScore = generateBoxScore(input, events, homeAttack, awayAttack);

  // 7. Generate play-by-play
  const playByPlay = generatePlayByPlay(events, input);

  return {
    homeTeamId: input.homeTeam.teamId,
    awayTeamId: input.awayTeam.teamId,
    homeScore: homeGoals,
    awayScore: awayGoals,
    winner: homeGoals > awayGoals ? input.homeTeam.teamId :
            awayGoals > homeGoals ? input.awayTeam.teamId : null,
    halfTimeScore: calculateHalfTimeScore(homeGoals, awayGoals),
    events,
    boxScore,
    playByPlay,
  };
}
```

### Task 1.3: Player Attribution System

```typescript
// Attribute goals to players based on position and composite
function attributeGoalToPlayer(team: SoccerTeamState, events: SoccerEvent[]): Player {
  // Weight by position (strikers most likely, defenders least)
  const weights = team.lineup.map(player => {
    const pos = team.positions[player.id];
    const attackComposite = calculateComposite(player, WEIGHTS_SOCCER_ATTACK);

    // Position multipliers
    const positionWeight = {
      'ST': 3.0, 'CF': 2.8,
      'LW': 2.0, 'RW': 2.0, 'CAM': 1.8,
      'CM': 1.0, 'CDM': 0.5,
      'LB': 0.3, 'RB': 0.3, 'CB': 0.2,
      'GK': 0.01,
    }[pos] || 1.0;

    return { player, weight: attackComposite * positionWeight };
  });

  // Weighted random selection
  return weightedRandomSelect(weights);
}

// Similar logic for assists (favor midfielders with high creativity)
function attributeAssistToPlayer(team: SoccerTeamState, scorer: Player): Player | null {
  // 70% chance of assist
  if (Math.random() > 0.7) return null;

  // Exclude scorer, weight by creativity
  const weights = team.lineup
    .filter(p => p.id !== scorer.id)
    .map(player => {
      const creativity = calculateComposite(player, WEIGHTS_SOCCER_MIDFIELD);
      const pos = team.positions[player.id];
      const positionWeight = {
        'CAM': 2.5, 'CM': 2.0, 'LW': 1.8, 'RW': 1.8,
        'ST': 1.5, 'CDM': 1.0, 'LB': 0.8, 'RB': 0.8,
        'CB': 0.3, 'GK': 0.1,
      }[pos] || 1.0;

      return { player, weight: creativity * positionWeight };
    });

  return weightedRandomSelect(weights);
}
```

---

## Day 2: Event Generation & Box Score

### Task 2.1: Event Types

Create `src/simulation/soccer/types.ts`:

```typescript
export type SoccerPosition = 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST';

export interface SoccerEvent {
  minute: number;
  type: 'goal' | 'yellow_card' | 'red_card' | 'substitution' | 'half_time' | 'full_time';
  team: 'home' | 'away';
  player?: Player;
  assistPlayer?: Player;
  description: string;
}

export interface SoccerBoxScore {
  // Team stats
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  corners: { home: number; away: number };
  fouls: { home: number; away: number };
  yellowCards: { home: number; away: number };
  redCards: { home: number; away: number };

  // Player stats
  homePlayerStats: Record<string, SoccerPlayerStats>;
  awayPlayerStats: Record<string, SoccerPlayerStats>;
}

export interface SoccerPlayerStats {
  minutesPlayed: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  yellowCards: number;
  redCards: number;
  // GK only
  saves?: number;
}
```

### Task 2.2: Event Generation

```typescript
function generateMatchEvents(
  input: SoccerMatchInput,
  homeGoals: number,
  awayGoals: number
): SoccerEvent[] {
  const events: SoccerEvent[] = [];

  // Generate goal events with minutes
  const homeGoalMinutes = generateGoalMinutes(homeGoals);
  const awayGoalMinutes = generateGoalMinutes(awayGoals);

  for (const minute of homeGoalMinutes) {
    const scorer = attributeGoalToPlayer(input.homeTeam, events);
    const assister = attributeAssistToPlayer(input.homeTeam, scorer);
    events.push({
      minute,
      type: 'goal',
      team: 'home',
      player: scorer,
      assistPlayer: assister,
      description: assister
        ? `${scorer.name} scores! Assisted by ${assister.name}`
        : `${scorer.name} scores!`,
    });
  }

  for (const minute of awayGoalMinutes) {
    const scorer = attributeGoalToPlayer(input.awayTeam, events);
    const assister = attributeAssistToPlayer(input.awayTeam, scorer);
    events.push({
      minute,
      type: 'goal',
      team: 'away',
      player: scorer,
      assistPlayer: assister,
      description: assister
        ? `${scorer.name} scores! Assisted by ${assister.name}`
        : `${scorer.name} scores!`,
    });
  }

  // Add yellow cards (random, 2-4 per game)
  const totalCards = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < totalCards; i++) {
    const team = Math.random() > 0.5 ? 'home' : 'away';
    const teamState = team === 'home' ? input.homeTeam : input.awayTeam;
    const player = teamState.lineup[Math.floor(Math.random() * 11)];
    events.push({
      minute: Math.floor(Math.random() * 90) + 1,
      type: 'yellow_card',
      team,
      player,
      description: `Yellow card for ${player.name}`,
    });
  }

  // Sort by minute
  events.sort((a, b) => a.minute - b.minute);

  // Add half time and full time
  events.splice(
    events.findIndex(e => e.minute > 45) || events.length,
    0,
    { minute: 45, type: 'half_time', team: 'home', description: 'Half Time' }
  );
  events.push({ minute: 90, type: 'full_time', team: 'home', description: 'Full Time' });

  return events;
}

function generateGoalMinutes(numGoals: number): number[] {
  // Generate realistic goal distribution (more goals late in halves)
  const minutes: number[] = [];
  for (let i = 0; i < numGoals; i++) {
    // Weight towards end of halves (45, 90)
    const half = Math.random() > 0.5 ? 1 : 2;
    const baseMinute = half === 1 ? 0 : 45;
    const minute = baseMinute + Math.floor(Math.random() * 45) + 1;
    minutes.push(minute);
  }
  return minutes.sort((a, b) => a - b);
}
```

### Task 2.3: Box Score Generation

```typescript
function generateBoxScore(
  input: SoccerMatchInput,
  events: SoccerEvent[],
  homeAttack: number,
  awayAttack: number
): SoccerBoxScore {
  // Calculate team stats
  const homeShots = Math.round(homeAttack / 8 + 5 + Math.random() * 5);
  const awayShots = Math.round(awayAttack / 8 + 5 + Math.random() * 5);

  const homeGoals = events.filter(e => e.type === 'goal' && e.team === 'home').length;
  const awayGoals = events.filter(e => e.type === 'goal' && e.team === 'away').length;

  // Shots on target >= goals
  const homeSoT = Math.max(homeGoals, Math.round(homeShots * 0.35 + Math.random() * 2));
  const awaySoT = Math.max(awayGoals, Math.round(awayShots * 0.35 + Math.random() * 2));

  // Possession based on midfield strength
  const homeMidfield = calculateTeamMidfield(input.homeTeam);
  const awayMidfield = calculateTeamMidfield(input.awayTeam);
  const homePossession = Math.round(50 + (homeMidfield - awayMidfield) / 2);

  // Initialize player stats
  const homePlayerStats: Record<string, SoccerPlayerStats> = {};
  const awayPlayerStats: Record<string, SoccerPlayerStats> = {};

  for (const player of input.homeTeam.lineup) {
    homePlayerStats[player.id] = createEmptyPlayerStats();
  }
  for (const player of input.awayTeam.lineup) {
    awayPlayerStats[player.id] = createEmptyPlayerStats();
  }

  // Populate from events
  for (const event of events) {
    const stats = event.team === 'home' ? homePlayerStats : awayPlayerStats;
    if (event.player && stats[event.player.id]) {
      if (event.type === 'goal') {
        stats[event.player.id].goals++;
        stats[event.player.id].shots++;
        stats[event.player.id].shotsOnTarget++;
      }
      if (event.type === 'yellow_card') {
        stats[event.player.id].yellowCards++;
      }
    }
    if (event.assistPlayer && stats[event.assistPlayer.id]) {
      stats[event.assistPlayer.id].assists++;
    }
  }

  // Distribute remaining shots to attackers
  distributeShots(input.homeTeam, homePlayerStats, homeShots - homeGoals);
  distributeShots(input.awayTeam, awayPlayerStats, awayShots - awayGoals);

  return {
    possession: { home: homePossession, away: 100 - homePossession },
    shots: { home: homeShots, away: awayShots },
    shotsOnTarget: { home: homeSoT, away: awaySoT },
    corners: { home: Math.floor(Math.random() * 8), away: Math.floor(Math.random() * 8) },
    fouls: { home: 10 + Math.floor(Math.random() * 8), away: 10 + Math.floor(Math.random() * 8) },
    yellowCards: {
      home: events.filter(e => e.type === 'yellow_card' && e.team === 'home').length,
      away: events.filter(e => e.type === 'yellow_card' && e.team === 'away').length,
    },
    redCards: { home: 0, away: 0 },
    homePlayerStats,
    awayPlayerStats,
  };
}
```

---

## Day 3: GameContext Integration & UI

### Task 3.1: Update GameContext.tsx

Replace lines 866-878 (random soccer):

```typescript
} else if (match.sport === 'soccer') {
  // Build soccer team states
  const homeSoccerState = buildSoccerTeamState(
    match.homeTeamId,
    homeRoster,
    isUserHome ? state.userTeam.lineup.soccerLineup : undefined
  );
  const awaySoccerState = buildSoccerTeamState(
    match.awayTeamId,
    awayRoster,
    isUserAway ? state.userTeam.lineup.soccerLineup : undefined
  );

  // Simulate match
  const soccerResult = simulateSoccerMatch({
    homeTeam: homeSoccerState,
    awayTeam: awaySoccerState,
  });

  homeScore = soccerResult.homeScore;
  awayScore = soccerResult.awayScore;
  boxScore = {
    ...soccerResult.boxScore,
    halfTimeScore: soccerResult.halfTimeScore,
  };
  playByPlay = soccerResult.playByPlay;
}
```

### Task 3.2: Add buildSoccerTeamState Function

```typescript
function buildSoccerTeamState(
  teamId: string,
  roster: Player[],
  lineupConfig?: SoccerLineupConfig
): SoccerTeamState {
  const sortedRoster = [...roster].sort((a, b) => {
    // Sort by overall rating
    const overallA = Object.values(a.attributes).reduce((sum, v) => sum + v, 0) / 26;
    const overallB = Object.values(b.attributes).reduce((sum, v) => sum + v, 0) / 26;
    return overallB - overallA;
  });

  // Use config or auto-generate
  let lineup: Player[];
  let formation: string;
  let positions: Record<string, SoccerPosition>;

  if (lineupConfig && lineupConfig.starters.length >= 11) {
    lineup = lineupConfig.starters
      .slice(0, 11)
      .map(id => roster.find(p => p.id === id))
      .filter((p): p is Player => p !== undefined);
    formation = lineupConfig.formation || '4-4-2';
    positions = lineupConfig.positions as Record<string, SoccerPosition>;
  } else {
    // Auto-generate: top 11 players
    lineup = sortedRoster.slice(0, 11);
    formation = '4-4-2';
    positions = autoAssignSoccerPositions(lineup);
  }

  return {
    teamId,
    lineup,
    formation,
    positions,
    tactics: {
      attackingStyle: 'possession',
      defensiveLine: 'medium',
    },
  };
}
```

### Task 3.3: Update ConnectedMatchResultScreen.tsx

Add soccer box score display (similar to baseball):

```typescript
{/* Soccer Box Score */}
{sport === 'soccer' && showFullBoxScore && match?.result?.boxScore && (
  <>
    {/* Team Stats */}
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={styles.cardTitle}>MATCH STATS</Text>
      <StatRow label="Possession" home={boxScore.possession.home + '%'} away={boxScore.possession.away + '%'} />
      <StatRow label="Shots" home={boxScore.shots.home} away={boxScore.shots.away} />
      <StatRow label="Shots on Target" home={boxScore.shotsOnTarget.home} away={boxScore.shotsOnTarget.away} />
      <StatRow label="Corners" home={boxScore.corners.home} away={boxScore.corners.away} />
      <StatRow label="Fouls" home={boxScore.fouls.home} away={boxScore.fouls.away} />
    </View>

    {/* Player Stats - Scorers */}
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={styles.cardTitle}>SCORERS</Text>
      {events.filter(e => e.type === 'goal').map((event, i) => (
        <Text key={i} style={styles.eventRow}>
          {event.minute}' - {event.player?.name} {event.assistPlayer ? `(${event.assistPlayer.name})` : ''}
        </Text>
      ))}
    </View>
  </>
)}
```

---

## File Structure

```
src/simulation/soccer/
├── index.ts                 # Exports
├── types.ts                 # SoccerEvent, SoccerBoxScore, SoccerPlayerStats
├── constants.ts             # Attribute weights, formation modifiers
└── game/
    ├── matchSimulation.ts   # Main simulation function
    └── boxScore.ts          # Stats aggregation
```

---

## Success Criteria

1. **Day 1 Complete:** Soccer uses correct attributes, formations have effect
2. **Day 2 Complete:** Can see who scored, who assisted, player stats populated
3. **Day 3 Complete:** Full integration with GameContext, UI displays soccer box score

---

## Scope Boundaries

### IN SCOPE
- Attribute-driven results
- Player-level goal/assist attribution
- Basic formation effects (multipliers)
- Box score display (possession, shots, cards)
- Play-by-play events (goals, cards)

### OUT OF SCOPE
- Possession-by-possession simulation
- Set pieces (corners, free kicks, penalties)
- Substitutions during match
- Extra time / penalty shootouts
- In-game tactical changes
- Injuries

---

## Estimated Lines of Code

| File | Lines |
|------|-------|
| types.ts | ~60 |
| constants.ts | ~80 |
| matchSimulation.ts | ~250 |
| boxScore.ts | ~100 |
| GameContext changes | ~80 |
| UI changes | ~100 |
| **Total** | **~670 lines** |

---

## Risk Mitigation

1. **Balancing:** Start with expected goals of 1.3-1.5 per team, adjust based on testing
2. **Player attribution:** Weight heavily by position to ensure strikers score most goals
3. **Formation effects:** Keep multipliers small (5-15%) to avoid unrealistic results
