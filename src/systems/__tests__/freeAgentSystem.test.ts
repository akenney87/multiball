import {
  generateRandomRating,
  generateRandomAge,
  generateRandomPotential,
  generateRandomSport,
  generateRandomPosition,
  generateSportRatings,
  generateFreeAgent,
  refreshFreeAgentPool,
  filterFreeAgents,
  sortFreeAgents,
  getTopFreeAgents,
  findFreeAgentById,
  removeFreeAgent,
  DEFAULT_POOL_CONFIG,
  AVAILABLE_SPORTS,
  POSITIONS_BY_SPORT,
  FreeAgent,
} from '../freeAgentSystem';

describe('FreeAgentSystem - Random Generation', () => {
  describe('generateRandomRating', () => {
    it('should generate ratings within valid range (40-85)', () => {
      for (let i = 0; i < 100; i++) {
        const rating = generateRandomRating(i);
        expect(rating).toBeGreaterThanOrEqual(40);
        expect(rating).toBeLessThanOrEqual(85);
      }
    });

    it('should generate deterministic ratings with same seed', () => {
      const rating1 = generateRandomRating(42);
      const rating2 = generateRandomRating(42);
      expect(rating1).toBe(rating2);
    });

    it('should generate different ratings with different seeds', () => {
      const rating1 = generateRandomRating(1);
      const rating2 = generateRandomRating(2);
      // Not guaranteed but statistically very likely
      expect(rating1).not.toBe(rating2);
    });

    it('should follow weighted distribution (more low ratings)', () => {
      const ratings: number[] = [];
      for (let i = 0; i < 1000; i++) {
        ratings.push(generateRandomRating(i));
      }

      const below60 = ratings.filter(r => r < 60).length;
      const above70 = ratings.filter(r => r > 70).length;

      // Should have more ratings below 60 than above 70
      expect(below60).toBeGreaterThan(above70);
    });
  });

  describe('generateRandomAge', () => {
    it('should generate ages within valid range (18-38)', () => {
      for (let i = 0; i < 100; i++) {
        const age = generateRandomAge(i);
        expect(age).toBeGreaterThanOrEqual(18);
        expect(age).toBeLessThanOrEqual(38);
      }
    });

    it('should generate deterministic ages with same seed', () => {
      const age1 = generateRandomAge(42);
      const age2 = generateRandomAge(42);
      expect(age1).toBe(age2);
    });

    it('should be weighted toward younger players', () => {
      const ages: number[] = [];
      for (let i = 0; i < 1000; i++) {
        ages.push(generateRandomAge(i));
      }

      const under28 = ages.filter(a => a < 28).length;
      const over32 = ages.filter(a => a > 32).length;

      // Should have more young players than old players
      expect(under28).toBeGreaterThan(over32);
    });
  });

  describe('generateRandomPotential', () => {
    it('should give younger players higher potential ranges', () => {
      const youngPotential = generateRandomPotential(60, 20, 123);
      const oldPotential = generateRandomPotential(60, 35, 123);

      // Young player should have higher potential
      expect(youngPotential).toBeGreaterThanOrEqual(oldPotential);
    });

    it('should cap potential at 100', () => {
      const potential = generateRandomPotential(95, 20, 456);
      expect(potential).toBeLessThanOrEqual(100);
    });

    it('should always be >= current rating', () => {
      for (let i = 0; i < 50; i++) {
        const rating = 60;
        const age = 25;
        const potential = generateRandomPotential(rating, age, i);
        expect(potential).toBeGreaterThanOrEqual(rating);
      }
    });
  });

  describe('generateRandomSport', () => {
    it('should generate valid sports', () => {
      for (let i = 0; i < 100; i++) {
        const sport = generateRandomSport(i);
        expect(AVAILABLE_SPORTS).toContain(sport);
      }
    });

    it('should be deterministic with same seed', () => {
      const sport1 = generateRandomSport(42);
      const sport2 = generateRandomSport(42);
      expect(sport1).toBe(sport2);
    });
  });

  describe('generateRandomPosition', () => {
    it('should generate valid positions for basketball', () => {
      const position = generateRandomPosition('basketball', 123);
      expect(POSITIONS_BY_SPORT.basketball).toContain(position);
    });

    it('should generate valid positions for volleyball', () => {
      const position = generateRandomPosition('volleyball', 456);
      expect(POSITIONS_BY_SPORT.volleyball).toContain(position);
    });

    it('should be deterministic with same seed', () => {
      const pos1 = generateRandomPosition('basketball', 42);
      const pos2 = generateRandomPosition('basketball', 42);
      expect(pos1).toBe(pos2);
    });
  });

  describe('generateSportRatings', () => {
    it('should always include primary sport', () => {
      const ratings = generateSportRatings('basketball', 75, 123);
      expect(ratings.basketball).toBe(75);
    });

    it('should sometimes include 2nd sport (50+)', () => {
      let hasSecondSport = false;

      for (let i = 0; i < 100; i++) {
        const ratings = generateSportRatings('basketball', 70, i);
        const sports = Object.keys(ratings);

        if (sports.length > 1) {
          hasSecondSport = true;
          // Check all secondary sports are 50+
          sports.forEach(sport => {
            if (sport !== 'basketball') {
              expect(ratings[sport]).toBeGreaterThanOrEqual(50);
            }
          });
        }
      }

      expect(hasSecondSport).toBe(true);
    });

    it('should rarely include 3rd sport', () => {
      let hasThirdSport = false;

      for (let i = 0; i < 100; i++) {
        const ratings = generateSportRatings('basketball', 70, i);
        if (Object.keys(ratings).length >= 3) {
          hasThirdSport = true;
        }
      }

      // Should find at least one in 100 attempts
      expect(hasThirdSport).toBe(true);
    });
  });
});

describe('FreeAgentSystem - Free Agent Generation', () => {
  describe('generateFreeAgent', () => {
    it('should generate a complete free agent', () => {
      const agent = generateFreeAgent('test-1', 1, 12345);

      expect(agent.id).toBe('test-1');
      expect(agent.name).toBeTruthy();
      expect(agent.age).toBeGreaterThanOrEqual(18);
      expect(agent.age).toBeLessThanOrEqual(38);
      expect(agent.overallRating).toBeGreaterThanOrEqual(40);
      expect(agent.overallRating).toBeLessThanOrEqual(85);
      expect(agent.primarySport).toBeTruthy();
      expect(agent.position).toBeTruthy();
      expect(agent.averagePotential).toBeGreaterThanOrEqual(agent.overallRating);
      expect(agent.marketValue).toBeGreaterThan(0);
      expect(agent.annualSalary).toBeGreaterThan(0);
      expect(agent.demands).toBeDefined();
      expect(agent.addedDate).toBe(1);
    });

    it('should generate valuation using Contract System', () => {
      const agent = generateFreeAgent('test-2', 1, 54321);

      // Salary should be ~20% of market value
      const expectedSalary = agent.marketValue * 0.20;
      expect(agent.annualSalary).toBeCloseTo(expectedSalary, -3); // Within $1000
    });

    it('should generate demands using Contract System', () => {
      const agent = generateFreeAgent('test-3', 1, 99999);

      // Demands should be reasonable
      expect(agent.demands.minAnnualSalary).toBeGreaterThan(agent.annualSalary * 0.9);
      expect(agent.demands.preferredLength).toBeGreaterThanOrEqual(2);
      expect(agent.demands.preferredLength).toBeLessThanOrEqual(5);
      expect(agent.demands.minSigningBonus).toBeGreaterThan(0);
    });

    it('should be deterministic with same seed', () => {
      const agent1 = generateFreeAgent('test-4', 1, 11111);
      const agent2 = generateFreeAgent('test-4', 1, 11111);

      expect(agent1.name).toBe(agent2.name);
      expect(agent1.age).toBe(agent2.age);
      expect(agent1.overallRating).toBe(agent2.overallRating);
      expect(agent1.primarySport).toBe(agent2.primarySport);
    });

    it('should generate different players with different seeds', () => {
      const agent1 = generateFreeAgent('test-5', 1, 10);
      const agent2 = generateFreeAgent('test-6', 1, 20);

      // Not all attributes will be different, but at least one should be
      const isDifferent =
        agent1.age !== agent2.age ||
        agent1.overallRating !== agent2.overallRating ||
        agent1.primarySport !== agent2.primarySport;

      expect(isDifferent).toBe(true);
    });
  });
});

describe('FreeAgentSystem - Pool Management', () => {
  describe('refreshFreeAgentPool', () => {
    it('should add new players to empty pool', () => {
      const result = refreshFreeAgentPool([], 1, DEFAULT_POOL_CONFIG, 1000);

      expect(result.added.length).toBe(DEFAULT_POOL_CONFIG.refreshRate);
      expect(result.removed.length).toBe(0);
      expect(result.poolSize).toBe(DEFAULT_POOL_CONFIG.refreshRate);
    });

    it('should not exceed maxSize', () => {
      const config = { ...DEFAULT_POOL_CONFIG, maxSize: 15, refreshRate: 10 };

      // Fill pool to 12
      const pool: FreeAgent[] = [];
      for (let i = 0; i < 12; i++) {
        pool.push(generateFreeAgent(`existing-${i}`, 1, i));
      }

      const result = refreshFreeAgentPool(pool, 2, config, 2000);

      // Should only add 3 to reach maxSize of 15
      expect(result.added.length).toBe(3);
      expect(result.poolSize).toBe(15);
    });

    it('should remove expired players', () => {
      const config = { ...DEFAULT_POOL_CONFIG, expiryWeeks: 12 };

      // Add players from week 1
      const oldPlayers = [
        generateFreeAgent('old-1', 1, 100),
        generateFreeAgent('old-2', 1, 101),
      ];

      // Add players from week 10
      const recentPlayers = [
        generateFreeAgent('recent-1', 10, 200),
        generateFreeAgent('recent-2', 10, 201),
      ];

      const pool = [...oldPlayers, ...recentPlayers];

      // Current week is 13 (old players are 12 weeks old)
      const result = refreshFreeAgentPool(pool, 13, config, 3000);

      expect(result.removed.length).toBe(2);
      expect(result.removed).toContainEqual(expect.objectContaining({ id: 'old-1' }));
      expect(result.removed).toContainEqual(expect.objectContaining({ id: 'old-2' }));
    });

    it('should maintain pool between refresh cycles', () => {
      const config = { ...DEFAULT_POOL_CONFIG, refreshRate: 5, expiryWeeks: 12 };

      // Week 1: Add 5 players
      let result1 = refreshFreeAgentPool([], 1, config, 1000);
      expect(result1.added.length).toBe(5);
      expect(result1.poolSize).toBe(5);

      // Week 2: Add 5 more (total 10)
      let pool = [...result1.added];
      let result2 = refreshFreeAgentPool(pool, 2, config, 2000);
      expect(result2.added.length).toBe(5);
      expect(result2.poolSize).toBe(10);

      // Week 3: Add 5 more (total 15)
      pool = [...pool, ...result2.added];
      let result3 = refreshFreeAgentPool(pool, 3, config, 3000);
      expect(result3.added.length).toBe(5);
      expect(result3.poolSize).toBe(15);
    });
  });
});

describe('FreeAgentSystem - Filtering and Sorting', () => {
  let testPool: FreeAgent[];

  beforeEach(() => {
    testPool = [
      generateFreeAgent('player-1', 1, 100),  // Will be deterministic
      generateFreeAgent('player-2', 1, 200),
      generateFreeAgent('player-3', 1, 300),
      generateFreeAgent('player-4', 1, 400),
      generateFreeAgent('player-5', 1, 500),
    ];
  });

  describe('filterFreeAgents', () => {
    it('should filter by minimum rating', () => {
      const filtered = filterFreeAgents(testPool, { minRating: 60 });
      filtered.forEach(fa => {
        expect(fa.overallRating).toBeGreaterThanOrEqual(60);
      });
    });

    it('should filter by maximum rating', () => {
      const filtered = filterFreeAgents(testPool, { maxRating: 70 });
      filtered.forEach(fa => {
        expect(fa.overallRating).toBeLessThanOrEqual(70);
      });
    });

    it('should filter by rating range', () => {
      const filtered = filterFreeAgents(testPool, { minRating: 55, maxRating: 75 });
      filtered.forEach(fa => {
        expect(fa.overallRating).toBeGreaterThanOrEqual(55);
        expect(fa.overallRating).toBeLessThanOrEqual(75);
      });
    });

    it('should filter by maximum age', () => {
      const filtered = filterFreeAgents(testPool, { maxAge: 28 });
      filtered.forEach(fa => {
        expect(fa.age).toBeLessThanOrEqual(28);
      });
    });

    it('should filter by minimum age', () => {
      const filtered = filterFreeAgents(testPool, { minAge: 25 });
      filtered.forEach(fa => {
        expect(fa.age).toBeGreaterThanOrEqual(25);
      });
    });

    it('should filter by maximum salary', () => {
      const filtered = filterFreeAgents(testPool, { maxSalary: 200000 });
      filtered.forEach(fa => {
        expect(fa.annualSalary).toBeLessThanOrEqual(200000);
      });
    });

    it('should filter by sport (must be 50+ in that sport)', () => {
      const filtered = filterFreeAgents(testPool, { sport: 'basketball' });
      filtered.forEach(fa => {
        expect(fa.sportsRatings.basketball).toBeGreaterThanOrEqual(50);
      });
    });

    it('should filter by position', () => {
      const filtered = filterFreeAgents(testPool, { position: 'PG' });
      filtered.forEach(fa => {
        expect(fa.position).toBe('PG');
      });
    });

    it('should combine multiple filters', () => {
      const filtered = filterFreeAgents(testPool, {
        minRating: 55,
        maxAge: 30,
        maxSalary: 250000,
      });

      filtered.forEach(fa => {
        expect(fa.overallRating).toBeGreaterThanOrEqual(55);
        expect(fa.age).toBeLessThanOrEqual(30);
        expect(fa.annualSalary).toBeLessThanOrEqual(250000);
      });
    });

    it('should return empty array if no matches', () => {
      const filtered = filterFreeAgents(testPool, { minRating: 90 });
      expect(filtered.length).toBe(0);
    });
  });

  describe('sortFreeAgents', () => {
    it('should sort by rating (descending)', () => {
      const sorted = sortFreeAgents(testPool, 'rating', false);

      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].overallRating).toBeGreaterThanOrEqual(sorted[i + 1].overallRating);
      }
    });

    it('should sort by rating (ascending)', () => {
      const sorted = sortFreeAgents(testPool, 'rating', true);

      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].overallRating).toBeLessThanOrEqual(sorted[i + 1].overallRating);
      }
    });

    it('should sort by age', () => {
      const sorted = sortFreeAgents(testPool, 'age', true);

      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].age).toBeLessThanOrEqual(sorted[i + 1].age);
      }
    });

    it('should sort by salary', () => {
      const sorted = sortFreeAgents(testPool, 'salary', false);

      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].annualSalary).toBeGreaterThanOrEqual(sorted[i + 1].annualSalary);
      }
    });

    it('should sort by potential', () => {
      const sorted = sortFreeAgents(testPool, 'potential', false);

      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].averagePotential).toBeGreaterThanOrEqual(sorted[i + 1].averagePotential);
      }
    });

    it('should not mutate original array', () => {
      const original = [...testPool];
      sortFreeAgents(testPool, 'rating', false);

      // Original should be unchanged
      expect(testPool).toEqual(original);
    });
  });

  describe('getTopFreeAgents', () => {
    it('should return top N players by rating', () => {
      const top3 = getTopFreeAgents(testPool, 3);

      expect(top3.length).toBe(3);

      // Should be sorted by rating descending
      expect(top3[0].overallRating).toBeGreaterThanOrEqual(top3[1].overallRating);
      expect(top3[1].overallRating).toBeGreaterThanOrEqual(top3[2].overallRating);
    });

    it('should return all players if N > pool size', () => {
      const top10 = getTopFreeAgents(testPool, 10);
      expect(top10.length).toBe(testPool.length);
    });
  });
});

describe('FreeAgentSystem - Pool Operations', () => {
  let testPool: FreeAgent[];

  beforeEach(() => {
    testPool = [
      generateFreeAgent('player-1', 1, 100),
      generateFreeAgent('player-2', 1, 200),
      generateFreeAgent('player-3', 1, 300),
    ];
  });

  describe('findFreeAgentById', () => {
    it('should find existing free agent', () => {
      const found = findFreeAgentById(testPool, 'player-2');
      expect(found).not.toBeNull();
      expect(found?.id).toBe('player-2');
    });

    it('should return null for non-existent ID', () => {
      const found = findFreeAgentById(testPool, 'non-existent');
      expect(found).toBeNull();
    });
  });

  describe('removeFreeAgent', () => {
    it('should remove free agent by ID', () => {
      const updated = removeFreeAgent(testPool, 'player-2');

      expect(updated.length).toBe(2);
      expect(updated.find(fa => fa.id === 'player-2')).toBeUndefined();
    });

    it('should not mutate original array', () => {
      const original = [...testPool];
      removeFreeAgent(testPool, 'player-2');

      expect(testPool).toEqual(original);
    });

    it('should handle removing non-existent ID', () => {
      const updated = removeFreeAgent(testPool, 'non-existent');
      expect(updated.length).toBe(testPool.length);
    });
  });
});

describe('FreeAgentSystem - Integration', () => {
  it('should simulate full free agent lifecycle', () => {
    const config = { ...DEFAULT_POOL_CONFIG, maxSize: 20, refreshRate: 5, expiryWeeks: 4 };

    // Week 1: Initialize pool
    let result1 = refreshFreeAgentPool([], 1, config, 1000);
    expect(result1.poolSize).toBe(5);

    let pool = result1.added;

    // Week 2: Add more players
    let result2 = refreshFreeAgentPool(pool, 2, config, 2000);
    expect(result2.poolSize).toBe(10);

    pool = [...pool, ...result2.added].filter(
      fa => !result2.removed.includes(fa)
    );

    // Week 3: Add more players
    let result3 = refreshFreeAgentPool(pool, 3, config, 3000);
    expect(result3.poolSize).toBe(15);

    pool = [...pool, ...result3.added].filter(
      fa => !result3.removed.includes(fa)
    );

    // Week 5: Old players from week 1 should expire
    let result5 = refreshFreeAgentPool(pool, 5, config, 5000);

    // Week 1 players should be removed (5 weeks old, expiry = 4)
    expect(result5.removed.length).toBeGreaterThan(0);
  });

  it('should support filtering, sorting, and selection workflow', () => {
    // Generate diverse pool
    const pool: FreeAgent[] = [];
    for (let i = 0; i < 50; i++) {
      pool.push(generateFreeAgent(`player-${i}`, 1, i * 100));
    }

    // Step 1: Filter by criteria (young, decent rating, affordable)
    const filtered = filterFreeAgents(pool, {
      minRating: 60,
      maxAge: 28,
      maxSalary: 300000,
    });

    // Step 2: Sort by rating
    const sorted = sortFreeAgents(filtered, 'rating', false);

    // Step 3: Get top 5
    const top5 = sorted.slice(0, 5);

    expect(top5.length).toBeLessThanOrEqual(5);

    top5.forEach(fa => {
      expect(fa.overallRating).toBeGreaterThanOrEqual(60);
      expect(fa.age).toBeLessThanOrEqual(28);
      expect(fa.annualSalary).toBeLessThanOrEqual(300000);
    });

    // Verify sorted by rating
    for (let i = 0; i < top5.length - 1; i++) {
      expect(top5[i].overallRating).toBeGreaterThanOrEqual(top5[i + 1].overallRating);
    }
  });
});
