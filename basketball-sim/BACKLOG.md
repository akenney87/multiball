# Feature Backlog

Features and enhancements deferred for future milestones.

---

## Milestone 2 Priorities (Quarter Simulation)

**Target:** Full 12-minute quarter with stamina tracking and substitutions
**Status:** Next in development queue
**Completion Date:** TBD

### High Priority - Must Address

#### 1. 3PT% Calibration
**Priority:** HIGH
**Current State:** 41.8-54.0% (NBA target: 36%)
**Gap:** +5.8% to +18% above target

**Action Items:**
- Monitor 3PT% after stamina integration (fatigue may naturally reduce shooting %)
- If still >40%, consider:
  - Option A: Reduce BASE_RATE_3PT from 0.05 to 0.03-0.04
  - Option B: Increase contest penalties (make contests more effective)
  - Option C: Adjust shot selection weights to favor less-optimal shots when fatigued
- Run 100-quarter validation to establish statistical confidence
- Target: 34-40% range (within 5% of NBA average)

**Success Criteria:** 3PT% between 34-40% over 100+ quarters

#### 2. Edge Case Bounds
**Priority:** HIGH
**Current State:** All-1 team produces 0% FG% (unrealistic floor)

**Action Items:**
- Implement minimum success floor (5%) for all shot types
- Add composite difference capping (±40 max) to prevent extreme sigmoid outputs
- Test extreme attribute disparities (1 vs 99, 99 vs 1)
- Validate that poor teams still score occasionally (prevents 0-120 blowouts)

**Success Criteria:** All-1 team achieves 5-10% FG%, scores 0.20+ PPP

#### 3. Stamina System Integration
**Priority:** HIGH (core M2 requirement)
**Current State:** Stamina tracking exists but not integrated into quarter flow

**Action Items:**
- Implement per-possession stamina depletion (based on pace, minutes played)
- Apply stamina degradation formula to all 25 attributes
- Implement substitution logic (based on stamina thresholds and minutes allocation)
- Track stamina recovery on bench (exponential curve)
- Validate that fatigue affects late-game shooting percentages
- Monitor if stamina naturally reduces 3PT% inflation

**Success Criteria:** Players show observable performance degradation at <60 stamina, substitution patterns realistic

### Medium Priority - Should Address

#### 4. Shot Selection Logic (Prevent Bad Shooters from Taking 3PT)
**Priority:** MEDIUM
**Current State:** All players attempt 3PT shots regardless of ability
**Impact:** Overall 3PT% runs 5-10% lower than NBA averages (~25% vs ~35% NBA)

**Rationale:**
- In NBA, bad 3PT shooters rarely attempt 3PT shots
- Without shot selection logic, simulator allows bad shooters to take 3PT attempts
- This depresses league-wide 3PT% below realistic levels
- Current behavior is technically realistic for "what would happen if bad shooters took 3s"
- Need to add logic to weight shot selection by player shooting ability

**Action Items:**
- Add 3PT shooting composite to shot selection weights
- Reduce 3PT attempt rate for players with composite <45
- Increase 3PT attempt rate for players with composite >65
- Validate that bad shooters (<45 composite) take <5% of team's 3PT attempts
- Monitor impact on league-wide 3PT% (should increase 5-10% to ~30-35%)

**Success Criteria:** League-wide 3PT% increases to 30-35%, elite shooters take 3x more 3PT attempts than poor shooters

#### 5. Contest Frequency Tuning
**Priority:** MEDIUM
**Current State:** Wide variance in shooting % between matchups (41.8% vs 54.0%)

**Action Items:**
- Analyze contest distance distribution (are too many shots wide open?)
- Consider increasing base contest aggressiveness for elite defenders
- Review help defense rotation rates (should be more frequent)
- Adjust zone defense contest penalties if needed

**Success Criteria:** Shooting % variance reduced to <10% between matchup types

#### 5. Shot Distribution Refinement
**Priority:** MEDIUM
**Current State:** 44% 3PT / 22% mid / 34% rim (target: 40/20/40)

**Action Items:**
- Increase rim attempt rate for athletic players
- Adjust transition shot selection weights if needed
- Review elite shooter 3PT% preference (may be too conservative)

**Success Criteria:** Shot distribution within ±5% of 40/20/40 target

#### 6. Quarter Clock Management
**Priority:** MEDIUM (core M2 requirement)
**Current State:** Not yet implemented

**Action Items:**
- Implement 12-minute quarter clock
- Calculate possession count based on pace (fast: ~27-29, standard: ~24-26, slow: ~21-23)
- Track time remaining (affects urgency, shot selection in final minute)
- Implement end-of-quarter logic (possession cut-off, final shot attempts)

**Success Criteria:** Quarter produces realistic possession counts and game flow

### Low Priority - Nice to Have

#### 7. Assist Rate Tuning
**Priority:** LOW
**Current State:** 70.2% (NBA target: 55-70%, on high end)

**Action Items:**
- Review assist probability by shot type (may be too generous)
- Consider reducing teamwork weight in assist calculations
- Monitor in M2 to see if still elevated

**Success Criteria:** Assist rate 60-68%

#### 8. Advanced Play-by-Play
**Priority:** LOW
**Current State:** Basic text generation working

**Action Items:**
- Add more descriptive shot location text ("from the corner", "at the elbow")
- Include defensive effort descriptions ("smothering defense", "late rotation")
- Generate momentum-based commentary

**Success Criteria:** Play-by-play reads like ESPN game summaries

#### 9. Play-by-Play Log System
**Priority:** HIGH (core M2 requirement)
**Current State:** Basic play-by-play exists for single possessions
**Timing:** Build during M2 development, **USER REVIEW AT END** (final M2 gate)

**Action Items:**
- Extend play-by-play to cover full quarter (all possessions)
- Include substitution events ("Player X checks in for Player Y at 8:32 remaining")
- Track score progression after each possession
- Include quarter summary statistics (team totals, leaders, etc.)
- Format for readability (proper line breaks, sections)
- Output to file (quarter_playbyplay.txt or similar)
- Include timestamp/game clock for each event

**Success Criteria:**
- User can read and follow entire quarter narrative
- All possession outcomes captured
- Substitutions logged clearly
- Score progression accurate

**User Sign-Off Required:** After all M2 systems are working and validated, generate sample play-by-play logs. User must manually review and approve play-by-play quality as the FINAL gate before M2 is considered complete.

### Validation Gates for M2

Before proceeding to Milestone 3:
- ✅ 3PT% between 34-40% (within 10% of NBA)
- ✅ Overall FG% between 43-50%
- ✅ All-1 team FG% >5%
- ✅ Elite vs poor FG% disparity <80%
- ✅ Turnover rate 11-15%
- ✅ PPP 0.95-1.15
- ✅ No crashes or NaN errors
- ✅ 11/13 metrics within ±10% of NBA average
- ✅ All M1 passing tests still pass
- ✅ 100-quarter validation shows consistent statistical patterns
- ✅ **Play-by-play log generated and manually approved by user**

---

## Milestone 3+ Features

### Timeout System
**Priority:** Medium
**Target Milestone:** 3 (Full Game)

**Description:**
Implement timeout mechanics including:
- Timeout allocation (7 per team: 4 in first half, 3 in second, max 3 per quarter)
- Post-timeout effects:
  - Temporary attribute boosts (+8 composure, +5 awareness, +3 teamwork for 3 possessions)
  - ATO (After TimeOut) play quality bonus
  - Defensive adjustment capability (±20% man/zone shift for next 5 possessions)
- User decision prompts at logical moments:
  - Trailing by 8+ points
  - After 6+ opponent points in a row
  - Stamina below 60 for scoring option #1
- Momentum break mechanics (interrupt opponent "hot hand" states)

**Rationale:**
Timeouts are a multi-possession feature requiring full game context. Not applicable to single-possession (M1) or quarter-level (M2) simulations. Natural integration point is when full 48-minute game flow is established.

**Data Structure Considerations:**
- `timeouts_remaining` field in team data
- `post_timeout_bonus` flag in PossessionContext
- Consider adding these as stubs in Milestone 2 to avoid future refactoring

**References:**
- Agent analysis: basketball-sim-pm (2025-11-04)

---

## Future Considerations

(Features not yet scoped or prioritized)

### Advanced Tactical Systems
- In-game defensive scheme adjustments
- Play-calling system
- Matchup-specific defensive assignments

### Coaching Layer
- Coach attributes affecting timeout effectiveness
- Halftime/quarter-break adjustments
- Coaching strategy AI

### Extended Simulation Features
- Shot clock violations
- Foul system and free throws
- Advanced player states (hot hand, cold streak)
- Detailed play-by-play commentary system
