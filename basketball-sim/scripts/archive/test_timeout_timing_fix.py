"""
Test script to verify timeout timing fix.

This script runs 3 full games and checks that:
1. Timeouts happen BEFORE possession (not after turnover)
2. Quarter-start substitutions happen before first possession
3. No timing violations in game logs

Expected patterns:
- CORRECT: "TIMEOUT: Lakers call timeout (momentum_swing)" → next possession starts
- WRONG: "Lakers turn it over" → "TIMEOUT: Lakers call timeout" (VIOLATION!)

Author: Architecture & Integration Lead
Date: 2025-11-06
"""

import sys
import os
import re
import random

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings, create_player


def create_extended_roster(team_name: str, base_rating: int = 75) -> list:
    """Create a 10-player roster for testing."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C']
    players = []
    for i, pos in enumerate(positions):
        is_starter = i < 5
        rating = base_rating + (5 if is_starter else -5) + random.randint(-5, 5)
        rating = max(50, min(95, rating))
        player = create_player(
            name=f"{team_name}_{i+1}_{pos}",
            position=pos,
            grip_strength=rating, arm_strength=rating, core_strength=rating,
            agility=rating + random.randint(-3, 3),
            acceleration=rating + random.randint(-3, 3),
            top_speed=rating + random.randint(-3, 3),
            jumping=rating + random.randint(-3, 3),
            reactions=rating + random.randint(-3, 3),
            stamina=rating + random.randint(-3, 3),
            balance=rating + random.randint(-3, 3),
            height=75 if pos in ['PG', 'SG'] else 85 if pos == 'SF' else 90,
            durability=rating,
            awareness=rating + random.randint(-3, 3),
            creativity=rating + random.randint(-3, 3),
            determination=rating + random.randint(-3, 3),
            bravery=rating,
            consistency=rating + random.randint(-3, 3),
            composure=rating + random.randint(-3, 3),
            patience=rating,
            hand_eye_coordination=rating + random.randint(-3, 3),
            throw_accuracy=rating + random.randint(-3, 3),
            form_technique=rating + random.randint(-3, 3),
            finesse=rating + random.randint(-3, 3),
            deception=rating,
            teamwork=rating
        )
        players.append(player)
    return players


def create_minutes_allotment(roster: list) -> dict:
    """Create minutes allocation for roster."""
    allotment = {}
    for i in range(5):
        allotment[roster[i]['name']] = 32
    for i in range(5, 8):
        allotment[roster[i]['name']] = 18
    for i in range(8, 10):
        allotment[roster[i]['name']] = 13
    return allotment


def check_timeout_timing(play_by_play_text: str, game_num: int) -> dict:
    """
    Check timeout timing in play-by-play text.

    Returns dict with:
        - violations: list of violations found
        - timeout_count: number of timeouts in game
        - valid_timeout_count: number of correctly-timed timeouts
    """
    violations = []
    timeout_count = 0
    valid_timeout_count = 0

    # Split into lines
    lines = play_by_play_text.split('\n')

    # Track previous possession outcome
    prev_line = None

    for i, line in enumerate(lines):
        # Check for timeout
        if 'TIMEOUT:' in line:
            timeout_count += 1

            # Check previous line (should NOT be turnover or made basket by OTHER team)
            if prev_line:
                # Extract team that called timeout
                timeout_match = re.search(r'TIMEOUT:\s+(\w+)', line)
                if timeout_match:
                    timeout_team = timeout_match.group(1)

                    # Check if previous line was turnover by THIS team
                    # If so, that's a VIOLATION (team lost ball, can't call timeout)
                    if 'turn' in prev_line.lower() and 'over' in prev_line.lower():
                        # Check if turnover was by timeout team
                        if timeout_team in prev_line:
                            violations.append({
                                'game': game_num,
                                'line_num': i,
                                'violation': 'timeout_after_turnover',
                                'prev_line': prev_line.strip(),
                                'timeout_line': line.strip()
                            })
                        else:
                            # Timeout by team that GAINED possession (legal)
                            valid_timeout_count += 1
                    else:
                        # Timeout not after turnover (likely legal)
                        valid_timeout_count += 1

        # Track previous line
        if line.strip() and not line.startswith('---') and not line.startswith('==='):
            prev_line = line

    return {
        'violations': violations,
        'timeout_count': timeout_count,
        'valid_timeout_count': valid_timeout_count
    }


def check_quarter_start_subs(play_by_play_text: str, game_num: int) -> dict:
    """
    Check that quarter-start substitutions happen BEFORE first possession.

    Returns dict with:
        - violations: list of violations found
        - quarter_starts_checked: number of quarter starts checked
    """
    violations = []

    # Split into lines
    lines = play_by_play_text.split('\n')

    # Find quarter boundaries
    quarter_starts = []
    for i, line in enumerate(lines):
        if re.search(r'={3,}.*Q[2-4]', line):  # Q2, Q3, Q4 start (not Q1)
            quarter_starts.append(i)

    # For each quarter start, check if subs happen before first possession
    for q_start_idx in quarter_starts:
        # Look at next 10 lines
        found_sub = False
        found_possession = False
        sub_line_idx = None
        possession_line_idx = None

        for offset in range(1, min(10, len(lines) - q_start_idx)):
            line = lines[q_start_idx + offset]

            # Check for substitution
            if 'SUB:' in line or 'substitution' in line.lower():
                if not found_sub:
                    found_sub = True
                    sub_line_idx = q_start_idx + offset

            # Check for possession (shot attempt, turnover, etc.)
            if any(keyword in line.lower() for keyword in ['shoots', 'makes', 'misses', 'turnover', 'rebound']):
                if not found_possession:
                    found_possession = True
                    possession_line_idx = q_start_idx + offset

        # If possession happened before sub, that's a violation
        if found_possession and not found_sub:
            # No subs at quarter start (might be OK if no subs needed)
            pass
        elif found_possession and found_sub and possession_line_idx < sub_line_idx:
            violations.append({
                'game': game_num,
                'violation': 'possession_before_quarter_start_sub',
                'quarter_line': q_start_idx,
                'possession_line': possession_line_idx,
                'sub_line': sub_line_idx
            })

    return {
        'violations': violations,
        'quarter_starts_checked': len(quarter_starts)
    }


def run_test_games(num_games: int = 3):
    """
    Run test games and check for timing violations.
    """
    print("=" * 80)
    print("TIMEOUT TIMING FIX VALIDATION")
    print("=" * 80)
    print()

    all_violations = []
    total_timeouts = 0
    total_valid_timeouts = 0

    for game_num in range(1, num_games + 1):
        print(f"\n{'='*80}")
        print(f"GAME {game_num}")
        print(f"{'='*80}\n")

        # Create rosters (seed each game differently)
        random.seed(100 + game_num)
        home_roster = create_extended_roster("Warriors", base_rating=75 + random.randint(-3, 3))
        away_roster = create_extended_roster("Lakers", base_rating=75 + random.randint(-3, 3))

        # Create tactical settings with closers (to trigger end-game scenarios)
        home_tactics = TacticalSettings(
            pace='standard',
            man_defense_pct=50 + random.randint(-10, 10),
            scoring_option_1=home_roster[0]['name'],
            scoring_option_2=home_roster[1]['name'],
            scoring_option_3=home_roster[2]['name'],
            minutes_allotment=create_minutes_allotment(home_roster),
            rebounding_strategy='standard',
            timeout_strategy='aggressive',
            closers=[p['name'] for p in home_roster[:5]]
        )

        away_tactics = TacticalSettings(
            pace='standard',
            man_defense_pct=50 + random.randint(-10, 10),
            scoring_option_1=away_roster[0]['name'],
            scoring_option_2=away_roster[1]['name'],
            scoring_option_3=away_roster[2]['name'],
            minutes_allotment=create_minutes_allotment(away_roster),
            rebounding_strategy='standard',
            timeout_strategy='aggressive',
            closers=[p['name'] for p in away_roster[:5]]
        )

        home_tactics.validate()
        away_tactics.validate()

        # Run game
        game_sim = GameSimulator(
            home_roster=home_roster,
            away_roster=away_roster,
            tactical_home=home_tactics,
            tactical_away=away_tactics,
            home_team_name='Warriors',
            away_team_name='Lakers'
        )

        game_result = game_sim.simulate_game(seed=42 + game_num)

        # Get play-by-play text
        pbp_text = game_result.play_by_play_text

        # Check timeout timing
        timeout_check = check_timeout_timing(pbp_text, game_num)
        print(f"Timeouts in game: {timeout_check['timeout_count']}")
        print(f"Valid timeouts: {timeout_check['valid_timeout_count']}")

        if timeout_check['violations']:
            print(f"\nTIMEOUT TIMING VIOLATIONS FOUND: {len(timeout_check['violations'])}")
            for v in timeout_check['violations']:
                print(f"  Line {v['line_num']}:")
                print(f"    Previous: {v['prev_line']}")
                print(f"    Timeout:  {v['timeout_line']}")
                all_violations.append(v)
        else:
            print("No timeout timing violations found.")

        total_timeouts += timeout_check['timeout_count']
        total_valid_timeouts += timeout_check['valid_timeout_count']

        # Check quarter-start subs
        quarter_check = check_quarter_start_subs(pbp_text, game_num)
        print(f"\nQuarter starts checked: {quarter_check['quarter_starts_checked']}")

        if quarter_check['violations']:
            print(f"QUARTER-START SUB VIOLATIONS FOUND: {len(quarter_check['violations'])}")
            for v in quarter_check['violations']:
                print(f"  Quarter line {v['quarter_line']}: possession before sub")
                all_violations.append(v)
        else:
            print("No quarter-start sub violations found.")

        # Write full play-by-play to file for inspection
        output_file = f"test_game_{game_num}_output.txt"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(pbp_text)
        print(f"\nFull play-by-play written to: {output_file}")

    # Summary
    print(f"\n\n{'='*80}")
    print("VALIDATION SUMMARY")
    print(f"{'='*80}\n")
    print(f"Games run: {num_games}")
    print(f"Total timeouts: {total_timeouts}")
    print(f"Valid timeouts: {total_valid_timeouts}")
    print(f"Total violations: {len(all_violations)}")

    if len(all_violations) == 0:
        print("\n" + "="*80)
        print("SUCCESS: All timeouts and substitutions are correctly timed!")
        print("="*80)
        return True
    else:
        print("\n" + "="*80)
        print("FAILURE: Violations detected. Review game logs above.")
        print("="*80)
        return False


if __name__ == '__main__':
    success = run_test_games(num_games=3)
    sys.exit(0 if success else 1)
