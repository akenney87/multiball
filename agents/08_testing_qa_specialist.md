# Agent 8: Testing & Quality Assurance Specialist

## Role
Create comprehensive test coverage across all systems to ensure stability, catch bugs early, and maintain code quality throughout development.

## Context
Read and understand:
- `PROJECT_CONTEXT.md` - Quality standards
- All other agents' deliverables - Everything needs testing

## Primary Objectives
1. Create comprehensive test suite (unit, integration, E2E)
2. Ensure business logic correctness
3. Catch edge cases and bugs early
4. Maintain code quality standards
5. Enable regression testing for ongoing development

## Testing Strategy

### Test Pyramid

```
           /\
          /E2E\          10% - End-to-end user flows
         /------\
        /  INT   \       30% - Integration tests
       /----------\
      /   UNIT     \     60% - Unit tests
     /--------------\
```

## 1. Unit Tests (60% of tests)

### Business Logic Testing

**Training Progression**
```typescript
describe('Training System', () => {
    describe('Attribute Progression', () => {
        it('should improve attributes based on training allocation', () => {
            const player = createTestPlayer({ jumping: 50 });
            const training = { physical: 100, mental: 0, technical: 0 };

            const result = calculateWeeklyProgression(player, training, coachingQuality);

            expect(result.jumping).toBeGreaterThan(50);
            expect(result.jumping).toBeLessThanOrEqual(52);  // Reasonable weekly gain
        });

        it('should apply soft cap as player approaches potential', () => {
            const player = createTestPlayer({
                jumping: 90,
                potentials: { physical: 92, mental: 80, technical: 80 }
            });

            const gainNearCap = calculateWeeklyProgression(player, { physical: 100, mental: 0, technical: 0 });
            const playerFarFromCap = createTestPlayer({ jumping: 50, potentials: { physical: 92, mental: 80, technical: 80 }});
            const gainFarFromCap = calculateWeeklyProgression(playerFarFromCap, { physical: 100, mental: 0, technical: 0 });

            expect(gainNearCap.jumping - 90).toBeLessThan(gainFarFromCap.jumping - 50);  // Diminishing returns
        });

        it('should give bonus XP for playing time', () => {
            const player = createTestPlayer({ jumping: 50 });
            const withPlayingTime = calculateWeeklyProgression(player, training, coaching, true);
            const withoutPlayingTime = calculateWeeklyProgression(player, training, coaching, false);

            expect(withPlayingTime.jumping).toBeGreaterThan(withoutPlayingTime.jumping);
        });

        it('should decline attributes after peak age', () => {
            const oldPlayer = createTestPlayer({
                age: 35,
                jumping: 80,
                peakAges: { physical: 26, mental: 30, technical: 28 }
            });

            const result = calculateAgeBasedRegression(oldPlayer);

            expect(result.jumping).toBeLessThan(80);
        });
    });
});
```

**Contract Valuation**
```typescript
describe('Contract System', () => {
    it('should calculate player value based on overall rating', () => {
        const player = createTestPlayer({ overall: 80 });
        const value = calculatePlayerValue(player);

        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThan(1000000);  // Reasonable range
    });

    it('should increase value for younger players', () => {
        const youngPlayer = createTestPlayer({ overall: 70, age: 22 });
        const oldPlayer = createTestPlayer({ overall: 70, age: 32 });

        const youngValue = calculatePlayerValue(youngPlayer);
        const oldValue = calculatePlayerValue(oldPlayer);

        expect(youngValue).toBeGreaterThan(oldValue);
    });

    it('should validate contract offers stay within budget', () => {
        const team = createTestTeam({ budget: 1000000, salaries: 900000 });
        const contract = { salary: 150000, signingBonus: 50000 };

        const valid = validateContractWithinBudget(team, contract);

        expect(valid).toBe(false);  // Would exceed budget
    });
});
```

**Scouting Ranges**
```typescript
describe('Scouting System', () => {
    it('should produce narrower ranges with higher depth setting', () => {
        const player = createTestPlayer({ jumping: 75 });

        const breadthReport = generateScoutingReport(player, { depthVsBreadth: 0, budget: 100000 });
        const depthReport = generateScoutingReport(player, { depthVsBreadth: 100, budget: 100000 });

        const breadthRange = breadthReport.attributeRanges.jumping.max - breadthReport.attributeRanges.jumping.min;
        const depthRange = depthReport.attributeRanges.jumping.max - depthReport.attributeRanges.jumping.min;

        expect(depthRange).toBeLessThan(breadthRange);
    });

    it('should include true value within estimated range', () => {
        const player = createTestPlayer({ jumping: 75 });
        const report = generateScoutingReport(player, { depthVsBreadth: 50, budget: 100000 });

        expect(report.attributeRanges.jumping.min).toBeLessThanOrEqual(75);
        expect(report.attributeRanges.jumping.max).toBeGreaterThanOrEqual(75);
    });
});
```

**Injury Probability**
```typescript
describe('Injury System', () => {
    it('should have lower injury probability for high durability players', () => {
        const durablePlayer = createTestPlayer({ durability: 90 });
        const fragilePlayer = createTestPlayer({ durability: 30 });

        const durableInjuryChance = calculateInjuryProbability(durablePlayer);
        const fragileInjuryChance = calculateInjuryProbability(fragilePlayer);

        expect(durableInjuryChance).toBeLessThan(fragileInjuryChance);
    });

    it('should apply medical budget reduction to recovery time', () => {
        const injury = { injuryType: 'moderate', baseRecoveryWeeks: 4 };
        const lowBudgetRecovery = calculateRecoveryTime(injury, 10000);
        const highBudgetRecovery = calculateRecoveryTime(injury, 100000);

        expect(highBudgetRecovery).toBeLessThan(lowBudgetRecovery);
    });
});
```

**AI Transfer Decisions**
```typescript
describe('AI Transfer Logic', () => {
    it('should make offers for players that fit personality', () => {
        const youthFocusedAI = createAITeam({ personality: 'youth_development' });
        const youngPlayer = createTestPlayer({ age: 20, overall: 65 });
        const veteranPlayer = createTestPlayer({ age: 32, overall: 75 });

        const shouldOfferYoung = aiShouldMakeOffer(youthFocusedAI, youngPlayer);
        const shouldOfferVeteran = aiShouldMakeOffer(youthFocusedAI, veteranPlayer);

        expect(shouldOfferYoung).toBe(true);
        expect(shouldOfferVeteran).toBe(false);
    });

    it('should counter-offer based on player value and loyalty', () => {
        const loyalAI = createAITeam({ loyalty: 90 });
        const player = createTestPlayer({ value: 100000 });
        const lowOffer = { transferFee: 50000 };

        const response = aiRespondToOffer(loyalAI, player, lowOffer);

        expect(response.counter).toBe(true);
        expect(response.amount).toBeGreaterThan(lowOffer.transferFee);
    });
});
```

## 2. Integration Tests (30% of tests)

### System Interactions

**Training → Attributes → Simulation**
```typescript
describe('Training-Attribute-Simulation Integration', () => {
    it('should improve simulation performance after training', () => {
        const player = createTestPlayer({ throw_accuracy: 50, form_technique: 50 });
        const beforeStats = simulateGames(player, 10);

        // Train for technical attributes
        for (let week = 0; week < 10; week++) {
            trainPlayer(player, { physical: 0, mental: 0, technical: 100 });
        }

        const afterStats = simulateGames(player, 10);

        expect(afterStats.avg3PtPercentage).toBeGreaterThan(beforeStats.avg3PtPercentage);
    });
});
```

**Budget → Systems → Performance**
```typescript
describe('Budget Allocation Integration', () => {
    it('should affect multiple systems based on allocation', () => {
        const team = createTestTeam();

        // High coaching allocation
        team.budgetAllocation.coaching = 40;
        const highCoachingGain = trainSquad(team, 1);

        // Low coaching allocation
        team.budgetAllocation.coaching = 10;
        const lowCoachingGain = trainSquad(team, 1);

        expect(highCoachingGain.averageImprovement).toBeGreaterThan(lowCoachingGain.averageImprovement);
    });
});
```

**Contracts → Budget → Constraints**
```typescript
describe('Contract-Budget Integration', () => {
    it('should prevent signing when over budget', () => {
        const team = createTestTeam({ budget: 1000000, currentSalaries: 950000 });
        const expensivePlayer = createTestPlayer();
        const contract = { salary: 100000, signingBonus: 20000 };

        const result = attemptSignContract(team, expensivePlayer, contract);

        expect(result.success).toBe(false);
        expect(result.error).toBe('OVER_BUDGET');
    });
});
```

**Season Progression**
```typescript
describe('Season Flow Integration', () => {
    it('should correctly transition through season phases', () => {
        const season = createNewSeason();

        expect(season.status).toBe('pre_season');

        startRegularSeason(season);
        expect(season.status).toBe('regular_season');
        expect(season.matches.length).toBe(57 * 20);  // 57 matches × 20 teams / 2

        simulateAllMatches(season);
        endRegularSeason(season);

        expect(season.status).toBe('post_season');

        const standings = calculateStandings(season);
        expect(standings.length).toBe(20);
        expect(standings[0].rank).toBe(1);
    });
});
```

## 3. End-to-End Tests (10% of tests)

### Complete User Flows

**New Game → Play Season → Promotion**
```typescript
describe('E2E: Complete Season Flow', () => {
    it('should allow user to complete full season and get promoted', async () => {
        // 1. Create new game
        const game = await createNewGame('Test Team');
        expect(game.franchise.division).toBe(5);  // Start in Division 5

        // 2. Simulate matches
        for (const match of game.season.matches.filter(m => m.homeTeamId === 'user' || m.awayTeamId === 'user')) {
            const result = await simulateMatch(match);
            // Rig results to win
            if (match.homeTeamId === 'user') {
                result.homeScore = 100;
                result.awayScore = 80;
            } else {
                result.awayScore = 100;
                result.homeScore = 80;
            }
        }

        // 3. End season
        await endSeason(game.season);

        // 4. Check standings
        const standings = getCurrentStandings(game);
        const userStanding = standings.find(s => s.teamId === 'user');

        expect(userStanding.rank).toBeLessThanOrEqual(3);  // Top 3

        // 5. Process promotion
        await processPromotionRelegation(game.season);

        expect(game.franchise.division).toBe(4);  // Promoted!
    });
});
```

**Scout → Transfer → Contract → Play**
```typescript
describe('E2E: Player Acquisition Flow', () => {
    it('should scout, transfer, sign, and play new player', async () => {
        const game = await createNewGame('Test Team');

        // 1. Scout free agents
        const scoutingReport = await scoutFreeAgents({ targetType: 'general' });
        expect(scoutingReport.length).toBeGreaterThan(0);

        const targetPlayer = scoutingReport[0];

        // 2. Make contract offer
        const offer = {
            salary: 100000,
            contractLength: 3,
            signingBonus: 10000,
        };

        const negotiation = await makeContractOffer(targetPlayer.playerId, offer);

        // 3. Player accepts
        negotiation.status = 'accepted';  // Simulate acceptance

        const signed = await signContract(negotiation);
        expect(signed.success).toBe(true);

        // 4. Player joins roster
        const roster = await getRoster('user');
        expect(roster.find(p => p.id === targetPlayer.playerId)).toBeDefined();

        // 5. Play match with new player
        const nextMatch = await getNextMatch();
        const result = await simulateMatch(nextMatch);

        expect(result.boxScore.players).toContainEqual(
            expect.objectContaining({ id: targetPlayer.playerId })
        );
    });
});
```

## Edge Case Testing

```typescript
describe('Edge Cases', () => {
    it('should handle all players injured scenario', () => {
        const team = createTestTeam();
        team.roster.forEach(p => p.injury = { injuryType: 'severe', returnDate: future });

        const lineup = selectLineup(team);

        // Should either forfeit, use injured players with penalties, or emergency signings
        expect(() => simulateMatch(team, opponent)).not.toThrow();
    });

    it('should handle negative budget (debt)', () => {
        const team = createTestTeam({ budget: -100000 });

        const canSign = canSignPlayer(team, createTestPlayer());

        expect(canSign).toBe(false);
    });

    it('should handle player aging past 40', () => {
        const ancientPlayer = createTestPlayer({ age: 42 });

        const regression = calculateAgeBasedRegression(ancientPlayer);

        expect(regression.attributes.physical).toBeLessThan(ancientPlayer.attributes.physical);
        // Should still be playable, just very degraded
    });

    it('should handle all AI teams offering for same player', () => {
        const player = createTestPlayer({ overall: 95 });  // Elite player

        const offers = [];
        for (let i = 0; i < 19; i++) {
            offers.push(aiMakeOffer(createAITeam(), player));
        }

        expect(offers.length).toBe(19);
        // Player can only go to one team
        const accepted = player.contract?.teamId;
        expect(typeof accepted).toBe('string');
    });
});
```

## Mobile-Specific Testing

```typescript
describe('Mobile Performance', () => {
    it('should save game state within 1 second', async () => {
        const start = Date.now();
        await saveGame(largeGameState);
        const elapsed = Date.now() - start;

        expect(elapsed).toBeLessThan(1000);  // < 1 second
    });

    it('should load dashboard within 500ms', async () => {
        const start = Date.now();
        await loadDashboard();
        const elapsed = Date.now() - start;

        expect(elapsed).toBeLessThan(500);
    });

    it('should handle app backgrounding/foregrounding', async () => {
        const game = await loadGame();
        simulateAppBackground();
        simulateAppForeground();

        const reloadedGame = await loadGame();
        expect(reloadedGame).toEqual(game);  // No data loss
    });
});
```

## Test Data Generators

```typescript
class TestDataFactory {
    createTestPlayer(overrides?: Partial<Player>): Player {
        return {
            id: uuid(),
            name: faker.name.fullName(),
            age: 25,
            attributes: this.generateAverageAttributes(),
            potentials: { physical: 75, mental: 75, technical: 75 },
            ...overrides,
        };
    }

    createTestTeam(overrides?: Partial<Franchise>): Franchise {
        return {
            id: uuid(),
            name: faker.company.name(),
            division: 3,
            budget: { total: 2000000, allocated: {}, available: 2000000 },
            roster: this.generateRoster(50),
            ...overrides,
        };
    }

    generateRoster(size: number): Player[] {
        return Array.from({ length: size }, () => this.createTestPlayer());
    }

    createTestSeason(): Season {
        const teams = Array.from({ length: 20 }, () => this.createTestTeam());
        return generateSeasonSchedule(teams);
    }
}
```

## Continuous Integration

```typescript
// jest.config.js
module.exports = {
    preset: 'react-native',
    testMatch: ['**/__tests__/**/*.test.ts'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.test.ts',
        '!src/**/index.ts',
    ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
        },
    },
};
```

## Deliverables
- [ ] Unit test suite (60% of tests) - Business logic coverage
- [ ] Integration test suite (30%) - System interactions
- [ ] E2E test suite (10%) - Complete user flows
- [ ] Edge case tests
- [ ] Mobile performance tests
- [ ] Test data generators/factories
- [ ] CI/CD configuration
- [ ] Code coverage reports (>80% target)
- [ ] Test documentation

## Collaboration
- **All Agents:** Test their deliverables
- **Agent 4 (Simulation Validator):** Share test infrastructure
- **Agent 10 (Overseer):** Report critical bugs and blockers
