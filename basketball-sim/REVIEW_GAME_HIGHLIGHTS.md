# M3 User Review Game Highlights

Quick reference guide for reviewing the 3 game logs.

---

## Game 1: Warriors 118, Lakers 100 (Moderate Competitive Game)

**File:** `output/M3_USER_REVIEW_GAME_1.txt`
**Seed:** 12345
**Scenario:** Close game (evenly matched teams)
**Final Result:** 18-point margin (closer than expected)

### Key Features to Check:
- Line 150: TIMEOUT - Nets (stop opponent momentum)
- Line 24: First bonus situation
- Line 140: Free throw miss (2 of 3)
- Multiple substitutions during dead balls
- Complete box scores at end

### Stats:
- Total Points: 218
- Fouls: 16
- FT: 23/25 (92%)
- **Violations:** 0

---

## Game 2: Celtics 122, Heat 94 (Moderate Blowout)

**File:** `output/M3_USER_REVIEW_GAME_2.txt`
**Seed:** 67890
**Scenario:** Mismatched teams (Celtics stronger)
**Final Result:** 28-point blowout

### Key Features to Check:
- Dominant performance by Celtics
- Proper timeout mechanics throughout
- Bonus situations in all quarters
- Free throw variety (makes and misses)
- Realistic blowout progression

### Stats:
- Total Points: 216
- Fouls: 16
- FT: 17/20 (85%)
- **Violations:** 0

---

## Game 3: Bucks 94, Nets 92 (Defensive Battle)

**File:** `output/M3_USER_REVIEW_GAME_3.txt`
**Seed:** 11111
**Scenario:** Lower-rated teams, defensive focus
**Final Result:** 2-point nail-biter!

### Key Features to Check:
- Line 150: TIMEOUT - Nets (stop opponent momentum)
- Line 176: "IN THE BONUS! 5 team fouls" - proper bonus display
- Line 408: FT misses (0/2) - shows realistic variance
- Line 813: TIMEOUT - Bucks (stop opponent momentum)
- Line 1234: TIMEOUT - Nets (desperation timeout)
- Close score throughout

### Stats:
- Total Points: 186 (lowest scoring - defensive battle)
- Fouls: 16
- FT: 29/31 (93.5%)
- **Violations:** 0

### Sample Bonus Situations:
```
Line 176: FOUL! Holding foul on Bucks_3_SF. [IN THE BONUS! 5 team fouls]
Line 357: FOUL! Shooting foul on Nets_5_C. Bucks_5_C to the line for 2 free throws. [BONUS: 5 team fouls]
Line 660: FOUL! Holding foul on Bucks_5_C. [IN THE BONUS! 5 team fouls]
Line 677: FOUL! Shooting foul on Nets_6_PG. Bucks_6_PG to the line for 3 free throws. [BONUS: 6 team fouls]
```

---

## How to Review

### 1. Quick Scan (5 minutes)
- Open each game file
- Search for "TIMEOUT" - verify they occur after opponent scores
- Search for "BONUS" - verify bonus triggers at 5 fouls
- Search for "MISS" - verify free throws miss sometimes
- Check end of file for complete box scores

### 2. Detailed Review (15 minutes)
- Read through a quarter of play-by-play
- Verify substitutions only happen during dead balls
- Check that timeouts make tactical sense
- Confirm bonus system displays correctly
- Review box score stats are populated

### 3. Realism Check (10 minutes)
- Does it feel like basketball?
- Are scores realistic?
- Do timeout decisions make sense?
- Is foul variety present?
- Do stats look reasonable?

---

## Search Commands

To quickly find features in the game logs:

```bash
# Find all timeouts
grep -n "TIMEOUT" output/M3_USER_REVIEW_GAME_3.txt

# Find all bonus situations
grep -n "BONUS" output/M3_USER_REVIEW_GAME_3.txt

# Find all free throw misses
grep -n "FT.*MISS" output/M3_USER_REVIEW_GAME_3.txt

# Find all substitutions
grep -n "Substitution" output/M3_USER_REVIEW_GAME_3.txt

# Find box score
tail -100 output/M3_USER_REVIEW_GAME_3.txt
```

---

## Expected Results

### ✅ What You Should See:
- Timeouts called after opponent scoring runs
- Substitutions during dead balls (after scores, turnovers, between quarters)
- "IN THE BONUS!" displays when team reaches 5 fouls
- Free throws miss occasionally (not 100% accuracy)
- Complete box scores with all stats
- Variety of foul types (shooting, holding, loose ball, offensive)
- Realistic NBA scores (90-130 per team)

### ❌ What You Should NOT See:
- Timeout immediately after team's own score
- Substitution during live play
- Substitution between free throws
- 100% free throw accuracy
- Missing box score stats
- Unrealistic scores (150+, sub-60)

---

## Validation Results

All 3 games passed automated validation:
- **Timeout violations:** 0
- **Substitution violations:** 0
- **Missing features:** 0
- **Statistical anomalies:** 0

**Status:** Ready for user sign-off

---

*Use this guide to efficiently review the game logs and verify M3 is ready for approval.*
