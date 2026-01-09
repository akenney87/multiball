"""
Basketball Simulator - M3 USER REVIEW GAME GENERATOR

Generates 2-3 pristine game logs showcasing all M3 features for user review.

Features showcased:
- Legal timeouts (momentum-based, not after own scores)
- Legal substitutions (only during dead balls)
- Bonus situations (team fouls reach 5+)
- Foul variety (shooting, non-shooting, offensive)
- Free throw misses (realistic 75-80%)
- Complete box scores (all stats populated)
- Realistic scoring (180-220 points per game)
- Realistic foul counts (18-25 per game)
"""

import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from src.core.data_structures import TacticalSettings, create_player
from src.systems.game_simulation import GameSimulator
import random
import json


def create_extended_roster(team_name: str, base_rating: int = 75) -> list:
    """Create a 10-player roster with varied attributes."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C']
    players = []

    for i, pos in enumerate(positions):
        is_starter = i < 5
        rating = base_rating + (5 if is_starter else -5)
        variation = random.randint(-5, 5)
        rating = max(50, min(95, rating + variation))

        player = create_player(
            name=f"{team_name}_{i+1}_{pos}",
            position=pos,
            grip_strength=rating,
            arm_strength=rating,
            core_strength=rating,
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
    """Create realistic minutes allocation (must sum to 240)."""
    allotment = {}
    for i in range(5):
        allotment[roster[i]['name']] = 32
    for i in range(5, 8):
        allotment[roster[i]['name']] = 18
    for i in range(8, 10):
        allotment[roster[i]['name']] = 13

    total = sum(allotment.values())
    assert total == 240, f"Minutes must sum to 240, got {total}"
    return allotment


def quick_violation_scan(pbp_text: str, game_name: str) -> dict:
    """Quick scan for violations in play-by-play."""
    violations = {
        'timeout_after_own_score': [],
        'sub_during_live_play': [],
        'sub_after_made_ft': [],
        'missing_bonus': [],
        'perfect_ft_shooting': False
    }

    lines = pbp_text.split('\n')
    prev_line = ''
    ft_made = 0
    ft_total = 0

    for i, line in enumerate(lines):
        # Check for timeout violations (team calls timeout right after they score)
        if 'TIMEOUT' in line and prev_line:
            if 'makes' in prev_line.lower() or 'GOOD' in prev_line:
                # Extract team from timeout line
                timeout_team = None
                if 'Home' in line:
                    timeout_team = 'Home'
                elif 'Away' in line:
                    timeout_team = 'Away'

                # Extract scoring team from previous line
                scoring_team = None
                if 'Home' in prev_line or 'HOME' in prev_line:
                    scoring_team = 'Home'
                elif 'Away' in prev_line or 'AWAY' in prev_line:
                    scoring_team = 'Away'

                # Violation if same team
                if timeout_team and scoring_team and timeout_team == scoring_team:
                    violations['timeout_after_own_score'].append(f"Line {i}: {line}")

        # Check for substitution violations
        if 'SUB IN' in line or 'SUB OUT' in line:
            # Look at surrounding context
            context = '\n'.join(lines[max(0, i-2):min(len(lines), i+3)])
            if 'dead ball' not in context.lower() and 'timeout' not in context.lower():
                # Check if it's after a made FT (illegal)
                if 'makes free throw' in prev_line.lower() and 'of 2' in prev_line.lower():
                    violations['sub_after_made_ft'].append(f"Line {i}: {line}")

        # Track free throw accuracy
        if 'free throw' in line.lower():
            ft_total += 1
            if 'makes' in line.lower():
                ft_made += 1

        prev_line = line

    # Check for perfect FT shooting (unrealistic)
    if ft_total > 0:
        ft_pct = ft_made / ft_total
        if ft_pct == 1.0 and ft_total > 10:
            violations['perfect_ft_shooting'] = True

    return violations, ft_made, ft_total


def generate_game(seed: int, scenario: str) -> tuple:
    """Generate a single game with specific scenario."""
    random.seed(seed)

    # Create rosters based on scenario
    if scenario == 'close':
        # Evenly matched teams
        home_roster = create_extended_roster("Warriors", base_rating=75)
        away_roster = create_extended_roster("Lakers", base_rating=75)
    elif scenario == 'blowout':
        # Mismatched teams
        home_roster = create_extended_roster("Warriors", base_rating=82)
        away_roster = create_extended_roster("Lakers", base_rating=68)
    elif scenario == 'defensive':
        # Lower offensive ratings
        home_roster = create_extended_roster("Warriors", base_rating=70)
        away_roster = create_extended_roster("Lakers", base_rating=70)
    else:
        home_roster = create_extended_roster("Warriors", base_rating=75)
        away_roster = create_extended_roster("Lakers", base_rating=75)

    # Create tactical settings
    home_tactics = TacticalSettings(
        pace='standard',
        man_defense_pct=70,
        scoring_option_1=home_roster[0]['name'],
        scoring_option_2=home_roster[1]['name'],
        scoring_option_3=home_roster[2]['name'],
        minutes_allotment=create_minutes_allotment(home_roster),
        rebounding_strategy='standard'
    )

    away_tactics = TacticalSettings(
        pace='standard',
        man_defense_pct=70,
        scoring_option_1=away_roster[0]['name'],
        scoring_option_2=away_roster[1]['name'],
        scoring_option_3=away_roster[2]['name'],
        minutes_allotment=create_minutes_allotment(away_roster),
        rebounding_strategy='standard'
    )

    # Run simulation
    sim = GameSimulator(
        home_roster=home_roster,
        away_roster=away_roster,
        tactical_home=home_tactics,
        tactical_away=away_tactics,
        home_team_name="Warriors",
        away_team_name="Lakers"
    )

    result = sim.simulate_game()

    return result, home_roster, away_roster


def format_game_log(result: dict, scenario: str, seed: int) -> str:
    """Format game result into clean log."""
    output = []
    output.append("=" * 80)
    output.append(f"M3 USER REVIEW GAME - {scenario.upper()} SCENARIO (Seed: {seed})")
    output.append("=" * 80)
    output.append("")

    # Add play-by-play
    output.append(result['play_by_play'])
    output.append("")

    # Add summary
    output.append("=" * 80)
    output.append("GAME SUMMARY")
    output.append("=" * 80)
    output.append(f"Final Score: Home {result['home_score']} - Away {result['away_score']}")
    output.append(f"Margin: {abs(result['home_score'] - result['away_score'])} points")
    output.append(f"Total Points: {result['home_score'] + result['away_score']}")
    output.append(f"Home Fouls: {result['home_stats'].get('team_fouls', 0)}")
    output.append(f"Away Fouls: {result['away_stats'].get('team_fouls', 0)}")
    output.append("")

    return '\n'.join(output)


def main():
    """Generate user review games."""
    print("=" * 80)
    print("M3 USER REVIEW GAME GENERATOR")
    print("=" * 80)
    print()

    scenarios = [
        ('close', 12345, 'Close game (evenly matched teams)'),
        ('blowout', 67890, 'Moderate blowout (10-15 point margin)'),
        ('defensive', 11111, 'Defensive battle (lower scoring)')
    ]

    metrics = {
        'games': [],
        'violations_found': 0,
        'total_violations': []
    }

    for idx, (scenario, seed, description) in enumerate(scenarios, 1):
        print(f"\nGenerating Game {idx}: {description}")
        print(f"Seed: {seed}")
        print("-" * 80)

        # Generate game
        result, home_roster, away_roster = generate_game(seed, scenario)

        # Format output
        game_log = format_game_log(result, scenario, seed)

        # Save to file
        filename = f"output/M3_USER_REVIEW_GAME_{idx}.txt"
        with open(filename, 'w') as f:
            f.write(game_log)

        print(f"✓ Saved to {filename}")

        # Quick validation
        violations, ft_made, ft_total = quick_violation_scan(result['play_by_play'], f"Game {idx}")

        has_violations = (
            len(violations['timeout_after_own_score']) > 0 or
            len(violations['sub_during_live_play']) > 0 or
            len(violations['sub_after_made_ft']) > 0 or
            violations['perfect_ft_shooting']
        )

        if has_violations:
            print(f"⚠ VIOLATIONS FOUND IN GAME {idx}!")
            metrics['violations_found'] += 1
            metrics['total_violations'].append({
                'game': idx,
                'violations': violations
            })
        else:
            print(f"✓ No violations detected")

        # Calculate metrics
        ft_pct = (ft_made / ft_total * 100) if ft_total > 0 else 0
        total_score = result['home_score'] + result['away_score']
        margin = abs(result['home_score'] - result['away_score'])
        total_fouls = result['home_stats'].get('team_fouls', 0) + result['away_stats'].get('team_fouls', 0)

        print(f"  Score: {result['home_score']}-{result['away_score']} (Margin: {margin})")
        print(f"  Total Points: {total_score}")
        print(f"  Total Fouls: {total_fouls}")
        print(f"  FT%: {ft_pct:.1f}% ({ft_made}/{ft_total})")

        metrics['games'].append({
            'game': idx,
            'scenario': scenario,
            'seed': seed,
            'home_score': result['home_score'],
            'away_score': result['away_score'],
            'margin': margin,
            'total_points': total_score,
            'total_fouls': total_fouls,
            'ft_made': ft_made,
            'ft_total': ft_total,
            'ft_pct': ft_pct
        })

    # Generate summary
    print("\n" + "=" * 80)
    print("GENERATION COMPLETE")
    print("=" * 80)
    print(f"\nGames Generated: {len(scenarios)}")
    print(f"Violations Found: {metrics['violations_found']}")

    if metrics['violations_found'] > 0:
        print("\n⚠ VIOLATIONS DETECTED - REVIEW REQUIRED")
        for v in metrics['total_violations']:
            print(f"\nGame {v['game']}:")
            for violation_type, violation_list in v['violations'].items():
                if violation_list and violation_type != 'perfect_ft_shooting':
                    print(f"  - {violation_type}: {len(violation_list)} occurrences")
                elif violation_type == 'perfect_ft_shooting' and violation_list:
                    print(f"  - {violation_type}: TRUE")
    else:
        print("\n✓ NO VIOLATIONS DETECTED - READY FOR USER REVIEW")

    # Calculate averages
    avg_score = sum(g['total_points'] for g in metrics['games']) / len(metrics['games'])
    avg_fouls = sum(g['total_fouls'] for g in metrics['games']) / len(metrics['games'])
    avg_ft_pct = sum(g['ft_pct'] for g in metrics['games']) / len(metrics['games'])

    print(f"\nAverage Metrics:")
    print(f"  Total Points: {avg_score:.1f}")
    print(f"  Total Fouls: {avg_fouls:.1f}")
    print(f"  FT%: {avg_ft_pct:.1f}%")

    # Save metrics
    with open('output/M3_USER_REVIEW_METRICS.json', 'w') as f:
        json.dump(metrics, f, indent=2)

    print(f"\n✓ Metrics saved to output/M3_USER_REVIEW_METRICS.json")

    return metrics


if __name__ == '__main__':
    metrics = main()
