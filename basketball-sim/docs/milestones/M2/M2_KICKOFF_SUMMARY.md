# Milestone 2 Kickoff Summary

**Date:** 2025-11-05
**Status:** Development Started
**PM Agent:** basketball-sim-pm

---

## Executive Summary

Milestone 1 (single possession simulation) is COMPLETE and APPROVED for advancement to Milestone 2.

**M1 Achievement:**
- 78% realism score (11/13 metrics within NBA targets)
- 320 unit tests passing
- Points per possession at NBA target (1.05)
- All four core pillars validated

**M2 Objective:**
Extend single possession to full 12-minute quarter with stamina tracking, substitutions, clock management, and comprehensive play-by-play narrative.

---

## Milestone 2 Validation Gates

### Technical Gates (11 Required)
- [ ] 3PT% between 34-40% (currently 41.8-54.0% ❌)
- [ ] Overall FG% between 43-50%
- [ ] All-1 team FG% >5% (currently 0% ❌)
- [ ] Elite vs poor FG% disparity <80%
- [ ] Turnover rate 11-15%
- [ ] PPP 0.95-1.15 (currently 0.99-1.24 ✅)
- [ ] OREB% 15-40% (currently 14.7% ⚠️)
- [ ] No crashes or NaN errors
- [ ] 11/13 metrics within ±10% of NBA average
- [ ] All M1 tests still pass (320 unit tests)
- [ ] 100-quarter validation consistency

### User Review Gates (BLOCKING M2 COMPLETION)
- [ ] **Play-by-play log generated and manually approved by user** ⚠️ CRITICAL
- [ ] Quarter simulation produces realistic game flow (user confirms)
- [ ] Substitution patterns make basketball sense (user confirms)

**Target Realism Score:** 85%+ (improve from M1's 78%)

---

## Critical Issues Identified

### HIGH PRIORITY

1. **3PT% Inflation (41.8-54.0% vs 36% NBA target)**
   - Root cause: No stamina degradation reducing late-possession shooting
   - Mitigation: Stamina integration expected to naturally reduce this
   - Acceptance criteria: 34-40% range

2. **Edge Case Bounds (All-1 team produces 0% FG%)**
   - Unrealistic floor violates basketball realism
   - Fix: Implement 5% minimum success floor in probability.py
   - Required before M2 validation

3. **Play-by-Play Log System (USER SIGN-OFF REQUIRED)**
   - BLOCKING requirement for M2 completion
   - User must manually review and approve narrative quality
   - Priority: Start immediately, allow iteration time

### MEDIUM PRIORITY

4. **OREB% at 14.7% (NBA: 22-28%)**
   - Slightly below target
   - Expected to improve with stamina (tired players box out worse)
   - Monitor during M2 validation

---

## Implementation Plan (7 Phases)

### PHASE 1: Stamina System (3-4 hours) 🔨 IN PROGRESS
**Status:** STARTED
**Priority:** HIGH (blocking)
**Files Created:**
- `src/systems/stamina_manager.py` (stub with TODOs)

**Deliverables:**
- StaminaTracker class
- calculate_stamina_cost() - per-possession depletion
- recover_stamina() - exponential bench recovery
- Unit tests (tests/test_stamina.py)

**Key Design:**
- Base cost: 0.8 stamina per possession
- Pace modifier: fast +0.3, slow -0.3
- Scoring option drain: +0.2
- Recovery: 8 * (1 - current/100) per minute

---

### PHASE 2: Substitution System (4-5 hours) ⏳ PENDING
**Status:** Awaiting Phase 1
**Priority:** HIGH
**Files Created:**
- `src/systems/substitutions.py` (stub with TODOs)

**Deliverables:**
- SubstitutionManager class
- check_substitution_needed() - trigger logic
- select_substitute() - position matching, stamina-based
- Unit tests (tests/test_substitutions.py)

**Key Logic:**
- Substitute if stamina < 60 (immediate)
- Substitute if minutes > allocation
- Position compatibility: PG↔SG, SF↔PF, C isolated

---

### PHASE 3: Game Clock (3-4 hours) ⏳ PENDING
**Status:** Can run parallel with Phase 1
**Priority:** MEDIUM
**Files Created:**
- `src/systems/game_clock.py` (stub with TODOs)

**Deliverables:**
- GameClock class
- calculate_possession_duration() - pace-based variance
- End-of-quarter logic
- Unit tests (tests/test_game_clock.py)

**Key Targets:**
- Fast pace: 27-29 possessions per quarter
- Standard: 24-26
- Slow: 21-23

---

### PHASE 4: Play-by-Play Log (6-8 hours) 🔨 IN PROGRESS
**Status:** STARTED (CRITICAL PATH)
**Priority:** CRITICAL (USER REVIEW REQUIRED)
**Files Created:**
- `src/systems/play_by_play.py` (stub with TODOs)

**Deliverables:**
- PlayByPlayLogger class
- QuarterStatistics tracking
- render_to_text() - complete narrative
- write_to_file() - output to .txt
- Unit tests (tests/test_play_by_play.py)

**Output Format:**
```
==================================================
1ST QUARTER - HOME vs AWAY
==================================================

[11:45] Home possession (Score: 0-0)
Stephen Curry attempts a 3-pointer. Contested by Kawhi Leonard.
CURRY MAKES IT! +3
Assist: Draymond Green
Score: 3-0

[10:32] Substitution: Kyle Lowry OUT (stamina: 58) → Bench Player X IN

... (25 possessions) ...

==================================================
1ST QUARTER COMPLETE
==================================================

FINAL SCORE: HOME 30, AWAY 26

QUARTER STATISTICS:
Home: FG 12/24 (50%), 3PT 4/10 (40%), REB 8, TO 2
Leading Scorer: Stephen Curry (9 pts)
```

**USER REVIEW CHECKPOINT:** Sample outputs must be approved before integration

---

### PHASE 5: Quarter Simulation Integration (5-6 hours) ⏳ PENDING
**Status:** Awaiting Phases 1-4
**Priority:** CRITICAL
**Files Created:**
- `src/systems/quarter_simulation.py` (stub with TODOs)

**Deliverables:**
- QuarterSimulator class
- QuarterResult data structure
- Main loop integrating all subsystems
- Unit tests (tests/test_quarter_simulation.py)

**Main Loop (10 steps):**
1. Check substitutions
2. Determine possession (alternate)
3. Apply stamina degradation
4. Simulate possession (M1 systems)
5. Update score
6. Apply stamina cost
7. Recover bench stamina
8. Log play-by-play
9. Update clock
10. Update minutes played

---

### PHASE 6: M1 Limitations Fix (2-3 hours) ⏳ PENDING
**Status:** Awaiting Phase 5
**Priority:** HIGH

**Tasks:**
1. Add 5% minimum success floor (src/core/probability.py)
2. Cap AttributeDiff at ±40
3. Monitor 3PT% after stamina integration
4. Tune if needed (BASE_RATE or contest penalties)
5. Add edge case validation tests

**Success Criteria:**
- All-1 team scores occasionally (PPP > 0.20)
- 3PT% within 34-40%
- No probabilities outside [0, 1]

---

### PHASE 7: M2 Validation Suite (4-5 hours) ⏳ PENDING
**Status:** Awaiting Phase 6
**Priority:** HIGH

**Deliverables:**
- validate_quarter_simulation.py
- Run 100 quarters with varying compositions
- Statistical confidence intervals
- Validation report
- demo_quarter.py (sample simulations)

**Success Criteria:**
- 11/13 metrics within ±10% of NBA average
- All validation gates pass
- 100-quarter consistency
- No crashes or NaN errors

---

## File Structure Created

```
simulator/
├── src/
│   ├── systems/
│   │   ├── stamina_manager.py        ✅ STUB CREATED (Phase 1)
│   │   ├── substitutions.py          ✅ STUB CREATED (Phase 2)
│   │   ├── game_clock.py             ✅ STUB CREATED (Phase 3)
│   │   ├── play_by_play.py           ✅ STUB CREATED (Phase 4)
│   │   └── quarter_simulation.py     ✅ STUB CREATED (Phase 5)
├── tests/
│   ├── test_stamina.py               ⏳ TO CREATE (Phase 1)
│   ├── test_substitutions.py         ⏳ TO CREATE (Phase 2)
│   ├── test_game_clock.py            ⏳ TO CREATE (Phase 3)
│   ├── test_play_by_play.py          ⏳ TO CREATE (Phase 4)
│   ├── test_quarter_simulation.py    ⏳ TO CREATE (Phase 5)
│   └── test_edge_cases.py            ⏳ TO CREATE (Phase 6)
├── output/                            ✅ DIRECTORY CREATED
│   └── quarter_playbyplay.txt         ⏳ OUTPUT TARGET
├── demo_quarter.py                    ✅ DEMO SCRIPT CREATED
├── validate_quarter_simulation.py     ⏳ TO CREATE (Phase 7)
├── MILESTONE_2_PLAN.md                ✅ PLAN DOCUMENT CREATED
└── M2_KICKOFF_SUMMARY.md              ✅ THIS FILE
```

---

## Timeline & Dependencies

**Total Estimated Time:** 27-35 hours

| Phase | Hours | Status | Dependencies |
|-------|-------|--------|--------------|
| 1 - Stamina | 3-4 | 🔨 STARTED | None |
| 2 - Substitutions | 4-5 | ⏳ PENDING | Phase 1 |
| 3 - Clock | 3-4 | ⏳ PENDING | None (parallel) |
| 4 - Play-by-Play | 6-8 | 🔨 STARTED | None (parallel) |
| 5 - Integration | 5-6 | ⏳ PENDING | Phases 1-4 |
| 6 - M1 Fixes | 2-3 | ⏳ PENDING | Phase 5 |
| 7 - Validation | 4-5 | ⏳ PENDING | Phase 6 |

**Critical Path:** Phase 1 → Phase 2 → Phase 5 → Phase 6 → Phase 7

**Parallel Development:**
- Phase 1 & 3 (independent)
- Phase 2 & 4 (independent after Phase 1 starts)

**Recommended Schedule:**
- **Week 1:** Phases 1-4 (parallel development)
- **Week 2:** Phases 5-7 (sequential integration & validation)

---

## Risk Assessment

### RISK 1: Stamina integration breaks M1 balance
- **Likelihood:** MEDIUM
- **Impact:** HIGH (could destabilize shooting percentages)
- **Mitigation:** Comprehensive unit tests, run M1 tests after integration

### RISK 2: Play-by-play narrative quality insufficient (user rejects)
- **Likelihood:** MEDIUM
- **Impact:** CRITICAL (blocks M2 completion)
- **Mitigation:** Iterative review, create samples early for user feedback

### RISK 3: 3PT% inflation persists after stamina
- **Likelihood:** MEDIUM
- **Impact:** MEDIUM (validation gate fails)
- **Mitigation:** Tuning options ready (BASE_RATE, contest penalties)

### RISK 4: Substitution logic causes crashes
- **Likelihood:** LOW
- **Impact:** HIGH (simulation crashes)
- **Mitigation:** Edge case handling, unit tests before integration

---

## Immediate Next Steps (ACTIONABLE)

### TASK 1 (HIGH PRIORITY - BLOCKING)
**Name:** Implement Stamina System (Phase 1)
**Assignee:** Core developer
**Status:** Stub created, ready for implementation
**File:** `src/systems/stamina_manager.py`
**Deadline:** 3-4 hours
**Deliverables:**
- Implement calculate_stamina_cost()
- Implement recover_stamina()
- Implement StaminaTracker class
- Create tests/test_stamina.py
- Run unit tests to verify

**Reference:** basketball_sim.md Section 11 (Stamina System)

---

### TASK 2 (HIGH PRIORITY - PARALLEL)
**Name:** Implement Play-by-Play Log System (Phase 4)
**Assignee:** Core developer
**Status:** Stub created, ready for implementation
**File:** `src/systems/play_by_play.py`
**Deadline:** 6-8 hours
**Deliverables:**
- Implement PlayByPlayLogger class
- Implement QuarterStatistics tracking
- Implement render_to_text() with proper formatting
- Create sample output files
- **OBTAIN USER REVIEW AND APPROVAL** ⚠️

**Reference:** BACKLOG.md Section 9 (Play-by-Play Log System)

---

### TASK 3 (MEDIUM PRIORITY - PARALLEL)
**Name:** Implement Game Clock System (Phase 3)
**Assignee:** Core developer
**Status:** Stub created, ready for implementation
**File:** `src/systems/game_clock.py`
**Deadline:** 3-4 hours
**Deliverables:**
- Implement calculate_possession_duration()
- Implement GameClock class
- Create tests/test_game_clock.py
- Verify possession count targets (21-29 per quarter)

---

## Success Metrics

**M2 is complete when ALL of the following are true:**

1. ✅ All 11 technical validation gates pass
2. ✅ User approves play-by-play narrative quality
3. ✅ User approves quarter game flow realism
4. ✅ User approves substitution patterns
5. ✅ 100-quarter statistical validation shows consistency
6. ✅ All M1 tests still pass (no regression)
7. ✅ Realism score improves to 85%+ (from M1's 78%)

---

## PM Assessment

**ALIGNMENT CHECK:** ✅ APPROVED

M2 architecture honors all four core pillars:
- **Deep/Realistic:** Stamina degradation adds biological realism, quarter flow mirrors real basketball
- **Weighted Dice-Roll:** No new random generation, all stamina/substitution logic attribute-driven
- **Attribute-Driven:** Stamina degradation applies to all 25 attributes proportionally
- **Tactical Input:** Minutes allocation finally utilized, tactical settings drive substitution timing

**REALISM PROJECTION:** This architecture WILL produce realistic basketball quarters if implemented according to spec.

**CRITICAL SUCCESS FACTORS:**
1. Stamina integration MUST NOT destabilize M1 balance
2. Play-by-play MUST be readable and engaging (user sign-off non-negotiable)
3. 3PT% MUST come down to 34-40% (monitor continuously, tune aggressively)
4. Edge case bounds MUST be fixed (all-1 team scoring 0 points is unacceptable)

**RECOMMENDATION:** Execute with discipline. Phase 1 and Phase 4 are the critical path. Start both immediately, with Phase 4 getting early user feedback iterations.

---

**Last Updated:** 2025-11-05
**Next Review:** After Phase 1 completion (stamina system)
**PM Agent:** basketball-sim-pm (ready for phase reviews)
