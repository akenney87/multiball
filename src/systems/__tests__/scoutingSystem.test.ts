import {
  validateScoutingSettings,
  calculateDepthMultiplier,
  calculateAccuracyMultiplier,
  calculateRangeWidth,
  calculatePlayersScoutedPerWeek,
  generateAttributeRange,
  generateSportRatingRange,
  generateScoutReport,
  simulateWeeklyScouting,
  getConfidenceLevel,
  getExpectedValue,
  formatAttributeRange,
  formatSportRatingRange,
  BASE_RANGE_WIDTH,
  MIN_RANGE_WIDTH,
  MAX_RANGE_WIDTH,
  BASE_DEPTH_MULTIPLIER,
  SCOUTABLE_ATTRIBUTES,
  ScoutingSettings,
} from '../scoutingSystem';

describe('ScoutingSystem - Settings Validation', () => {
  describe('validateScoutingSettings', () => {
    it('should accept valid settings', () => {
      const settings: ScoutingSettings = {
        depthSlider: 0.5,
        scoutingBudgetMultiplier: 1.0,
        simultaneousScouts: 3,
      };

      const result = validateScoutingSettings(settings);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject depth slider < 0', () => {
      const settings: ScoutingSettings = {
        depthSlider: -0.1,
        scoutingBudgetMultiplier: 1.0,
        simultaneousScouts: 3,
      };

      const result = validateScoutingSettings(settings);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Depth slider must be between 0.0 (breadth) and 1.0 (depth)');
    });

    it('should reject depth slider > 1.0', () => {
      const settings: ScoutingSettings = {
        depthSlider: 1.5,
        scoutingBudgetMultiplier: 1.0,
        simultaneousScouts: 3,
      };

      const result = validateScoutingSettings(settings);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Depth slider must be between 0.0 (breadth) and 1.0 (depth)');
    });

    it('should reject budget multiplier < 0.5x', () => {
      const settings: ScoutingSettings = {
        depthSlider: 0.5,
        scoutingBudgetMultiplier: 0.3,
        simultaneousScouts: 3,
      };

      const result = validateScoutingSettings(settings);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Scouting budget multiplier must be between 0.5x and 2.0x');
    });

    it('should reject budget multiplier > 2.0x', () => {
      const settings: ScoutingSettings = {
        depthSlider: 0.5,
        scoutingBudgetMultiplier: 2.5,
        simultaneousScouts: 3,
      };

      const result = validateScoutingSettings(settings);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Scouting budget multiplier must be between 0.5x and 2.0x');
    });

    it('should reject < 1 simultaneous scout', () => {
      const settings: ScoutingSettings = {
        depthSlider: 0.5,
        scoutingBudgetMultiplier: 1.0,
        simultaneousScouts: 0,
      };

      const result = validateScoutingSettings(settings);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Must have at least 1 simultaneous scout');
    });

    it('should accept boundary values', () => {
      const settings: ScoutingSettings = {
        depthSlider: 0.0,
        scoutingBudgetMultiplier: 0.5,
        simultaneousScouts: 1,
      };

      const result = validateScoutingSettings(settings);
      expect(result.isValid).toBe(true);
    });
  });
});

describe('ScoutingSystem - Accuracy Calculations', () => {
  describe('calculateDepthMultiplier', () => {
    it('should return 0.5x for breadth focus (0.0)', () => {
      expect(calculateDepthMultiplier(0.0)).toBe(0.5);
    });

    it('should return 1.0x for balanced (0.5)', () => {
      expect(calculateDepthMultiplier(0.5)).toBe(1.0);
    });

    it('should return 1.5x for depth focus (1.0)', () => {
      expect(calculateDepthMultiplier(1.0)).toBe(1.5);
    });

    it('should follow linear formula', () => {
      const depth0_25 = calculateDepthMultiplier(0.25);
      expect(depth0_25).toBeCloseTo(BASE_DEPTH_MULTIPLIER + 0.25, 2);
    });
  });

  describe('calculateAccuracyMultiplier', () => {
    it('should multiply budget and depth multipliers', () => {
      const accuracy = calculateAccuracyMultiplier(1.5, 0.5);
      // 1.5 × 1.0 = 1.5x
      expect(accuracy).toBeCloseTo(1.5, 2);
    });

    it('should give minimum accuracy with poor budget + breadth', () => {
      const accuracy = calculateAccuracyMultiplier(0.5, 0.0);
      // 0.5 × 0.5 = 0.25x
      expect(accuracy).toBeCloseTo(0.25, 2);
    });

    it('should give maximum accuracy with elite budget + depth (capped at 2.5x)', () => {
      const accuracy = calculateAccuracyMultiplier(2.0, 1.0);
      // 2.0 × 1.5 = 3.0x, but capped at 2.5x (100% accuracy)
      expect(accuracy).toBeCloseTo(2.5, 2);
    });
  });

  describe('calculateRangeWidth', () => {
    it('should calculate range width from accuracy', () => {
      const rangeWidth = calculateRangeWidth(1.5);
      // 20 / 1.5 = 13.33 points
      expect(rangeWidth).toBeCloseTo(13.33, 1);
    });

    it('should clamp to minimum range width', () => {
      const rangeWidth = calculateRangeWidth(10.0); // Very high accuracy
      // 20 / 10 = 2 points (at minimum)
      expect(rangeWidth).toBe(MIN_RANGE_WIDTH);
    });

    it('should clamp to maximum range width', () => {
      const rangeWidth = calculateRangeWidth(0.1); // Very low accuracy
      // 20 / 0.1 = 200 points (clamped to 30)
      expect(rangeWidth).toBe(MAX_RANGE_WIDTH);
    });

    it('should produce narrower ranges with higher accuracy', () => {
      const lowAccuracy = calculateRangeWidth(0.5);
      const highAccuracy = calculateRangeWidth(2.0);

      expect(highAccuracy).toBeLessThan(lowAccuracy);
    });
  });

  describe('calculatePlayersScoutedPerWeek', () => {
    it('should calculate throughput for breadth focus', () => {
      const players = calculatePlayersScoutedPerWeek(5, 0.0);
      // 5 / 0.5 = 10 players/week
      expect(players).toBe(10);
    });

    it('should calculate throughput for balanced', () => {
      const players = calculatePlayersScoutedPerWeek(5, 0.5);
      // 5 / 1.0 = 5 players/week
      expect(players).toBe(5);
    });

    it('should calculate throughput for depth focus', () => {
      const players = calculatePlayersScoutedPerWeek(5, 1.0);
      // 5 / 1.5 = 3.33 → 3 players/week
      expect(players).toBe(3);
    });

    it('should round down fractional players', () => {
      const players = calculatePlayersScoutedPerWeek(7, 1.0);
      // 7 / 1.5 = 4.67 → 4 players/week
      expect(players).toBe(4);
    });

    it('should scale with scout count', () => {
      const players1 = calculatePlayersScoutedPerWeek(2, 0.5);
      const players2 = calculatePlayersScoutedPerWeek(4, 0.5);

      expect(players2).toBe(players1 * 2);
    });
  });
});

describe('ScoutingSystem - Range Generation', () => {
  describe('generateAttributeRange', () => {
    it('should generate centered range around true value', () => {
      const range = generateAttributeRange('agility', 75, 10);

      expect(range.attributeName).toBe('agility');
      expect(range.min).toBe(70);
      expect(range.max).toBe(80);
      expect(range.width).toBe(10);
    });

    it('should clamp minimum to 0', () => {
      const range = generateAttributeRange('strength', 5, 20);
      // True value 5, range ±10 would give -5 to 15
      expect(range.min).toBe(0);
      expect(range.max).toBe(15);
    });

    it('should clamp maximum to 100', () => {
      const range = generateAttributeRange('speed', 95, 20);
      // True value 95, range ±10 would give 85 to 105
      expect(range.min).toBe(85);
      expect(range.max).toBe(100);
    });

    it('should handle edge case: true value 0', () => {
      const range = generateAttributeRange('attr', 0, 10);

      expect(range.min).toBe(0);
      expect(range.max).toBe(5);
    });

    it('should handle edge case: true value 100', () => {
      const range = generateAttributeRange('attr', 100, 10);

      expect(range.min).toBe(95);
      expect(range.max).toBe(100);
    });

    it('should produce narrower ranges with smaller width', () => {
      const narrow = generateAttributeRange('attr', 50, 5);
      const wide = generateAttributeRange('attr', 50, 20);

      expect(narrow.width).toBeLessThan(wide.width);
    });
  });

  describe('generateSportRatingRange', () => {
    it('should generate centered range around true value', () => {
      const range = generateSportRatingRange('basketball', 70, 14);

      expect(range.sport).toBe('basketball');
      expect(range.min).toBe(63);
      expect(range.max).toBe(77);
      expect(range.width).toBe(14);
    });

    it('should clamp to 0-100 bounds', () => {
      const lowRange = generateSportRatingRange('volleyball', 3, 20);
      expect(lowRange.min).toBe(0);

      const highRange = generateSportRatingRange('handball', 97, 20);
      expect(highRange.max).toBe(100);
    });
  });
});

describe('ScoutingSystem - Scout Report Generation', () => {
  describe('generateScoutReport', () => {
    const mockAttributes = {
      agility: 75,
      grip_strength: 60,
      top_speed: 80,
      awareness: 70,
    };

    const mockSportRatings = {
      basketball: 75,
      volleyball: 65,
    };

    const mockSettings: ScoutingSettings = {
      depthSlider: 0.5,
      scoutingBudgetMultiplier: 1.5,
      simultaneousScouts: 3,
    };

    it('should generate complete scout report', () => {
      const report = generateScoutReport(
        'player-1',
        'John Doe',
        25,
        'PG',
        'basketball',
        mockAttributes,
        mockSportRatings,
        mockSettings,
        10
      );

      expect(report.playerId).toBe('player-1');
      expect(report.playerName).toBe('John Doe');
      expect(report.age).toBe(25);
      expect(report.position).toBe('PG');
      expect(report.primarySport).toBe('basketball');
      expect(report.scoutedWeek).toBe(10);
      expect(report.attributeRanges.length).toBeGreaterThan(0);
      expect(report.sportRatingRanges.length).toBe(2);
    });

    it('should generate attribute ranges for all provided attributes', () => {
      const report = generateScoutReport(
        'player-2',
        'Jane Smith',
        28,
        'SG',
        'basketball',
        mockAttributes,
        mockSportRatings,
        mockSettings,
        10
      );

      const attrNames = report.attributeRanges.map(r => r.attributeName);

      expect(attrNames).toContain('agility');
      expect(attrNames).toContain('grip_strength');
      expect(attrNames).toContain('top_speed');
      expect(attrNames).toContain('awareness');
    });

    it('should generate sport rating ranges for all sports', () => {
      const report = generateScoutReport(
        'player-3',
        'Alex Johnson',
        23,
        'SF',
        'basketball',
        mockAttributes,
        mockSportRatings,
        mockSettings,
        10
      );

      const sportNames = report.sportRatingRanges.map(r => r.sport);

      expect(sportNames).toContain('basketball');
      expect(sportNames).toContain('volleyball');
    });

    it('should calculate overall rating range from sport ratings', () => {
      const report = generateScoutReport(
        'player-4',
        'Chris Lee',
        26,
        'PF',
        'basketball',
        mockAttributes,
        mockSportRatings,
        mockSettings,
        10
      );

      // Overall should be average of sport rating ranges
      const avgMin = Math.round(
        report.sportRatingRanges.reduce((sum, r) => sum + r.min, 0) / report.sportRatingRanges.length
      );
      const avgMax = Math.round(
        report.sportRatingRanges.reduce((sum, r) => sum + r.max, 0) / report.sportRatingRanges.length
      );

      expect(report.estimatedOverallMin).toBe(avgMin);
      expect(report.estimatedOverallMax).toBe(avgMax);
    });

    it('should store accuracy multiplier for UI display', () => {
      const report = generateScoutReport(
        'player-5',
        'Taylor Brown',
        24,
        'C',
        'basketball',
        mockAttributes,
        mockSportRatings,
        mockSettings,
        10
      );

      const expectedAccuracy = calculateAccuracyMultiplier(
        mockSettings.scoutingBudgetMultiplier,
        mockSettings.depthSlider
      );

      expect(report.accuracyMultiplier).toBeCloseTo(expectedAccuracy, 2);
    });

    it('should produce narrower ranges with better settings', () => {
      const poorSettings: ScoutingSettings = {
        depthSlider: 0.0,
        scoutingBudgetMultiplier: 0.5,
        simultaneousScouts: 1,
      };

      const eliteSettings: ScoutingSettings = {
        depthSlider: 1.0,
        scoutingBudgetMultiplier: 2.0,
        simultaneousScouts: 5,
      };

      const poorReport = generateScoutReport(
        'player-6',
        'Poor Scout',
        25,
        'PG',
        'basketball',
        mockAttributes,
        mockSportRatings,
        poorSettings,
        10
      );

      const eliteReport = generateScoutReport(
        'player-7',
        'Elite Scout',
        25,
        'PG',
        'basketball',
        mockAttributes,
        mockSportRatings,
        eliteSettings,
        10
      );

      const poorWidth = poorReport.attributeRanges[0].width;
      const eliteWidth = eliteReport.attributeRanges[0].width;

      expect(eliteWidth).toBeLessThan(poorWidth);
    });
  });
});

describe('ScoutingSystem - Weekly Scouting', () => {
  describe('simulateWeeklyScouting', () => {
    const mockPlayers = [
      {
        id: 'p1',
        name: 'Player 1',
        age: 25,
        position: 'PG',
        primarySport: 'basketball',
        attributes: { agility: 75, strength: 60 },
        sportRatings: { basketball: 75 },
      },
      {
        id: 'p2',
        name: 'Player 2',
        age: 28,
        position: 'SG',
        primarySport: 'volleyball',
        attributes: { agility: 70, strength: 65 },
        sportRatings: { volleyball: 70 },
      },
      {
        id: 'p3',
        name: 'Player 3',
        age: 23,
        position: 'SF',
        primarySport: 'handball',
        attributes: { agility: 80, strength: 70 },
        sportRatings: { handball: 80 },
      },
    ];

    it('should scout correct number of players (breadth)', () => {
      const settings: ScoutingSettings = {
        depthSlider: 0.0,
        scoutingBudgetMultiplier: 1.0,
        simultaneousScouts: 5,
      };

      const result = simulateWeeklyScouting(mockPlayers, settings, 1);

      // 5 / 0.5 = 10 players, but only 3 available
      expect(result.playersScoutedCount).toBe(3);
      expect(result.reports.length).toBe(3);
    });

    it('should scout correct number of players (depth)', () => {
      const settings: ScoutingSettings = {
        depthSlider: 1.0,
        scoutingBudgetMultiplier: 1.0,
        simultaneousScouts: 3,
      };

      const result = simulateWeeklyScouting(mockPlayers, settings, 1);

      // 3 / 1.5 = 2 players
      expect(result.playersScoutedCount).toBe(2);
      expect(result.reports.length).toBe(2);
    });

    it('should not exceed available players', () => {
      const settings: ScoutingSettings = {
        depthSlider: 0.0,
        scoutingBudgetMultiplier: 2.0,
        simultaneousScouts: 10,
      };

      const result = simulateWeeklyScouting(mockPlayers, settings, 1);

      // Can scout 20 players/week, but only 3 available
      expect(result.playersScoutedCount).toBe(3);
      expect(result.reports.length).toBe(3);
    });

    it('should generate reports for scouted players', () => {
      const settings: ScoutingSettings = {
        depthSlider: 0.5,
        scoutingBudgetMultiplier: 1.0,
        simultaneousScouts: 2,
      };

      const result = simulateWeeklyScouting(mockPlayers, settings, 5);

      expect(result.reports.length).toBeGreaterThan(0);

      result.reports.forEach(report => {
        expect(report.playerId).toBeTruthy();
        expect(report.playerName).toBeTruthy();
        expect(report.scoutedWeek).toBe(5);
        expect(report.attributeRanges.length).toBeGreaterThan(0);
        expect(report.sportRatingRanges.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty player list', () => {
      const settings: ScoutingSettings = {
        depthSlider: 0.5,
        scoutingBudgetMultiplier: 1.0,
        simultaneousScouts: 5,
      };

      const result = simulateWeeklyScouting([], settings, 1);

      expect(result.playersScoutedCount).toBe(0);
      expect(result.reports.length).toBe(0);
    });
  });
});

describe('ScoutingSystem - Utility Functions', () => {
  describe('getConfidenceLevel', () => {
    it('should return "Very High" for narrow ranges (≤5)', () => {
      expect(getConfidenceLevel(2)).toBe('Very High');
      expect(getConfidenceLevel(5)).toBe('Very High');
    });

    it('should return "High" for ranges 6-10', () => {
      expect(getConfidenceLevel(6)).toBe('High');
      expect(getConfidenceLevel(10)).toBe('High');
    });

    it('should return "Medium" for ranges 11-20', () => {
      expect(getConfidenceLevel(11)).toBe('Medium');
      expect(getConfidenceLevel(20)).toBe('Medium');
    });

    it('should return "Low" for wide ranges (>20)', () => {
      expect(getConfidenceLevel(21)).toBe('Low');
      expect(getConfidenceLevel(30)).toBe('Low');
    });
  });

  describe('getExpectedValue', () => {
    it('should calculate midpoint of range', () => {
      expect(getExpectedValue(60, 80)).toBe(70);
      expect(getExpectedValue(45, 55)).toBe(50);
    });

    it('should round to nearest integer', () => {
      expect(getExpectedValue(60, 81)).toBe(71); // 70.5 → 71
      expect(getExpectedValue(45, 54)).toBe(50); // 49.5 → 50
    });
  });

  describe('formatAttributeRange', () => {
    it('should format attribute range with expected value', () => {
      const range = {
        attributeName: 'agility',
        min: 68,
        max: 82,
        width: 14,
      };

      const formatted = formatAttributeRange(range);
      expect(formatted).toBe('agility: 68-82 (75)');
    });
  });

  describe('formatSportRatingRange', () => {
    it('should format sport rating range with expected value', () => {
      const range = {
        sport: 'basketball',
        min: 70,
        max: 85,
        width: 15,
      };

      const formatted = formatSportRatingRange(range);
      expect(formatted).toBe('basketball: 70-85 (78)');
    });
  });
});

describe('ScoutingSystem - Integration', () => {
  it('should demonstrate breadth vs depth tradeoff', () => {
    const breadthSettings: ScoutingSettings = {
      depthSlider: 0.0,
      scoutingBudgetMultiplier: 1.0,
      simultaneousScouts: 5,
    };

    const depthSettings: ScoutingSettings = {
      depthSlider: 1.0,
      scoutingBudgetMultiplier: 1.0,
      simultaneousScouts: 5,
    };

    // Breadth: More players, wider ranges
    const breadthPlayers = calculatePlayersScoutedPerWeek(
      breadthSettings.simultaneousScouts,
      breadthSettings.depthSlider
    );
    const breadthAccuracy = calculateAccuracyMultiplier(
      breadthSettings.scoutingBudgetMultiplier,
      breadthSettings.depthSlider
    );
    const breadthWidth = calculateRangeWidth(breadthAccuracy);

    // Depth: Fewer players, narrower ranges
    const depthPlayers = calculatePlayersScoutedPerWeek(
      depthSettings.simultaneousScouts,
      depthSettings.depthSlider
    );
    const depthAccuracy = calculateAccuracyMultiplier(
      depthSettings.scoutingBudgetMultiplier,
      depthSettings.depthSlider
    );
    const depthWidth = calculateRangeWidth(depthAccuracy);

    // Verify tradeoff
    expect(breadthPlayers).toBeGreaterThan(depthPlayers);
    expect(depthWidth).toBeLessThan(breadthWidth);
  });

  it('should demonstrate budget impact on accuracy', () => {
    const poorSettings: ScoutingSettings = {
      depthSlider: 0.5,
      scoutingBudgetMultiplier: 0.5,
      simultaneousScouts: 1,
    };

    const eliteSettings: ScoutingSettings = {
      depthSlider: 0.5,
      scoutingBudgetMultiplier: 2.0,
      simultaneousScouts: 5,
    };

    const poorAccuracy = calculateAccuracyMultiplier(
      poorSettings.scoutingBudgetMultiplier,
      poorSettings.depthSlider
    );
    const poorWidth = calculateRangeWidth(poorAccuracy);

    const eliteAccuracy = calculateAccuracyMultiplier(
      eliteSettings.scoutingBudgetMultiplier,
      eliteSettings.depthSlider
    );
    const eliteWidth = calculateRangeWidth(eliteAccuracy);

    // Elite budget should give narrower ranges
    expect(eliteWidth).toBeLessThan(poorWidth);

    // Elite budget also scouts more players
    const poorPlayers = calculatePlayersScoutedPerWeek(
      poorSettings.simultaneousScouts,
      poorSettings.depthSlider
    );
    const elitePlayers = calculatePlayersScoutedPerWeek(
      eliteSettings.simultaneousScouts,
      eliteSettings.depthSlider
    );

    expect(elitePlayers).toBeGreaterThan(poorPlayers);
  });

  it('should match example from FORMULAS.md (Scenario B)', () => {
    // Scenario B: Good budget (1.5x), Balanced (0.5 slider)
    const settings: ScoutingSettings = {
      depthSlider: 0.5,
      scoutingBudgetMultiplier: 1.5,
      simultaneousScouts: 5,
    };

    const accuracy = calculateAccuracyMultiplier(
      settings.scoutingBudgetMultiplier,
      settings.depthSlider
    );
    const rangeWidth = calculateRangeWidth(accuracy);

    // Expected: accuracyMultiplier = 1.5 × 1.0 = 1.5x
    expect(accuracy).toBeCloseTo(1.5, 2);

    // Expected: rangeWidth = 20 / 1.5 = 13.3 points
    expect(rangeWidth).toBeCloseTo(13.33, 1);

    // Players scouted: 5 / 1.0 = 5 per week
    const playersPerWeek = calculatePlayersScoutedPerWeek(
      settings.simultaneousScouts,
      settings.depthSlider
    );
    expect(playersPerWeek).toBe(5);
  });

  it('should match example from FORMULAS.md (Scenario C)', () => {
    // Scenario C: Elite budget (2.0x), Depth focus (1.0 slider)
    const settings: ScoutingSettings = {
      depthSlider: 1.0,
      scoutingBudgetMultiplier: 2.0,
      simultaneousScouts: 5,
    };

    const accuracy = calculateAccuracyMultiplier(
      settings.scoutingBudgetMultiplier,
      settings.depthSlider
    );
    const rangeWidth = calculateRangeWidth(accuracy);

    // Expected: accuracyMultiplier = 2.0 × 1.5 = 3.0x, capped at 2.5x (100% accuracy)
    expect(accuracy).toBeCloseTo(2.5, 2);

    // Expected: rangeWidth = 20 / 2.5 = 8 points
    expect(rangeWidth).toBeCloseTo(8, 1);

    // Players scouted: 5 / 1.5 = 3.33 → 3 per week
    const playersPerWeek = calculatePlayersScoutedPerWeek(
      settings.simultaneousScouts,
      settings.depthSlider
    );
    expect(playersPerWeek).toBe(3);
  });
});
