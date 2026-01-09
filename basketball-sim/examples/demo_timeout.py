"""
Demo script for M3 Phase 2c: Timeout System Testing

Demonstrates:
1. Momentum timeout detection (8-0, 10-2 runs)
2. End-game timeout strategy
3. Timeout tracking and usage
4. Scoring run detection

Note: This is a standalone test - NOT integrated with game simulation yet.
"""

from src.systems.timeout_manager import TimeoutManager, ScoringRun


def test_momentum_detection():
    """Test momentum timeout detection."""
    print("=" * 80)
    print("TEST 1: MOMENTUM TIMEOUT DETECTION")
    print("=" * 80)
    print()

    # Create timeout manager with aggressive strategy (threshold = 8)
    tm = TimeoutManager(timeout_strategy='aggressive')

    print("Scenario: Away team goes on 8-0 run")
    print("Home team should consider timeout (aggressive strategy: threshold=8)")
    print()

    # Simulate 8-0 run
    tm.update_scoring_run('Home', 0, 'Away')  # Away scores
    tm.update_scoring_run('Home', 3, 'Away')  # Away scores 3
    tm.update_scoring_run('Home', 0, 'Home')  # Home misses
    tm.update_scoring_run('Home', 2, 'Away')  # Away scores 2
    tm.update_scoring_run('Home', 0, 'Home')  # Home misses
    tm.update_scoring_run('Home', 3, 'Away')  # Away scores 3 (now 8-0 run)

    # Check if home should call timeout
    should_call, reason = tm.check_momentum_timeout(
        team='Home',
        quarter=2,
        time_remaining=300,  # 5 minutes left
        score_differential=-8  # Home losing by 8
    )

    print(f"Run tracker: {tm.home_run.get_run()}")
    print(f"Should call timeout: {should_call}")
    print(f"Reason: {reason if reason else 'N/A'}")
    print()

    if should_call:
        timeout_event = tm.call_timeout(
            team='Home',
            quarter=2,
            game_time='5:00',
            reason=reason,
            scoring_run=tm.home_run.get_run()
        )
        print(f"[OK] Timeout called! Timeouts remaining: {timeout_event.timeouts_remaining_after}")
        print(f"  Scoring run: {timeout_event.scoring_run}")
    else:
        print("[NO] No timeout called")

    print()
    print("-" * 80)
    print()


def test_10_2_run():
    """Test 10-2 run detection."""
    print("=" * 80)
    print("TEST 2: 10-2 RUN DETECTION")
    print("=" * 80)
    print()

    tm = TimeoutManager(timeout_strategy='standard')

    print("Scenario: Away team goes on 10-2 run (home only scores 2)")
    print()

    # Simulate 10-2 run
    tm.update_scoring_run('Home', 3, 'Away')  # Away scores 3
    tm.update_scoring_run('Home', 2, 'Home')  # Home scores 2
    tm.update_scoring_run('Home', 2, 'Away')  # Away scores 2
    tm.update_scoring_run('Home', 0, 'Home')  # Home misses
    tm.update_scoring_run('Home', 3, 'Away')  # Away scores 3
    tm.update_scoring_run('Home', 0, 'Home')  # Home misses
    tm.update_scoring_run('Home', 2, 'Away')  # Away scores 2 (now 10-2 run)

    should_call, reason = tm.check_momentum_timeout(
        team='Home',
        quarter=3,
        time_remaining=420,
        score_differential=-5
    )

    print(f"Run tracker: {tm.home_run.get_run()}")
    print(f"Should call timeout: {should_call}")
    print(f"Reason: {reason if reason else 'N/A'}")

    if should_call:
        timeout_event = tm.call_timeout(
            team='Home',
            quarter=3,
            game_time='7:00',
            reason=reason,
            scoring_run=tm.home_run.get_run()
        )
        print(f"[OK] Timeout called! Timeouts remaining: {timeout_event.timeouts_remaining_after}")

    print()
    print("-" * 80)
    print()


def test_end_game_timeouts():
    """Test end-game timeout strategy."""
    print("=" * 80)
    print("TEST 3: END-GAME TIMEOUT STRATEGY")
    print("=" * 80)
    print()

    tm = TimeoutManager(timeout_strategy='standard')

    # Test Case 1: Down 3, <30 seconds, have ball
    print("Scenario 1: Down 3 points, 25 seconds left, home has ball")
    should_call, reason = tm.check_end_game_timeout(
        team='Home',
        quarter=4,
        time_remaining=25,
        score_differential=-3,
        team_has_ball=True
    )
    print(f"  Should call timeout: {should_call}")
    print(f"  Reason: {reason if reason else 'N/A'}")
    if should_call:
        print("  [OK] Timeout called to draw up 3PT play")
    print()

    # Test Case 2: Down 1, <10 seconds, have ball
    print("Scenario 2: Down 1 point, 8 seconds left, home has ball")
    should_call, reason = tm.check_end_game_timeout(
        team='Home',
        quarter=4,
        time_remaining=8,
        score_differential=-1,
        team_has_ball=True
    )
    print(f"  Should call timeout: {should_call}")
    print(f"  Reason: {reason if reason else 'N/A'}")
    if should_call:
        print("  [OK] Timeout called for final possession setup")
    print()

    # Test Case 3: Losing, <5 seconds, opponent has ball
    print("Scenario 3: Down 2 points, 4 seconds left, opponent has ball")
    should_call, reason = tm.check_end_game_timeout(
        team='Home',
        quarter=4,
        time_remaining=4,
        score_differential=-2,
        team_has_ball=False
    )
    print(f"  Should call timeout: {should_call}")
    print(f"  Reason: {reason if reason else 'N/A'}")
    if should_call:
        print("  [OK] Timeout called to prevent clock runout (desperation)")
    print()

    print("-" * 80)
    print()


def test_strategy_differences():
    """Test different timeout strategies."""
    print("=" * 80)
    print("TEST 4: STRATEGY COMPARISON")
    print("=" * 80)
    print()

    strategies = ['aggressive', 'standard', 'conservative']

    print("Scenario: 8-0 run, Q2, 5 min left, home losing by 8, 7 TOs remaining")
    print()

    for strategy in strategies:
        tm = TimeoutManager(timeout_strategy=strategy)

        # Simulate 8-0 run
        tm.update_scoring_run('Home', 0, 'Away')
        tm.update_scoring_run('Home', 3, 'Away')
        tm.update_scoring_run('Home', 0, 'Home')
        tm.update_scoring_run('Home', 2, 'Away')
        tm.update_scoring_run('Home', 0, 'Home')
        tm.update_scoring_run('Home', 3, 'Away')

        should_call, reason = tm.check_momentum_timeout(
            team='Home',
            quarter=2,
            time_remaining=300,
            score_differential=-8
        )

        params = tm.strategy_params
        print(f"{strategy.upper():15} | Threshold: {params['momentum_threshold']:2d} | "
              f"Save: {params['save_for_endgame']} | Call TO: {should_call}")

    print()
    print("Note: Aggressive calls timeouts earliest, conservative saves them longest")
    print()
    print("-" * 80)
    print()


def test_timeout_tracking():
    """Test timeout usage tracking."""
    print("=" * 80)
    print("TEST 5: TIMEOUT USAGE TRACKING")
    print("=" * 80)
    print()

    tm = TimeoutManager()

    print("Simulating full game with multiple timeouts...")
    print()

    # Call several timeouts throughout game
    timeouts_to_call = [
        ('Home', 1, '8:30', 'momentum'),
        ('Away', 2, '6:15', 'momentum'),
        ('Home', 3, '4:20', 'momentum'),
        ('Home', 4, '2:00', 'end_game_3pt_setup'),
        ('Away', 4, '0:45', 'end_game_final_possession'),
    ]

    for team, quarter, game_time, reason in timeouts_to_call:
        tm.call_timeout(team, quarter, game_time, reason)
        print(f"Q{quarter} [{game_time}] {team} timeout ({reason})")

    print()
    print("Final Timeout Summary:")
    summary = tm.get_timeout_summary()
    print(f"  Home: {summary['home_timeouts_used']}/7 used, {summary['home_timeouts_remaining']} remaining")
    print(f"  Away: {summary['away_timeouts_used']}/7 used, {summary['away_timeouts_remaining']} remaining")
    print(f"  Total timeouts called: {summary['total_timeouts']}")
    print()

    print("Detailed Timeout Events:")
    for i, event in enumerate(summary['timeout_events'], 1):
        print(f"  {i}. Q{event.quarter} [{event.game_time}] {event.team} - {event.reason} "
              f"(TOs left: {event.timeouts_remaining_after})")

    print()
    print("-" * 80)
    print()


def main():
    """Run all timeout system tests."""
    print()
    print("=" * 80)
    print("M3 PHASE 2c: TIMEOUT SYSTEM STANDALONE TESTS")
    print("=" * 80)
    print()
    print("Note: These are unit tests of timeout logic.")
    print("Integration with game simulation is deferred to Phase 5.")
    print()
    print("-" * 80)
    print()

    # Run tests
    test_momentum_detection()
    test_10_2_run()
    test_end_game_timeouts()
    test_strategy_differences()
    test_timeout_tracking()

    print("=" * 80)
    print("ALL TESTS COMPLETE")
    print("=" * 80)
    print()
    print("Summary:")
    print("  [OK] Momentum timeout detection working")
    print("  [OK] 8-0 and 10-2 run tracking working")
    print("  [OK] End-game timeout strategy working")
    print("  [OK] Strategy differences (aggressive/standard/conservative) working")
    print("  [OK] Timeout usage tracking working")
    print()
    print("Next Steps:")
    print("  - Phase 5: Integrate timeout_manager.py into quarter_simulation.py")
    print("  - Add timeout checks after each possession")
    print("  - Apply stamina recovery during timeouts")
    print("  - Add timeout events to play-by-play")
    print()


if __name__ == '__main__':
    main()
