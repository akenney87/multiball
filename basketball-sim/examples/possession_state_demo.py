"""
Possession State Machine - Integration Demo

Demonstrates how PossessionState works with quarter simulation flow.

This shows the correct way to track possession and enforce timeout/substitution rules.

Author: Architecture & Integration Lead
Date: 2025-11-06
"""

import sys
sys.path.insert(0, 'C:/Users/alexa/desktop/projects/simulator')

from src.systems.possession_state import PossessionState


def demo_complete_possession_flow():
    """Demonstrate a complete possession sequence with state tracking."""

    print("=" * 70)
    print("POSSESSION STATE MACHINE - INTEGRATION DEMO")
    print("=" * 70)
    print()

    # =========================================================================
    # SCENARIO 1: Made Basket
    # =========================================================================
    print("SCENARIO 1: Made Basket Sequence")
    print("-" * 70)

    state = PossessionState('home')
    print(f"Initial state: {state}")
    print(f"  Home can timeout: {state.can_call_timeout('home')}")
    print(f"  Away can timeout: {state.can_call_timeout('away')}")
    print(f"  Can substitute: {state.can_substitute()}")
    print()

    # Home team shoots and scores
    print("[BASKET] Home team makes a basket!")
    state.update_after_made_basket('home')
    print(f"After made basket: {state}")
    print(f"  Possession: {state.get_possession_team()} (switched to opponent)")
    print(f"  Home can timeout: {state.can_call_timeout('home')} (dead ball, both can)")
    print(f"  Away can timeout: {state.can_call_timeout('away')}")
    print(f"  Can substitute: {state.can_substitute()} (NO - made basket != sub opportunity)")
    print()

    # Away inbounds
    print("[INBOUND] Away team inbounds the ball")
    state.start_new_possession()
    print(f"After inbound: {state}")
    print(f"  Home can timeout: {state.can_call_timeout('home')} (live ball, away has it)")
    print(f"  Away can timeout: {state.can_call_timeout('away')} (live ball, away has it)")
    print(f"  Can substitute: {state.can_substitute()} (live ball)")
    print()

    # =========================================================================
    # SCENARIO 2: Defensive Rebound -> Timeout
    # =========================================================================
    print("\nSCENARIO 2: Defensive Rebound -> Timeout")
    print("-" * 70)

    state = PossessionState('home')
    print(f"Initial state: {state}")
    print()

    # Home shoots and misses, away gets defensive rebound
    print("[PLAY] Home team shoots and MISSES")
    print("[PLAY] Away team gets DEFENSIVE REBOUND")
    state.update_after_defensive_rebound('away')
    print(f"After defensive rebound: {state}")
    print(f"  Possession: {state.get_possession_team()} (switched to rebounder)")
    print(f"  Home can timeout: {state.can_call_timeout('home')} [X] (live ball, don't have it)")
    print(f"  Away can timeout: {state.can_call_timeout('away')} [OK] (live ball, have ball)")
    print(f"  Can substitute: {state.can_substitute()} (live ball)")
    print()

    # Away calls timeout
    print("[TIMEOUT]  Away team calls TIMEOUT")
    state.update_after_timeout()
    print(f"After timeout: {state}")
    print(f"  Possession: {state.get_possession_team()} (no change)")
    print(f"  Home can timeout: {state.can_call_timeout('home')}")
    print(f"  Away can timeout: {state.can_call_timeout('away')}")
    print(f"  Can substitute: {state.can_substitute()} [OK] (timeout creates sub window)")
    print()

    print("[SUB] SUBSTITUTIONS OCCUR")
    print("   - Home: Player A out, Player B in")
    print("   - Away: Player X out, Player Y in")
    print()

    # Resume play
    print("[PLAY] Play resumes after timeout")
    state.start_new_possession()
    print(f"After resume: {state}")
    print(f"  Away can timeout: {state.can_call_timeout('away')} (live ball, have ball)")
    print(f"  Can substitute: {state.can_substitute()} (live ball)")
    print()

    # =========================================================================
    # SCENARIO 3: Turnover -> Illegal Timeout Attempt (PREVENTED)
    # =========================================================================
    print("\nSCENARIO 3: Turnover -> Timeout Check")
    print("-" * 70)

    state = PossessionState('home')
    print(f"Initial state: {state}")
    print()

    # Home turns ball over
    print("[PLAY] Home team commits TURNOVER")
    print("[PLAY] Away team gets possession")
    state.update_after_turnover('away')
    print(f"After turnover: {state}")
    print(f"  Possession: {state.get_possession_team()} (switched to away)")
    print(f"  Ball state: {state.get_ball_state().value} (turnover = violation = dead ball)")
    print(f"  Home can timeout: {state.can_call_timeout('home')} (dead ball, both can)")
    print(f"  Away can timeout: {state.can_call_timeout('away')}")
    print(f"  Can substitute: {state.can_substitute()} [OK] (violation allows subs)")
    print()

    print("[WARNING]  Home team wants to call timeout...")
    if state.can_call_timeout('home'):
        print("[OK] LEGAL - Turnover is a dead ball, both teams can timeout")
        state.update_after_timeout()
        print("[TIMEOUT]  Home team calls timeout (legal)")
    else:
        print("[X] ILLEGAL - Home doesn't have possession")
    print()

    # =========================================================================
    # SCENARIO 4: Foul -> Free Throws -> Rebound
    # =========================================================================
    print("\nSCENARIO 4: Foul -> Free Throws -> Missed FT -> Rebound")
    print("-" * 70)

    state = PossessionState('home')
    print(f"Initial state: {state}")
    print()

    # Away fouls home
    print("[PLAY] Away team commits FOUL on home player")
    state.update_after_foul('home')
    print(f"After foul: {state}")
    print(f"  Possession: {state.get_possession_team()} (home - fouled team)")
    print(f"  Home can timeout: {state.can_call_timeout('home')}")
    print(f"  Away can timeout: {state.can_call_timeout('away')}")
    print(f"  Can substitute: {state.can_substitute()} [OK] (before FTs)")
    print()

    print("[SUB] SUBSTITUTIONS ALLOWED (before FTs start)")
    print()

    # Home shoots FTs
    print("[PLAY] Home team shoots 2 FREE THROWS")
    print("   FT 1: GOOD")
    print("   FT 2: MISS")
    print()

    # Missed final FT
    print("[PLAY] Final FT MISSED - rebound situation")
    state.update_after_missed_ft()
    print(f"After missed FT: {state}")
    print(f"  Ball state: {state.get_ball_state().value}")
    print(f"  Can substitute: {state.can_substitute()} [OK] (dead ball rebound opportunity)")
    print()

    # Away gets defensive rebound
    print("[PLAY] Away team gets DEFENSIVE REBOUND")
    state.update_after_defensive_rebound('away')
    print(f"After rebound: {state}")
    print(f"  Possession: {state.get_possession_team()} (away)")
    print(f"  Away can timeout: {state.can_call_timeout('away')} (live ball, have ball)")
    print(f"  Can substitute: {state.can_substitute()} (live ball)")
    print()

    # =========================================================================
    # SCENARIO 5: Offensive Rebound
    # =========================================================================
    print("\nSCENARIO 5: Offensive Rebound (Possession Continues)")
    print("-" * 70)

    state = PossessionState('home')
    print(f"Initial state: {state}")
    print()

    # Home shoots and misses, home gets offensive rebound
    print("[PLAY] Home team shoots and MISSES")
    print("[PLAY] Home team gets OFFENSIVE REBOUND")
    state.update_after_offensive_rebound('home')
    print(f"After offensive rebound: {state}")
    print(f"  Possession: {state.get_possession_team()} (no change - same team)")
    print(f"  Home can timeout: {state.can_call_timeout('home')} [OK] (live ball, have ball)")
    print(f"  Away can timeout: {state.can_call_timeout('away')} [X] (live ball, don't have ball)")
    print(f"  Can substitute: {state.can_substitute()} (live ball)")
    print()

    # =========================================================================
    # SUMMARY
    # =========================================================================
    print("\n" + "=" * 70)
    print("SUMMARY: Key Takeaways")
    print("=" * 70)
    print()
    print("[OK] LIVE BALL:")
    print("   - Only team with possession can call timeout")
    print("   - No substitutions allowed")
    print("   - Examples: After defensive rebound, offensive rebound")
    print()
    print("[OK] DEAD BALL (with substitutions):")
    print("   - Either team can call timeout")
    print("   - Substitutions ALLOWED")
    print("   - Examples: Foul, timeout, violation, missed final FT")
    print()
    print("[OK] DEAD BALL (NO substitutions):")
    print("   - Either team can call timeout")
    print("   - Substitutions NOT ALLOWED")
    print("   - Examples: Made basket, made final FT")
    print()
    print("[WARNING]  CRITICAL: Always check state before timeout/substitution!")
    print("   - Use: possession_state.can_call_timeout(team)")
    print("   - Use: possession_state.can_substitute()")
    print()


if __name__ == '__main__':
    demo_complete_possession_flow()
