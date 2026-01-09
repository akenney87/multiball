# Baseball Integration Fix Plan (Revision 3 - FINAL)

## Summary of Revisions (Round 3)
Based on reviewer feedback (Agent 1: B+, Agent 2: B), this final revision addresses:
- **Clarify NEW vs MODIFY**: Explicitly state which functions are new, which are modified
- **Add basketball validation**: Fix unsafe cast with validation
- **Fix incomplete test**: Complete the released player test case
- **Remove existing padding**: Explicitly state we're REMOVING the padding loop

---

## Implementation Strategy

### Functions to ADD (new):
- `validateBaseballLineup()` in gameInitializer.ts
- `validateBasketballLineup()` in gameInitializer.ts (NEW - fixes unsafe cast)
- `isFieldingPosition()` type guard in GameContext.tsx

### Functions to MODIFY (existing):
- `generateBaseballLineup()` in gameInitializer.ts - REMOVE padding loop
- `regenerateBasketballLineup()` in gameInitializer.ts - exists, update to not pad
- `buildBaseballTeamState()` in GameContext.tsx - use type guard
- `simulateMatch()` in GameContext.tsx - add validation call

### Types to MODIFY:
- `BaseballLineupConfig.battingOrder` in types.ts - change from tuple to `string[]`

---

## Critical Issue 1: Type Definition Fix

**Problem**: `battingOrder` is defined as 10-element tuple, preventing variable-length arrays.

**Decision**: Use `string[]` with runtime validation (simpler than discriminated union).

**Trade-off acknowledged**: We accept weaker compile-time type safety in exchange for simpler code. Runtime validation catches all edge cases.

**Code Changes** (`src/ui/context/types.ts`):
```typescript
// BEFORE (line 53):
battingOrder: [string, string, string, string, string, string, string, string, string, string];

// AFTER:
battingOrder: string[]; // 9-10 players, validated at runtime by validateBaseballLineup()
```

---

## Critical Issue 2: DH Position Type Mismatch

**Problem**: `BaseballPosition` includes `'DH'` but simulation's `FieldingPosition` only has 9 positions.

**Solution**: Type guard function (no unsafe casts).

**Code Changes** (`src/ui/context/GameContext.tsx`):
```typescript
// ADD near top of file - NEW IMPORT
import { validateBaseballLineup, validateBasketballLineup } from '../integration/gameInitializer';

// ADD - NEW TYPE GUARD FUNCTION
const FIELDING_POSITIONS: readonly string[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

function isFieldingPosition(pos: string): pos is FieldingPosition {
  return FIELDING_POSITIONS.includes(pos);
}

// MODIFY buildBaseballTeamState - use type guard:
const defense: Partial<Record<FieldingPosition, string>> = {};
for (const player of roster) {
  const pos = lineupConfig?.positions[player.id];
  if (pos && isFieldingPosition(pos)) {
    defense[pos] = player.id;
  }
}
```

---

## Critical Issue 3: Generate Lineup Without Empty Strings

**Problem**: Current code pads with empty strings (lines 441-444 in gameInitializer.ts).

**Solution**: REMOVE the padding loop entirely.

**Code Changes** (`src/ui/integration/gameInitializer.ts`):
```typescript
// MODIFY existing generateBaseballLineup function

export function generateBaseballLineup(rosterIds: string[], players: Record<string, Player>): BaseballLineupConfig {
  const validIds = rosterIds.filter(id => players[id]);
  const sorted = validIds
    .map(id => ({ id, overall: calculatePlayerOverall(players[id]) }))
    .sort((a, b) => b.overall - a.overall);

  // Take up to 10 players - NO PADDING
  const lineupPlayers = sorted.slice(0, Math.min(sorted.length, 10));
  const battingOrder = lineupPlayers.map(p => p.id); // string[]

  // DELETE THE FOLLOWING LINES (currently lines 441-444):
  // while (battingOrder.length < 10) {
  //   battingOrder.push('');
  // }

  // Position assignment based on roster size
  const positions: Record<string, BaseballPosition> = {};

  if (battingOrder.length >= 10) {
    // 10+ players: 9 fielders + 1 DH
    assignDefensivePositions(lineupPlayers.slice(0, 9), players, positions);
    positions[battingOrder[9]] = 'DH';
  } else if (battingOrder.length === 9) {
    // Exactly 9 players: all field, no DH
    assignDefensivePositions(lineupPlayers, players, positions);
  }
  // < 9 players: positions incomplete, validation will catch

  const startingPitcher = Object.entries(positions).find(([_, pos]) => pos === 'P')?.[0] || '';

  return {
    battingOrder,
    positions,
    startingPitcher,
  };
}
```

---

## Critical Issue 4: Add Validation Functions (NEW)

**These are NEW functions to ADD to gameInitializer.ts:**

```typescript
// ADD - NEW EXPORT
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ADD - NEW FUNCTION
export function validateBaseballLineup(
  lineup: BaseballLineupConfig,
  roster: Player[]
): ValidationResult {
  const rosterIds = new Set(roster.map(p => p.id));

  // 1. Check minimum players in batting order
  const validBatters = lineup.battingOrder.filter(id => rosterIds.has(id));
  if (validBatters.length < 9) {
    return {
      valid: false,
      error: `Need at least 9 players for baseball (have ${validBatters.length})`
    };
  }

  // 2. Check starting pitcher exists and is in batting order
  if (!lineup.startingPitcher) {
    return { valid: false, error: 'No starting pitcher assigned' };
  }
  if (!rosterIds.has(lineup.startingPitcher)) {
    return { valid: false, error: 'Starting pitcher not on roster' };
  }
  if (!validBatters.includes(lineup.startingPitcher)) {
    return { valid: false, error: 'Starting pitcher must be in batting order' };
  }

  // 3. Check all 9 defensive positions are assigned
  const REQUIRED_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  const assignedPositions = new Set(
    Object.entries(lineup.positions)
      .filter(([playerId, pos]) => pos !== 'DH' && rosterIds.has(playerId))
      .map(([_, pos]) => pos)
  );

  const missingPositions = REQUIRED_POSITIONS.filter(p => !assignedPositions.has(p as BaseballPosition));
  if (missingPositions.length > 0) {
    return {
      valid: false,
      error: `Missing defensive positions: ${missingPositions.join(', ')}`
    };
  }

  // 4. Check no duplicate position assignments (except DH)
  const positionCounts: Record<string, number> = {};
  for (const [playerId, pos] of Object.entries(lineup.positions)) {
    if (pos !== 'DH' && rosterIds.has(playerId)) {
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
      if (positionCounts[pos] > 1) {
        return { valid: false, error: `Duplicate assignment for position: ${pos}` };
      }
    }
  }

  // 5. Pitcher at P position matches startingPitcher
  const pitcherAtP = Object.entries(lineup.positions).find(([_, pos]) => pos === 'P')?.[0];
  if (pitcherAtP !== lineup.startingPitcher) {
    return { valid: false, error: 'Starting pitcher must be assigned to P position' };
  }

  return { valid: true };
}

// ADD - NEW FUNCTION (fixes unsafe basketball cast)
export function validateBasketballLineup(
  starters: string[],
  roster: Player[]
): ValidationResult {
  const rosterIds = new Set(roster.map(p => p.id));
  const validStarters = starters.filter(id => rosterIds.has(id));

  if (validStarters.length < 5) {
    return {
      valid: false,
      error: `Need at least 5 players for basketball (have ${validStarters.length})`
    };
  }

  return { valid: true };
}
```

---

## Critical Issue 5: Fix Basketball Unsafe Cast (NEW)

**Problem**: Basketball starters cast `as [string, string, string, string, string]` is unsafe.

**Solution**: Add validation before cast.

**Code Changes** (`src/ui/integration/gameInitializer.ts`):
```typescript
// MODIFY existing regenerateBasketballLineup function

export function regenerateBasketballLineup(
  currentLineup: LineupConfig,
  remainingRosterIds: string[],
  players: Record<string, Player>
): LineupConfig {
  const validIds = remainingRosterIds.filter(id => players[id]);
  const sorted = validIds
    .map(id => ({ id, overall: calculatePlayerOverall(players[id]) }))
    .sort((a, b) => b.overall - a.overall);

  // Top 5 become starters
  const starters = sorted.slice(0, 5).map(p => p.id);
  const bench = sorted.slice(5).map(p => p.id);

  // VALIDATE before cast - throws if < 5 players
  if (starters.length < 5) {
    throw new Error(`Cannot create basketball lineup: need 5 starters (have ${starters.length})`);
  }

  return {
    ...currentLineup,
    basketballStarters: starters as [string, string, string, string, string], // SAFE: validated above
    bench,
  };
}
```

---

## Critical Issue 6: Keep simulateMatch Return Type

**Solution**: Keep `Promise<MatchResult>`, throw errors.

**Code Changes** (`src/ui/context/GameContext.tsx`):
```typescript
// MODIFY simulateMatch - add validation before simulation

const simulateMatch = useCallback(async (matchId: string): Promise<MatchResult> => {
  // ... existing match finding code ...

  if (match.sport === 'baseball') {
    // ADD: Validate user lineup - THROW on failure
    const userRoster = getUserRoster();
    const validation = validateBaseballLineup(state.userTeam.lineup.baseballLineup, userRoster);

    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid baseball lineup');
    }

    // ... proceed with simulation ...
  }

  if (match.sport === 'basketball') {
    // ADD: Validate user lineup - THROW on failure
    const userRoster = getUserRoster();
    const validation = validateBasketballLineup(
      state.userTeam.lineup.basketballStarters,
      userRoster
    );

    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid basketball lineup');
    }

    // ... proceed with simulation ...
  }

  // ... other sports unchanged ...
}, [/* deps */]);
```

---

## Critical Issue 7: UI Error Handling

**Code Changes** (`src/ui/screens/ConnectedMatchPreviewScreen.tsx`):
```typescript
// MODIFY handleSimulate to catch errors

const handleSimulate = async () => {
  setIsSimulating(true);
  try {
    await simulate(); // Throws on validation failure
    navigation.navigate('MatchResult', { matchId });
  } catch (error) {
    // Show validation error to user
    Alert.alert(
      'Cannot Play Match',
      error instanceof Error ? error.message : 'Unknown error'
    );
  } finally {
    setIsSimulating(false);
  }
};
```

---

## Critical Issue 8: Fix Box Score Team Names

**Code Changes** (`src/ui/screens/ConnectedMatchResultScreen.tsx`):
```typescript
// ADD state variables
const [showBattingStats, setShowBattingStats] = useState(false);
const [showPitchingStats, setShowPitchingStats] = useState(false);

// ADD team name calculation
const homeTeamName = match.homeTeamId === 'user' ? userTeamName : opponentTeamName;
const awayTeamName = match.awayTeamId === 'user' ? userTeamName : opponentTeamName;

// ADD baseball box score display (use homeTeamName for home, awayTeamName for away)
```

---

## Medium Issue: RELEASE_PLAYER

**Decision**: Keep existing behavior. Validation catches invalid lineups at match time.

**No code changes needed** - existing implementation is sufficient.

---

## Medium Issue: Consolidate calculatePlayerOverall

**Code Changes** (`src/ui/context/GameContext.tsx`):
```typescript
// REMOVE local calculatePlayerOverall function (if duplicate exists)
// ADD import:
import { calculatePlayerOverall } from '../integration/gameInitializer';
```

---

## Implementation Order

1. **MODIFY types.ts** - `battingOrder: string[]`
2. **ADD validateBaseballLineup** - NEW function in gameInitializer.ts
3. **ADD validateBasketballLineup** - NEW function in gameInitializer.ts
4. **MODIFY generateBaseballLineup** - REMOVE padding loop
5. **MODIFY regenerateBasketballLineup** - Add validation before cast
6. **ADD isFieldingPosition** - NEW type guard in GameContext.tsx
7. **ADD import** - validateBaseballLineup, validateBasketballLineup
8. **MODIFY buildBaseballTeamState** - Use type guard
9. **MODIFY simulateMatch** - Add validation calls
10. **MODIFY Match Preview** - Catch errors, show Alert
11. **MODIFY Match Result** - Fix team names, add box score

---

## Files Summary

| File | Action | Changes |
|------|--------|---------|
| `src/ui/context/types.ts` | MODIFY | Change `battingOrder` tuple to `string[]` |
| `src/ui/integration/gameInitializer.ts` | ADD + MODIFY | Add 2 validation functions, remove padding from generateBaseballLineup, add throw to regenerateBasketballLineup |
| `src/ui/context/GameContext.tsx` | ADD + MODIFY | Add type guard, add import, add validation calls, remove duplicate calculatePlayerOverall |
| `src/ui/screens/ConnectedMatchPreviewScreen.tsx` | MODIFY | Add try-catch, show Alert |
| `src/ui/screens/ConnectedMatchResultScreen.tsx` | MODIFY | Fix team names, add expandable box score |

---

## Test Cases

### Unit Tests (`src/ui/integration/__tests__/baseballLineup.test.ts`):

```typescript
describe('generateBaseballLineup', () => {
  test('10+ players: 9 fielders + 1 DH', () => {
    const lineup = generateBaseballLineup(tenPlayerRoster, players);
    expect(lineup.battingOrder).toHaveLength(10);
    expect(Object.values(lineup.positions).filter(p => p === 'DH')).toHaveLength(1);
  });

  test('exactly 9 players: all field, no DH', () => {
    const lineup = generateBaseballLineup(ninePlayerRoster, players);
    expect(lineup.battingOrder).toHaveLength(9);
    expect(Object.values(lineup.positions)).not.toContain('DH');
  });

  test('8 players: generates 8-player lineup (validation catches)', () => {
    const lineup = generateBaseballLineup(eightPlayerRoster, players);
    expect(lineup.battingOrder).toHaveLength(8);
  });

  test('NEVER contains empty strings', () => {
    const lineup = generateBaseballLineup(anyRoster, players);
    expect(lineup.battingOrder.every(id => id !== '')).toBe(true);
    expect(lineup.battingOrder.every(id => id.length > 0)).toBe(true);
  });
});

describe('validateBaseballLineup', () => {
  test('valid 10-player lineup passes', () => {
    const result = validateBaseballLineup(validLineup, tenPlayerRoster);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('valid 9-player lineup passes', () => {
    const result = validateBaseballLineup(ninePlayerLineup, ninePlayerRoster);
    expect(result.valid).toBe(true);
  });

  test('8-player lineup fails with specific error', () => {
    const result = validateBaseballLineup(eightPlayerLineup, eightPlayerRoster);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Need at least 9 players for baseball (have 8)');
  });

  test('missing pitcher fails', () => {
    const result = validateBaseballLineup({ ...validLineup, startingPitcher: '' }, roster);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('pitcher');
  });

  test('pitcher not in batting order fails', () => {
    const badLineup = {
      ...validLineup,
      battingOrder: validLineup.battingOrder.filter(id => id !== validLineup.startingPitcher)
    };
    const result = validateBaseballLineup(badLineup, roster);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Starting pitcher must be in batting order');
  });

  test('missing defensive position fails', () => {
    const positions = { ...validLineup.positions };
    const ssPlayer = Object.entries(positions).find(([_, p]) => p === 'SS')?.[0];
    if (ssPlayer) delete positions[ssPlayer];
    const result = validateBaseballLineup({ ...validLineup, positions }, roster);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('SS');
  });

  test('duplicate position assignment fails', () => {
    const positions = { ...validLineup.positions, 'extra-player': '1B' as BaseballPosition };
    const extraRoster = [...roster, { id: 'extra-player', name: 'Extra' } as Player];
    const result = validateBaseballLineup({ ...validLineup, positions }, extraRoster);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Duplicate');
  });

  // COMPLETE test for released player scenario
  test('lineup with released player counts only valid players', () => {
    // Create 10-player lineup
    const lineup = generateBaseballLineup(tenPlayerRoster, players);
    expect(lineup.battingOrder).toHaveLength(10);

    // Simulate releasing player at index 9 (the DH)
    const releasedPlayerId = lineup.battingOrder[9];
    const rosterAfterRelease = tenPlayerRoster.filter(p => p.id !== releasedPlayerId);

    // Validation should pass - still have 9 valid players
    const result = validateBaseballLineup(lineup, rosterAfterRelease);
    expect(result.valid).toBe(true); // 9 valid players remain
  });

  test('lineup becomes invalid when too many players released', () => {
    const lineup = generateBaseballLineup(tenPlayerRoster, players);

    // Release 3 players - only 7 valid remain
    const rosterAfterRelease = tenPlayerRoster.slice(0, 7);

    const result = validateBaseballLineup(lineup, rosterAfterRelease);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least 9 players');
  });
});

describe('validateBasketballLineup', () => {
  test('valid 5-player lineup passes', () => {
    const result = validateBasketballLineup(fivePlayerStarters, roster);
    expect(result.valid).toBe(true);
  });

  test('4-player lineup fails', () => {
    const result = validateBasketballLineup(fourPlayerStarters, roster);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Need at least 5 players for basketball (have 4)');
  });
});

describe('regenerateBasketballLineup', () => {
  test('throws error if fewer than 5 players', () => {
    expect(() => {
      regenerateBasketballLineup(currentLineup, fourPlayerRosterIds, players);
    }).toThrow('need 5 starters');
  });

  test('succeeds with 5+ players', () => {
    const result = regenerateBasketballLineup(currentLineup, fivePlayerRosterIds, players);
    expect(result.basketballStarters).toHaveLength(5);
  });
});

describe('isFieldingPosition', () => {
  test('returns true for all 9 fielding positions', () => {
    const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
    positions.forEach(pos => {
      expect(isFieldingPosition(pos)).toBe(true);
    });
  });

  test('returns false for DH', () => {
    expect(isFieldingPosition('DH')).toBe(false);
  });

  test('returns false for invalid strings', () => {
    expect(isFieldingPosition('XX')).toBe(false);
    expect(isFieldingPosition('')).toBe(false);
  });
});
```

### Integration Tests:

```typescript
describe('Baseball game simulation', () => {
  test('simulates successfully with 10-player roster', async () => {
    const result = await simulateMatch(baseballMatchId);
    expect(result).toBeDefined();
    expect(result.homeScore).toBeGreaterThanOrEqual(0);
  });

  test('simulates successfully with 9-player roster', async () => {
    const result = await simulateMatch(baseballMatchId);
    expect(result).toBeDefined();
  });

  test('throws error with 8-player roster', async () => {
    await expect(simulateMatch(baseballMatchId)).rejects.toThrow('at least 9 players');
  });
});

describe('Basketball game simulation', () => {
  test('throws error with 4-player roster', async () => {
    await expect(simulateMatch(basketballMatchId)).rejects.toThrow('at least 5 players');
  });
});
```

---

## Verification Checklist

- [ ] `battingOrder` type is `string[]` in types.ts
- [ ] `validateBaseballLineup` function ADDED to gameInitializer.ts
- [ ] `validateBasketballLineup` function ADDED to gameInitializer.ts
- [ ] Padding loop REMOVED from generateBaseballLineup
- [ ] `regenerateBasketballLineup` throws if < 5 players
- [ ] `isFieldingPosition` type guard ADDED to GameContext.tsx
- [ ] Import statement ADDED for validation functions
- [ ] `simulateMatch` calls validation and throws on failure
- [ ] Match Preview catches errors and shows Alert
- [ ] Box score shows correct team names
- [ ] All test cases pass with assertions
- [ ] No TypeScript errors
- [ ] Basketball functionality has validation
