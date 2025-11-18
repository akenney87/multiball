/**
 * Tests for Possession State Machine
 *
 * Validates:
 * - State transitions after various possession outcomes
 * - Timeout legality rules (live vs dead ball)
 * - Substitution window logic
 * - Ball state and possession tracking accuracy
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  PossessionState,
  BallState,
  DeadBallReason,
} from '../../../src/simulation/possession/possessionState';

describe('PossessionState', () => {
  let state: PossessionState;

  beforeEach(() => {
    state = new PossessionState('home');
  });

  describe('Constructor', () => {
    it('should initialize with starting team as home', () => {
      const homeState = new PossessionState('home');
      expect(homeState.getPossessionTeam()).toBe('home');
      expect(homeState.getBallState()).toBe(BallState.LIVE);
      expect(homeState.getDeadBallReason()).toBe(DeadBallReason.NONE);
    });

    it('should initialize with starting team as away', () => {
      const awayState = new PossessionState('away');
      expect(awayState.getPossessionTeam()).toBe('away');
      expect(awayState.getBallState()).toBe(BallState.LIVE);
    });

    it('should throw error for invalid starting team', () => {
      expect(() => new PossessionState('invalid' as any)).toThrow();
    });
  });

  describe('Timeout Rules', () => {
    it('should allow possession team to call timeout during live ball', () => {
      // Home has possession, ball is live
      expect(state.canCallTimeout('home')).toBe(true);
      expect(state.canCallTimeout('away')).toBe(false);
    });

    it('should allow either team to call timeout during dead ball', () => {
      state.updateAfterMadeBasket('home');
      expect(state.getBallState()).toBe(BallState.DEAD);
      expect(state.canCallTimeout('home')).toBe(true);
      expect(state.canCallTimeout('away')).toBe(true);
    });

    it('should update timeout rules after defensive rebound', () => {
      state.updateAfterDefensiveRebound('away');
      // Away now has possession, ball is live
      expect(state.canCallTimeout('away')).toBe(true);
      expect(state.canCallTimeout('home')).toBe(false);
    });
  });

  describe('Substitution Rules', () => {
    it('should not allow substitutions during live play', () => {
      expect(state.getBallState()).toBe(BallState.LIVE);
      expect(state.canSubstitute()).toBe(false);
    });

    it('should allow substitutions after timeout', () => {
      state.updateAfterTimeout();
      expect(state.canSubstitute()).toBe(true);
    });

    it('should allow substitutions after violation', () => {
      state.updateAfterViolation('away');
      expect(state.canSubstitute()).toBe(true);
    });

    it('should allow substitutions at quarter end', () => {
      state.endQuarter();
      expect(state.canSubstitute()).toBe(true);
    });

    it('should NOT allow substitutions after made basket', () => {
      state.updateAfterMadeBasket('home');
      expect(state.getBallState()).toBe(BallState.DEAD);
      expect(state.canSubstitute()).toBe(false);
    });

    it('should NOT allow substitutions after made free throw', () => {
      state.updateAfterMadeFT('home');
      expect(state.getBallState()).toBe(BallState.DEAD);
      expect(state.canSubstitute()).toBe(false);
    });

    it('should allow substitutions after foul', () => {
      state.updateAfterFoul('away');
      expect(state.canSubstitute()).toBe(true);
    });
  });

  describe('Made Basket Transitions', () => {
    it('should switch possession to opponent after made basket', () => {
      state.updateAfterMadeBasket('home');
      expect(state.getPossessionTeam()).toBe('away');
      expect(state.getBallState()).toBe(BallState.DEAD);
      expect(state.getDeadBallReason()).toBe(DeadBallReason.MADE_BASKET);
    });

    it('should switch possession to home if away scores', () => {
      const awayState = new PossessionState('away');
      awayState.updateAfterMadeBasket('away');
      expect(awayState.getPossessionTeam()).toBe('home');
    });
  });

  describe('Rebound Transitions', () => {
    it('should keep possession live after defensive rebound', () => {
      state.updateAfterDefensiveRebound('away');
      expect(state.getPossessionTeam()).toBe('away');
      expect(state.getBallState()).toBe(BallState.LIVE);
      expect(state.getDeadBallReason()).toBe(DeadBallReason.NONE);
    });

    it('should keep possession live after offensive rebound', () => {
      state.updateAfterOffensiveRebound('home');
      expect(state.getPossessionTeam()).toBe('home');
      expect(state.getBallState()).toBe(BallState.LIVE);
    });
  });

  describe('Turnover Transitions', () => {
    it('should handle live ball steal (bad pass)', () => {
      state.updateAfterTurnover('away', 'bad_pass', true);
      expect(state.getPossessionTeam()).toBe('away');
      expect(state.getBallState()).toBe(BallState.LIVE);
      expect(state.canSubstitute()).toBe(false);
    });

    it('should handle dead ball violation (traveling)', () => {
      state.updateAfterTurnover('away', 'violation', false);
      expect(state.getPossessionTeam()).toBe('away');
      expect(state.getBallState()).toBe(BallState.DEAD);
      expect(state.getDeadBallReason()).toBe(DeadBallReason.VIOLATION);
      expect(state.canSubstitute()).toBe(true);
    });

    it('should handle dead ball offensive foul', () => {
      state.updateAfterTurnover('away', 'offensive_foul', false);
      expect(state.getPossessionTeam()).toBe('away');
      expect(state.getBallState()).toBe(BallState.DEAD);
      expect(state.getDeadBallReason()).toBe(DeadBallReason.FOUL);
      expect(state.canSubstitute()).toBe(true);
    });

    it('should handle out of bounds as violation', () => {
      state.updateAfterTurnover('away', 'bad_pass', false);
      expect(state.getBallState()).toBe(BallState.DEAD);
      expect(state.getDeadBallReason()).toBe(DeadBallReason.VIOLATION);
    });
  });

  describe('Free Throw Transitions', () => {
    it('should switch possession after made final FT', () => {
      state.updateAfterMadeFT('home');
      expect(state.getPossessionTeam()).toBe('away');
      expect(state.getBallState()).toBe(BallState.DEAD);
      expect(state.getDeadBallReason()).toBe(DeadBallReason.MADE_FREE_THROW);
    });

    it('should not change possession after missed FT', () => {
      const originalTeam = state.getPossessionTeam();
      state.updateAfterMissedFT();
      expect(state.getPossessionTeam()).toBe(originalTeam);
      expect(state.getBallState()).toBe(BallState.DEAD);
      expect(state.getDeadBallReason()).toBe(DeadBallReason.MISSED_FINAL_FT);
    });
  });

  describe('Violation and Out of Bounds', () => {
    it('should switch possession after violation', () => {
      state.updateAfterViolation('away');
      expect(state.getPossessionTeam()).toBe('away');
      expect(state.getBallState()).toBe(BallState.DEAD);
      expect(state.getDeadBallReason()).toBe(DeadBallReason.VIOLATION);
    });

    it('should switch possession after out of bounds', () => {
      state.updateAfterOutOfBounds('away');
      expect(state.getPossessionTeam()).toBe('away');
      expect(state.getBallState()).toBe(BallState.DEAD);
      expect(state.getDeadBallReason()).toBe(DeadBallReason.VIOLATION);
    });
  });

  describe('Timeout and Quarter End', () => {
    it('should maintain possession after timeout', () => {
      const originalTeam = state.getPossessionTeam();
      state.updateAfterTimeout();
      expect(state.getPossessionTeam()).toBe(originalTeam);
      expect(state.getBallState()).toBe(BallState.DEAD);
      expect(state.getDeadBallReason()).toBe(DeadBallReason.TIMEOUT);
    });

    it('should maintain possession at quarter end', () => {
      const originalTeam = state.getPossessionTeam();
      state.endQuarter();
      expect(state.getPossessionTeam()).toBe(originalTeam);
      expect(state.getBallState()).toBe(BallState.DEAD);
      expect(state.getDeadBallReason()).toBe(DeadBallReason.QUARTER_END);
    });
  });

  describe('Start New Possession', () => {
    it('should transition from dead to live ball', () => {
      state.updateAfterMadeBasket('home');
      expect(state.getBallState()).toBe(BallState.DEAD);

      state.startNewPossession();
      expect(state.getBallState()).toBe(BallState.LIVE);
      expect(state.getDeadBallReason()).toBe(DeadBallReason.NONE);
    });
  });

  describe('State Summary', () => {
    it('should provide accurate state summary', () => {
      state.updateAfterMadeBasket('home');
      const summary = state.getStateSummary();

      expect(summary.possessionTeam).toBe('away');
      expect(summary.ballState).toBe(BallState.DEAD);
      expect(summary.deadBallReason).toBe(DeadBallReason.MADE_BASKET);
      expect(summary.canTimeoutHome).toBe(true);
      expect(summary.canTimeoutAway).toBe(true);
      expect(summary.canSubstitute).toBe(false);
    });

    it('should format toString correctly', () => {
      const str = state.toString();
      expect(str).toContain('PossessionState');
      expect(str).toContain('home');
      expect(str).toContain('LIVE');
    });
  });

  describe('Edge Cases', () => {
    it('should throw error for invalid team in updateAfterMadeBasket', () => {
      expect(() => state.updateAfterMadeBasket('invalid' as any)).toThrow();
    });

    it('should throw error for invalid team in canCallTimeout', () => {
      expect(() => state.canCallTimeout('invalid' as any)).toThrow();
    });

    it('should throw error for invalid team in updateAfterDefensiveRebound', () => {
      expect(() => state.updateAfterDefensiveRebound('invalid' as any)).toThrow();
    });
  });

  describe('Complex State Transitions', () => {
    it('should handle sequence: made basket -> timeout -> new possession', () => {
      state.updateAfterMadeBasket('home');
      expect(state.getPossessionTeam()).toBe('away');
      expect(state.canSubstitute()).toBe(false);

      state.updateAfterTimeout();
      expect(state.canSubstitute()).toBe(true);

      state.startNewPossession();
      expect(state.getBallState()).toBe(BallState.LIVE);
      expect(state.canSubstitute()).toBe(false);
    });

    it('should handle sequence: foul -> FT miss -> defensive rebound', () => {
      state.updateAfterFoul('away');
      expect(state.canSubstitute()).toBe(true);

      state.updateAfterMissedFT();
      // MISSED_FINAL_FT is NOT a legal substitution window per simplified rules
      expect(state.canSubstitute()).toBe(false);

      state.updateAfterDefensiveRebound('home');
      expect(state.getBallState()).toBe(BallState.LIVE);
      expect(state.canSubstitute()).toBe(false);
    });
  });
});
