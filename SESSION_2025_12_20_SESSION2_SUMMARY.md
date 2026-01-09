# Session Summary: 2025-12-20 (Session 2)

## Completed: Soccer Simulation Realism Improvements

### Overview
Implemented comprehensive realism improvements to the soccer simulation following a 5-phase plan. The simulation now produces realistic match outcomes with tactical influence, GK saves, player form, and rich play-by-play narratives.

---

## Files Created

### `src/simulation/soccer/systems/cardSystem.ts`
- Realistic foul/card generation system
- Foul rate based on tactics (attacking style, defensive line)
- Card probability based on:
  - Position weights (CDM 1.4x, CB 1.3x, GK 0.05x)
  - Player aggression (bravery + determination vs composure + patience)
  - Game state (trailing teams foul more late game)
- Second yellow → automatic red card logic
- Straight red cards (0.5% of fouls for violent conduct)

### `src/simulation/soccer/systems/goalkeeperSystem.ts`
- Two-stage goal process replacing simple xG conversion
- Process: xG → shot opportunities (xG × 8) → 35% become shots on target → GK save roll
- Save probability formula:
  - Base rate: 65%
  - GK rating modifier: ±25% at extremes (rating 20 vs 90)
  - Shot quality modifiers: fullChance 0.75x, halfChance 1.15x, longRange 1.30x
- Exports: `processShots()`, `calculateSaveChance()`, `getGoalkeeperStats()`

### `src/simulation/soccer/playByPlay/soccerPlayByPlay.ts`
- Template-based narrative generation system
- Goal templates by shot quality (fullChance, halfChance, longRange)
- Assist phrases with variety
- Save and miss templates
- Card templates (yellow, red, second yellow)
- Exports: `generateGoalNarrative()`, `generateSaveNarrative()`, `generateMissNarrative()`, `generateCardNarrative()`, `generatePlayByPlay()`

---

## Files Modified

### `src/simulation/soccer/constants.ts`
Added constants for:
- `ATTACKING_STYLE_MODIFIERS` - possession/direct/counter (xG, possession, foulRate)
- `DEFENSIVE_LINE_MODIFIERS` - high/medium/low (xGConceded, possession, foulRate)
- `HOME_ADVANTAGE_XG_MODIFIER` - 1.08 (+8% xG for home team)
- Card system constants (BASE_FOULS_PER_TEAM, YELLOW_CARD_PER_FOUL_RATE, etc.)
- GK system constants (BASE_SAVE_RATE, GK_RATING_SAVE_IMPACT, SHOT_QUALITY_SAVE_MODIFIERS)
- Form system constants (HOT_STREAK_CHANCE, COLD_STREAK_CHANCE, etc.)

### `src/simulation/soccer/types.ts`
- Added `shot_saved`, `shot_missed` to `SoccerEventType`

### `src/simulation/soccer/game/matchSimulation.ts`
- Updated `calculateExpectedGoals()` with tactical parameters
- Integrated `processShots()` from goalkeeperSystem
- Integrated `generateCardEvents()` from cardSystem
- Added form modifier to player attribution
- Updated play-by-play generation to use enriched narratives

### `src/simulation/soccer/game/boxScore.ts`
- Updated possession calculation with tactical modifiers
- Accepts `ShotProcessingResult` for accurate GK save stats

### `src/simulation/soccer/index.ts`
- Added exports for new systems (cardSystem, goalkeeperSystem, soccerPlayByPlay)

### `src/ui/context/GameContext.tsx`
- Fixed `buildSoccerTeamState()` to properly convert slot indices to position strings
- Changed `positions: Record<string, string>` to `positions: Record<string, number>`
- Added conversion logic using `FORMATION_POSITIONS` mapping

---

## Validation Results (100 simulations each)

| Test Case | Results |
|-----------|---------|
| Even teams (50 rating) | ~1 goal/team, 37%H/33%A/30%D |
| Strong (80) vs Weak (30) | Strong wins 87%, 2.49 avg goals vs 0.25 |
| GK Impact (Elite 90 vs Poor 30) | Elite GK team wins 54% vs 15% |
| Tactical (Direct vs Possession) | Direct: 4.3 yellows, Possession: 2.2 yellows |

---

## Technical Notes

### Architecture Decision
- Kept "Enhanced Outcome-First" approach (not possession-by-possession)
- xG-based modeling is industry standard for soccer analytics
- Tactical modifiers layer on top without architectural rewrite
- Faster simulation suitable for "Quick Sim" with rich narratives for "Watch Sim"

### TypeScript Status
- All soccer simulation files compile cleanly (0 errors)
- Pre-existing test file errors unrelated to this work (997 total, all in `__tests__/` directory)

### Key Formula References
```typescript
// xG Calculation
xgModifier = 1 + ((attackNorm - opposition) * 1.5)
xgModifier *= ATTACKING_STYLE_MODIFIERS[style].xG
xgModifier *= DEFENSIVE_LINE_MODIFIERS[line].xGConceded
if (isHome) xgModifier *= HOME_ADVANTAGE_XG_MODIFIER
return BASE_EXPECTED_GOALS * Math.max(0.3, xgModifier)

// Save Probability
ratingModifier = (gkRating - 50) * GK_RATING_SAVE_IMPACT  // ±0.25 at extremes
saveChance = (BASE_SAVE_RATE + ratingModifier) * SHOT_QUALITY_SAVE_MODIFIERS[quality]
return clamp(saveChance, 0.15, 0.85)

// Player Attribution
finalWeight = (skillComponent * 0.6 + positionComponent * 0.4) * formModifier
```

---

## Next Steps / Recommendations

1. **Baseball Simulation Implementation** - Foundation ready (types, constants, weight tables defined)
2. **UI Integration** - Test soccer simulation through actual UI gameplay
3. **Balance Tuning** - May need adjustment based on player feedback

---

## Documentation Updated
- `PROJECT_CONTEXT.md` - Full documentation of Soccer Simulation System section
- Status updated to "Soccer Simulation Realism COMPLETE"
- Next priority set to "Baseball simulation implementation"
