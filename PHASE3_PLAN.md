# Phase 3: AI & Season Flow - Implementation Plan

**Created:** 2025-11-21
**Status:** READY TO BEGIN
**Duration:** 4-6 weeks estimated
**Prerequisites:** Phase 1 ✅ | Phase 2 ✅ | All tests passing ✅

---

## Overview

Phase 3 transforms the Multiball project from isolated systems into a living, breathing franchise simulation. This phase adds:
- **AI team decision-making** (roster management, tactics)
- **Season scheduling and progression** (57 matches across 3 sports)
- **League standings and promotion/relegation** (Division 5 → Division 1)
- **AI vs AI match simulation** (autonomous league operation)
- **End-of-season processing** (playoffs, awards, transfers)

---

## Phase 3 Architecture

### Core Systems (4 New + Integration)

1. **AI Decision Engine** - Team personality-driven roster/tactical choices
2. **Season Manager** - Schedule generation, match progression, calendar
3. **League System** - Standings, promotion/relegation, multi-team coordination
4. **Match Orchestrator** - AI vs AI game simulation, result processing

### Integration Points

- **With Phase 1 (Basketball Sim):** Match Orchestrator uses QuarterSimulator/GameSimulator
- **With Phase 2 (Management):** AI uses Contract, Transfer, Scouting, Youth Academy, Injury, Training systems
- **With Phase 4 (UI):** Season Manager exposes state for UI rendering

---

## Technical Debt Mitigation (Week 1 Priority)

Based on Agent 10's review, address these issues BEFORE building Phase 3 systems:

### 1. Player Data Format Standardization ⚠️ MODERATE PRIORITY

**Issue:** Dual formats (nested `player.attributes.stamina` vs flat `player.stamina`)

**Action Items:**
- [ ] Create `src/types/player.ts` with canonical Player interface
- [ ] Add `normalizePlayer()` utility function:
  ```typescript
  function normalizePlayer(player: any): Player {
    if ('attributes' in player && player.attributes) return player;
    return { name: player.name, position: player.position,
             attributes: { stamina: player.stamina, ... } };
  }
  ```
- [ ] Refactor quarterSimulation.ts and substitutions.ts to use normalizer
- [ ] Update test fixtures to use nested format
- [ ] Add integration test validating both formats normalize correctly

**Estimated Time:** 3-4 hours

---

### 2. Test Coverage Improvement 📊 MODERATE PRIORITY

**Current:** 67.42% statement coverage (target: 80%)

**Action Items:**
- [ ] Generate coverage report: `npm run test:coverage`
- [ ] Identify uncovered management system functions
- [ ] Add integration tests for cross-system interactions:
  - Player Progression + Training (do gains offset regression?)
  - Injury + Substitutions (injured player removal)
  - Contract + Transfer (valuation consistency)
  - Youth Academy + Scouting (graduate quality)
- [ ] Target: 75% coverage before Phase 3 mid-point

**Estimated Time:** 6-8 hours (incremental)

---

### 3. Flaky Test Fixes 🔬 LOW PRIORITY

**Issue:** 2 probabilistic tests fail occasionally (small sample sizes)

**Action Items:**
- [ ] Update `turnovers.test.ts`: Increase iterations 100 → 1000
- [ ] Update `freeThrows.test.ts`: Increase iterations 200 → 1000
- [ ] Consider using seeded RNG for deterministic tests

**Estimated Time:** 1 hour

---

## Phase 3 Implementation Plan

### Week 1: Foundation & AI Decision Engine (Days 1-3)

**Goal:** Build AI personality system and basic decision-making

#### Day 1: AI Personality & Evaluation System
- [ ] Create `src/ai/types.ts` with AI interfaces:
  ```typescript
  type TeamPersonality = 'conservative' | 'balanced' | 'aggressive';
  type DecisionContext = { week: number, standings: Standings, finance: Budget };
  ```
- [ ] Create `src/ai/playerEvaluation.ts`:
  - `evaluatePlayer(player, position, needs)` → rating (0-100)
  - Use existing `calculateBasketballOverall()` from substitutions.ts
  - Factor in age, potential, contract length
- [ ] Tests: Player evaluation consistency

#### Day 2: AI Roster Management
- [ ] Create `src/ai/rosterDecisions.ts`:
  - `shouldReleasePlayer(player, context)` → boolean + reason
  - `shouldOfferContract(freeAgent, context)` → offer | null
  - `prioritizeScouting(context)` → positions[]
  - `shouldPromoteYouth(youthPlayer, context)` → boolean
- [ ] Integrate with Phase 2 systems (Contract, Free Agent, Scouting, Youth)
- [ ] Tests: AI decision validation (conservative vs aggressive behavior)

#### Day 3: AI Tactical Decisions
- [ ] Create `src/ai/tacticalDecisions.ts`:
  - `selectStartingLineup(roster, opponent)` → Player[5]
  - `choosePaceStrategy(context)` → 'slow' | 'normal' | 'fast'
  - `setDefenseStrategy(opponent)` → 'man' | 'zone' | 'press'
  - `allocateMinutes(roster, importance)` → Record<string, number>
- [ ] Integrate with QuarterSimulator/GameSimulator
- [ ] Tests: Tactical variation by personality

**Week 1 Deliverables:**
- ✅ AI can evaluate players and make roster decisions
- ✅ AI can select tactics based on personality + context
- ✅ 40+ tests covering AI decision logic
- ✅ Tech debt items (#1-3) addressed

---

### Week 2: Season Manager & Schedule Generation (Days 4-6)

**Goal:** Create season flow and match scheduling

#### Day 4: Season Structure
- [ ] Create `src/season/types.ts`:
  ```typescript
  interface Season {
    year: number;
    week: number; // 1-40
    division: number; // 1-5
    schedule: Match[];
    standings: TeamStanding[];
  }
  interface Match {
    week: number;
    sport: 'basketball' | 'baseball' | 'soccer';
    home: string;
    away: string;
    result?: MatchResult;
  }
  ```
- [ ] Create `src/season/scheduleGenerator.ts`:
  - `generateSeasonSchedule(teams, sports)` → Match[]
  - Algorithm: Round-robin (19 opponents × 3 sports = 57 matches)
  - Spread evenly across 40 weeks (avg 1.4 matches/week)
- [ ] Tests: Schedule validation (all teams play all opponents in all sports)

#### Day 5: Season State Management
- [ ] Create `src/season/seasonManager.ts`:
  - `advanceWeek()` → process matches, update standings, trigger events
  - `getUpcomingMatches(week)` → Match[]
  - `getCurrentStandings()` → TeamStanding[]
  - `checkPromotionRelegation()` → { promoted: Team[], relegated: Team[] }
- [ ] Integrate with Calendar system (off-season, transfer windows)
- [ ] Tests: Week progression, standings updates

#### Day 6: Match Result Processing
- [ ] Create `src/season/matchProcessor.ts`:
  - `simulateMatch(match, aiEngine)` → MatchResult
  - `updateStandings(result)` → update win/loss/points
  - `applyPostMatchEffects(result)` → injuries, stamina, morale
- [ ] Integrate with GameSimulator (basketball), placeholder for other sports
- [ ] Tests: Result consistency, standings calculation

**Week 2 Deliverables:**
- ✅ Season structure with 57-match schedule
- ✅ Week-by-week progression system
- ✅ Match simulation (basketball working, others stubbed)
- ✅ 35+ tests covering season flow

---

### Week 3: League System & Standings (Days 7-9)

**Goal:** Multi-team league management with promotion/relegation

#### Day 7: League Structure
- [ ] Create `src/league/types.ts`:
  ```typescript
  interface Division {
    level: number; // 1 (top) - 5 (bottom)
    teams: Team[]; // 20 teams per division
    season: Season;
  }
  interface League {
    divisions: Division[5];
    currentYear: number;
  }
  ```
- [ ] Create `src/league/leagueManager.ts`:
  - `initializeLeague()` → create 5 divisions with 20 teams each
  - `getTeam(teamId)` → Team + current division
  - `getAllStandings()` → Standings[5]
- [ ] Tests: League initialization, team lookup

#### Day 8: Standings & Points System
- [ ] Create `src/league/standings.ts`:
  - **Points System:** 3 points per win, 0 per loss (combined across 3 sports)
  - `calculateStandings(results)` → sorted TeamStanding[]
  - `getPromotionZone(division)` → Team[3] (top 3)
  - `getRelegationZone(division)` → Team[3] (bottom 3)
  - Handle tiebreakers (goal differential → head-to-head → random)
- [ ] Tests: Standings calculation, tiebreaker scenarios

#### Day 9: Promotion/Relegation
- [ ] Create `src/league/promotionRelegation.ts`:
  - `processEndOfSeason(league)` → { promoted, relegated, newDivisions }
  - Promote top 3 from each division (except Division 1)
  - Relegate bottom 3 from each division (except Division 5)
  - Swap teams between divisions
- [ ] Integrate with Season Manager
- [ ] Tests: Multi-season promotion/relegation chains

**Week 3 Deliverables:**
- ✅ 5-division league with 100 teams
- ✅ Combined standings across 3 sports
- ✅ Promotion/relegation mechanics
- ✅ 30+ tests covering league operations

---

### Week 4: Match Orchestrator & AI vs AI (Days 10-12)

**Goal:** Fully autonomous AI-driven matches

#### Day 10: Match Orchestrator Core
- [ ] Create `src/match/matchOrchestrator.ts`:
  - `orchestrateMatch(match, homeAI, awayAI)` → MatchResult
  - Flow:
    1. AIs select lineups
    2. AIs choose tactics
    3. Simulate game (GameSimulator with AI tactical settings)
    4. Process injuries, stamina, stats
    5. Return complete result
- [ ] Integrate with AI Decision Engine + GameSimulator
- [ ] Tests: End-to-end match flow

#### Day 11: Batch Match Simulation
- [ ] Create `src/match/batchSimulator.ts`:
  - `simulateWeek(matches, league)` → MatchResult[]
  - Parallel simulation (matches don't affect each other)
  - Progress tracking for UI
- [ ] Add performance optimization (consider Web Workers for parallel sims)
- [ ] Tests: Multi-match simulation, result consistency

#### Day 12: Match Statistics & History
- [ ] Create `src/match/matchHistory.ts`:
  - `recordMatch(result)` → save to history
  - `getTeamHistory(teamId, count)` → recent results
  - `getPlayerStats(playerId, season)` → aggregated stats
  - `getLeagueLeaders(stat, count)` → top players
- [ ] Tests: Stat aggregation, historical queries

**Week 4 Deliverables:**
- ✅ Fully autonomous AI vs AI matches
- ✅ Batch week simulation
- ✅ Match history and statistics tracking
- ✅ 25+ tests covering match orchestration

---

### Week 5: Season Progression & Events (Days 13-15)

**Goal:** Complete season loop with events and transitions

#### Day 13: Week-by-Week Events
- [ ] Create `src/season/weeklyEvents.ts`:
  - `processWeeklyMaintenance()` → injuries heal, training applies, stamina resets
  - `triggerRandomEvents()` → player morale, injuries, news
  - `processContractExpirations(week)` → expiring contracts
  - `checkTransferWindows(week)` → open/close transfer periods
- [ ] Integrate with all Phase 2 systems
- [ ] Tests: Event sequencing, system integration

#### Day 14: Off-Season Processing
- [ ] Create `src/season/offseason.ts`:
  - `processEndOfSeason(league)` → awards, promotion/relegation, contracts
  - `generateAwards(season)` → MVP, Golden Boot, etc.
  - `freeAgencyPeriod(league)` → AI teams make offers
  - `youthGraduation(league)` → promote youth players
  - `budgetAllocation(league)` → AI teams allocate budgets
  - `prepareNewSeason(league)` → reset schedules, update ages
- [ ] Tests: Full off-season cycle

#### Day 15: Season Transitions
- [ ] Create `src/season/seasonTransition.ts`:
  - `transitionToNewSeason(league)` → seamless continuation
  - Handle player aging (Player Progression System)
  - Generate new schedule
  - Reset team states (stamina, injuries)
- [ ] Tests: Multi-year progression

**Week 5 Deliverables:**
- ✅ Complete season loop (start → 40 weeks → off-season → new season)
- ✅ Weekly events and maintenance
- ✅ Off-season processing (awards, transfers, youth)
- ✅ 30+ tests covering season transitions

---

### Week 6: Integration Testing & Polish (Days 16-18)

**Goal:** Ensure all systems work together seamlessly

#### Day 16: Integration Test Suite
- [ ] Create `src/__tests__/integration/`:
  - `fullSeason.test.ts` → simulate complete 40-week season
  - `multiSeasonProgression.test.ts` → 5 seasons with promotion/relegation
  - `aiDecisionFlow.test.ts` → AI makes roster/tactical decisions
  - `crossSystemInteractions.test.ts` → injuries during matches, contracts during off-season
- [ ] Target: 100+ integration test scenarios
- [ ] Fix any integration bugs discovered

#### Day 17: Performance Optimization
- [ ] Profile season simulation speed (target: < 1 second per match)
- [ ] Optimize bottlenecks:
  - Batch database operations
  - Cache frequently accessed data (standings, rosters)
  - Consider async/await for long operations
- [ ] Add progress indicators for multi-match simulations
- [ ] Tests: Performance benchmarks

#### Day 18: Documentation & Examples
- [ ] Create `docs/PHASE3_USAGE.md`:
  - How to initialize a league
  - How to simulate a season
  - How to query standings/stats
  - AI personality customization
- [ ] Add code examples:
  - `examples/quickSimulation.ts` → simulate 1 season
  - `examples/customLeague.ts` → create custom divisions
  - `examples/aiPersonalities.ts` → configure team behaviors
- [ ] Update PROJECT_CONTEXT.md with Phase 3 completion

**Week 6 Deliverables:**
- ✅ 100+ integration tests passing
- ✅ Performance optimized (< 1s per match)
- ✅ Comprehensive documentation
- ✅ Phase 3 COMPLETE ✅

---

## Success Criteria

### Functional Requirements ✓
- [ ] AI teams make autonomous roster decisions (contracts, releases, scouting)
- [ ] AI teams choose tactics based on personality and context
- [ ] Season generates 57-match schedule (19 opponents × 3 sports)
- [ ] Matches simulate with AI vs AI (basketball working, others stubbed)
- [ ] Standings calculate correctly across 3 sports (3 pts/win)
- [ ] Promotion/relegation works (top 3 up, bottom 3 down)
- [ ] Off-season processes (awards, transfers, youth graduation, aging)
- [ ] Multi-season progression (seamless year-over-year continuation)

### Quality Requirements ✓
- [ ] 200+ Phase 3 tests passing
- [ ] 75%+ overall test coverage
- [ ] No integration bugs between Phase 1/2/3 systems
- [ ] Performance: < 1 second per match simulation
- [ ] Documentation: Usage guides and examples

### Architecture Requirements ✓
- [ ] Clean separation: AI / Season / League / Match modules
- [ ] No circular dependencies
- [ ] TypeScript strict mode compliance
- [ ] Agent 10 approval (B+ or higher grade)

---

## Risk Assessment

### HIGH RISK ⚠️
- **AI Decision Complexity:** AI making realistic roster/tactical decisions requires careful tuning
  - *Mitigation:* Start with simple heuristics, iterate based on playtesting
- **Performance at Scale:** Simulating 100 teams × 57 matches = 2,850+ simulations per season
  - *Mitigation:* Profile early, optimize bottlenecks, consider async/parallel processing

### MEDIUM RISK ⚠️
- **Schedule Generation:** Round-robin with 3 sports needs careful algorithm design
  - *Mitigation:* Start with simple algorithm, add constraints incrementally
- **Cross-System Integration:** Phase 3 touches all Phase 1/2 systems, high coupling risk
  - *Mitigation:* Use dependency injection, comprehensive integration tests

### LOW RISK ✓
- **Promotion/Relegation Logic:** Well-defined rules, straightforward implementation
- **Standings Calculation:** Simple point system (3 pts/win), low complexity

---

## Dependencies

### Phase 1 Systems (Required)
- ✅ Basketball Simulation (QuarterSimulator, GameSimulator)
- ✅ Possession Engine, Stamina, Timeouts, Substitutions

### Phase 2 Systems (Required)
- ✅ Contract System (AI uses for free agency)
- ✅ Transfer System (AI uses for transfers)
- ✅ Scouting System (AI uses for discovery)
- ✅ Youth Academy (AI uses for graduation)
- ✅ Injury System (applied during matches)
- ✅ Training System (applied weekly)
- ✅ Player Progression (aging during off-season)

### External Libraries (None New)
- TypeScript, Jest, React Native (existing)

---

## Post-Phase 3 Roadmap

### Phase 4: Mobile UI (Next)
- React Native screens: Season view, match viewer, standings
- User interaction: Manage own team, view AI teams
- Save/load functionality

### Phase 5: Multi-Sport Expansion (Future)
- Translate baseball simulator (Python → TypeScript)
- Translate soccer simulator (Python → TypeScript)
- Replace basketball-only placeholders with real simulations

---

## Notes

- **Baseball/Soccer Placeholder:** Phase 3 will stub these sports (random results) until Phase 5
- **User Team vs AI:** Phase 3 focuses on AI vs AI; Phase 4 adds user interaction
- **Mobile Performance:** Consider reducing simulation detail for mobile (e.g., skip play-by-play for AI matches)

---

**Last Updated:** 2025-11-21
**Status:** READY TO BEGIN
**Next Step:** Address technical debt (Week 1, Days 1-3) → Start AI Decision Engine
