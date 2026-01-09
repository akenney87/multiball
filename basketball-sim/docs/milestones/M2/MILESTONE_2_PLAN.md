# Milestone 2 Implementation Plan

**Version:** 1.0
**Status:** IN PROGRESS
**Target:** Full 12-minute quarter simulation with stamina tracking and substitutions

---

## Executive Summary

**Objective:** Extend Milestone 1 (single possession) to simulate a complete 12-minute quarter with:
- Stamina tracking and degradation (per possession)
- Substitution system (based on stamina and minutes allocation)
- Quarter clock management (24-29 possessions based on pace)
- **Play-by-play log system** (complete narrative, USER REVIEW REQUIRED)
- Address M1 limitations (3PT% inflation, edge case bounds)
- Statistical validation (100 quarters)

**Timeline:** 27-35 hours (phased development)
**Critical Path:** Stamina → Substitutions → Integration → Validation
**Blocking Requirement:** Play-by-play log must be manually approved by user

---

## Milestone 2 Validation Gates

Before proceeding to Milestone 3, ALL must be true:

### Technical Gates
- [ ] 3PT% between 34-40% (currently 41.8-54.0% ❌)
- [ ] Overall FG% between 43-50%
- [ ] All-1 team FG% >5% (currently 0% ❌)
- [ ] Elite vs poor FG% disparity <80%
- [ ] Turnover rate 11-15%
- [ ] PPP 0.95-1.15 (currently 0.99-1.24 ✅)
- [ ] OREB% 15-40% (currently 14.7% ⚠️)
- [ ] No crashes or NaN errors
- [ ] 11/13 metrics within ±10% of NBA average
- [ ] All M1 passing tests still pass (320 unit tests)
- [ ] 100-quarter validation shows consistent statistical patterns

### User Review Gate (FINAL M2 GATE)
**Timing:** After all technical gates pass, this is the LAST step before M2 completion.

- [ ] Generate sample play-by-play logs for multiple quarters
- [ ] **User manually reviews and approves play-by-play quality** ⚠️ CRITICAL
- [ ] User confirms quarter simulation produces realistic game flow
- [ ] User confirms substitution patterns make basketball sense

**Important:** User sign-off occurs AFTER all systems are implemented, integrated, and validated. This is the final approval gate, not a mid-development checkpoint.

---

## Architecture Design

### Key Design Decisions

**Q1: When does stamina deplete?**
- **A:** After EVERY possession (not per action)
- Base cost: 0.8 stamina per possession
- Pace modifier: fast +0.3, slow -0.3
- Scoring option bonus drain: +0.2

**Q2: When do substitutions trigger?**
- **A:** Check after EVERY possession:
  1. If stamina < 60 → substitute immediately
  2. If minutes played exceeds allocation → substitute
  3. Substitute: highest stamina available player (position match preferred)

**Q3: How to calculate possession duration?**
- **A:** Average with variance:
  - Fast: 20-25 sec (avg 22.5)
  - Standard: 25-35 sec (avg 30)
  - Slow: 30-45 sec (avg 37.5)
  - Random variance: ±3 seconds

**Q4: Play-by-play format?**
- **A:** Event log structure → render to text
- Include: timestamps, score progression, substitutions, quarter summary
- Output to file: `output/quarter_playbyplay.txt`

---

## Implementation Phases

### PHASE 1: Stamina System (3-4 hours)
**Status:** 🔨 IN PROGRESS
**Priority:** HIGH (blocking all other phases)

**Deliverables:**
- `src/systems/stamina_manager.py` - StaminaTracker class
- Extend `src/core/probability.py`:
  - `calculate_stamina_cost(pace, is_scoring_option)`
  - `recover_stamina(current, minutes_on_bench)`
- `tests/test_stamina.py` - Unit tests

**Success Criteria:**
- Stamina depletion reduces attributes proportionally
- Bench recovery follows exponential curve
- All stamina values in [0, 100]

---

### PHASE 2: Substitution System (4-5 hours)
**Status:** ⏳ PENDING (awaiting Phase 1)
**Priority:** HIGH

**Deliverables:**
- `src/systems/substitutions.py` - SubstitutionManager class
- Edge case handling (all bench exhausted, position matching)
- `tests/test_substitutions.py`

**Success Criteria:**
- Substitutions occur when stamina < 60
- Minutes allocation respected (±1 min tolerance)
- No player plays >12 minutes in quarter

---

### PHASE 3: Game Clock (3-4 hours)
**Status:** ⏳ PENDING (can run parallel with Phase 1)
**Priority:** MEDIUM

**Deliverables:**
- `src/systems/game_clock.py` - GameClock class
- Possession duration calculation
- End-of-quarter logic
- `tests/test_game_clock.py`

**Success Criteria:**
- Quarter produces 21-29 possessions (pace-dependent)
- No negative time values
- Final possession logic works

---

### PHASE 4: Play-by-Play Log (6-8 hours)
**Status:** 🔨 IN PROGRESS
**Priority:** CRITICAL (USER REVIEW REQUIRED)

**Deliverables:**
- `src/systems/play_by_play.py` - PlayByPlayLogger class
- Extend `src/systems/possession.py` to emit structured events
- Quarter summary statistics
- Output to `output/quarter_playbyplay.txt`
- `tests/test_play_by_play.py`

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
Home Team: FG 12/24 (50%), 3PT 4/10 (40%), REB 8, TO 2
Leading Scorer: Stephen Curry (9 pts)
```

**Success Criteria:**
- User can read and follow entire quarter
- All possessions captured with timestamps
- Substitutions logged with reasons
- **USER MANUALLY APPROVES QUALITY** ✅

---

### PHASE 5: Quarter Simulation Integration (5-6 hours)
**Status:** ⏳ PENDING (awaiting Phases 1-4)
**Priority:** CRITICAL

**Deliverables:**
- `src/systems/quarter_simulation.py` - QuarterSimulator class
- `QuarterResult` data structure
- Integration of all subsystems
- `tests/test_quarter_simulation.py`

**Main Loop:**
1. Check substitutions (both teams)
2. Determine possession (alternate)
3. Apply stamina degradation
4. Simulate possession (using M1 systems)
5. Update score
6. Apply stamina cost
7. Recover bench stamina
8. Log play-by-play
9. Update clock
10. Update minutes played

**Success Criteria:**
- Quarter runs 24-29 possessions
- No crashes or NaN
- Stamina degrades realistically
- Score progression accurate

---

### PHASE 6: Address M1 Limitations (2-3 hours)
**Status:** ⏳ PENDING (awaiting Phase 5)
**Priority:** HIGH

**Tasks:**
1. Fix edge case bounds (`src/core/probability.py`):
   - Add 5% minimum success floor
   - Cap AttributeDiff at ±40
2. Monitor 3PT% after stamina integration
3. Tune if needed:
   - Option A: Reduce BASE_RATE_3PT (0.05 → 0.03)
   - Option B: Increase contest penalties
4. Add validation tests

**Success Criteria:**
- All-1 team scores occasionally (PPP > 0.20)
- 3PT% within 34-40% range
- No probabilities outside [0, 1]

---

### PHASE 7: M2 Validation Suite (4-5 hours)
**Status:** ⏳ PENDING (awaiting Phase 6)
**Priority:** HIGH

**Deliverables:**
- `validate_quarter_simulation.py`
- Run 100 quarters with varying compositions
- Statistical confidence intervals
- Validation report
- `demo_quarter.py` - Sample simulations

**Success Criteria:**
- 11/13 metrics within ±10% of NBA average
- All validation gates pass
- 100-quarter consistency
- No crashes

---

## File Structure (New Files)

```
simulator/
├── src/
│   ├── systems/
│   │   ├── stamina_manager.py        # Phase 1
│   │   ├── substitutions.py          # Phase 2
│   │   ├── game_clock.py             # Phase 3
│   │   ├── play_by_play.py           # Phase 4
│   │   └── quarter_simulation.py     # Phase 5
├── tests/
│   ├── test_stamina.py               # Phase 1
│   ├── test_substitutions.py         # Phase 2
│   ├── test_game_clock.py            # Phase 3
│   ├── test_play_by_play.py          # Phase 4
│   ├── test_quarter_simulation.py    # Phase 5
│   └── test_edge_cases.py            # Phase 6
├── validate_quarter_simulation.py     # Phase 7
├── demo_quarter.py                    # Phase 7
├── output/
│   └── quarter_playbyplay.txt         # Play-by-play output
└── MILESTONE_2_PLAN.md                # This file
```

---

## Risk Assessment

### RISK 1: Stamina integration breaks M1 balance
- **Likelihood:** MEDIUM
- **Impact:** HIGH
- **Mitigation:** Comprehensive unit tests, run M1 tests after integration

### RISK 2: Play-by-play narrative quality insufficient
- **Likelihood:** MEDIUM
- **Impact:** CRITICAL (blocks M2)
- **Mitigation:** Iterative review, create samples early for user feedback

### RISK 3: 3PT% inflation persists
- **Likelihood:** MEDIUM
- **Impact:** MEDIUM
- **Mitigation:** Tuning options ready (BASE_RATE, contest penalties)

### RISK 4: Substitution logic bugs
- **Likelihood:** LOW
- **Impact:** HIGH
- **Mitigation:** Edge case handling, unit tests before integration

---

## Timeline & Dependencies

**Total Estimated Time:** 27-35 hours

| Phase | Hours | Dependencies |
|-------|-------|--------------|
| 1 - Stamina | 3-4 | None |
| 2 - Substitutions | 4-5 | Phase 1 |
| 3 - Clock | 3-4 | None (parallel) |
| 4 - Play-by-Play | 6-8 | None (parallel) |
| 5 - Integration | 5-6 | Phases 1-4 |
| 6 - M1 Fixes | 2-3 | Phase 5 |
| 7 - Validation | 4-5 | Phase 6 |

**Critical Path:** Phase 1 → Phase 2 → Phase 5 → Phase 6 → Phase 7

**Parallel Development:**
- Phase 1 & 3 (independent)
- Phase 2 & 4 (independent)

---

## Task Delegation

### IMMEDIATE TASKS (Start Now)

**TASK 1 (HIGH PRIORITY - Blocking):**
- **Name:** Create stamina system (Phase 1)
- **Assignee:** Core developer
- **Deadline:** 3-4 hours
- **Deliverable:** `stamina_manager.py` with unit tests

**TASK 2 (HIGH PRIORITY - Parallel):**
- **Name:** Create play-by-play log (Phase 4)
- **Assignee:** Core developer
- **Deadline:** 6-8 hours
- **Deliverable:** `play_by_play.py` with sample output
- **NOTE:** USER REVIEW REQUIRED

**TASK 3 (MEDIUM PRIORITY - Parallel):**
- **Name:** Create game clock (Phase 3)
- **Assignee:** Core developer
- **Deadline:** 3-4 hours
- **Deliverable:** `game_clock.py`

### SEQUENTIAL TASKS

**TASK 4:** Create substitution system (Phase 2) - After TASK 1
**TASK 5:** Integrate quarter simulation (Phase 5) - After TASKS 1-4
**TASK 6:** Fix M1 limitations (Phase 6) - After TASK 5
**TASK 7:** Run validation (Phase 7) - After TASK 6

---

## Success Metrics

**M2 is complete when:**
1. All 11 technical validation gates pass ✅
2. User approves play-by-play narrative quality ✅
3. User approves quarter game flow ✅
4. 100-quarter statistical validation shows consistency ✅
5. All M1 tests still pass (no regression) ✅

**Realism Score Target:** 85%+ (improve from M1's 78%)

---

## Notes

- M1 foundation is solid (78% realism, 320 tests passing)
- Stamina integration should naturally reduce 3PT% inflation
- Play-by-play log is critical path for user sign-off
- Keep M1 balance intact while adding complexity

**Last Updated:** 2025-11-05
**Status:** Phase 1 & 4 starting now
