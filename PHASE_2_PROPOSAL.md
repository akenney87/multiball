# Phase 2: Management Systems - Kickoff Proposal

**Date:** 2025-11-20
**Status:** Ready to Begin
**Estimated Duration:** 3-4 weeks (based on MVP_GAMEPLAN.md)

---

## Phase 1 Completion Summary ✅

### What We Accomplished
- ✅ **Basketball Simulation:** Fully translated from Python to TypeScript
- ✅ **Rotation System:** Priority-based substitutions working correctly (Q1/Q3 and Q2/Q4 patterns)
- ✅ **Substitution Timing:** All subs occur only during legal dead balls
- ✅ **Data Models:** Complete type definitions for all game entities
- ✅ **Game Flow:** Full 4-quarter games playable with proper timing and rules
- ✅ **No Critical Bugs:** Simulation validated and ready for integration

### Key Files Completed
```
src/
├── simulation/
│   ├── core/
│   │   ├── probability.ts        ✅ (weighted sigmoid)
│   │   ├── constants.ts          ✅ (all NBA constants)
│   │   └── types.ts              ✅ (simulation types)
│   ├── systems/
│   │   ├── shooting.ts           ✅ (shot selection, contests)
│   │   ├── defense.ts            ✅ (man/zone defense)
│   │   ├── rebounding.ts         ✅ (OREB/DREB)
│   │   ├── turnovers.ts          ✅ (TO probability)
│   │   ├── fouls.ts              ✅ (foul system)
│   │   ├── freeThrows.ts         ✅ (FT shooting)
│   │   ├── substitutions.ts      ✅ (rotation plans)
│   │   ├── staminaManager.ts     ✅ (stamina tracking)
│   │   └── gameClock.ts          ✅ (time management)
│   ├── possession/
│   │   └── possession.ts         ✅ (possession flow)
│   └── game/
│       ├── quarterSimulation.ts  ✅ (quarter logic)
│       └── gameSimulation.ts     ✅ (full game)
└── data/
    ├── types.ts                  ✅ (all data models)
    ├── storage.ts                ✅ (AsyncStorage)
    ├── validation.ts             ✅ (data validation)
    └── factories.ts              ✅ (test data)
```

---

## Phase 2 Overview: Management Systems

### Goal
Build all 10 franchise management systems that turn the basketball simulation into a complete franchise management game.

### Why This Phase Matters
The simulation is the "engine" - Phase 2 adds the "game" layer:
- Training makes players improve over time
- Contracts create financial strategy
- Scouting creates discovery and recruitment
- Youth academy provides long-term planning
- Budget allocation creates strategic tradeoffs

Without these systems, we just have a basketball simulator. With them, we have a franchise management game.

---

## Proposed Implementation Order

Based on dependencies outlined in MVP_GAMEPLAN.md (Step 2.1), I recommend this order:

### Week 1: Foundation Systems (Systems 1-3)

**Day 1-2: Budget Allocation System**
- Why first: All other systems depend on budget
- Complexity: Low (data structure + validation)
- Deliverables:
  - Budget allocation data structure
  - Radar chart data model
  - Budget validation (total ≤ 100%)
  - Budget impact calculators

**Day 3-5: Training System**
- Why second: Affects player attributes, which simulation uses
- Complexity: Medium (progression formulas)
- Deliverables:
  - Weekly training progression algorithm
  - Age-based multipliers
  - Category potentials with soft caps
  - Playing time bonus XP
  - Team-wide vs per-player logic

**Day 6-7: Contract System**
- Why third: Affects budget, needed for transfers/free agency
- Complexity: Medium (negotiation state machine)
- Deliverables:
  - Player valuation algorithm
  - Contract negotiation flow (offer → counter → accept/reject)
  - Performance bonuses, release clauses
  - Contract expiry tracking

### Week 2: Player Lifecycle Systems (Systems 4-5)

**Day 8-9: Injury System**
- Dependencies: None (standalone)
- Complexity: Low
- Deliverables:
  - Injury probability (durability-based)
  - Recovery time calculator
  - Doctor report generator
  - Medical budget impact on recovery

**Day 10-12: Player Progression System**
- Dependencies: Training system
- Complexity: High (age curves, regression, potentials)
- Deliverables:
  - Hidden category potentials
  - Soft cap progression algorithm
  - Age-based regression (after peaks)
  - Peak age determination
  - Career arc tracking

### Week 3: Economic & Recruitment Systems (Systems 6-8)

**Day 13: Revenue System**
- Dependencies: None (standalone formula)
- Complexity: Low
- Deliverables:
  - Performance-based revenue formula
  - Division multipliers
  - Weekly revenue calculator
  - Season-end bonus distribution

**Day 14-15: Free Agent System**
- Dependencies: Contract system
- Complexity: Low
- Deliverables:
  - Global free agent pool
  - Pool refresh triggers
  - Tryout system (budget-based frequency)

**Day 16-18: Scouting System**
- Dependencies: Free agent system
- Complexity: Medium (range calculations)
- Deliverables:
  - Scouting settings (budget, depth vs breadth)
  - Attribute range calculator
  - Overall sport rating ranges
  - Weekly scouting results
  - Target filtering

### Week 4: Advanced Systems + Integration (Systems 9-10)

**Day 19-21: Transfer System**
- Dependencies: Contract system, scouting
- Complexity: High (negotiation, AI participation)
- Deliverables:
  - Transfer offer data structures
  - Bid/counter negotiation flow
  - Transfer window enforcement
  - Revenue allocation
  - Basic AI transfer logic

**Day 22-24: Youth Academy System**
- Dependencies: Training system, contract system
- Complexity: Medium
- Deliverables:
  - Capacity calculator (budget-based)
  - Youth prospect generator (ages 15-18)
  - Age tracking and promotion enforcement
  - Academy training
  - Promotion/rejection workflows

**Day 25-28: Integration Testing**
- All systems working together
- Cross-system integration tests
- End-to-end flow testing
- Bug fixes

---

## Success Criteria

### Technical Metrics
- ✅ All 10 systems implemented and functional
- ✅ Systems integrate correctly with each other
- ✅ Budget constraints enforced across all systems
- ✅ Test coverage >80% for business logic
- ✅ No critical bugs (P0/P1)

### Gameplay Validation
- ✅ Player attributes improve from training over time
- ✅ Budget allocation visibly impacts system performance
- ✅ Contract negotiations feel realistic
- ✅ Injuries occur at reasonable rates
- ✅ Players have realistic career arcs (improve → peak → decline)
- ✅ Revenue increases with better performance
- ✅ Scouting provides useful information with budget tradeoffs
- ✅ Transfer system creates strategic decisions
- ✅ Youth academy provides long-term planning

### Integration Tests
- ✅ Sign free agent → plays match → earns XP → improves
- ✅ Train player → attributes improve → simulation performance improves
- ✅ Budget allocation → affects multiple systems correctly
- ✅ Contract expires → player enters free agent pool
- ✅ Youth prospect turns 19 → must be promoted or released

---

## Key Design Principles for Phase 2

### 1. Simple Defaults, Deep Customization
Every system must work with zero user input (sensible defaults) but allow deep customization for engaged users.

**Examples:**
- Training: Team-wide default OR per-athlete custom plans
- Budget: Auto-balanced allocation OR manual radar chart
- Scouting: General pool OR specific player searches with filters

### 2. Budget is the Core Constraint
Everything costs money. Strategic decisions revolve around budget allocation tradeoffs.

### 3. No Arbitrary Randomness
Like the simulation, use weighted probability formulas based on attributes and inputs.

### 4. Soft Caps, Not Hard Limits
- Player progression: Soft caps with diminishing returns (not hard walls)
- Budget: Can't exceed, but no artificial roster limits
- Youth academy: Capacity based on budget, not arbitrary number

### 5. Realistic Career Arcs
A 27-year-old player must be objectively better than the same player at 35. Age matters.

---

## Proposed Workflow

### Per-System Development Pattern
1. **Design** (30 min): Review specifications, clarify formulas
2. **Implementation** (2-4 hours): Write business logic
3. **Testing** (1 hour): Unit tests for formulas and logic
4. **Integration** (30 min): Connect to existing systems
5. **Validation** (30 min): Verify system behaves as expected

### Daily Checkpoint
- Morning: Review previous day's work
- Implementation: Build 1-2 systems
- Evening: Test and document

### Weekly Milestone
- Week 1: Foundation systems (budget, training, contracts)
- Week 2: Player lifecycle (injuries, progression)
- Week 3: Economy & recruitment (revenue, free agents, scouting)
- Week 4: Advanced systems + integration (transfers, youth academy)

---

## Questions to Resolve Before Starting

### Formula Specifications Needed

1. **Revenue Formula**
   - How does win/loss record translate to dollars?
   - What are the division multipliers?
   - Season-end prize money structure?

2. **Training Progression Formula**
   - What's the base XP gain per week?
   - How do age multipliers work? (young players improve faster)
   - What's the soft cap formula? (diminishing returns)
   - Playing time bonus formula?

3. **Player Valuation Formula**
   - How do we calculate "market value" for a player?
   - Based on: attributes? age? potential? position?

4. **Injury Probability Formula**
   - Durability attribute → injury chance
   - Is it per game? Per possession? Per match type?

5. **Youth Academy Formulas**
   - Budget → prospect quality
   - Budget → prospect quantity
   - Budget → academy capacity

6. **Scouting Range Formula**
   - Depth slider → attribute range width
   - Budget → number of simultaneous scouts
   - How accurate should "depth" be? (±5? ±10? ±15?)

### Design Decisions Needed

1. **Contract Negotiation Flow**
   - How many rounds of negotiation? (2-3 recommended)
   - What factors affect player acceptance? (wage, role, team prestige?)
   - Can negotiations fail? If so, cooldown period?

2. **Transfer Window Timing**
   - July 1 - January 1 confirmed, but...
   - Can user make offers outside window (for future windows)?
   - What happens to pending offers when window closes?

3. **Youth Academy Promotion**
   - Age 19 enforcement: promote or auto-release?
   - Can user reject prospects earlier?
   - Do rejected prospects enter free agent pool?

---

## Recommended Approach

### Option A: Start with Known Formulas (Recommended)
Begin with systems that have clear, simple formulas:
1. Budget Allocation (pure validation, no complex formulas)
2. Injury System (simple probability)
3. Free Agent System (pool management)
4. Revenue System (once formula defined)

Then tackle complex systems:
5. Training System (needs progression formula)
6. Player Progression (needs soft cap formula)
7. Scouting System (needs range formula)

**Advantage:** Build momentum with quick wins, defer complex decisions

### Option B: Define All Formulas First
Sit down and define every formula before writing any code.

**Advantage:** No interruptions during implementation
**Disadvantage:** Slower start, harder to visualize without prototypes

---

## Next Steps

### Immediate Actions

1. **Review this proposal** - Approve or request changes

2. **Answer formula/design questions** - Which ones do you want to tackle first?

3. **Choose approach** - Option A (start with simple) or Option B (define all first)?

4. **Create `src/systems/` directory** - New directory for management systems

5. **Begin with System #1** - Budget Allocation (foundation for all others)

### First System Implementation (2-3 hours)

**Budget Allocation System** (simplest, no dependencies)
- Create budget allocation data structures
- Implement validation logic (total ≤ 100%)
- Add budget impact calculators (coaching → training quality, etc.)
- Write tests
- Document

---

## Expected Outcomes

By the end of Phase 2, you'll have:
- ✅ A complete franchise management layer
- ✅ All 10 systems functional and tested
- ✅ Systems integrated with basketball simulation
- ✅ Strategic depth through budget management
- ✅ Player progression creating long-term engagement
- ✅ Recruitment systems creating roster building gameplay
- ✅ Foundation ready for Phase 3 (AI & Season Flow)

---

## Risks & Mitigations

### Risk 1: Formula Complexity Slows Progress
**Mitigation:** Start with simple placeholder formulas, refine later based on gameplay testing

### Risk 2: System Integration Issues
**Mitigation:** Incremental integration with tests after each system

### Risk 3: Scope Creep
**Mitigation:** Stick to MVP features, defer "nice-to-haves"

### Risk 4: Balancing Difficulty
**Mitigation:** Build tuning parameters into formulas (easy to adjust later)

---

## Questions?

Ready to begin Phase 2? Let me know:
1. Which approach you prefer (A or B)?
2. Which formula questions you want to tackle first?
3. Any concerns or adjustments to this plan?

Let's build the management layer! 🎮💼
