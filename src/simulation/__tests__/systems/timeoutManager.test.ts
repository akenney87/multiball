/**
 * Tests for timeout management system
 *
 * @module simulation/__tests__/systems/timeoutManager.test
 */

import { TimeoutManager, ScoringRun } from '../../systems/timeoutManager';

describe('ScoringRun', () => {
  test('should track scoring runs correctly', () => {
    const run = new ScoringRun();

    run.update(2, true); // Team scores 2
    expect(run.getRun()).toEqual([2, 0]);

    run.update(3, false); // Opponent scores 3
    expect(run.getRun()).toEqual([2, 3]);
  });

  test('should reset run tracker', () => {
    const run = new ScoringRun();
    run.update(5, true);
    run.reset();
    expect(run.getRun()).toEqual([0, 0]);
  });
});

describe('TimeoutManager', () => {
  test('should initialize with correct timeouts', () => {
    const manager = new TimeoutManager('standard', 7);

    expect(manager.getTimeoutsRemaining('Home')).toBe(7);
    expect(manager.getTimeoutsRemaining('Away')).toBe(7);
  });

  test('should detect momentum timeout (8-0 run)', () => {
    const manager = new TimeoutManager('standard', 7);

    // Simulate opponent on 8-0 run
    manager.updateScoringRun('Home', 2, 'Away');
    manager.updateScoringRun('Home', 3, 'Away');
    manager.updateScoringRun('Home', 3, 'Away');

    const [shouldCall, reason] = manager.checkMomentumTimeout('Home', 2, 300, -5, false);
    expect(shouldCall).toBe(false); // Needs 10-0 for standard strategy

    // Continue run
    manager.updateScoringRun('Home', 2, 'Away');
    const [shouldCall2, reason2] = manager.checkMomentumTimeout('Home', 2, 300, -5, false);
    expect(shouldCall2).toBe(true);
    expect(reason2).toBe('momentum');
  });

  test('should not call timeout if team just scored', () => {
    const manager = new TimeoutManager('standard', 7);

    // Even with big run, don't call timeout if team just scored
    manager.updateScoringRun('Home', 2, 'Away');
    manager.updateScoringRun('Home', 3, 'Away');
    manager.updateScoringRun('Home', 3, 'Away');
    manager.updateScoringRun('Home', 2, 'Away');

    const [shouldCall, reason] = manager.checkMomentumTimeout('Home', 2, 300, -5, true);
    expect(shouldCall).toBe(false);
  });

  test('should detect end-game timeout (down 3, <30s)', () => {
    const manager = new TimeoutManager('standard', 7);

    const [shouldCall, reason] = manager.checkEndGameTimeout('Home', 4, 25, -3, true);
    expect(shouldCall).toBe(true);
    expect(reason).toBe('end_game_3pt_setup');
  });

  test('should call timeout and decrement counter', () => {
    const manager = new TimeoutManager('standard', 7);

    const event = manager.callTimeout('Home', 2, '8:30', 'momentum', [10, 2], 510);
    expect(event.team).toBe('Home');
    expect(event.timeoutsRemainingAfter).toBe(6);
    expect(manager.getTimeoutsRemaining('Home')).toBe(6);
  });

  test('should reset scoring runs after timeout', () => {
    const manager = new TimeoutManager('standard', 7);

    manager.updateScoringRun('Home', 5, 'Away');
    manager.callTimeout('Home', 2, '8:30', 'momentum', undefined, 510);

    // Run should be reset
    manager.updateScoringRun('Home', 2, 'Away');
    const [shouldCall] = manager.checkMomentumTimeout('Home', 2, 300, -5, false);
    expect(shouldCall).toBe(false); // Only 2 points in run, not enough
  });

  test('should enforce cooldown between timeouts', () => {
    const manager = new TimeoutManager('standard', 7);

    // Call timeout
    manager.callTimeout('Home', 2, '8:30', 'momentum', undefined, 510);

    // Try to call another timeout too soon (within 15 seconds)
    const [shouldCall] = manager.checkMomentumTimeout('Home', 2, 500, -5, false);
    expect(shouldCall).toBe(false);
  });

  test('should return timeout summary', () => {
    const manager = new TimeoutManager('standard', 7);

    manager.callTimeout('Home', 1, '5:00', 'momentum', undefined, 300);
    manager.callTimeout('Away', 2, '3:00', 'end_game', undefined, 180);

    const summary = manager.getTimeoutSummary();
    expect(summary.homeTimeoutsRemaining).toBe(6);
    expect(summary.awayTimeoutsRemaining).toBe(6);
    expect(summary.totalTimeouts).toBe(2);
  });
});
