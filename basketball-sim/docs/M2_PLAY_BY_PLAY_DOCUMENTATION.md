# Play-by-Play Logging System Documentation

**Milestone:** M2 - Quarter Simulation
**Status:** Implementation Complete - Awaiting User Approval
**Critical:** This is the FINAL M2 approval gate

## Overview

The play-by-play logging system generates professional, readable quarter narratives for basketball simulation. It tracks all possession events, substitutions, score progression, and quarter statistics.

## Architecture

### Core Components

1. **PlayByPlayLogger** - Main interface for logging quarter events
2. **QuarterStatistics** - Aggregates team and player statistics
3. **PossessionEvent** - Structured data for possession outcomes
4. **SubstitutionEvent** - Structured data for player substitutions

### File Structure

```
src/systems/play_by_play.py         # Core implementation
tests/test_play_by_play.py           # Comprehensive test suite (26 tests)
demo_play_by_play.py                 # Sample output generator
output/quarter_playbyplay_*.txt      # Sample quarter narratives
```

## Usage

### Basic Integration

```python
from src.systems.play_by_play import PlayByPlayLogger

# Initialize logger
logger = PlayByPlayLogger(
    home_team_name="Golden State Warriors",
    away_team_name="Los Angeles Lakers",
    quarter_number=1
)

# During quarter simulation loop:
for possession in quarter_possessions:
    # Simulate possession
    result = possession.simulate_possession(...)

    # Log possession
    logger.add_possession(
        game_clock=current_time,
        offense_team='Home',  # or 'Away'
        possession_result=result
    )

    # Handle substitutions
    if substitution_needed:
        logger.add_substitution(
            game_clock=current_time,
            team='Home',
            player_out='Stephen Curry',
            player_in='Jordan Poole',
            reason='low_stamina',
            stamina_out=55.0
        )

# Generate and save narrative
logger.write_to_file('output/quarter_playbyplay.txt')
```

### PossessionResult Requirements

The logger expects `PossessionResult` objects from `possession.simulate_possession()` with:

**Required Fields:**
- `play_by_play_text` - Narrative text of possession
- `possession_outcome` - 'made_shot', 'missed_shot', or 'turnover'
- `points_scored` - 0, 2, or 3
- `debug` - Dictionary containing:
  - `shot_type` - '3pt', 'midrange', or 'rim'
  - `rebound` (if applicable) - Dict with `offensive_rebound` boolean

**Optional Fields:**
- `scoring_player` - Name of scorer (if made shot)
- `assist_player` - Name of assister (if assist occurred)
- `rebound_player` - Name of rebounder (if missed shot)

## Output Format

### Structure

```
================================================================================
           1ST QUARTER - Golden State Warriors vs Los Angeles Lakers
================================================================================

[12:00] Golden State Warriors possession (Score: 0-0)
Stephen Curry attempts a 3-pointer. Contested by Kawhi Leonard (3.2 ft).
CURRY MAKES IT! +3
Assist: Draymond Green
Score: 3-0

[10:32] Substitution (Warriors): Kyle Lowry OUT (stamina: 58) → Jordan Poole IN

... (continue for all possessions) ...

================================================================================
                              1ST QUARTER COMPLETE
================================================================================

FINAL SCORE: Golden State Warriors 30, Los Angeles Lakers 26

QUARTER STATISTICS:
--------------------------------------------------------------------------------

Golden State Warriors:
  FG: 12/24 (50.0%), 3PT: 4/10 (40.0%), REB: 8 (2 off, 6 def), AST: 7, TO: 2
  Leading Scorers:
    1. Stephen Curry - 12 pts
    2. Klay Thompson - 8 pts
    3. Draymond Green - 5 pts

Los Angeles Lakers:
  FG: 9/20 (45.0%), 3PT: 2/8 (25.0%), REB: 15 (5 off, 10 def), AST: 5, TO: 3
  Leading Scorers:
    1. LeBron James - 10 pts
    2. Anthony Davis - 7 pts
    3. Austin Reaves - 5 pts

================================================================================
```

### Formatting Specifications

**Line Width:** 80 characters max (section headers use `=` or `-` separators)

**Timestamps:** `[MM:SS]` format (e.g., `[11:45]`, `[08:12]`, `[00:23]`)

**Quarter Ordinals:** 1ST, 2ND, 3RD, 4TH (extensible to 5TH+ for overtime)

**Score Display:**
- Before possession: `(Score: 0-0)`
- After made shot: `Score: 3-0`
- Final score: `FINAL SCORE: Warriors 30, Lakers 26`

**Substitutions:**
- With stamina: `[10:32] Substitution (Warriors): Curry OUT (stamina: 58) → Poole IN (low stamina)`
- Without stamina: `[10:32] Substitution (Warriors): Curry OUT → Poole IN (minutes management)`

**Reason Mapping:**
- `low_stamina` → "low stamina"
- `minutes_allocation` → "minutes management"
- `injury` → "injury"

## Statistics Tracking

### Team-Level Stats

- **Points** - Total points scored
- **FGM/FGA** - Field goals made/attempted
- **FG3M/FG3A** - Three-pointers made/attempted
- **OREB/DREB** - Offensive/defensive rebounds
- **AST** - Assists
- **TOV** - Turnovers

### Player-Level Stats

- **Points** - Individual scoring
- **Rebounds** - Total rebounds (offensive + defensive)
- **Assists** - Passes leading to scores
- **FGM/FGA** - Individual shooting

### Calculation Logic

**Field Goal Percentage:**
```python
fg_pct = (fgm / fga * 100) if fga > 0 else 0.0
```

**Three-Point Percentage:**
```python
fg3_pct = (fg3m / fg3a * 100) if fg3a > 0 else 0.0
```

**Total Rebounds:**
```python
total_reb = oreb + dreb
```

## API Reference

### PlayByPlayLogger

#### `__init__(home_team_name, away_team_name, quarter_number=1)`
Initialize logger for quarter.

**Args:**
- `home_team_name` (str) - Name of home team
- `away_team_name` (str) - Name of away team
- `quarter_number` (int) - Quarter number (1-4)

#### `add_possession(game_clock, offense_team, possession_result)`
Log a possession event.

**Args:**
- `game_clock` (int) - Seconds remaining when possession started (0-720)
- `offense_team` (str) - 'Home' or 'Away'
- `possession_result` (PossessionResult) - Result from possession.simulate_possession()

**Updates:**
- Adds possession to event log
- Updates score tracking
- Updates team/player statistics

#### `add_substitution(game_clock, team, player_out, player_in, reason, stamina_out=None)`
Log a substitution event.

**Args:**
- `game_clock` (int) - Seconds remaining when sub occurred
- `team` (str) - 'Home' or 'Away'
- `player_out` (str) - Name of exiting player
- `player_in` (str) - Name of entering player
- `reason` (str) - 'low_stamina', 'minutes_allocation', or 'injury'
- `stamina_out` (float, optional) - Stamina of exiting player

#### `render_to_text()`
Generate complete quarter narrative.

**Returns:**
- (str) Multi-line formatted narrative

**Format:**
1. Quarter header
2. Chronological events (possessions + substitutions)
3. Quarter complete banner
4. Final score
5. Quarter statistics (both teams)

#### `write_to_file(filepath)`
Write narrative to text file.

**Args:**
- `filepath` (str) - Output file path (e.g., 'output/quarter_playbyplay.txt')

**Side Effects:**
- Creates output directory if needed
- Writes formatted narrative to file

### QuarterStatistics

#### `__init__(home_team_name, away_team_name)`
Initialize statistics tracker.

#### `add_possession_result(offense_team, possession_event)`
Update statistics from possession.

**Args:**
- `offense_team` (str) - 'Home' or 'Away'
- `possession_event` (PossessionEvent) - Event with complete possession data

#### `get_team_summary(team)`
Generate team summary text.

**Args:**
- `team` (str) - 'Home' or 'Away'

**Returns:**
- (str) Formatted statistics line

**Example:**
```
"FG: 12/24 (50.0%), 3PT: 4/10 (40.0%), REB: 8 (2 off, 6 def), AST: 7, TO: 2"
```

#### `get_top_performers(team, stat, top_n=3)`
Get top N performers for a stat.

**Args:**
- `team` (str) - 'Home' or 'Away' (unused, returns all players)
- `stat` (str) - 'points', 'rebounds', or 'assists'
- `top_n` (int) - Number of performers to return

**Returns:**
- List[Tuple[str, int]] - List of (player_name, stat_value) tuples

## Testing

### Test Suite Coverage

**26 tests** covering:

1. **Helper Functions** (4 tests)
   - Percentage formatting
   - Quarter ordinal formatting

2. **QuarterStatistics** (7 tests)
   - Initialization
   - Made shot tracking
   - Missed shot tracking
   - Turnover tracking
   - Offensive rebound tracking
   - Team summary generation
   - Top performers retrieval

3. **PlayByPlayLogger** (12 tests)
   - Initialization
   - Add possession (made/missed)
   - Add substitution
   - Game clock formatting
   - Event rendering (possession/substitution)
   - Full narrative rendering
   - File writing
   - Event chronological ordering
   - Score tracking across possessions

4. **Edge Cases** (3 tests)
   - No possessions
   - Made shot without assist
   - Quarter number variations

### Running Tests

```bash
cd C:\Users\alexa\desktop\projects\simulator
python -m pytest tests/test_play_by_play.py -v
```

**Expected Result:** All 26 tests pass

### Sample Output Generation

```bash
python demo_play_by_play.py
```

**Generates:**
- `output/quarter_playbyplay_fast.txt` (~28 possessions)
- `output/quarter_playbyplay_standard.txt` (~25 possessions)
- `output/quarter_playbyplay_slow.txt` (~22 possessions)

## Design Decisions

### Event Ordering

Events sorted by **game clock descending** (12:00 → 0:00) for chronological narrative. Possessions and substitutions interleaved based on timestamp.

### Score Tracking

Score updated immediately after each possession. Display format:
- **Before possession:** `(Score: 3-0)` - Parenthetical, compact
- **After made shot:** `Score: 3-0` - Standalone line for emphasis

### Statistics Attribution

- **Made shots:** Update FGM, FGA, points, and player scoring
- **3PT attempts:** Track separately from 2PT attempts
- **Assists:** Only credited if `assist_player` field present
- **Rebounds:** Type determined by `is_offensive_rebound` flag

### Text Rendering

**Play-by-play text** comes directly from `possession.generate_play_by_play()`, ensuring consistency with M1 narrative style. Logger adds:
- Timestamp header
- Team possession indicator
- Score display (before and after)

### Substitution Formatting

Includes:
- Timestamp
- Team name (not 'Home'/'Away')
- Player names (OUT → IN with arrow symbol)
- Reason (human-readable)
- Optional stamina value

## Integration with Quarter Simulation

### Expected Quarter Simulation Flow

```python
def simulate_quarter(home_team, away_team, ...):
    # Initialize logger
    logger = PlayByPlayLogger(home_team_name, away_team_name, quarter_number)

    game_clock = 720  # 12 minutes

    while game_clock > 0:
        # Determine possession
        offense_team = determine_offense(...)

        # Check substitutions
        if needs_substitution(home_team):
            player_out, player_in = select_substitution(home_team)
            logger.add_substitution(game_clock, 'Home', player_out, player_in, 'low_stamina', stamina)

        # Simulate possession
        result = possession.simulate_possession(...)

        # Log possession
        logger.add_possession(game_clock, offense_team, result)

        # Advance clock
        game_clock -= calculate_possession_time(pace)

    # Save quarter narrative
    logger.write_to_file(f'output/quarter{quarter_number}_playbyplay.txt')

    return logger.statistics
```

### Possession Time Calculation

**Average possession times by pace:**
- Fast: 18 seconds/possession
- Standard: 24 seconds/possession
- Slow: 30 seconds/possession

**Variation:** ±5 seconds random variation per possession

**Minimum:** 10 seconds (prevents negative clock)

## Validation Criteria

### Readability Checklist

- [ ] Headers and separators clearly delineate sections
- [ ] Timestamps accurate and properly formatted
- [ ] Play-by-play text flows naturally
- [ ] Score updates appear after every made basket
- [ ] Substitutions formatted consistently
- [ ] Quarter summary statistics accurate

### Completeness Checklist

- [ ] All possessions logged chronologically
- [ ] All substitutions logged with timestamps
- [ ] Score progression tracked accurately
- [ ] Team statistics calculated correctly
- [ ] Player statistics attributed correctly
- [ ] Top scorers identified properly

### Professional Presentation Checklist

- [ ] 80-character line width maintained
- [ ] Consistent spacing and indentation
- [ ] NBA-style formatting (quarters, timestamps, score display)
- [ ] No redundant information
- [ ] Clear visual hierarchy

## Sample Outputs

### Fast Pace Quarter
- **Possessions:** ~28
- **Pace:** 18 seconds/possession
- **Expected Score:** 15-20 points per team
- **File:** `output/quarter_playbyplay_fast.txt`

### Standard Pace Quarter
- **Possessions:** ~25
- **Pace:** 24 seconds/possession
- **Expected Score:** 12-18 points per team
- **File:** `output/quarter_playbyplay_standard.txt`

### Slow Pace Quarter
- **Possessions:** ~22
- **Pace:** 30 seconds/possession
- **Expected Score:** 10-16 points per team
- **File:** `output/quarter_playbyplay_slow.txt`

## Known Limitations

### Current Scope (M2)

1. **No foul tracking** - Fouls and free throws deferred to future milestone
2. **No shot clock violations** - Tracked possession time, violations deferred
3. **No player box scores** - Individual player stats tracked but not exported separately
4. **No team filtering for top performers** - `get_top_performers()` returns all players regardless of team

### Future Enhancements (M3+)

1. **Foul tracking** - Add foul events with player attribution
2. **Free throw logging** - Separate narrative for FT sequences
3. **Shot clock violations** - Handle 24-second and 14-second violations
4. **Advanced stats** - +/-, true shooting %, usage rate
5. **Full game narrative** - Concatenate four quarters with halftime stats
6. **Player box scores** - Export individual player stat lines

## User Approval Requirements

**CRITICAL:** This is the FINAL M2 approval gate. User must review sample outputs and approve:

1. **Readability** - Is the narrative easy to follow?
2. **Completeness** - Are all events captured correctly?
3. **Formatting** - Is the presentation professional and clear?
4. **Accuracy** - Do scores and statistics match expectations?
5. **Usability** - Can this be used for quarter simulation output?

**Approval Process:**
1. Review `output/quarter_playbyplay_*.txt` files
2. Verify chronological ordering and score tracking
3. Check substitution formatting and quarter summary
4. Confirm alignment with M2 requirements
5. Provide feedback or approve for M2 completion

## Contact

**Questions or Issues:**
- Review test suite for usage examples
- Check sample outputs for formatting reference
- Consult BACKLOG.md for M2 requirements

**M2 Completion:**
- All tests passing (26/26)
- Sample outputs generated successfully
- Documentation complete
- **Awaiting user approval to proceed to M3**
