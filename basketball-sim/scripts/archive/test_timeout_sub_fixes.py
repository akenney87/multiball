"""
Test script to validate timeout and substitution fixes.

Runs 5 complete games and saves detailed play-by-play to output files.
Verifies:
1. No timeouts called by team immediately after they score
2. No substitutions during live play (offensive rebounds)
3. No substitutions after made free throws
"""

import sys
import os
sys.path.insert(0, os.path.abspath('.'))

import random
from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings, create_player


def create_extended_roster(team_name: str, base_rating: int = 75) -> list:
    """Create a 10-player roster with randomized attributes."""
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
    """Create minutes allocation: starters 32, bench 18/13."""
    allotment = {}
    for i in range(5):
        allotment[roster[i]['name']] = 32
    for i in range(5, 8):
        allotment[roster[i]['name']] = 18
    for i in range(8, 10):
        allotment[roster[i]['name']] = 13
    return allotment


def run_validation_game(game_num: int, seed: int):
    """Run a single validation game with fixed seed."""

    print(f"\n{'='*80}")
    print(f"RUNNING VALIDATION GAME #{game_num} (seed={seed})")
    print(f"{'='*80}\n")

    # Set random seed
    random.seed(seed)

    # Generate teams
    home_roster = create_extended_roster("Heat", base_rating=75 + random.randint(-3, 3))
    away_roster = create_extended_roster("Celtics", base_rating=75 + random.randint(-3, 3))

    # Set up tactical settings (standard settings)
    tactical_home = TacticalSettings(
        pace='standard',
        man_defense_pct=50 + random.randint(-10, 10),
        scoring_option_1=home_roster[0]['name'],
        scoring_option_2=home_roster[1]['name'],
        scoring_option_3=home_roster[2]['name'],
        rebounding_strategy='standard',
        minutes_allotment=create_minutes_allotment(home_roster),
        closers=[p['name'] for p in home_roster[:7]],
        timeout_strategy='standard'
    )

    tactical_away = TacticalSettings(
        pace='standard',
        man_defense_pct=50 + random.randint(-10, 10),
        scoring_option_1=away_roster[0]['name'],
        scoring_option_2=away_roster[1]['name'],
        scoring_option_3=away_roster[2]['name'],
        rebounding_strategy='standard',
        minutes_allotment=create_minutes_allotment(away_roster),
        closers=[p['name'] for p in away_roster[:7]],
        timeout_strategy='standard'
    )

    tactical_home.validate()
    tactical_away.validate()

    # Create game simulator
    game_sim = GameSimulator(
        home_roster=home_roster,
        away_roster=away_roster,
        tactical_home=tactical_home,
        tactical_away=tactical_away,
        home_team_name="Heat",
        away_team_name="Celtics"
    )

    # Run game simulation
    result = game_sim.simulate_game(seed=seed)

    # Save play-by-play to file
    output_file = f"output/timeout_sub_validation_game_{game_num}.txt"
    os.makedirs("output", exist_ok=True)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(result.play_by_play_text)

    print(f"[OK] Game {game_num} complete: Heat {result.home_score}, Celtics {result.away_score}")
    print(f"  Saved to: {output_file}")

    return result, output_file


def analyze_game_for_violations(game_num: int, output_file: str):
    """
    Analyze game output for violations.

    Checks:
    1. Timeout violations: team calling timeout after they score
    2. Substitution violations: during offensive rebounds
    3. Substitution violations: after made free throws
    """

    print(f"\n--- Analyzing Game {game_num} for violations ---")

    with open(output_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    violations = {
        'timeout_after_own_score': [],
        'sub_during_offensive_rebound': [],
        'sub_after_made_ft': []
    }

    # Track previous lines for context
    prev_lines = []

    for i, line in enumerate(lines):
        # Keep track of previous 5 lines for context
        prev_lines.append(line)
        if len(prev_lines) > 5:
            prev_lines.pop(0)

        # Check for timeout violations
        if 'TIMEOUT' in line:
            # Look at previous 3 lines to see if same team just scored
            for prev_line in prev_lines[-4:-1]:
                # Check for scoring patterns
                if 'MAKES IT' in prev_line.upper() or 'PUTS IT BACK IN' in prev_line.upper():
                    # Extract team from timeout line
                    if 'Heat' in line and 'Heat' in prev_line.upper():
                        violations['timeout_after_own_score'].append({
                            'line_num': i,
                            'context': ''.join(prev_lines[-3:]) + line
                        })
                    elif 'Celtics' in line and 'Celtics' in prev_line.upper():
                        violations['timeout_after_own_score'].append({
                            'line_num': i,
                            'context': ''.join(prev_lines[-3:]) + line
                        })

        # Check for substitution violations (offensive rebounds)
        if 'Substitution' in line:
            # Look at previous lines for offensive rebound
            for prev_line in prev_lines[-3:]:
                if 'Offensive rebound' in prev_line or 'putback' in prev_line or 'kicks it out' in prev_line:
                    # Check if this is right after offensive rebound sequence (no other events between)
                    # If previous line is just offensive rebound continuation, this is a violation
                    if 'kicks it out' in prev_lines[-2]:
                        violations['sub_during_offensive_rebound'].append({
                            'line_num': i,
                            'context': ''.join(prev_lines[-3:]) + line
                        })

        # Check for substitution violations (after made FTs)
        if 'Substitution' in line:
            # Look for made FTs in previous lines
            for prev_line in prev_lines[-4:]:
                if 'makes' in prev_line and 'from the line' in prev_line:
                    # Check if this is ALL makes (not a mix)
                    # Pattern: "Player_Name makes 3/3 from the line" means all made
                    if '/3 from the line' in prev_line or '/2 from the line' in prev_line or '/1 from the line' in prev_line:
                        import re
                        match = re.search(r'makes (\d+)/(\d+) from the line', prev_line)
                        if match:
                            made = int(match.group(1))
                            attempts = int(match.group(2))
                            if made == attempts:  # All FTs made
                                violations['sub_after_made_ft'].append({
                                    'line_num': i,
                                    'context': ''.join(prev_lines[-3:]) + line
                                })

    # Report violations
    total_violations = sum(len(v) for v in violations.values())

    if total_violations == 0:
        print(f"[OK] No violations found in Game {game_num}")
    else:
        print(f"[X] Found {total_violations} violation(s) in Game {game_num}:")

        if violations['timeout_after_own_score']:
            print(f"\n  Timeout after own score: {len(violations['timeout_after_own_score'])}")
            for v in violations['timeout_after_own_score'][:3]:  # Show first 3
                print(f"    Line {v['line_num']}")

        if violations['sub_during_offensive_rebound']:
            print(f"\n  Sub during offensive rebound: {len(violations['sub_during_offensive_rebound'])}")
            for v in violations['sub_during_offensive_rebound'][:3]:
                print(f"    Line {v['line_num']}")

        if violations['sub_after_made_ft']:
            print(f"\n  Sub after made FT: {len(violations['sub_after_made_ft'])}")
            for v in violations['sub_after_made_ft'][:3]:
                print(f"    Line {v['line_num']}")

    return violations


def count_timeouts_and_subs(output_file: str):
    """Count total timeouts and substitutions in game."""

    with open(output_file, 'r', encoding='utf-8') as f:
        content = f.read()

    timeout_count = content.count('TIMEOUT')
    sub_count = content.count('Substitution')

    return {
        'timeouts': timeout_count,
        'substitutions': sub_count
    }


def main():
    """Run 5 validation games and analyze results."""

    print("="*80)
    print("TIMEOUT AND SUBSTITUTION VALIDATION TEST")
    print("="*80)
    print("\nTesting fixes for:")
    print("1. Timeout called by team after they score (ILLEGAL)")
    print("2. Substitutions during live play (offensive rebounds) (ILLEGAL)")
    print("3. Substitutions after made free throws (ILLEGAL)")
    print()

    # Run 5 games with different seeds
    seeds = [42, 123, 456, 789, 1024]
    results = []
    all_violations = []

    for i, seed in enumerate(seeds, 1):
        result, output_file = run_validation_game(i, seed)
        violations = analyze_game_for_violations(i, output_file)
        stats = count_timeouts_and_subs(output_file)

        results.append({
            'game_num': i,
            'seed': seed,
            'final_score': (result.home_score, result.away_score),
            'violations': violations,
            'stats': stats
        })
        all_violations.append(violations)

    # Generate summary report
    print("\n" + "="*80)
    print("VALIDATION SUMMARY")
    print("="*80)

    total_timeout_violations = sum(len(v['timeout_after_own_score']) for v in all_violations)
    total_oreb_violations = sum(len(v['sub_during_offensive_rebound']) for v in all_violations)
    total_ft_violations = sum(len(v['sub_after_made_ft']) for v in all_violations)
    total_violations = total_timeout_violations + total_oreb_violations + total_ft_violations

    print(f"\nTotal games run: 5")
    print(f"Total violations found: {total_violations}")
    print(f"  - Timeout after own score: {total_timeout_violations}")
    print(f"  - Sub during offensive rebound: {total_oreb_violations}")
    print(f"  - Sub after made FT: {total_ft_violations}")

    print("\nPer-game statistics:")
    for r in results:
        print(f"\nGame {r['game_num']} (seed={r['seed']}):")
        print(f"  Final Score: Heat {r['final_score'][0]}, Celtics {r['final_score'][1]}")
        print(f"  Timeouts: {r['stats']['timeouts']}")
        print(f"  Substitutions: {r['stats']['substitutions']}")
        v_count = sum(len(v) for v in r['violations'].values())
        if v_count == 0:
            print(f"  Violations: [OK] NONE")
        else:
            print(f"  Violations: [X] {v_count}")

    if total_violations == 0:
        print("\n" + "="*80)
        print("[OK][OK][OK] ALL TESTS PASSED - ZERO VIOLATIONS [OK][OK][OK]")
        print("="*80)
    else:
        print("\n" + "="*80)
        print(f"[X][X][X] TESTS FAILED - {total_violations} VIOLATIONS FOUND [X][X][X]")
        print("="*80)


if __name__ == '__main__':
    main()
