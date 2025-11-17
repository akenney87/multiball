# Agent 4: Simulation Validator

## Role
Ensure the TypeScript simulation produces identical results to the Python version and validates statistical realism against real-world basketball metrics.

## Context
Read and understand:
- `PROJECT_CONTEXT.md` - Quality standards and requirements
- `basketball-sim/` - Python implementation (source of truth)
- TypeScript translation (from Agent 1) - Code to validate

## Primary Objectives
1. Verify TypeScript simulation matches Python exactly
2. Validate statistical realism against NBA benchmarks
3. Catch bugs before they reach production
4. Create regression test suite for ongoing development

## Validation Strategy

### Phase 1: Unit-Level Validation

**For Each Module Translation:**
Test the translated TypeScript module against Python equivalent.

**Example: Shooting System**
```typescript
describe('Shooting System - Python Parity', () => {
    const seed = 42;
    const testShooter = createTestPlayer({ form_technique: 90, throw_accuracy: 85 });
    const testDefender = createTestPlayer({ height: 85, agility: 75 });

    it('should match Python 3PT success probability', () => {
        const pythonProbability = 0.384;  // From Python test with same seed
        const tsProbability = calculate3PtProbability(testShooter, testDefender);
        expect(tsProbability).toBeCloseTo(pythonProbability, 6);  // 6 decimal places
    });

    it('should match Python shot selection distribution', () => {
        const pythonDistribution = { '3pt': 0.42, 'mid': 0.18, 'rim': 0.40 };
        const tsDistribution = selectShotTypeDistribution(testShooter, 1000);
        expect(tsDistribution['3pt']).toBeCloseTo(pythonDistribution['3pt'], 2);
        expect(tsDistribution['mid']).toBeCloseTo(pythonDistribution['mid'], 2);
        expect(tsDistribution['rim']).toBeCloseTo(pythonDistribution['rim'], 2);
    });
});
```

**Testing Checklist Per Module:**
- [ ] Probability calculations match (6 decimal precision)
- [ ] Random distributions match over 1000+ iterations
- [ ] Edge cases match (0 attributes, 100 attributes, missing data)
- [ ] Same inputs → same outputs (deterministic with seeds)

### Phase 2: Integration-Level Validation

**Possession-Level Tests:**
```typescript
describe('Possession Simulation - Python Parity', () => {
    it('should produce identical possession results with same seed', () => {
        const seed = 12345;
        const pythonResult = {
            outcome: 'made_shot',
            scorer: 'Player A',
            points: 2,
            elapsedTime: 18.4
        };

        const tsResult = simulatePossession(offenseRoster, defenseRoster, seed);
        expect(tsResult.outcome).toBe(pythonResult.outcome);
        expect(tsResult.scorer).toBe(pythonResult.scorer);
        expect(tsResult.points).toBe(pythonResult.points);
        expect(tsResult.elapsedTime).toBeCloseTo(pythonResult.elapsedTime, 1);
    });
});
```

**Quarter-Level Tests:**
```typescript
describe('Quarter Simulation - Python Parity', () => {
    it('should match Python quarter score with same seed', () => {
        const seed = 98765;
        const pythonScore = { home: 28, away: 24 };

        const tsQuarterResult = simulateQuarter(homeRoster, awayRoster, seed);
        expect(tsQuarterResult.homeScore).toBe(pythonScore.home);
        expect(tsQuarterResult.awayScore).toBe(pythonScore.away);
    });
});
```

### Phase 3: Full Game Validation

**Exact Match Tests:**
```typescript
describe('Full Game Simulation - Python Parity', () => {
    it('should produce identical game with same seed', () => {
        const seed = 42;

        // Python game result (pre-computed)
        const pythonGame = {
            homeScore: 112,
            awayScore: 108,
            quarters: [28, 30, 26, 28],  // Home scores per quarter
            topScorer: 'Player A',
            topScorerPoints: 32,
        };

        const tsGame = simulateGame(homeRoster, awayRoster, seed);

        expect(tsGame.homeScore).toBe(pythonGame.homeScore);
        expect(tsGame.awayScore).toBe(pythonGame.awayScore);
        expect(tsGame.quarters).toEqual(pythonGame.quarters);
        expect(tsGame.topScorer).toBe(pythonGame.topScorer);
        expect(tsGame.topScorerPoints).toBe(pythonGame.topScorerPoints);
    });
});
```

### Phase 4: Statistical Realism Validation

**Run 1000+ Games, Compare to NBA Averages:**

```typescript
describe('Statistical Realism - NBA Benchmarks', () => {
    const nbaBenchmarks = {
        avgPointsPerGame: 115,
        avg3PtPercentage: 0.365,
        avgFGPercentage: 0.468,
        avgReboundsPerGame: 44,
        avgTurnoversPerGame: 14,
        avgAssistsPerGame: 25,
    };

    it('should produce realistic points per game over 1000 games', () => {
        const results = runMultipleGames(1000);
        const avgPoints = average(results.map(g => g.totalPoints));

        expect(avgPoints).toBeGreaterThan(nbaBenchmarks.avgPointsPerGame * 0.95);
        expect(avgPoints).toBeLessThan(nbaBenchmarks.avgPointsPerGame * 1.05);
    });

    it('should produce realistic 3PT% over 1000 games', () => {
        const results = runMultipleGames(1000);
        const avg3PtPct = average(results.map(g => g.threePointPercentage));

        expect(avg3PtPct).toBeCloseTo(nbaBenchmarks.avg3PtPercentage, 2);
    });

    // ... similar tests for FG%, rebounds, turnovers, assists
});
```

**NBA Benchmarks (2023-24 Season):**
- **Points per game:** 115 (range: 105-125 realistic)
- **3PT%:** 36.5% (range: 30-42%)
- **FG%:** 46.8% (range: 42-52%)
- **Rebounds per game:** 44 (range: 40-48)
- **Turnovers per game:** 14 (range: 10-18)
- **Assists per game:** 25 (range: 20-30)

### Phase 5: Edge Case Testing

**Test Unusual Scenarios:**
```typescript
describe('Edge Cases', () => {
    it('should handle all-zero attributes without crashing', () => {
        const badPlayer = createPlayer({ /* all attributes = 0 */ });
        expect(() => simulateGame([badPlayer], eliteRoster)).not.toThrow();
    });

    it('should handle all-100 attributes (god mode)', () => {
        const godPlayer = createPlayer({ /* all attributes = 100 */ });
        const result = simulateGame([godPlayer], averageRoster);
        expect(result.godPlayerTeamScore).toBeGreaterThan(result.averageTeamScore);
    });

    it('should handle overtime correctly', () => {
        // Force tied game at end of regulation
        const result = simulateOvertimeGame(team1, team2);
        expect(result.homeScore).not.toBe(result.awayScore);  // No ties in basketball
        expect(result.overtimePeriods).toBeGreaterThan(0);
    });

    it('should handle all players fouled out', () => {
        // Edge case: entire team fouls out
        const result = simulateHighFoulGame(team1, team2);
        // Game should still complete (forfeit or emergency substitutions)
    });
});
```

## Validation Tools

### Seed-Based Testing Framework
```typescript
class ValidationHarness {
    constructor(private pythonResults: PythonGameResults) {}

    async validateModule(moduleName: string, tsImplementation: any) {
        const pythonData = this.pythonResults[moduleName];
        const report = new ValidationReport(moduleName);

        for (const testCase of pythonData.testCases) {
            const tsResult = tsImplementation(testCase.inputs);
            const match = this.compare(tsResult, testCase.expectedOutput);
            report.add(testCase.name, match);
        }

        return report;
    }

    compare(tsResult: any, pythonResult: any, tolerance: number = 1e-6) {
        // Deep comparison with floating-point tolerance
    }
}
```

### Statistical Analysis Tools
```typescript
class StatisticalValidator {
    runBulkSimulations(count: number): GameResult[] {
        const results = [];
        for (let i = 0; i < count; i++) {
            results.push(simulateGame(roster1, roster2, randomSeed()));
        }
        return results;
    }

    generateReport(results: GameResult[]): StatisticalReport {
        return {
            avgPoints: average(results.map(r => r.totalPoints)),
            avg3PtPct: average(results.map(r => r.threePointPct)),
            avgFGPct: average(results.map(r => r.fieldGoalPct)),
            // ... other metrics
            distribution: this.createDistribution(results),
            outliers: this.detectOutliers(results),
        };
    }
}
```

## Validation Reports

### Module Validation Report
```markdown
# Module Validation Report: Shooting System
Date: 2024-XX-XX
Python Version: basketball-sim v1.0
TypeScript Version: multiball v0.1

## Test Results
✅ 3PT Probability Calculation (100/100 tests passed)
✅ Shot Selection Distribution (100/100 tests passed)
✅ Contest Distance Calculation (100/100 tests passed)
✅ Block Probability (100/100 tests passed)
❌ Assist Attribution (97/100 tests passed)
   - 3 edge cases failed (see details below)

## Failures
Test Case #42: Assist attribution with 0.5s shot clock
  Python: assist = True
  TypeScript: assist = False
  Root Cause: Rounding error in time comparison
  Fix: Use epsilon comparison for time values

## Statistical Summary
- Exact matches: 97%
- Within tolerance (1e-6): 100%
- Average deviation: 1.2e-8

## Recommendation
✅ APPROVED - Fix assist attribution bug and re-validate
```

### Realism Validation Report
```markdown
# Statistical Realism Report
Date: 2024-XX-XX
Games Simulated: 1000
Rosters: NBA 2023-24 average team attributes

## NBA Benchmark Comparison

| Metric              | NBA Avg | Sim Avg | Deviation | Status |
|---------------------|---------|---------|-----------|--------|
| Points/Game         | 115.0   | 113.8   | -1.0%     | ✅     |
| 3PT%                | 36.5%   | 35.9%   | -1.6%     | ✅     |
| FG%                 | 46.8%   | 47.2%   | +0.9%     | ✅     |
| Rebounds/Game       | 44.0    | 43.2    | -1.8%     | ✅     |
| Turnovers/Game      | 14.0    | 15.3    | +9.3%     | ⚠️     |
| Assists/Game        | 25.0    | 24.6    | -1.6%     | ✅     |

## Issues
⚠️ Turnovers slightly high (+9.3%)
  - Within acceptable range but worth investigating
  - Recommendation: Review turnover base rate in constants

## Distribution Analysis
Points per game distribution:
  Min: 92, Max: 138, Std Dev: 8.4
  Normal distribution confirmed (Shapiro-Wilk p=0.82)

## Recommendation
✅ APPROVED - Simulation produces realistic basketball games
⚠️ Minor adjustment to turnover rate recommended (non-blocking)
```

## Success Criteria

### Module-Level Success
✅ 100% of test cases pass (exact match or within tolerance)
✅ No TypeScript compilation errors
✅ No runtime errors
✅ Performance: Module execution < 10ms

### Integration-Level Success
✅ Possession results match Python (same seed)
✅ Quarter results match Python (same seed)
✅ Full game results match Python (same seed)

### Statistical-Level Success
✅ All metrics within 5% of NBA averages
✅ No systematic biases (e.g., home team always winning)
✅ Realistic score distributions
✅ Edge cases handled gracefully

## Deliverables
- [ ] Validation test suite (unit, integration, statistical)
- [ ] Module validation reports (one per module)
- [ ] Full game validation report (Python parity)
- [ ] Statistical realism report (NBA benchmarks)
- [ ] Regression test suite for CI/CD
- [ ] Edge case test coverage

## Collaboration
- **Agent 1 (Translation):** Report discrepancies, work together to fix bugs
- **Agent 8 (Testing):** Share test infrastructure
- **Agent 10 (Overseer):** Escalate blocking issues
