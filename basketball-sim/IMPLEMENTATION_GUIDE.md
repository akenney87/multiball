# Milestone 1 Implementation Guide

Detailed specifications for implementing remaining systems.

---

## OVERVIEW

**Foundation Status:** COMPLETE
- Core probability engine (weighted sigmoid, composites, stamina)
- Data structures (PossessionContext, TacticalSettings, PossessionResult)
- Constants (all BaseRates, weights, modifiers)
- Sample teams (6 archetypes with extreme attribute profiles)

**Remaining Work:** 10 tasks across 4 phases

---

## PHASE 2: GAME MECHANICS

### TASK 1: Shooting System (systems/shooting.py)

**Estimated Time:** 6-8 hours

**Dependencies:**
- `src/core/probability.py` (weighted_sigmoid_probability, calculate_composite)
- `src/constants.py` (WEIGHTS_3PT, WEIGHTS_MIDRANGE, etc.)

**Required Functions:**

#### 1.1 Shot Type Selection

```python
def select_shot_type(
    shooter: Dict[str, Any],
    tactical_settings: TacticalSettings,
    defense_type: str  # 'man' or 'zone'
) -> str:
    """
    Determine shot type using weighted distribution.

    Returns: '3pt', 'midrange_short', 'midrange_long', or 'rim'

    Algorithm:
    1. Start with baseline (40% 3pt, 20% mid, 40% rim)
    2. Apply player modifiers (±5% based on shooting strengths)
    3. Apply tactical modifiers (±10% from pace/strategy)
    4. If zone defense: +5% to 3PT
    5. Normalize to 100%
    6. Weighted random selection
    """
```

**Player Modifiers Logic:**
- Calculate shooter's 3PT composite vs midrange composite vs rim composite
- If 3PT composite > 80: +5% to 3PT attempts
- If rim composite > 80: +5% to rim attempts
- Adjust proportionally

**Tactical Modifiers:**
- Fast pace: +5% rim (transition opportunities)
- Slow pace: +5% midrange (halfcourt sets)

#### 1.2 Three-Point Shot

```python
def attempt_3pt_shot(
    shooter: Dict[str, Any],
    defender: Dict[str, Any],
    contest_distance: float,
    is_transition: bool = False
) -> Tuple[bool, Dict[str, Any]]:
    """
    Simulate 3PT shot attempt with full debug output.

    Returns:
        (success: bool, debug_info: dict)

    Two-Stage Process:
    1. Base success from shooter composite vs defender composite
    2. Apply contest penalty based on distance + defender quality

    Debug Info Must Include:
    - shooter_composite
    - defender_composite
    - attribute_diff
    - base_success_rate (before contest)
    - contest_penalty
    - final_success_rate
    - actual_roll
    - transition_bonus (if applicable)
    """
```

**Implementation Details:**
1. Calculate shooter composite using WEIGHTS_3PT
2. Calculate defender composite using WEIGHTS_CONTEST
3. Apply weighted_sigmoid_probability with BASE_RATE_3PT
4. Calculate contest penalty (see function 1.5)
5. If is_transition: Add TRANSITION_BONUS_3PT
6. Clamp final probability to [0, 1]
7. Roll success

#### 1.3 Midrange Shot

```python
def attempt_midrange_shot(
    shooter: Dict[str, Any],
    defender: Dict[str, Any],
    contest_distance: float,
    range_type: str,  # 'short' or 'long'
    is_transition: bool = False
) -> Tuple[bool, Dict[str, Any]]:
    """
    Similar to 3PT but with range-dependent BaseRate.

    BaseRate:
    - short (10-16 ft): 0.45
    - long (16-23 ft): 0.37
    """
```

#### 1.4 Rim Attempt (Dunk or Layup)

```python
def attempt_rim_shot(
    shooter: Dict[str, Any],
    defender: Dict[str, Any],
    contest_distance: float,
    attempt_type: str,  # 'dunk' or 'layup'
    is_transition: bool = False
) -> Tuple[bool, Dict[str, Any]]:
    """
    Rim attempt with type-specific composites.

    Dunk: WEIGHTS_DUNK, BASE_RATE_DUNK (0.80)
    Layup: WEIGHTS_LAYUP, BASE_RATE_LAYUP (0.62)
    """
```

**Dunk vs Layup Selection:**
- Calculate both dunk and layup composites
- If dunk_composite > layup_composite + 15: choose dunk
- Else: choose layup
- Exception: If height < 70 and jumping < 70: force layup (can't dunk)

#### 1.5 Contest Penalty Calculator

```python
def calculate_contest_penalty(
    contest_distance: float,
    defender_composite: float
) -> float:
    """
    Calculate shot contest penalty (Section 4.5).

    Distance Tiers:
    - >= 6.0 ft: Wide open (0% penalty)
    - 2.0 - 6.0 ft: Contested (-15% base)
    - < 2.0 ft: Heavily contested (-25% base)

    Defender Modifier:
    - (defender_composite - 50) * 0.001 = ±5% adjustment
    - Elite defender (90): -0.04 additional penalty
    - Poor defender (30): +0.02 penalty reduction

    Returns:
        Penalty as negative float (e.g., -0.18 = -18% penalty)
    """
```

#### 1.6 Help Defense Check

```python
def check_help_defense(
    primary_defender: Dict[str, Any],
    help_defenders: List[Dict[str, Any]],
    contest_quality: float
) -> Optional[Dict[str, Any]]:
    """
    Determine if help defense rotates (Section 4.6).

    Algorithm:
    1. If contest_quality >= 0.30: No help needed, return None
    2. For each help_defender:
        - Calculate help probability using awareness sigmoid
        - P = sigmoid(-0.05 * (awareness - 50))
        - If roll succeeds: return help_defender
    3. If multiple succeed: return closest (use random for M1)
    4. If none succeed: return None
    """
```

**Critical Implementation Notes:**
- All shooting functions MUST return debug dict with sigmoid calculations
- Contest penalty is ADDITIVE, not multiplicative: `final = base - penalty`
- Transition bonuses are ADDITIVE: `final = base + transition_bonus - contest_penalty`
- Always clamp final probabilities to [0, 1]

---

### TASK 2: Defense System (systems/defense.py)

**Estimated Time:** 3-4 hours

**Required Functions:**

#### 2.1 Defensive Assignment

```python
def get_primary_defender(
    shooter: Dict[str, Any],
    defensive_team: List[Dict[str, Any]],
    defensive_assignments: Dict[str, str],
    defense_type: str  # 'man' or 'zone'
) -> Dict[str, Any]:
    """
    Determine primary contest defender.

    Man Defense:
    - Use defensive_assignments dict (offensive player name → defensive player name)
    - Fallback: Match by position if assignment invalid

    Zone Defense:
    - Use proximity-based (simplified for M1: match by position)
    - Future: Could use court position coordinates
    """
```

#### 2.2 Contest Distance Simulation

```python
def simulate_contest_distance(
    shooter: Dict[str, Any],
    defender: Dict[str, Any]
) -> float:
    """
    Simulate how close defender gets to contest.

    Uses defender's speed/reactions to determine distance.

    Algorithm:
    1. Calculate defender's contest composite:
       - reactions * 0.4
       - agility * 0.3
       - top_speed * 0.3
    2. Base distance = 6.0 ft (wide open)
    3. Reduce by (composite - 50) * 0.05
       - Elite defender (90): 6.0 - (40 * 0.05) = 4.0 ft (contested)
       - Average defender (50): 6.0 ft (wide open)
       - Poor defender (30): 6.0 + (20 * 0.05) = 7.0 ft (even more open)
    4. Add randomness: ±1.0 ft
    5. Clamp to [0.5, 10.0]
    """
```

#### 2.3 Zone Defense Application

```python
def apply_zone_defense_modifiers(
    base_probabilities: Dict[str, float],
    shot_type: str
) -> Dict[str, float]:
    """
    Apply zone defense effects (Section 12.2).

    Modifiers:
    - 3PT contest: Reduce defender composite by 15%
    - Drive success: -10% penalty to all drive outcomes
    - Turnover rate: +3% (handled in turnover system)

    For M1: Focus on 3PT contest reduction
    """
```

---

### TASK 3: Turnover System (systems/turnovers.py)

**Estimated Time:** 2-3 hours

**Required Functions:**

#### 3.1 Turnover Check

```python
def check_turnover(
    ball_handler: Dict[str, Any],
    defender: Dict[str, Any],
    tactical_settings: TacticalSettings,
    defense_type: str
) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """
    Determine if turnover occurs.

    Returns:
        (turnover_occurred: bool, turnover_type: str, debug_info: dict)

    Algorithm:
    1. Calculate base turnover rate (0.08)
    2. Modify by pace:
       - Fast: +0.025 (10.5% total)
       - Slow: -0.025 (5.5% total)
    3. If zone defense: multiply by 1.03 (+3%)
    4. Calculate ball handler's turnover prevention composite
    5. Adjust rate using sigmoid:
       adjusted_rate = base_rate * sigmoid(-0.02 * (composite - 50))
    6. Roll against adjusted rate
    7. If turnover: select type (see 3.2)
    """
```

#### 3.2 Turnover Type Selection

```python
def select_turnover_type() -> str:
    """
    Select turnover type using weighted distribution.

    Distribution:
    - bad_pass: 40%
    - lost_ball: 30%
    - offensive_foul: 20%
    - violation: 10%

    Use weighted_random_choice from probability module.
    """
```

#### 3.3 Transition Trigger

```python
def triggers_transition(turnover_type: str) -> bool:
    """
    Determine if turnover triggers fast break.

    Triggers transition: bad_pass, lost_ball, offensive_foul
    Does NOT trigger: violation (dead ball)
    """
```

---

### TASK 4: Rebounding System (systems/rebounding.py)

**Estimated Time:** 3-4 hours

**Required Functions:**

#### 4.1 Team Rebound Strength

```python
def calculate_team_rebound_strength(
    rebounders: List[Dict[str, Any]],
    is_defense: bool
) -> float:
    """
    Calculate aggregate rebounding strength.

    Algorithm:
    1. Calculate each rebounder's composite using WEIGHTS_REBOUND
    2. Average all composites
    3. If is_defense: multiply by 1.15 (15% defensive advantage)
    4. Return average strength
    """
```

#### 4.2 Rebound Team Selection

```python
def determine_rebounding_team(
    offensive_rebounders: List[Dict[str, Any]],
    defensive_rebounders: List[Dict[str, Any]]
) -> str:
    """
    Determine which team gets the rebound.

    Returns: 'offense' or 'defense'

    Algorithm:
    1. Calculate offensive strength (no bonus)
    2. Calculate defensive strength (with 1.15x bonus)
    3. Total = offensive + defensive
    4. OREB probability = offensive / total
    5. Roll to determine outcome
    """
```

#### 4.3 Individual Rebounder Selection

```python
def select_rebounder(
    rebounders: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Select which specific player gets the rebound.

    Algorithm:
    1. Calculate each rebounder's composite
    2. Use weighted_random_choice with composites as weights
    3. Return selected player
    """
```

#### 4.4 Offensive Rebound Logic

```python
def handle_offensive_rebound(
    rebounder: Dict[str, Any]
) -> str:
    """
    Determine outcome of offensive rebound.

    Returns: 'putback' or 'kickout'

    Algorithm:
    - If rebounder['height'] > 75: 'putback' (immediate rim attempt)
    - Else: 'kickout' (new possession, normal shot selection)

    Note: Shot clock resets to 14 seconds in both cases
    """
```

---

## PHASE 3: INTEGRATION

### TASK 5: Tactical Modifiers (tactical/modifiers.py)

**Estimated Time:** 3-4 hours

**Required Functions:**

#### 5.1 Pace Effects

```python
def get_pace_modifiers(pace: str) -> Dict[str, float]:
    """
    Return pace-based modifiers.

    Returns dict:
    {
        'possession_multiplier': float,
        'stamina_drain_multiplier': float,
        'turnover_adjustment': float
    }

    Fast: {1.10, 1.15, +0.025}
    Standard: {1.0, 1.0, 0}
    Slow: {0.90, 0.85, -0.025}
    """
```

#### 5.2 Shooter Selection

```python
def select_shooter(
    offensive_team: List[Dict[str, Any]],
    tactical_settings: TacticalSettings
) -> Dict[str, Any]:
    """
    Select shooter using usage distribution.

    Algorithm:
    1. Check scoring_option_1: 30% usage
    2. Check scoring_option_2: 20% usage
    3. Check scoring_option_3: 15% usage
    4. Remaining players: 35% split equally

    Fallback: If option unavailable (stamina < 20), skip to next

    Use weighted_random_choice
    """
```

#### 5.3 Rebounding Strategy Application

```python
def get_rebounders(
    team: List[Dict[str, Any]],
    rebounding_strategy: str
) -> List[Dict[str, Any]]:
    """
    Select which players box out for rebounds.

    Returns list of rebounders.

    Strategy:
    - crash_glass: All 5 players
    - standard: 4 players (exclude 1 guard)
    - prevent_transition: 3 players (exclude 2 guards)

    Selection: Sort by rebounding composite, take top N
    """
```

---

### TASK 6: Possession Coordinator (systems/possession.py)

**Estimated Time:** 4-5 hours

**Required Functions:**

#### 6.1 Drive-to-Rim Outcome

```python
def resolve_drive_to_rim(
    driver: Dict[str, Any],
    paint_defenders: List[Dict[str, Any]]
) -> Tuple[str, Dict[str, Any]]:
    """
    Four-way sigmoid to determine drive outcome (Section 5.3).

    Returns: (outcome: str, debug_info: dict)
    Outcomes: 'dunk', 'layup', 'kickout', 'turnover'

    Algorithm:
    1. Calculate driver's 4 composites:
       - dunk: WEIGHTS_DRIVE_DUNK
       - layup: WEIGHTS_DRIVE_LAYUP
       - kickout: WEIGHTS_DRIVE_KICKOUT
       - turnover: WEIGHTS_DRIVE_TURNOVER
    2. Calculate average defender composite (use all paint defenders)
    3. For each outcome, calculate sigmoid score:
       score = sigmoid(-0.02 * (composite - defender_avg))
    4. INVERT turnover: turnover_score = 1 - sigmoid(...)
    5. Normalize all 4 scores to probabilities
    6. Weighted random selection
    """
```

**Critical:** No minimum thresholds. Outcomes can naturally reach 0%.

#### 6.2 Assist Tracking

```python
def check_assist(
    time_since_pass: float,
    passer: Dict[str, Any]
) -> Optional[str]:
    """
    Determine if assist is awarded.

    Rule: If shot made within 2 seconds of pass → automatic assist

    Returns: passer['name'] if assist, else None
    """
```

#### 6.3 Main Possession Flow

```python
def simulate_possession(
    offensive_team: List[Dict[str, Any]],
    defensive_team: List[Dict[str, Any]],
    offensive_tactics: TacticalSettings,
    defensive_tactics: TacticalSettings,
    defensive_assignments: Dict[str, str],
    possession_context: PossessionContext,
    debug: bool = True
) -> PossessionResult:
    """
    Orchestrate complete possession simulation.

    Flow:
    1. Determine defense type (man/zone roll)
    2. Check for turnover
       - If yes: End possession, check transition trigger
    3. Select shooter (usage distribution)
    4. Select shot type (weighted by player + tactics)
    5. If rim shot: Check drive outcomes
       - If kickout: Re-select shot type (exclude rim)
       - If turnover: End possession
    6. Get primary defender
    7. Simulate contest distance
    8. Check help defense (if contest poor)
    9. Attempt shot (type-specific function)
    10. If miss: Resolve rebound
        - If OREB: Handle putback/kickout
    11. Generate debug output
    12. Return PossessionResult

    Debug output must include ALL sigmoid calculations.
    """
```

---

## PHASE 4: SIMULATION ENGINE

### TASK 7: Main Engine (simulation.py)

**Estimated Time:** 3-4 hours

**Required Functions:**

#### 7.1 Input Validation

```python
def validate_simulation_inputs(
    offensive_team: List[Dict[str, Any]],
    defensive_team: List[Dict[str, Any]],
    offensive_tactics: TacticalSettings,
    defensive_tactics: TacticalSettings,
    defensive_assignments: Dict[str, str]
) -> bool:
    """
    Validate all inputs before simulation.

    Checks:
    - Teams have exactly 5 players each
    - All players have 25 attributes in [1, 100]
    - Tactical settings are valid
    - Defensive assignments reference valid players
    """
```

#### 7.2 Play-by-Play Generator

```python
def generate_play_by_play(
    possession_result: PossessionResult,
    debug: bool = False
) -> str:
    """
    Create human-readable narrative.

    Example outputs:

    MAKE:
    "Stephen Curry attempts a 3-pointer from the top of the key.
    Contested by Draymond Green (4.2 feet away).
    CURRY MAKES THE THREE! (+3 points)
    Assist: Kyle Lowry"

    MISS + REBOUND:
    "Shaquille O'Neal drives to the rim.
    Heavily contested by Rudy Gobert.
    O'NEAL MISSES THE DUNK.
    Rebound: Dennis Rodman (DEF)"

    TURNOVER:
    "Stephen Curry brings the ball up court.
    TURNOVER: Bad pass stolen by Gary Payton.
    Fast break opportunity for the defense!"

    If debug=True: Include all sigmoid calculations below narrative.
    """
```

#### 7.3 Debug Output Formatter

```python
def format_debug_output(
    possession_result: PossessionResult
) -> str:
    """
    Format debug dict into readable output.

    Structure:
    === POSSESSION DEBUG ===

    [SHOOTER SELECTION]
    Usage distribution: {scorer_1: 30%, scorer_2: 20%, ...}
    Selected: Stephen Curry

    [SHOT SELECTION]
    Distribution: {3pt: 45%, mid: 18%, rim: 37%}
    Selected: 3pt

    [COMPOSITE CALCULATION - OFFENSE]
    Stephen Curry:
      form_technique (97) × 0.25 = 24.25
      throw_accuracy (98) × 0.20 = 19.60
      ...
    Composite: 92.4

    [COMPOSITE CALCULATION - DEFENSE]
    Draymond Green:
      height (75) × 0.33 = 24.75
      reactions (95) × 0.33 = 31.35
      ...
    Composite: 85.0

    [PROBABILITY CALCULATION]
    BaseRate: 0.30 (3PT uncontested)
    Attribute Diff: 92.4 - 85.0 = 7.4
    Sigmoid Input: -0.02 × 7.4 = -0.148
    Sigmoid Output: 0.537
    Base Success: 0.30 + (0.70 × 0.537) = 0.676 (67.6%)

    [CONTEST PENALTY]
    Distance: 4.2 ft → Contested
    Base Penalty: -0.15
    Defender Modifier: (85.0 - 50) × 0.001 = 0.035
    Total Penalty: -0.115

    [FINAL SUCCESS RATE]
    67.6% - 11.5% = 56.1%

    [RESULT]
    Roll: 0.342
    Outcome: MAKE (0.342 < 0.561)
    """
```

---

### TASK 8: CLI Entry Point (main.py)

**Estimated Time:** 2-3 hours

**Required Functions:**

```python
import argparse
import json
from src.simulation import simulate_possession
from src.core.data_structures import TacticalSettings, PossessionContext
from src.core.probability import set_seed


def load_teams(file_path: str) -> dict:
    """Load team data from JSON."""
    with open(file_path, 'r') as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(
        description='Basketball Simulator - Milestone 1'
    )
    parser.add_argument(
        '--offensive-team',
        required=True,
        help='Offensive team name'
    )
    parser.add_argument(
        '--defensive-team',
        required=True,
        help='Defensive team name'
    )
    parser.add_argument(
        '--seed',
        type=int,
        default=42,
        help='Random seed for reproducibility'
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Enable full debug output'
    )
    parser.add_argument(
        '--data-file',
        default='data/sample_teams.json',
        help='Path to team data file'
    )

    args = parser.parse_args()

    # Set seed
    set_seed(args.seed)

    # Load teams
    data = load_teams(args.data_file)
    teams = data['teams']

    if args.offensive_team not in teams:
        print(f"Error: Team '{args.offensive_team}' not found")
        return

    if args.defensive_team not in teams:
        print(f"Error: Team '{args.defensive_team}' not found")
        return

    offensive_team = teams[args.offensive_team]
    defensive_team = teams[args.defensive_team]

    # Create default tactics
    offensive_tactics = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=offensive_team[0]['name'],  # Default to first player
        rebounding_strategy='standard'
    )

    defensive_tactics = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        rebounding_strategy='standard'
    )

    # Create defensive assignments (position-based)
    defensive_assignments = {}
    for off_player in offensive_team:
        # Simple position matching
        for def_player in defensive_team:
            if def_player['position'] == off_player['position']:
                defensive_assignments[off_player['name']] = def_player['name']
                break

    # Create possession context
    context = PossessionContext()

    # Simulate
    result = simulate_possession(
        offensive_team,
        defensive_team,
        offensive_tactics,
        defensive_tactics,
        defensive_assignments,
        context,
        debug=args.debug
    )

    # Output
    print(result.play_by_play_text)
    print(f"\nOutcome: {result.possession_outcome}")
    print(f"Points: {result.points_scored}")

    if args.debug:
        print("\n" + format_debug_output(result))

    # JSON output
    print("\n=== JSON OUTPUT ===")
    print(json.dumps(result.to_dict(), indent=2))


if __name__ == '__main__':
    main()
```

---

## PHASE 5: VALIDATION

### TASK 9: Unit Tests (tests/)

**Estimated Time:** 4-5 hours

**Test Files:**

#### tests/test_probability.py
- Sigmoid extreme values (±100)
- Composite calculation accuracy
- Stamina degradation curve
- Weighted random choice normalization

#### tests/test_shooting.py
- Shot type selection distribution
- Contest penalty tiers
- Elite vs poor matchups
- Transition bonuses

#### tests/test_possession.py
- Shooter selection (usage distribution)
- Drive outcomes (4-way sigmoid)
- Assist timing (2-second rule)

#### tests/test_rebounding.py
- Team strength calculation
- Defensive advantage (15%)
- OREB putback logic (height > 75)

---

### TASK 10: Integration Validation (tests/test_integration.py)

**Estimated Time:** 3-4 hours

**Test Scenarios:**

```python
def test_elite_vs_weak():
    """
    Elite Shooters vs G-League Rookies.
    Expect ~70-80% success rate on 3PT shots.
    """
    # Run 100 possessions
    # Track make percentage
    # Assert 0.65 <= make_pct <= 0.85

def test_weak_vs_elite():
    """
    G-League Rookies vs Elite Defenders.
    Expect ~10-20% success rate.
    """
    # Run 100 possessions
    # Assert 0.08 <= make_pct <= 0.25

def test_zone_defense():
    """
    100% zone defense.
    Verify:
    - 3PT attempts elevated (+5%)
    - 3PT success lowered (worse contests)
    - Turnover rate higher (+3%)
    """
    # Run 100 possessions with zone
    # Run 100 possessions with man
    # Compare distributions

def test_transition():
    """
    Transition possessions.
    Verify rim success +20% vs halfcourt.
    """
    # Run 50 transition rim attempts
    # Run 50 halfcourt rim attempts
    # Assert transition > halfcourt by ~15-25%
```

---

## CRITICAL IMPLEMENTATION STANDARDS

### 1. Probability Sanity Checks
**EVERY probability calculation MUST:**
- Be in range [0, 1]
- Use weighted sigmoid (never bare random())
- Include all relevant attributes with correct weights
- Clamp final result: `max(0.0, min(1.0, probability))`

### 2. Debug Output Requirements
**ALL game mechanics MUST produce:**
- Input composites (offensive + defensive)
- Attribute diff
- Sigmoid input/output
- Base rate
- Modifiers applied (transition, contest, etc.)
- Final probability
- Actual roll value
- Outcome (make/miss, success/failure)

### 3. Edge Case Handling
**MUST handle:**
- Extreme attribute disparities (1 vs 99)
- Empty lists (no rebounders, no help defenders)
- Invalid assignments (missing players)
- Zero/negative weights
- Division by zero (normalization)

### 4. Validation Before Integration
**DO NOT integrate until:**
- Unit tests pass (100% coverage of core functions)
- Edge cases validated
- Output format matches PossessionResult schema
- Debug info complete

---

## ESTIMATED TOTAL TIME

**By Task:**
1. Shooting: 6-8 hours
2. Defense: 3-4 hours
3. Turnovers: 2-3 hours
4. Rebounding: 3-4 hours
5. Tactical: 3-4 hours
6. Possession: 4-5 hours
7. Simulation: 3-4 hours
8. CLI: 2-3 hours
9. Unit Tests: 4-5 hours
10. Integration: 3-4 hours

**Total:** 33-48 hours

**With Foundation Complete:** ~35-40 hours remaining for experienced developer.

---

## SUCCESS CRITERIA (MILESTONE 1)

**Must Demonstrate:**
1. Single possession runs without errors
2. All probabilities in valid range
3. Higher attributes produce better outcomes
4. Tactical settings create observable differences
5. Debug output shows all sigmoid calculations
6. Edge cases handled gracefully

**Statistical Validation:**
- 100 possessions with varied teams
- Make rates align with attribute differentials
- Zone defense modifiers apply correctly
- Transition bonuses measurable

**Deliverable:**
- Working CLI (`python main.py --offensive-team "Elite Shooters" --defensive-team "Elite Defenders" --seed 42 --debug`)
- Complete debug output
- Unit test suite passing
- README updated with usage examples

---

**Document Version:** 1.0
**Last Updated:** 2025-11-04
**Status:** Ready for Development
