import {
  validateTransferMultiplier,
  getUrgencyMultiplier,
  calculateTransferFee,
  calculateMinAcceptableOffer,
  evaluateTransferOffer,
  createTransferOffer,
  acceptTransferOffer,
  rejectTransferOffer,
  expireTransferOffer,
  processTransferOffer,
  suggestAskingPrice,
  calculatePlayerMarketValue,
  filterOffersByStatus,
  sortOffersByAmount,
  getOffersForPlayer,
  getOffersForTeam,
  expireOldOffers,
  MIN_TRANSFER_MULTIPLIER,
  MAX_TRANSFER_MULTIPLIER,
  DEFAULT_TRANSFER_MULTIPLIER,
  URGENCY_MULTIPLIERS,
  PERSONALITY_MULTIPLIERS,
  TransferOffer,
  AITransferSettings,
} from '../transferSystem';

describe('TransferSystem - Transfer Fee Calculation', () => {
  describe('validateTransferMultiplier', () => {
    it('should accept valid multipliers', () => {
      expect(validateTransferMultiplier(2.0)).toBe(2.0);
      expect(validateTransferMultiplier(1.8)).toBe(1.8);
      expect(validateTransferMultiplier(2.5)).toBe(2.5);
    });

    it('should clamp to minimum (1.5x)', () => {
      expect(validateTransferMultiplier(1.0)).toBe(MIN_TRANSFER_MULTIPLIER);
      expect(validateTransferMultiplier(0.5)).toBe(MIN_TRANSFER_MULTIPLIER);
    });

    it('should clamp to maximum (3.0x)', () => {
      expect(validateTransferMultiplier(3.5)).toBe(MAX_TRANSFER_MULTIPLIER);
      expect(validateTransferMultiplier(5.0)).toBe(MAX_TRANSFER_MULTIPLIER);
    });

    it('should accept boundary values', () => {
      expect(validateTransferMultiplier(MIN_TRANSFER_MULTIPLIER)).toBe(1.5);
      expect(validateTransferMultiplier(MAX_TRANSFER_MULTIPLIER)).toBe(3.0);
    });
  });

  describe('getUrgencyMultiplier', () => {
    it('should return 0.8x for reluctant buyer', () => {
      expect(getUrgencyMultiplier('reluctant')).toBe(URGENCY_MULTIPLIERS.reluctant);
      expect(getUrgencyMultiplier('reluctant')).toBe(0.8);
    });

    it('should return 1.0x for neutral buyer', () => {
      expect(getUrgencyMultiplier('neutral')).toBe(URGENCY_MULTIPLIERS.neutral);
      expect(getUrgencyMultiplier('neutral')).toBe(1.0);
    });

    it('should return 1.2x for desperate buyer', () => {
      expect(getUrgencyMultiplier('desperate')).toBe(URGENCY_MULTIPLIERS.desperate);
      expect(getUrgencyMultiplier('desperate')).toBe(1.2);
    });
  });

  describe('calculateTransferFee', () => {
    it('should calculate fee with standard multipliers', () => {
      const fee = calculateTransferFee(1000000, 2.0, 1.0);
      // 1M × 2.0 × 1.0 = 2M
      expect(fee).toBe(2000000);
    });

    it('should calculate fee with reluctant buyer (0.8x)', () => {
      const fee = calculateTransferFee(1000000, 2.0, 0.8);
      // 1M × 2.0 × 0.8 = 1.6M
      expect(fee).toBe(1600000);
    });

    it('should calculate fee with desperate buyer (1.2x)', () => {
      const fee = calculateTransferFee(1000000, 2.0, 1.2);
      // 1M × 2.0 × 1.2 = 2.4M
      expect(fee).toBe(2400000);
    });

    it('should clamp invalid transfer multipliers', () => {
      const fee = calculateTransferFee(1000000, 5.0, 1.0);
      // 5.0 clamped to 3.0: 1M × 3.0 × 1.0 = 3M
      expect(fee).toBe(3000000);
    });

    it('should round to nearest integer', () => {
      const fee = calculateTransferFee(1000000, 1.75, 1.1);
      // 1M × 1.75 × 1.1 = 1,925,000
      expect(fee).toBe(1925000);
    });

    it('should match FORMULAS.md example', () => {
      // Example: $1M player, 2.0x asking, 1.2x desperate = $2.4M
      const fee = calculateTransferFee(1000000, 2.0, 1.2);
      expect(fee).toBe(2400000);
    });
  });
});

describe('TransferSystem - AI Acceptance Logic', () => {
  describe('calculateMinAcceptableOffer', () => {
    const baseSettings: AITransferSettings = {
      teamId: 'team-1',
      personality: 'balanced',
      leaguePosition: 6,
      totalTeams: 12,
      contractExpiringWithinYears: 3,
    };

    it('should calculate min offer for balanced team', () => {
      const minOffer = calculateMinAcceptableOffer(1000000, baseSettings);
      // Balanced personality: 1.5x base
      // Middle third position: -0.2x adjustment
      // 2+ years contract: 0.0x adjustment
      // Total: 1.5 - 0.2 = 1.3x → $1.3M
      expect(minOffer).toBe(1300000);
    });

    it('should demand more for conservative team', () => {
      const settings: AITransferSettings = {
        ...baseSettings,
        personality: 'conservative',
      };

      const minOffer = calculateMinAcceptableOffer(1000000, settings);
      // Conservative: 2.0x - 0.2x = 1.8x → $1.8M
      expect(minOffer).toBe(1800000);
    });

    it('should accept less for aggressive team', () => {
      const settings: AITransferSettings = {
        ...baseSettings,
        personality: 'aggressive',
      };

      const minOffer = calculateMinAcceptableOffer(1000000, settings);
      // Aggressive: 0.8x - 0.2x = 0.6x → $600k
      expect(minOffer).toBe(600000);
    });

    it('should accept less for bottom-tier teams', () => {
      const settings: AITransferSettings = {
        ...baseSettings,
        leaguePosition: 11, // Bottom third
        totalTeams: 12,
      };

      const minOffer = calculateMinAcceptableOffer(1000000, settings);
      // Balanced: 1.5x - 0.4x (bottom third) = 1.1x → $1.1M
      expect(minOffer).toBe(1100000);
    });

    it('should not adjust for top-tier teams', () => {
      const settings: AITransferSettings = {
        ...baseSettings,
        leaguePosition: 1, // Top third
        totalTeams: 12,
      };

      const minOffer = calculateMinAcceptableOffer(1000000, settings);
      // Balanced: 1.5x + 0.0x (top third) = 1.5x → $1.5M
      expect(minOffer).toBe(1500000);
    });

    it('should accept less for expiring contracts', () => {
      const settings: AITransferSettings = {
        ...baseSettings,
        leaguePosition: 1, // Top third (no adjustment)
        contractExpiringWithinYears: 1,
      };

      const minOffer = calculateMinAcceptableOffer(1000000, settings);
      // Balanced: 1.5x - 0.3x (expiring) = 1.2x → $1.2M
      expect(minOffer).toBe(1200000);
    });

    it('should have minimum floor of 0.5x', () => {
      const settings: AITransferSettings = {
        ...baseSettings,
        personality: 'aggressive',     // 0.8x
        leaguePosition: 12,            // -0.4x
        contractExpiringWithinYears: 1, // -0.3x
        totalTeams: 12,
      };

      const minOffer = calculateMinAcceptableOffer(1000000, settings);
      // 0.8 - 0.4 - 0.3 = 0.1x, but floor is 0.5x → $500k
      expect(minOffer).toBeGreaterThanOrEqual(500000);
    });
  });

  describe('evaluateTransferOffer', () => {
    const mockOffer: TransferOffer = {
      playerId: 'player-1',
      playerName: 'John Doe',
      sellerTeamId: 'team-seller',
      buyerTeamId: 'team-buyer',
      marketValue: 1000000,
      transferMultiplier: 2.0,
      urgencyMultiplier: 1.0,
      finalOffer: 2000000,
      status: 'pending',
      createdWeek: 1,
    };

    const baseSettings: AITransferSettings = {
      teamId: 'team-seller',
      personality: 'balanced',
      leaguePosition: 6,
      totalTeams: 12,
      contractExpiringWithinYears: 3,
    };

    it('should accept offer above minimum', () => {
      const evaluation = evaluateTransferOffer(mockOffer, baseSettings);
      // Min acceptable: $1.3M, Offer: $2M
      expect(evaluation.accepted).toBe(true);
      expect(evaluation.offerAmount).toBe(2000000);
      expect(evaluation.minAcceptableOffer).toBe(1300000);
    });

    it('should reject offer below minimum', () => {
      const lowOffer: TransferOffer = {
        ...mockOffer,
        finalOffer: 1000000, // Only $1M
      };

      const evaluation = evaluateTransferOffer(lowOffer, baseSettings);
      // Min acceptable: $1.3M, Offer: $1M
      expect(evaluation.accepted).toBe(false);
      expect(evaluation.offerAmount).toBe(1000000);
      expect(evaluation.minAcceptableOffer).toBe(1300000);
    });

    it('should provide acceptance reason', () => {
      const evaluation = evaluateTransferOffer(mockOffer, baseSettings);
      expect(evaluation.reason).toContain('exceeds minimum');
    });

    it('should provide rejection reason', () => {
      const lowOffer: TransferOffer = {
        ...mockOffer,
        finalOffer: 1000000,
      };

      const evaluation = evaluateTransferOffer(lowOffer, baseSettings);
      expect(evaluation.reason).toContain('below minimum');
    });
  });
});

describe('TransferSystem - Offer Management', () => {
  describe('createTransferOffer', () => {
    it('should create a complete transfer offer', () => {
      const offer = createTransferOffer(
        'player-1',
        'John Doe',
        'team-seller',
        'team-buyer',
        1000000,
        2.0,
        'neutral',
        10
      );

      expect(offer.playerId).toBe('player-1');
      expect(offer.playerName).toBe('John Doe');
      expect(offer.sellerTeamId).toBe('team-seller');
      expect(offer.buyerTeamId).toBe('team-buyer');
      expect(offer.marketValue).toBe(1000000);
      expect(offer.transferMultiplier).toBe(2.0);
      expect(offer.urgencyMultiplier).toBe(1.0);
      expect(offer.finalOffer).toBe(2000000);
      expect(offer.status).toBe('pending');
      expect(offer.createdWeek).toBe(10);
    });

    it('should calculate final offer correctly', () => {
      const offer = createTransferOffer(
        'player-1',
        'John Doe',
        'team-seller',
        'team-buyer',
        1000000,
        2.0,
        'desperate',
        10
      );

      // 1M × 2.0 × 1.2 = 2.4M
      expect(offer.finalOffer).toBe(2400000);
    });

    it('should clamp invalid multipliers', () => {
      const offer = createTransferOffer(
        'player-1',
        'John Doe',
        'team-seller',
        'team-buyer',
        1000000,
        5.0, // Invalid, will be clamped to 3.0
        'neutral',
        10
      );

      expect(offer.transferMultiplier).toBe(3.0);
      expect(offer.finalOffer).toBe(3000000);
    });
  });

  describe('acceptTransferOffer', () => {
    it('should change status to accepted', () => {
      const offer = createTransferOffer(
        'player-1',
        'John Doe',
        'team-seller',
        'team-buyer',
        1000000,
        2.0,
        'neutral',
        10
      );

      const accepted = acceptTransferOffer(offer);
      expect(accepted.status).toBe('accepted');
    });

    it('should not mutate original offer', () => {
      const offer = createTransferOffer(
        'player-1',
        'John Doe',
        'team-seller',
        'team-buyer',
        1000000,
        2.0,
        'neutral',
        10
      );

      acceptTransferOffer(offer);
      expect(offer.status).toBe('pending');
    });
  });

  describe('rejectTransferOffer', () => {
    it('should change status to rejected', () => {
      const offer = createTransferOffer(
        'player-1',
        'John Doe',
        'team-seller',
        'team-buyer',
        1000000,
        2.0,
        'neutral',
        10
      );

      const rejected = rejectTransferOffer(offer);
      expect(rejected.status).toBe('rejected');
    });
  });

  describe('expireTransferOffer', () => {
    it('should change status to expired', () => {
      const offer = createTransferOffer(
        'player-1',
        'John Doe',
        'team-seller',
        'team-buyer',
        1000000,
        2.0,
        'neutral',
        10
      );

      const expired = expireTransferOffer(offer);
      expect(expired.status).toBe('expired');
    });
  });

  describe('processTransferOffer', () => {
    const baseSettings: AITransferSettings = {
      teamId: 'team-seller',
      personality: 'balanced',
      leaguePosition: 6,
      totalTeams: 12,
      contractExpiringWithinYears: 3,
    };

    it('should accept good offer', () => {
      const offer = createTransferOffer(
        'player-1',
        'John Doe',
        'team-seller',
        'team-buyer',
        1000000,
        2.0,
        'neutral',
        10
      );

      const result = processTransferOffer(offer, baseSettings);

      expect(result.evaluation.accepted).toBe(true);
      expect(result.updatedOffer.status).toBe('accepted');
    });

    it('should reject low offer', () => {
      const offer = createTransferOffer(
        'player-1',
        'John Doe',
        'team-seller',
        'team-buyer',
        1000000,
        1.5,
        'reluctant', // 1.5 × 0.8 = 1.2x → $1.2M (below $1.3M min)
        10
      );

      const result = processTransferOffer(offer, baseSettings);

      expect(result.evaluation.accepted).toBe(false);
      expect(result.updatedOffer.status).toBe('rejected');
    });

    it('should return evaluation with details', () => {
      const offer = createTransferOffer(
        'player-1',
        'John Doe',
        'team-seller',
        'team-buyer',
        1000000,
        2.0,
        'desperate',
        10
      );

      const result = processTransferOffer(offer, baseSettings);

      expect(result.evaluation.offerAmount).toBe(2400000);
      expect(result.evaluation.minAcceptableOffer).toBe(1300000);
      expect(result.evaluation.reason).toBeTruthy();
    });
  });
});

describe('TransferSystem - Utility Functions', () => {
  describe('suggestAskingPrice', () => {
    it('should suggest 2.5x for conservative teams', () => {
      const suggested = suggestAskingPrice(1000000, 'conservative');
      expect(suggested).toBe(2.5);
    });

    it('should suggest 2.0x for balanced teams', () => {
      const suggested = suggestAskingPrice(1000000, 'balanced');
      expect(suggested).toBe(2.0);
    });

    it('should suggest 1.5x for aggressive teams', () => {
      const suggested = suggestAskingPrice(1000000, 'aggressive');
      expect(suggested).toBe(1.5);
    });
  });

  describe('calculatePlayerMarketValue', () => {
    it('should calculate market value using Contract System', () => {
      const marketValue = calculatePlayerMarketValue(75, 26, 80, 2);

      // This should match Contract System's valuation
      expect(marketValue).toBeGreaterThan(0);
      expect(marketValue).toBeLessThan(10000000); // Reasonable range
    });

    it('should give higher value for prime-age players', () => {
      const youngValue = calculatePlayerMarketValue(70, 20, 75, 1);
      const primeValue = calculatePlayerMarketValue(70, 26, 75, 1);

      expect(primeValue).toBeGreaterThan(youngValue);
    });
  });

  describe('filterOffersByStatus', () => {
    let offers: TransferOffer[];

    beforeEach(() => {
      offers = [
        createTransferOffer('p1', 'Player 1', 's1', 'b1', 1000000, 2.0, 'neutral', 1),
        { ...createTransferOffer('p2', 'Player 2', 's2', 'b2', 2000000, 2.0, 'neutral', 1), status: 'accepted' as const },
        { ...createTransferOffer('p3', 'Player 3', 's3', 'b3', 1500000, 2.0, 'neutral', 1), status: 'rejected' as const },
        createTransferOffer('p4', 'Player 4', 's4', 'b4', 1200000, 2.0, 'neutral', 1),
      ];
    });

    it('should filter pending offers', () => {
      const pending = filterOffersByStatus(offers, 'pending');
      expect(pending.length).toBe(2);
      expect(pending.every(o => o.status === 'pending')).toBe(true);
    });

    it('should filter accepted offers', () => {
      const accepted = filterOffersByStatus(offers, 'accepted');
      expect(accepted.length).toBe(1);
      expect(accepted[0].playerId).toBe('p2');
    });

    it('should filter rejected offers', () => {
      const rejected = filterOffersByStatus(offers, 'rejected');
      expect(rejected.length).toBe(1);
      expect(rejected[0].playerId).toBe('p3');
    });
  });

  describe('sortOffersByAmount', () => {
    let offers: TransferOffer[];

    beforeEach(() => {
      offers = [
        createTransferOffer('p1', 'Player 1', 's1', 'b1', 1000000, 2.0, 'neutral', 1),
        createTransferOffer('p2', 'Player 2', 's2', 'b2', 2000000, 2.0, 'neutral', 1),
        createTransferOffer('p3', 'Player 3', 's3', 'b3', 1500000, 2.0, 'neutral', 1),
      ];
    });

    it('should sort by amount descending', () => {
      const sorted = sortOffersByAmount(offers, false);

      expect(sorted[0].marketValue).toBe(2000000);
      expect(sorted[1].marketValue).toBe(1500000);
      expect(sorted[2].marketValue).toBe(1000000);
    });

    it('should sort by amount ascending', () => {
      const sorted = sortOffersByAmount(offers, true);

      expect(sorted[0].marketValue).toBe(1000000);
      expect(sorted[1].marketValue).toBe(1500000);
      expect(sorted[2].marketValue).toBe(2000000);
    });

    it('should not mutate original array', () => {
      const original = [...offers];
      sortOffersByAmount(offers, false);
      expect(offers).toEqual(original);
    });
  });

  describe('getOffersForPlayer', () => {
    it('should return offers for specific player', () => {
      const offers = [
        createTransferOffer('p1', 'Player 1', 's1', 'b1', 1000000, 2.0, 'neutral', 1),
        createTransferOffer('p2', 'Player 2', 's2', 'b2', 2000000, 2.0, 'neutral', 1),
        createTransferOffer('p1', 'Player 1', 's3', 'b3', 1000000, 2.5, 'desperate', 1),
      ];

      const p1Offers = getOffersForPlayer(offers, 'p1');
      expect(p1Offers.length).toBe(2);
      expect(p1Offers.every(o => o.playerId === 'p1')).toBe(true);
    });
  });

  describe('getOffersForTeam', () => {
    it('should return offers where team is seller', () => {
      const offers = [
        createTransferOffer('p1', 'Player 1', 'team-a', 'team-b', 1000000, 2.0, 'neutral', 1),
        createTransferOffer('p2', 'Player 2', 'team-b', 'team-c', 2000000, 2.0, 'neutral', 1),
        createTransferOffer('p3', 'Player 3', 'team-a', 'team-c', 1500000, 2.0, 'neutral', 1),
      ];

      const teamAOffers = getOffersForTeam(offers, 'team-a');
      expect(teamAOffers.length).toBe(2);
    });

    it('should return offers where team is buyer', () => {
      const offers = [
        createTransferOffer('p1', 'Player 1', 'team-a', 'team-b', 1000000, 2.0, 'neutral', 1),
        createTransferOffer('p2', 'Player 2', 'team-b', 'team-c', 2000000, 2.0, 'neutral', 1),
        createTransferOffer('p3', 'Player 3', 'team-c', 'team-b', 1500000, 2.0, 'neutral', 1),
      ];

      const teamBOffers = getOffersForTeam(offers, 'team-b');
      expect(teamBOffers.length).toBe(3); // 1 as seller, 2 as buyer
    });
  });

  describe('expireOldOffers', () => {
    it('should expire offers older than expiry weeks', () => {
      const offers = [
        createTransferOffer('p1', 'Player 1', 's1', 'b1', 1000000, 2.0, 'neutral', 1),
        createTransferOffer('p2', 'Player 2', 's2', 'b2', 2000000, 2.0, 'neutral', 5),
        createTransferOffer('p3', 'Player 3', 's3', 'b3', 1500000, 2.0, 'neutral', 10),
      ];

      const updated = expireOldOffers(offers, 12, 2);

      // Offer from week 1 (11 weeks old): expired
      // Offer from week 5 (7 weeks old): expired
      // Offer from week 10 (2 weeks old): expired
      const expired = updated.filter(o => o.status === 'expired');
      expect(expired.length).toBe(3);
    });

    it('should not expire recent offers', () => {
      const offers = [
        createTransferOffer('p1', 'Player 1', 's1', 'b1', 1000000, 2.0, 'neutral', 10),
      ];

      const updated = expireOldOffers(offers, 11, 2);

      expect(updated[0].status).toBe('pending');
    });

    it('should not expire already accepted offers', () => {
      const offers = [
        { ...createTransferOffer('p1', 'Player 1', 's1', 'b1', 1000000, 2.0, 'neutral', 1), status: 'accepted' as const },
      ];

      const updated = expireOldOffers(offers, 10, 2);

      expect(updated[0].status).toBe('accepted'); // Still accepted, not expired
    });
  });
});

describe('TransferSystem - Integration', () => {
  it('should demonstrate full transfer workflow', () => {
    // Step 1: Calculate player market value
    const marketValue = calculatePlayerMarketValue(75, 26, 80, 2);
    expect(marketValue).toBeGreaterThan(0);

    // Step 2: Seller suggests asking price
    const askingMultiplier = suggestAskingPrice(marketValue, 'balanced');
    expect(askingMultiplier).toBe(2.0);

    // Step 3: Buyer creates offer
    const offer = createTransferOffer(
      'player-1',
      'Star Player',
      'team-seller',
      'team-buyer',
      marketValue,
      askingMultiplier,
      'desperate',
      50
    );

    expect(offer.status).toBe('pending');

    // Step 4: AI seller evaluates offer
    const sellerSettings: AITransferSettings = {
      teamId: 'team-seller',
      personality: 'balanced',
      leaguePosition: 3,
      totalTeams: 12,
      contractExpiringWithinYears: 2,
    };

    const result = processTransferOffer(offer, sellerSettings);

    expect(result.evaluation.accepted).toBeDefined();
    expect(result.updatedOffer.status).not.toBe('pending');
  });

  it('should match FORMULAS.md example', () => {
    // Example: $1M player, 2.0x asking, 1.2x desperate = $2.4M
    const offer = createTransferOffer(
      'player-1',
      'John Doe',
      'team-seller',
      'team-buyer',
      1000000,
      2.0,
      'desperate',
      1
    );

    expect(offer.finalOffer).toBe(2400000);
  });

  it('should demonstrate personality impact on acceptance', () => {
    const offer = createTransferOffer(
      'player-1',
      'John Doe',
      'team-seller',
      'team-buyer',
      1000000,
      1.8,
      'neutral',
      1
    );

    const conservativeSettings: AITransferSettings = {
      teamId: 'team-seller',
      personality: 'conservative',
      leaguePosition: 1,
      totalTeams: 12,
      contractExpiringWithinYears: 3,
    };

    const aggressiveSettings: AITransferSettings = {
      teamId: 'team-seller',
      personality: 'aggressive',
      leaguePosition: 1,
      totalTeams: 12,
      contractExpiringWithinYears: 3,
    };

    const conservativeResult = processTransferOffer(offer, conservativeSettings);
    const aggressiveResult = processTransferOffer(offer, aggressiveSettings);

    // Same offer: aggressive team accepts, conservative team might reject
    expect(aggressiveResult.evaluation.accepted).toBe(true);
    expect(conservativeResult.evaluation.accepted).toBe(false);
  });

  it('should demonstrate league position impact', () => {
    const offer = createTransferOffer(
      'player-1',
      'John Doe',
      'team-seller',
      'team-buyer',
      1000000,
      1.5,
      'neutral',
      1
    );

    const topTeamSettings: AITransferSettings = {
      teamId: 'team-seller',
      personality: 'balanced',
      leaguePosition: 1,
      totalTeams: 12,
      contractExpiringWithinYears: 3,
    };

    const bottomTeamSettings: AITransferSettings = {
      teamId: 'team-seller',
      personality: 'balanced',
      leaguePosition: 12,
      totalTeams: 12,
      contractExpiringWithinYears: 3,
    };

    const topResult = processTransferOffer(offer, topTeamSettings);
    const bottomResult = processTransferOffer(offer, bottomTeamSettings);

    // Bottom team should accept lower offers
    expect(bottomResult.evaluation.minAcceptableOffer).toBeLessThan(
      topResult.evaluation.minAcceptableOffer
    );
  });
});
