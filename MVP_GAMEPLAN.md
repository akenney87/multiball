# Multiball MVP - Comprehensive Gameplan

**Version:** 1.0
**Date:** 2025-11-17
**Status:** Planning Complete - Ready for Execution

---

## Executive Summary

This gameplan outlines the complete development strategy for the Multiball MVP - a multi-sport franchise management mobile game. The project will be executed in 5 phases over multiple sessions, with the current session (Session 1) focusing on Phase 1: Foundation.

**MVP Scope:**
- Basketball simulation (fully functional, translated from Python)
- Complete franchise management layer (10 systems)
- AI opponents with diverse personalities (5-division structure)
- React Native mobile UI (iOS + Android)
- Local storage with future cloud save architecture

**Not in MVP:** Baseball/soccer simulators (future sessions)

---

## Development Phases

### Phase 1: Foundation (Session 1 - CURRENT)
**Goal:** Translate basketball simulation to TypeScript and establish solid data foundations

**Duration:** Current session
**Active Agents:** 1, 4, 5, 10
**Completion Criteria:** Basketball sim in TypeScript producing identical results to Python

### Phase 2: Management Systems (Session 2)
**Goal:** Build all franchise management systems

**Duration:** 1 session
**Active Agents:** 2, 5, 8, 10
**Completion Criteria:** All 10 management systems functional and tested

### Phase 3: AI & Season Flow (Session 3)
**Goal:** Create living AI ecosystem and complete season loop

**Duration:** 1 session
**Active Agents:** 6, 7, 8, 10
**Completion Criteria:** Full season playable with realistic AI opponents

### Phase 4: Mobile UI (Session 4)
**Goal:** Build React Native UI for all features

**Duration:** 1 session
**Active Agents:** 3, 8, 10
**Completion Criteria:** Complete mobile app with polished UI/UX

### Phase 5: Polish & Launch Prep (Session 5)
**Goal:** Bug fixes, optimization, final testing

**Duration:** 1 session
**Active Agents:** 8, 10 (all agents for bug fixes)
**Completion Criteria:** MVP ready for TestFlight/beta

---

## Phase 1: Foundation (Current Session)

### Objectives
1. ✅ Translate basketball-sim from Python to TypeScript
2. ✅ Validate TypeScript simulation matches Python exactly
3. ✅ Define all data models for game entities
4. ✅ Set up React Native project structure
5. ✅ Establish PROJECT_CONTEXT.md as living document

### Step-by-Step Execution

#### Step 1.1: Project Setup (Week 1, Day 1)
**Owner:** You + Agent 10

**Tasks:**
- [ ] Initialize React Native project with TypeScript
- [ ] Set up project structure:
  ```
  multiball/
  ├── src/
  │   ├── simulation/        # Basketball sim (from Agent 1)
  │   ├── data/              # Data models (from Agent 5)
  │   ├── systems/           # Management systems (Phase 2)
  │   ├── ai/                # AI behavior (Phase 3)
  │   ├── ui/                # React Native components (Phase 4)
  │   └── utils/             # Shared utilities
  ├── __tests__/             # Test suite
  ├── assets/                # Images, fonts
  ├── PROJECT_CONTEXT.md     # Living context
  └── agents/                # Agent instructions (already created)
  ```
- [ ] Install dependencies:
  - React Native core
  - TypeScript
  - AsyncStorage for local storage
  - seedrandom for deterministic randomness
  - Jest for testing
- [ ] Configure TypeScript (strict mode)
- [ ] Set up Git repository

**Deliverables:**
- Working React Native project
- PROJECT_CONTEXT.md initialized
- Git repository with initial commit

---

#### Step 1.2: Data Model Definition (Week 1, Days 2-3)
**Owner:** Agent 5 + Agent 10

**Tasks:**
- [ ] Define all TypeScript interfaces (see Agent 5 instructions):
  - Player/Athlete (25 attributes, potentials, contract, injury, stats)
  - Franchise/Team (roster, budget, settings, AI personality)
  - Contract (salary, length, bonuses, clauses)
  - Season (schedule, standings, status)
  - Match (teams, sport, result)
  - Injury (type, recovery, doctor report)
  - ScoutingReport (ranges, ratings)
  - YouthProspect (academy data)
  - TransferOffer (negotiation data)
  - NewsItem (alerts/inbox)
  - GameSave (complete state)

- [ ] Implement AsyncStorage wrapper:
  - saveGame()
  - loadGame()
  - deleteGame()

- [ ] Create data migration system (for future updates)
- [ ] Implement data validation schemas
- [ ] Create test data factories

**Deliverables:**
- `src/data/types.ts` (all interfaces)
- `src/data/storage.ts` (AsyncStorage wrapper)
- `src/data/validation.ts` (validation schemas)
- `src/data/factories.ts` (test data generators)

**Validation (Agent 10):**
- All types properly documented
- No circular dependencies
- Future cloud save compatibility maintained

---

#### Step 1.3: Basketball Simulation Translation (Week 1-2, Days 4-10)
**Owner:** Agent 1 + Agent 4 + Agent 10

**Translation Order (Module-by-Module):**

**Day 4-5: Foundation Modules**
- [ ] `core/probability.ts`
  - Translate weighted_sigmoid formula
  - **Critical:** Exact precision match
  - Test: Compare outputs to Python with 6 decimal precision
- [ ] `core/types.ts`
  - Convert Python dataclasses to TypeScript interfaces
  - Align with Agent 5's Player type
- [ ] `constants.ts`
  - All attribute weight tables
  - Base rates, modifiers
  - **Verify:** Every constant matches Python

**Day 6-7: Core Systems**
- [ ] `systems/shooting.ts` (1187 lines in Python - largest module)
  - Shot selection logic
  - Contest calculations
  - Block checks
  - Test: 3PT%, shot distribution matches Python
- [ ] `systems/defense.ts`
  - Defensive assignments (man vs zone)
  - Contest distance
  - Help defense
- [ ] `systems/rebounding.ts`
  - Team rebound strength
  - OREB/DREB probability
  - Putback logic
- [ ] `systems/turnovers.ts`
  - Turnover checks
  - Type selection
  - Steal attribution

**Day 8: Secondary Systems**
- [ ] `systems/fouls.ts`
- [ ] `systems/freeThrows.ts`
- [ ] `systems/gameClock.ts`
- [ ] `systems/staminaManager.ts`
- [ ] `systems/substitutions.ts`

**Day 9: Game Flow**
- [ ] `systems/possession.ts`
  - Full possession orchestration
  - Calls shooting, rebounding, turnovers
  - Test: Possession outcomes match Python
- [ ] `systems/quarterSimulation.ts`
  - 12-minute quarter
  - Substitutions, timeouts
  - Test: Quarter scores match Python

**Day 10: Game Orchestration**
- [ ] `systems/gameSimulation.ts`
  - Full 48-minute game
  - 4 quarters with halftime
  - Test: **Full game with seed must match Python exactly**
- [ ] `systems/playByPlay.ts`
  - Narrative generation
  - Statistics tracking
- [ ] `systems/endGameModes.ts`
  - Clock management
  - Intentional fouls
- [ ] `systems/timeoutManager.ts`
- [ ] `tactical/tacticalModifiers.ts`

**Validation After Each Module (Agent 4):**
1. Unit tests comparing Python vs TypeScript outputs
2. Statistical validation (1000+ runs for probability distributions)
3. Edge case testing
4. Performance benchmarking

**Deliverables:**
- Complete `src/simulation/` directory
- `__tests__/simulation/` test suite
- Validation report confirming 100% Python parity
- Performance benchmarks

**Success Criteria (Agent 10):**
- ✅ All modules translated
- ✅ All tests passing (100% pass rate)
- ✅ Seed-based tests produce identical outputs (Python vs TypeScript)
- ✅ Statistical validation within 0.5% of NBA benchmarks
- ✅ No TypeScript compilation errors
- ✅ Performance: Full game simulation < 2 seconds on mobile

---

#### Step 1.4: Integration & Validation (Week 2, Day 11-12)
**Owner:** Agent 4 + Agent 10

**Tasks:**
- [ ] Run comprehensive validation suite:
  - 100 games with same seeds (Python vs TypeScript)
  - Verify identical: scores, box scores, play-by-play
  - Statistical analysis: points, 3PT%, FG%, rebounds, turnovers, assists
  - Edge cases: overtime, blowouts, all players fouled out

- [ ] Generate validation reports:
  - Module-by-module comparison
  - Statistical realism report (vs NBA benchmarks)
  - Performance analysis
  - Edge case coverage

- [ ] Fix any discrepancies found
- [ ] Create regression test suite for CI/CD

**Deliverables:**
- Validation report confirming 100% accuracy
- Regression test suite
- Performance optimization recommendations (if needed)

**Gate (Agent 10):**
- Translation cannot proceed to Phase 2 until validation passes 100%

---

#### Step 1.5: Phase 1 Wrap-Up (Week 2, Day 13-14)
**Owner:** Agent 10

**Tasks:**
- [ ] Update PROJECT_CONTEXT.md with Phase 1 completion status
- [ ] Document any technical debt or future optimizations
- [ ] Review Phase 1 deliverables checklist
- [ ] Prepare Phase 2 kickoff brief
- [ ] User review and sign-off

**Phase 1 Completion Checklist:**
- [ ] Basketball simulation fully functional in TypeScript
- [ ] 100% Python parity validated
- [ ] All data models defined
- [ ] AsyncStorage implemented
- [ ] Test infrastructure established
- [ ] PROJECT_CONTEXT.md updated
- [ ] No blocking issues

**Deliverables:**
- Phase 1 completion report
- Phase 2 kickoff document
- Updated PROJECT_CONTEXT.md

---

## Phase 2: Management Systems (Session 2)

### Objectives
1. Build all 10 franchise management systems
2. Integrate systems with simulation and data models
3. Establish "simple default, deep customization" UX patterns
4. Create business logic layer

### Step-by-Step Execution

#### Step 2.1: System Architecture Design (Week 3, Day 1-2)
**Owner:** Agent 2 + Agent 10

**Tasks:**
- [ ] Design system architecture document:
  - How systems interact
  - Data flow diagrams
  - Event system (for cross-system communication)
  - State management strategy

- [ ] Define interfaces between systems:
  - Training → Attributes → Simulation
  - Budget → All Systems
  - Contracts → Transfers → Free Agency
  - Season → All Time-Based Systems

- [ ] Create system implementation order (based on dependencies):
  1. Budget Allocation (foundational)
  2. Training System (affects attributes)
  3. Contract System (affects budget)
  4. Injury System (affects availability)
  5. Player Progression (attributes, age, peaks)
  6. Revenue System (affects budget)
  7. Free Agent Pool (standalone)
  8. Scouting System (uses free agents)
  9. Transfer System (uses contracts)
  10. Youth Academy (uses training, contracts)

**Deliverables:**
- System architecture document
- Interface definitions
- Implementation order plan
- Event system design

---

#### Step 2.2: Implement Core Systems (Week 3-4, Days 3-12)
**Owner:** Agent 2 + Agent 8 (testing) + Agent 10 (validation)

**Implementation Pattern (per system):**
1. Agent 2 implements business logic
2. Agent 8 writes unit tests
3. Agent 2 fixes bugs from tests
4. Agent 10 validates integration
5. Repeat for next system

**Day 3-4: Budget Allocation System**
- [ ] Implement budget allocation data structures
- [ ] Create radar chart data model
- [ ] Implement validation (total ≤ 100%, expenses ≤ budget)
- [ ] Build budget impact calculators (coaching → training quality, etc.)
- [ ] Tests: Budget constraints, allocation effects
- **Validation:** Budget cannot be exceeded

**Day 4-5: Training System**
- [ ] Implement weekly training progression algorithm
- [ ] Age-based multipliers (young players improve faster)
- [ ] Category potentials (soft caps with diminishing returns)
- [ ] Playing time bonus XP
- [ ] Team-wide vs per-player logic
- [ ] Tests: Progression formulas, soft caps, playing time bonus
- **Validation:** Training actually improves attributes noticeably

**Day 5-6: Contract System (FM-lite)**
- [ ] Implement contract data structures
- [ ] Player valuation algorithm
- [ ] Contract negotiation state machine (offer → counter → accept/reject)
- [ ] Performance bonuses, release clauses, salary increases
- [ ] Expiry tracking
- [ ] Tests: Valuation, negotiation flow, budget compliance
- **Validation:** Contracts stay within budget, expiry works

**Day 6-7: Injury System**
- [ ] Implement injury probability (durability-based)
- [ ] Injury type generator (minor/moderate/severe)
- [ ] Recovery time calculator (medical budget affects recovery)
- [ ] Doctor report generator
- [ ] Return-to-play tracking
- [ ] Tests: Probability correct, recovery time, budget impact
- **Validation:** Durability reduces injury risk, medical budget helps recovery

**Day 7-8: Player Progression System**
- [ ] Implement hidden category potentials generation
- [ ] Soft cap progression algorithm
- [ ] Age-based regression (after peak ages)
- [ ] Peak age determination (randomized within ranges)
- [ ] Career arc tracking
- [ ] Tests: Potentials work, regression works, peaks realistic
- **Validation:** 27-year-old > same player at 35

**Day 8-9: Revenue System**
- [ ] Performance-based revenue formula
- [ ] Division multipliers
- [ ] Weekly revenue calculator
- [ ] Season-end bonus distribution
- [ ] Tests: Formula correctness, division scaling
- **Validation:** Better performance = more revenue

**Day 9: Free Agent System**
- [ ] Global free agent pool management
- [ ] Pool refresh triggers (contract expiry, releases)
- [ ] Tryout system (budget-based frequency)
- [ ] Tests: Pool updates, tryout frequency
- **Validation:** Expired contracts → free agent pool

**Day 10: Scouting System**
- [ ] Scouting settings (budget allocation, depth vs breadth slider)
- [ ] Attribute range calculator (based on depth/breadth/budget)
- [ ] Overall sport rating ranges
- [ ] Weekly scouting results generator
- [ ] Target filtering system
- [ ] Tests: Range calculations, budget impact, filters work
- **Validation:** Higher depth = narrower ranges, true value within range

**Day 11: Transfer System**
- [ ] Transfer offer data structures
- [ ] Bid/counter negotiation flow
- [ ] Transfer window enforcement (July 1 - Jan 1)
- [ ] Revenue allocation (to budget or available funds)
- [ ] AI transfer initiation (basic logic)
- [ ] Tests: Negotiation flow, window enforcement, revenue
- **Validation:** Transfers only in window, fees affect budget

**Day 12: Youth Academy System**
- [ ] Academy capacity calculator (budget-based)
- [ ] Youth prospect generator (ages 15-18, higher potentials)
- [ ] Age tracking and promotion enforcement (must promote by 19)
- [ ] Academy training (default + custom)
- [ ] Promotion/rejection workflows
- [ ] Tests: Capacity, generation, age enforcement, training
- **Validation:** Budget affects capacity/quality, age 19 enforced

---

#### Step 2.3: Integration Testing (Week 4, Day 13-14)
**Owner:** Agent 8 + Agent 10

**Tasks:**
- [ ] Cross-system integration tests:
  - Training → Attributes → Simulation performance
  - Budget → Systems → Constraints
  - Contracts → Transfers → Free Agency
  - Season progression → System triggers

- [ ] End-to-end flow tests:
  - Sign free agent → plays match → earns XP
  - Train player → attributes improve → simulation performance improves
  - Budget allocation → affects multiple systems

- [ ] Edge case testing:
  - Negative budget scenarios
  - All players injured
  - Youth academy at capacity
  - Contract negotiations over budget

**Deliverables:**
- Integration test suite
- Edge case test coverage
- Bug fixes from testing

**Gate (Agent 10):**
- All 10 systems functional
- Integration tests passing
- No critical bugs

---

#### Step 2.4: Phase 2 Wrap-Up (Week 4, Day 15)
**Owner:** Agent 10

**Phase 2 Completion Checklist:**
- [ ] All 10 management systems implemented
- [ ] Systems integrate correctly
- [ ] Business logic tested (>80% coverage)
- [ ] "Simple default, deep customization" maintained
- [ ] PROJECT_CONTEXT.md updated
- [ ] Phase 3 kickoff ready

---

## Phase 3: AI & Season Flow (Session 3)

### Objectives
1. Create AI team personalities and decision-making
2. Implement season flow and schedule generation
3. Build promotion/relegation system
4. Complete game loop (season → off-season → new season)

### Step-by-Step Execution

#### Step 3.1: AI Personality Design (Week 5, Day 1-2)
**Owner:** Agent 6 + Agent 10

**Tasks:**
- [ ] Design 5+ AI personality archetypes:
  - Youth Development FC
  - Money Bags United (Big Spender)
  - Omni-Athletes Club (Multi-Sport Specialist)
  - The Fortress (Defensive Focus)
  - Data Driven FC (Moneyball)
  - + Balanced/Generic teams

- [ ] Define personality traits and impacts:
  - Budget allocation preferences
  - Transfer behavior
  - Contract negotiation style
  - Tactical preferences
  - Training focus

- [ ] Create personality distribution (per division, 20 teams)

**Deliverables:**
- AI personality system design
- 5+ personality archetypes defined
- Distribution algorithm

---

#### Step 3.2: AI Decision-Making Implementation (Week 5, Days 3-8)
**Owner:** Agent 6 + Agent 8 (testing) + Agent 10 (validation)

**Day 3-4: Transfer AI**
- [ ] Implement shouldMakeOffer() logic
- [ ] Offer amount calculation (personality-based)
- [ ] Counter-offer logic (loyalty factor)
- [ ] AI-to-AI transfer simulation
- [ ] Tests: Personality alignment, offer amounts, negotiations
- **Validation:** AI makes realistic offers based on personality

**Day 4-5: Contract Negotiation AI**
- [ ] Implement player wage demands
- [ ] AI contract offer generation
- [ ] Contract renewal decisions
- [ ] Tests: Wage formulas, renewal logic
- **Validation:** AI wages realistic, renewal decisions make sense

**Day 5-6: Tactical AI**
- [ ] Lineup selection (personality-based)
- [ ] Tactical settings selection (pace, defense, scoring options)
- [ ] Adaptation to opponent
- [ ] Tests: Lineups match personality, tactics realistic
- **Validation:** Defensive AI plays slow/defensive, etc.

**Day 6-7: Budget & Training AI**
- [ ] Budget allocation (personality-based)
- [ ] Training focus determination
- [ ] Season performance adjustments
- [ ] Tests: Allocations match personality
- **Validation:** Youth teams invest in academy, etc.

**Day 7-8: Scouting AI**
- [ ] Scouting strategy (depth vs breadth)
- [ ] Target player types (based on personality)
- [ ] Tests: Scouting aligns with personality
- **Validation:** Big Spenders scout elite players, etc.

---

#### Step 3.3: AI Team Generation (Week 5, Day 9)
**Owner:** Agent 6 + Agent 10

**Tasks:**
- [ ] Generate 100 AI teams (20 per division)
- [ ] Assign personalities (distribution algorithm)
- [ ] Generate rosters based on division quality:
  - Division 1: Attributes 60-90
  - Division 2: Attributes 50-80
  - Division 3: Attributes 40-70
  - Division 4: Attributes 30-60
  - Division 5: Attributes 20-50

- [ ] Assign budgets based on division
- [ ] Create distinct team names and colors
- [ ] Initialize AI team states

**Deliverables:**
- 100 AI teams generated
- Personality distribution applied
- Rosters balanced by division

**Validation (Agent 10):**
- Teams feel diverse
- Division quality appropriate
- Personalities distributed

---

#### Step 3.4: Season & Schedule Implementation (Week 6, Days 10-13)
**Owner:** Agent 7 + Agent 8 (testing) + Agent 10 (validation)

**Day 10: Schedule Generation**
- [ ] Implement round-robin algorithm (19 rounds, each team plays every opponent once)
- [ ] Assign sports to pairings (basketball, baseball, soccer)
- [ ] Distribute matches across 30-week calendar
- [ ] Validate schedule balance (no same opponent same day, rest days)
- [ ] Tests: Schedule completeness, balance, constraints
- **Validation:** 57 matches per team, balanced distribution

**Day 11: Season Flow State Machine**
- [ ] Implement season phases (pre → regular → post → off)
- [ ] Pre-season: User makes budget allocations
- [ ] Regular season: Matches, training, transfers
- [ ] Post-season: Calculate standings, promotion/relegation, revenue
- [ ] Off-season: Contracts expire, youth promotions, free agency
- [ ] Tests: Phase transitions, triggers work
- **Validation:** Season flows correctly, events fire

**Day 12: Combined League Table & Promotion/Relegation**
- [ ] Implement standings calculator (all 3 sports combined)
- [ ] Points system (3 points per win)
- [ ] Rank by points, then wins (tiebreaker)
- [ ] Promotion/relegation logic (top 3 up, bottom 3 down)
- [ ] Division budget adjustments (promotion bonus, relegation penalty)
- [ ] Tests: Standings correct, promotion/relegation works
- **Validation:** Top 3 promote, bottom 3 relegate

**Day 13: Revenue & Historical Records**
- [ ] Implement season-end revenue distribution
- [ ] Historical records tracking (season-by-season, all-time)
- [ ] Tests: Revenue formulas, history tracking
- **Validation:** Prize money distributed, history saved

---

#### Step 3.5: Simulation Speed Controls (Week 6, Day 14)
**Owner:** Agent 7 + Agent 10

**Tasks:**
- [ ] Implement play_next_match (full simulation)
- [ ] Implement simulate_to_end_of_week (quick sim)
- [ ] Implement simulate_to_end_of_season (quick sim)
- [ ] Generate match news and events
- [ ] Tests: All simulation modes work, results consistent
- **Validation:** User can control simulation speed

---

#### Step 3.6: Integration & Full Season Test (Week 6, Day 15)
**Owner:** Agent 8 + Agent 10

**Tasks:**
- [ ] E2E test: Complete season flow
  - Create new game → Play/simulate full season → Promotion/relegation → New season
  - Verify: All systems work together, AI participates, standings calculate, promotion works

- [ ] Bug fixes from integration testing
- [ ] Performance optimization (if needed)

**Gate (Agent 10):**
- Full season playable
- AI behaves realistically
- Promotion/relegation works
- No blocking bugs

---

#### Step 3.7: Phase 3 Wrap-Up
**Owner:** Agent 10

**Phase 3 Completion Checklist:**
- [ ] AI personalities implemented (5+)
- [ ] AI decision-making realistic
- [ ] 100 AI teams generated
- [ ] Season schedule generation works
- [ ] Season flow complete
- [ ] Promotion/relegation functional
- [ ] Historical records tracking
- [ ] Full season playable end-to-end
- [ ] PROJECT_CONTEXT.md updated

---

## Phase 4: Mobile UI (Session 4)

### Objectives
1. Design navigation structure
2. Build React Native UI for all features
3. Implement FM-style news feed
4. Create mobile-optimized layouts
5. Ensure large, touch-friendly buttons

### Step-by-Step Execution

#### Step 4.1: Navigation & Design System (Week 7, Days 1-3)
**Owner:** Agent 3 + Agent 10

**Day 1-2: Navigation Structure**
- [ ] Propose navigation options (bottom tabs, hamburger, etc.)
- [ ] Get user approval on navigation choice
- [ ] Design screen flow diagram
- [ ] Define tab structure:
  - Home/Dashboard
  - Team (roster, training, contracts)
  - Scouting (scouts, free agents, youth academy)
  - More (transfers, budget, settings, history)

**Day 3: Design System**
- [ ] Define color palette
- [ ] Typography scale (minimum 16sp body, 20sp+ headers)
- [ ] Spacing system (8pt grid)
- [ ] Button sizes (minimum 44x44pt touch targets)
- [ ] Component library structure

**Deliverables:**
- Navigation structure (approved by user)
- Design system documentation
- Component library foundation

---

#### Step 4.2: Core UI Components (Week 7, Days 4-8)
**Owner:** Agent 3 + Agent 8 (testing) + Agent 10 (validation)

**Day 4: Base Components**
- [ ] PrimaryButton, SecondaryButton (large, touch-friendly)
- [ ] Card components (MatchCard, PlayerCard, AlertCard)
- [ ] Header, BottomTabs
- [ ] Badge, ProgressBar
- [ ] Tests: Component rendering, interaction
- **Validation:** Touch targets ≥ 44pt, accessible

**Day 5: Form Components**
- [ ] Slider (for training allocation)
- [ ] RadarChart (for budget allocation)
- [ ] Dropdown, TextInput
- [ ] Tests: User interaction, state management
- **Validation:** Mobile-friendly, performant

**Day 6-8: List Components**
- [ ] PlayerList (virtualized for 50+ players)
- [ ] MatchList
- [ ] NewsFeed (FM-style with priority filters)
- [ ] ScoutReportList
- [ ] Tests: Virtualization works, performance
- **Validation:** Smooth scrolling with 50+ items

---

#### Step 4.3: Screen Implementation (Week 8-9, Days 9-18)
**Owner:** Agent 3 + Agent 8 (testing) + Agent 10 (validation)

**Day 9-10: Dashboard (Home)**
- [ ] Next match card (large, prominent)
- [ ] Budget display (always visible)
- [ ] Division/standings summary
- [ ] Critical alerts (top 3)
- [ ] Quick action buttons
- [ ] Tests: Data display, navigation
- **Validation:** Key info visible, not overwhelming

**Day 10-11: Roster View (Team Tab)**
- [ ] Default view: Player list with overall ratings per sport
- [ ] Player detail view (drill-down)
- [ ] All attributes view (drill-down from detail)
- [ ] Training management (team-wide + per-player)
- [ ] Contracts view
- [ ] Injuries view
- [ ] Tests: Navigation, drill-downs work
- **Validation:** Simple default, deep customization available

**Day 11-12: Scouting (Scouting Tab)**
- [ ] Main scouting screen (budget display, strategy slider)
- [ ] Scout players screen (search, filters)
- [ ] Scouting reports list
- [ ] Report detail view (attribute ranges, overall ratings)
- [ ] Youth academy view
- [ ] Free agents list
- [ ] Tests: Filtering, scouting reports
- **Validation:** Depth vs breadth slider intuitive

**Day 12-13: Budget Allocation**
- [ ] Radar chart interface (interactive)
- [ ] Percentage sliders
- [ ] Dollar amount display
- [ ] Validation feedback (total ≤ 100%)
- [ ] Tests: Interaction, validation
- **Validation:** Intuitive, visually clear

**Day 13-14: Transfers**
- [ ] Transfer market search
- [ ] Make offer screen (bid input, counter display)
- [ ] Incoming offers view
- [ ] Transfer history
- [ ] Tests: Offer flow, negotiation
- **Validation:** Negotiation flow clear

**Day 14-15: Contract Negotiations**
- [ ] Make contract offer screen (salary, length, bonuses, clauses)
- [ ] Counter-offer display
- [ ] Negotiation history
- [ ] Tests: Offer flow, validation
- **Validation:** FM-lite complexity achieved

**Day 15-16: Match Simulation**
- [ ] Pre-match screen (lineups, simulate vs watch buttons)
- [ ] Play-by-play viewer (watch live mode)
- [ ] Speed controls (1x, 2x, skip to end)
- [ ] Post-match summary (score, top performers, box score)
- [ ] Tests: Simulation modes, controls
- **Validation:** Both modes (quick sim, watch) work

**Day 16-17: News Feed (Inbox)**
- [ ] FM-style news feed (scrollable list)
- [ ] Priority badges (critical, important, info)
- [ ] Category filters
- [ ] News detail view
- [ ] Tests: Filtering, priority display
- **Validation:** Critical items stand out

**Day 17-18: Settings & History**
- [ ] Team customization (name, colors)
- [ ] Historical records view
- [ ] Season history
- [ ] Settings (tutorial, delete save, etc.)
- [ ] Tests: Customization saves, history displays

---

#### Step 4.4: Mobile Optimization & Accessibility (Week 9, Day 19-20)
**Owner:** Agent 3 + Agent 8 + Agent 10

**Tasks:**
- [ ] Responsive design testing (small phones to tablets)
- [ ] Accessibility audit:
  - Touch targets ≥ 44pt
  - Color contrast WCAG AA (4.5:1)
  - Screen reader labels
  - Text scaling support

- [ ] Performance optimization:
  - List virtualization verified
  - Image optimization
  - Animation performance (60fps)
  - Memory profiling

- [ ] Tests: Different screen sizes, accessibility
- **Validation:** Works on iPhone SE, Android flagship

---

#### Step 4.5: Phase 4 Wrap-Up (Week 9, Day 21)
**Owner:** Agent 10

**Phase 4 Completion Checklist:**
- [ ] Navigation structure implemented
- [ ] All screens built
- [ ] Mobile-optimized (touch-friendly)
- [ ] Accessible (WCAG AA)
- [ ] Performant (60fps, <500ms loads)
- [ ] "Simple default, deep customization" in UI
- [ ] PROJECT_CONTEXT.md updated

---

## Phase 5: Polish & Launch Prep (Session 5)

### Objectives
1. Bug fixes from end-to-end testing
2. Performance optimization
3. User onboarding/tutorial
4. Final QA pass
5. Prepare for TestFlight/beta

### Step-by-Step Execution

#### Step 5.1: End-to-End Testing (Week 10, Days 1-3)
**Owner:** Agent 8 + All Agents (bug fixes) + Agent 10 (coordination)

**Tasks:**
- [ ] Full game flow E2E tests:
  - New game → Complete season → Promotion → New season
  - Sign players → Train → Play matches → Improve
  - Scout → Transfer → Negotiate → Sign
  - Youth academy → Develop → Promote
  - Budget management across seasons

- [ ] Edge case marathon:
  - Negative budget
  - All players injured
  - Extreme attribute values
  - Rapid simulation (100 seasons)
  - App backgrounding/foregrounding
  - Storage limits

- [ ] Bug tracking and prioritization (P0/P1/P2)
- [ ] Bug fixing by relevant agents
- [ ] Regression testing

**Gate (Agent 10):**
- No P0 bugs (blockers)
- <5 P1 bugs (critical)
- Performance acceptable

---

#### Step 5.2: Performance Optimization (Week 10, Days 4-5)
**Owner:** Agent 8 + Agent 10

**Tasks:**
- [ ] Profile app performance:
  - Dashboard load time
  - Game simulation speed
  - Save/load game time
  - List scrolling performance
  - Memory usage

- [ ] Optimize bottlenecks:
  - Lazy loading
  - Memoization
  - Database query optimization
  - Image optimization
  - Bundle size reduction

- [ ] Set performance benchmarks:
  - Dashboard loads < 500ms
  - Game simulation < 2 seconds
  - Save game < 1 second
  - List scroll 60fps
  - App size < 100MB

**Validation (Agent 10):**
- All benchmarks met

---

#### Step 5.3: User Onboarding (Week 10, Days 6-7)
**Owner:** Agent 3 + Agent 10

**Tasks:**
- [ ] Design tutorial flow:
  - Welcome screen
  - Team customization (name, colors)
  - Explain multi-sport concept
  - Show dashboard tour
  - First match tutorial
  - Training tutorial
  - Budget allocation tutorial

- [ ] Implement tutorial screens
- [ ] Add skip tutorial option
- [ ] Tutorial completion tracking

**Deliverables:**
- Tutorial flow implemented
- Skippable
- Engaging

---

#### Step 5.4: Final QA Pass (Week 10, Days 8-9)
**Owner:** Agent 8 + Agent 10

**Tasks:**
- [ ] Comprehensive QA checklist:
  - All features functional
  - UI polish (no placeholder text, aligned layouts)
  - Error handling (graceful failures, user-friendly messages)
  - Accessibility
  - Performance
  - Data persistence (save/load works perfectly)

- [ ] Device testing:
  - iOS (iPhone 13, SE, Pro Max)
  - Android (Pixel, Samsung flagship)
  - Different OS versions

- [ ] Final bug fixes
- [ ] Sign-off from Agent 10

---

#### Step 5.5: Launch Preparation (Week 10, Day 10)
**Owner:** Agent 10 + You

**Tasks:**
- [ ] Prepare TestFlight/Google Play Beta:
  - App store metadata
  - Screenshots
  - Description
  - Privacy policy

- [ ] Create release notes
- [ ] Final PROJECT_CONTEXT.md update
- [ ] Archive source code
- [ ] User acceptance testing plan

**Deliverables:**
- MVP ready for beta testing
- TestFlight/Play Beta submission ready
- Documentation complete

---

## Success Metrics

### Technical Metrics
- ✅ Basketball simulation 100% Python parity
- ✅ All 10 management systems functional
- ✅ AI teams behave realistically (5+ personalities)
- ✅ Full season playable end-to-end
- ✅ UI works on iOS + Android
- ✅ Performance: Dashboard < 500ms, game sim < 2s
- ✅ Test coverage > 80%
- ✅ Zero P0 bugs, < 5 P1 bugs

### User Experience Metrics
- ✅ "Simple default, deep customization" maintained
- ✅ Intuitive navigation
- ✅ Large, touch-friendly buttons (≥ 44pt)
- ✅ Accessible (WCAG AA)
- ✅ Tutorial explains core concepts
- ✅ Users can complete a season

### Business Metrics
- ✅ MVP ready for TestFlight/beta
- ✅ Free version (1 season) functional
- ✅ Paid version (infinite seasons) unlock functional
- ✅ Architecture supports future features:
  - Cloud saves
  - Baseball/soccer simulators
  - Multiplayer

---

## Risk Management

### High-Risk Areas

**1. Python-to-TypeScript Translation**
- **Risk:** Bugs introduced during translation
- **Mitigation:** Module-by-module with parallel validation (Agent 4)
- **Contingency:** Keep Python version as reference, re-translate buggy modules

**2. Performance on Mobile**
- **Risk:** Simulation too slow, UI laggy
- **Mitigation:** Early performance testing, optimization in Phase 5
- **Contingency:** Reduce simulation detail, optimize hot paths

**3. System Integration Complexity**
- **Risk:** Systems don't integrate well, bugs at boundaries
- **Mitigation:** Agent 10 validates integration continuously
- **Contingency:** Simplify system interactions if needed

**4. Scope Creep**
- **Risk:** Feature creep delays MVP
- **Mitigation:** Agent 10 enforces scope discipline
- **Contingency:** Cut nice-to-have features, focus on core loop

### Medium-Risk Areas

**5. AI Realism**
- **Risk:** AI feels dumb or exploitable
- **Mitigation:** Agent 6 designs varied personalities, Agent 10 validates
- **Contingency:** Iterate on AI logic post-beta

**6. UI/UX on Mobile**
- **Risk:** UI doesn't feel native or is hard to use
- **Mitigation:** Agent 3 specializes in mobile-first design
- **Contingency:** User testing, iterate based on feedback

**7. Data Model Changes**
- **Risk:** Late data model changes break systems
- **Mitigation:** Agent 5 defines all models in Phase 1, migration system in place
- **Contingency:** Data migration scripts

---

## Dependencies & Blockers

### External Dependencies
- React Native framework (stable)
- AsyncStorage library (stable)
- TypeScript compiler (stable)
- Jest testing framework (stable)
- seedrandom library (for deterministic randomness)

### Internal Dependencies
- **Phase 2 depends on Phase 1:** Cannot build management systems without simulation + data models
- **Phase 3 depends on Phase 2:** AI needs management systems to make decisions
- **Phase 4 depends on Phase 2 & 3:** UI needs backend logic to display
- **Phase 5 depends on Phase 4:** Cannot polish without complete app

### Potential Blockers
- User unavailable for decisions (mitigate: Agent 10 makes reasonable assumptions, documents for later approval)
- Performance issues discovered late (mitigate: Early performance testing in Phase 1)
- Technical limitations of React Native (mitigate: Research during Phase 1)

---

## Communication Plan

### User Touchpoints
- **Phase 1 Kickoff:** Review gameplan, approve approach
- **Phase 1 Completion:** Review validation report, approve simulation
- **Phase 2 Completion:** Playtest management systems, provide feedback
- **Phase 3 Completion:** Playtest full season, validate AI behavior
- **Phase 4 Completion:** UI review, design feedback
- **Phase 5 Completion:** Final acceptance testing, launch approval

### Agent Collaboration
- **Daily:** Agents update status in PROJECT_CONTEXT.md
- **Per Module:** Agent 10 validates before moving to next
- **Per Phase:** Agent 10 conducts phase wrap-up, prepares next phase
- **Blockers:** Immediate escalation to Agent 10 → User if needed

---

## Next Steps (Immediate Actions for Current Session)

### For You (Human Developer):
1. **Review this gameplan** - Approve approach or request changes
2. **Execute Step 1.1:** Initialize React Native project
3. **Invoke Agent 5:** Define data models (Step 1.2)
4. **Invoke Agent 1 & 4:** Begin simulation translation (Step 1.3)
5. **Agent 10 monitors** all work, updates PROJECT_CONTEXT.md

### For Agents:
- **Agent 10:** Begin monitoring, prepare to update PROJECT_CONTEXT.md
- **Agent 5:** Ready to define data models when invoked
- **Agent 1:** Ready to translate basketball-sim when invoked
- **Agent 4:** Ready to validate translation when invoked

---

## Appendix: Estimated Timeline

**Optimistic Timeline:**
- Phase 1 (Foundation): 2 weeks
- Phase 2 (Management Systems): 2 weeks
- Phase 3 (AI & Season): 2 weeks
- Phase 4 (Mobile UI): 3 weeks
- Phase 5 (Polish): 1 week
- **Total: 10 weeks** (assuming full-time work)

**Realistic Timeline:**
- Phase 1: 2-3 weeks
- Phase 2: 3-4 weeks
- Phase 3: 2-3 weeks
- Phase 4: 3-4 weeks
- Phase 5: 1-2 weeks
- **Total: 11-16 weeks** (accounting for bugs, iteration)

**Note:** Timeline assumes sessions can run continuously. Actual calendar time may vary based on session availability.

---

## Conclusion

This gameplan provides a comprehensive, step-by-step roadmap for building the Multiball MVP. With 10 specialized agents, clear phases, defined deliverables, and robust quality gates (via Agent 10), the project is positioned for successful execution.

**Key Success Factors:**
1. **Agent 10's oversight** ensures quality and coherence
2. **Modular approach** reduces risk through incremental validation
3. **Clear scope boundaries** prevent feature creep
4. **Testing-first mentality** catches bugs early
5. **PROJECT_CONTEXT.md** maintains shared understanding

The MVP will deliver a unique, engaging multi-sport franchise management experience optimized for mobile. Let's build something great! 🏀⚾⚽
