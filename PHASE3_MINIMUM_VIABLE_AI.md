# Phase 3: Minimum Viable AI Definition

**Date:** 2025-11-21
**Purpose:** Define simplest possible AI decision logic for Week 1 implementation
**Philosophy:** "Works correctly" > "Feels realistic" (add sophistication in Week 6)
**Status:** COMPLETE

---

## Executive Summary

**Approach:** Pure rating-based decisions with simple thresholds
**Complexity Level:** Minimal (Week 1) → Enhanced (Week 6 polish)
**Implementation Time:** 3-4 hours per AI module

**Key Principle:** Use existing rating systems from Phase 1/2, add simple threshold logic, defer personality-driven complexity until Week 6.

---

## Design Philosophy

### Week 1 Goals (Minimum Viable)
✅ **Correctness:** AI makes legal, valid decisions
✅ **Predictability:** Decisions are deterministic and testable
✅ **Simplicity:** No complex multi-factor weighting
✅ **Integration:** Uses existing Phase 1/2 systems correctly

❌ **Deferred to Week 6:**
- Personality-driven variation (conservative/balanced/aggressive)
- Context-aware decisions (standings, budget pressure, rivalries)
- Multi-factor weighting (age + potential + contract + form)
- Realistic human-like behavior

### Rating System Foundation

**Basketball Overall Rating** (from `substitutions.ts` line 270):
```typescript
function calculateBasketballOverall(player: Player): number {
  const weights = {
    shooting: 0.25,
    defense: 0.20,
    passing: 0.15,
    rebounding: 0.15,
    ballHandling: 0.12,
    athleticism: 0.08,
    bbiq: 0.05
  };
  // Returns 0-100 score
}
```

**Week 1 AI will use this as primary decision metric.**

---

## AI Roster Management

### Function 1: `shouldReleasePlayer(player, roster, context)`

**Week 1 Logic:** Simple rating threshold
```typescript
function shouldReleasePlayer(player: Player, roster: Player[], context: DecisionContext): boolean {
  const rating = calculateBasketballOverall(player);

  // Release if rating below 60 (bottom 40% of 0-100 scale)
  if (rating < 60) return true;

  // Release if roster > 15 players and this player is in bottom 5
  if (roster.length > 15) {
    const sortedByRating = roster.sort((a, b) =>
      calculateBasketballOverall(b) - calculateBasketballOverall(a)
    );
    const playerIndex = sortedByRating.indexOf(player);
    if (playerIndex >= roster.length - 5) return true;
  }

  return false;
}
```

**Rationale:**
- 60 rating threshold = "competent" player
- Roster cap logic = prevent oversized rosters
- Ignore: Contract value, age, potential, morale (defer to Week 6)

**Edge Cases:**
- Never release below roster minimum (12 players)
- Never release during active matches (check `context.week`)

---

### Function 2: `shouldOfferContract(freeAgent, roster, context)`

**Week 1 Logic:** Rating + budget check
```typescript
function shouldOfferContract(
  freeAgent: Player,
  roster: Player[],
  context: DecisionContext
): ContractOffer | null {
  const rating = calculateBasketballOverall(freeAgent);
  const budget = context.finance.available;

  // Only consider free agents rated 65+ (top 35% of scale)
  if (rating < 65) return null;

  // Only offer if roster has space (< 15 players)
  if (roster.length >= 15) return null;

  // Calculate offer: $50k per rating point (simple linear)
  const annualSalary = rating * 50000;

  // Check budget (need 2x annual salary for safety)
  if (budget < annualSalary * 2) return null;

  return {
    playerId: freeAgent.id,
    annualSalary,
    duration: 2, // Always 2-year contracts (simple)
    bonuses: []
  };
}
```

**Rationale:**
- 65 rating threshold = "good" player worth signing
- $50k/point = simple valuation (60 rating = $3M, 80 rating = $4M)
- 2-year contracts = avoid complexity of long-term planning
- 2x budget safety = ensure can afford next season
- Ignore: Position needs, age, potential, team fit (defer to Week 6)

**Edge Cases:**
- Never offer during closed transfer window (`context.transferWindowOpen === false`)
- Never offer if budget < $500k (minimum safety threshold)

---

### Function 3: `prioritizeScouting(roster, context)`

**Week 1 Logic:** Find weakest position
```typescript
function prioritizeScouting(roster: Player[], context: DecisionContext): Position[] {
  // Count players by position
  const positionCounts = {
    PG: roster.filter(p => p.position === 'PG').length,
    SG: roster.filter(p => p.position === 'SG').length,
    SF: roster.filter(p => p.position === 'SF').length,
    PF: roster.filter(p => p.position === 'PF').length,
    C: roster.filter(p => p.position === 'C').length
  };

  // Calculate average rating by position
  const positionRatings = {
    PG: calculatePositionAverage(roster, 'PG'),
    SG: calculatePositionAverage(roster, 'SG'),
    SF: calculatePositionAverage(roster, 'SF'),
    PF: calculatePositionAverage(roster, 'PF'),
    C: calculatePositionAverage(roster, 'C')
  };

  // Prioritize positions with:
  // 1. Fewest players (< 2)
  // 2. Lowest average rating (< 65)
  const priorities = Object.entries(positionRatings)
    .filter(([pos, rating]) => positionCounts[pos] < 2 || rating < 65)
    .sort((a, b) => a[1] - b[1]) // Lowest rating first
    .map(([pos]) => pos);

  return priorities.length > 0 ? priorities : ['PG', 'SG', 'SF']; // Default fallback
}
```

**Rationale:**
- Address depth issues (< 2 players per position)
- Address quality issues (average rating < 65)
- Ignore: Upcoming free agents, budget constraints, long-term strategy (defer to Week 6)

**Edge Cases:**
- Always return at least 1 position (default to backcourt)
- Never prioritize more than 3 positions (focus scouting budget)

---

### Function 4: `shouldPromoteYouth(youthPlayer, roster, context)`

**Week 1 Logic:** Rating + age + roster space
```typescript
function shouldPromoteYouth(
  youthPlayer: Player,
  roster: Player[],
  context: DecisionContext
): boolean {
  const rating = calculateBasketballOverall(youthPlayer);
  const age = youthPlayer.age;

  // Promote if rating 65+ (ready for senior play)
  if (rating >= 65) return true;

  // Promote if age 19+ and rating 60+ (borderline, but aging out)
  if (age >= 19 && rating >= 60) return true;

  // Don't promote if roster full (15+ players)
  if (roster.length >= 15) return false;

  return false;
}
```

**Rationale:**
- 65 rating = ready for senior team
- Age 19 = last chance to promote before leaving youth system
- 60 rating at age 19 = "good enough" to avoid losing prospect
- Ignore: Potential ceiling, position needs, playing time guarantees (defer to Week 6)

**Edge Cases:**
- Never promote if roster at maximum (15 players)
- Always promote age 19 players with rating 60+ (avoid losing prospects)

---

## AI Tactical Decisions

### Function 5: `selectStartingLineup(roster, opponent)`

**Week 1 Logic:** Top 5 rated players matching positions
```typescript
function selectStartingLineup(roster: Player[], opponent: Team): Player[5] {
  // Sort roster by rating (highest first)
  const sortedRoster = roster
    .filter(p => !p.injury) // Exclude injured
    .sort((a, b) => calculateBasketballOverall(b) - calculateBasketballOverall(a));

  // Select top player for each position
  const lineup: Player[] = [];
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

  for (const pos of positions) {
    const bestAtPosition = sortedRoster.find(p =>
      p.position === pos && !lineup.includes(p)
    );
    if (bestAtPosition) lineup.push(bestAtPosition);
  }

  // Fill remaining slots with highest rated (if positions missing)
  while (lineup.length < 5) {
    const nextBest = sortedRoster.find(p => !lineup.includes(p));
    if (nextBest) lineup.push(nextBest);
    else break; // No more players available
  }

  return lineup;
}
```

**Rationale:**
- Top 5 rated = "play your best players"
- Position matching = ensure valid lineup (1 PG, 1 SG, 1 SF, 1 PF, 1 C ideal)
- Ignore: Opponent matchups, fatigue, tactical schemes (defer to Week 6)

**Edge Cases:**
- Exclude injured players (`player.injury !== null`)
- Handle rosters with position gaps (fill with best available)

---

### Function 6: `choosePaceStrategy(roster, opponent, context)`

**Week 1 Logic:** Match roster athleticism
```typescript
function choosePaceStrategy(
  roster: Player[],
  opponent: Team,
  context: DecisionContext
): 'slow' | 'normal' | 'fast' {
  // Calculate team average athleticism
  const avgAthleticism = roster.reduce((sum, p) =>
    sum + p.attributes.athleticism, 0
  ) / roster.length;

  // Simple threshold logic
  if (avgAthleticism >= 75) return 'fast';
  if (avgAthleticism <= 55) return 'slow';
  return 'normal';
}
```

**Rationale:**
- High athleticism (75+) = fast pace exploits speed advantage
- Low athleticism (55-) = slow pace reduces running
- Average athleticism (56-74) = normal pace
- Ignore: Opponent pace, score situation, stamina management (defer to Week 6)

**Edge Cases:**
- Default to 'normal' if roster empty or data missing

---

### Function 7: `setDefenseStrategy(roster, opponent, context)`

**Week 1 Logic:** Always man-to-man
```typescript
function setDefenseStrategy(
  roster: Player[],
  opponent: Team,
  context: DecisionContext
): 'man' | 'zone' | 'press' {
  // Week 1: Always use man-to-man (simplest, most common)
  return 'man';
}
```

**Rationale:**
- Man-to-man = NBA default, works in all situations
- Zone/press require tactical sophistication (defer to Week 6)
- Avoid complexity of defensive scheme selection

**Week 6 Enhancement (Placeholder):**
```typescript
// Future: Consider team defense rating, opponent shooting, etc.
const teamDefense = avgTeamAttribute(roster, 'defense');
if (teamDefense < 60) return 'zone'; // Hide weak defenders
if (opponent.pace === 'slow') return 'press'; // Force tempo
return 'man'; // Default
```

---

### Function 8: `allocateMinutes(roster, matchImportance, context)`

**Week 1 Logic:** Rating-based distribution
```typescript
function allocateMinutes(
  roster: Player[],
  matchImportance: 'low' | 'medium' | 'high',
  context: DecisionContext
): Record<string, number> {
  const minutesAllocation: Record<string, number> = {};
  const availablePlayers = roster.filter(p => !p.injury);

  // Sort by rating
  const sortedPlayers = availablePlayers.sort((a, b) =>
    calculateBasketballOverall(b) - calculateBasketballOverall(a)
  );

  // Top 5 players: 32 minutes each (starters)
  // Next 3 players: 12 minutes each (bench rotation)
  // Remaining: 4 minutes each (garbage time)

  const starters = sortedPlayers.slice(0, 5);
  const rotation = sortedPlayers.slice(5, 8);
  const deepBench = sortedPlayers.slice(8);

  starters.forEach(p => minutesAllocation[p.id] = 32);
  rotation.forEach(p => minutesAllocation[p.id] = 12);
  deepBench.forEach(p => minutesAllocation[p.id] = 4);

  return minutesAllocation;
}
```

**Rationale:**
- 32 min/starter = realistic NBA starter usage
- 12 min/rotation = meaningful bench role
- 4 min/deep bench = garbage time only
- Total = (32*5) + (12*3) + (4*N) ≈ 240 minutes (5 players × 48 min game)
- Ignore: Stamina, matchups, score situations (defer to Week 6)

**Edge Cases:**
- Adjust if fewer than 8 healthy players (increase starter minutes)
- Ignore `matchImportance` in Week 1 (all matches treated equally)

---

## Integration with Existing Systems

### Phase 1 Integration (Basketball Simulation)

**GameSimulator Usage:**
```typescript
// AI provides tactical settings to GameSimulator
const tacticalSettings: TacticalSettings = {
  lineup: selectStartingLineup(roster, opponent),
  pace: choosePaceStrategy(roster, opponent, context),
  defense: setDefenseStrategy(roster, opponent, context),
  substitutions: allocateMinutes(roster, 'medium', context)
};

const matchResult = runGameSimulation(homeTeam, awayTeam, tacticalSettings);
```

**No changes required to GameSimulator** - AI simply provides inputs that Phase 1 already accepts.

---

### Phase 2 Integration (Management Systems)

**Contract System:**
```typescript
// AI uses existing contract offer/acceptance logic
const offer = shouldOfferContract(freeAgent, roster, context);
if (offer) {
  createContractOffer(offer); // Phase 2 function
}
```

**Transfer System:**
```typescript
// AI uses existing transfer market functions
const freeAgents = getFreeAgents(); // Phase 2 function
freeAgents.forEach(fa => {
  const offer = shouldOfferContract(fa, roster, context);
  // ... process offer
});
```

**Scouting System:**
```typescript
// AI uses existing scouting priority functions
const priorities = prioritizeScouting(roster, context);
updateScoutingAssignments(priorities); // Phase 2 function
```

**Youth Academy:**
```typescript
// AI uses existing youth promotion functions
const youthPlayers = getYouthAcademyPlayers(); // Phase 2 function
youthPlayers.forEach(yp => {
  if (shouldPromoteYouth(yp, roster, context)) {
    promoteYouthPlayer(yp.id); // Phase 2 function
  }
});
```

**No changes required to Phase 2 systems** - AI uses existing APIs.

---

## Testing Strategy

### Unit Tests (Per Function)

Each AI function needs 8-12 tests covering:
1. **Happy path** - Normal decision with typical inputs
2. **Boundary conditions** - Edge of thresholds (e.g., rating exactly 60)
3. **Edge cases** - Empty rosters, budget zero, injured players
4. **Determinism** - Same inputs always produce same outputs

**Example: `shouldReleasePlayer()` tests**
```typescript
describe('shouldReleasePlayer', () => {
  it('releases player with rating < 60', () => {
    const lowRatedPlayer = createPlayer({ rating: 55 });
    expect(shouldReleasePlayer(lowRatedPlayer, roster, context)).toBe(true);
  });

  it('keeps player with rating >= 60', () => {
    const goodPlayer = createPlayer({ rating: 65 });
    expect(shouldReleasePlayer(goodPlayer, roster, context)).toBe(false);
  });

  it('releases bottom 5 when roster > 15', () => {
    const largeRoster = createRoster(16); // 16 players
    const worstPlayer = largeRoster[15]; // Lowest rated
    expect(shouldReleasePlayer(worstPlayer, largeRoster, context)).toBe(true);
  });

  it('never releases below 12 players', () => {
    const minimalRoster = createRoster(12);
    const worstPlayer = minimalRoster[11];
    expect(shouldReleasePlayer(worstPlayer, minimalRoster, context)).toBe(false);
  });
});
```

**Target:** 40+ tests for Week 1 AI module (5 tests per function × 8 functions)

---

### Integration Tests (Cross-System)

Test AI interacting with Phase 2 systems:
1. **AI Roster Cycle** - AI evaluates roster, releases 2 players, signs 2 free agents
2. **AI Scouting** - AI prioritizes positions, scouting discovers players, AI offers contracts
3. **AI Youth Management** - AI promotes youth player, youth player enters rotation
4. **AI Match Preparation** - AI selects lineup, sets tactics, match simulates successfully

**Example: AI Roster Cycle**
```typescript
it('AI makes full roster decisions', () => {
  const team = createTeamWithRoster(15); // 15 players
  const freeAgents = createFreeAgentPool(20); // 20 available

  // Step 1: Evaluate and release
  const playersToRelease = roster.filter(p => shouldReleasePlayer(p, roster, context));
  playersToRelease.forEach(p => releasePlayer(p.id));

  // Step 2: Sign free agents
  freeAgents.forEach(fa => {
    const offer = shouldOfferContract(fa, roster, context);
    if (offer) signFreeAgent(offer);
  });

  // Verify: Roster improved (higher average rating)
  const newAvgRating = calculateAverageRating(roster);
  expect(newAvgRating).toBeGreaterThan(initialAvgRating);
});
```

**Target:** 15+ integration tests for Week 1 AI module

---

## Week 6 Enhancement Plan (Deferred Features)

### Personality-Driven Variation

**Conservative AI:**
- Release threshold: 55 (keep more players)
- Contract offers: 70+ rating (only sign stars)
- Scouting: Focus on proven players (age < 28)
- Tactics: Slow pace, zone defense

**Balanced AI (Week 1 = Balanced by default):**
- Release threshold: 60
- Contract offers: 65+ rating
- Scouting: Mix of youth and experience
- Tactics: Normal pace, man defense

**Aggressive AI:**
- Release threshold: 65 (ruthless cuts)
- Contract offers: 60+ rating (sign many)
- Scouting: Focus on high-potential youth
- Tactics: Fast pace, press defense

**Implementation:** Add `personality` parameter to each function, adjust thresholds based on personality traits (youth_development_focus, spending_aggression, risk_tolerance).

---

### Context-Aware Decisions

**Standings Pressure:**
- Bottom 3 teams (relegation zone): More aggressive signings, higher risk tactics
- Top 3 teams (promotion zone): Conservative roster management, protect lead

**Budget Pressure:**
- Low budget (< $1M): Reduce contract offer amounts, prioritize free transfers
- High budget (> $10M): Increase spending aggression, sign multiple players

**Match Importance:**
- Playoffs/promotion matches: Play starters 36+ minutes, aggressive tactics
- Low-stakes matches: Rest starters, play deep bench

**Implementation:** Add `standings`, `budget`, `matchImportance` to `DecisionContext`, modify thresholds dynamically.

---

### Multi-Factor Weighting

Replace single-factor decisions (rating only) with weighted formulas:

**Contract Valuation Example:**
```typescript
// Week 1: Simple linear
const value = rating * 50000;

// Week 6: Multi-factor
const value = (
  rating * 40000 +
  (100 - age) * 5000 + // Youth premium
  potential * 10000 +   // High ceiling premium
  experienceFactor * 5000
);
```

**Implementation:** Create `calculatePlayerValue()` utility, use in all roster decisions.

---

## Implementation Checklist

### Week 1 Day 1: AI Foundation (3-4 hours)
- [ ] Create `src/ai/types.ts` (DecisionContext, TeamPersonality, etc.)
- [ ] Create `src/ai/playerEvaluation.ts` (use existing calculateBasketballOverall)
- [ ] Add 10 tests for player evaluation

### Week 1 Day 2: AI Roster Management (4-6 hours)
- [ ] Create `src/ai/rosterDecisions.ts`
- [ ] Implement shouldReleasePlayer (20 min)
- [ ] Implement shouldOfferContract (30 min)
- [ ] Implement prioritizeScouting (30 min)
- [ ] Implement shouldPromoteYouth (20 min)
- [ ] Add 25 tests for roster decisions
- [ ] Integration test: AI roster cycle

### Week 1 Day 3: AI Tactical Decisions (3-4 hours)
- [ ] Create `src/ai/tacticalDecisions.ts`
- [ ] Implement selectStartingLineup (30 min)
- [ ] Implement choosePaceStrategy (15 min)
- [ ] Implement setDefenseStrategy (10 min)
- [ ] Implement allocateMinutes (30 min)
- [ ] Add 20 tests for tactical decisions
- [ ] Integration test: AI match preparation

**Total Estimated Time:** 10-14 hours (fits within Week 1 Days 1-3 schedule)

---

## Risk Mitigation

### Risk 1: AI Makes Illegal Decisions
**Example:** AI offers contract during closed transfer window

**Mitigation:**
- Add validation checks at start of each function
- Throw errors for invalid states (fail fast)
- Add integration tests covering illegal scenarios

**Code:**
```typescript
function shouldOfferContract(player, roster, context) {
  if (!context.transferWindowOpen) {
    throw new Error('Cannot offer contract: Transfer window closed');
  }
  // ... rest of logic
}
```

---

### Risk 2: AI Creates Budget Imbalances
**Example:** AI signs 5 players in one week, bankrupts team

**Mitigation:**
- Add budget safety checks (2x annual salary requirement)
- Limit signings per week (max 2)
- Add integration test simulating budget depletion

**Code:**
```typescript
function shouldOfferContract(player, roster, context) {
  const recentSignings = getRecentSignings(context.week);
  if (recentSignings.length >= 2) return null; // Max 2 per week

  const budget = context.finance.available;
  if (budget < annualSalary * 2) return null; // Safety buffer
  // ... rest of logic
}
```

---

### Risk 3: AI Decisions Feel Robotic
**Example:** All AI teams make identical decisions

**Acceptance:** This is EXPECTED in Week 1 (minimum viable)

**Week 6 Resolution:**
- Add personality variation (conservative/balanced/aggressive)
- Add randomness (±5% variation in thresholds)
- Add context awareness (standings, rivalries)

**Not a blocker for Week 1 implementation.**

---

## Conclusion

**Verdict:** ✅ **READY FOR IMPLEMENTATION**

**Complexity Level:** LOW (rating-based thresholds)
**Implementation Time:** 10-14 hours (Week 1 Days 1-3)
**Test Coverage:** 55+ tests (40 unit + 15 integration)

**Key Success Metrics:**
- ✅ AI makes legal, valid decisions
- ✅ AI integrates with Phase 1/2 systems without modifications
- ✅ All tests pass deterministically
- ✅ No budget imbalances or illegal roster states

**Week 6 Enhancement Plan:** Add personality variation, context awareness, multi-factor weighting (4-6 hours polish time)

**Recommendation:** PROCEED WITH WEEK 1 IMPLEMENTATION AS DEFINED

---

**Document Completed By:** Phase 3 Implementation Team
**Review Status:** Ready for Week 1 Day 1 implementation
**Next Step:** Create Phase 3 Test Plan (Pre-Phase 3 Requirement #3)
