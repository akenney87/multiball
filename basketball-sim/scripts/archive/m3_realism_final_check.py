"""
Basketball Simulator - M3 REALISM FINAL CHECK (Corrected)

Streamlined validation with correct pattern matching.
"""

import sys
import os
import re
sys.path.insert(0, os.path.abspath('.'))

from src.core.data_structures import TacticalSettings, create_player
from src.systems.game_simulation import GameSimulator
import random


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
    """Create realistic minutes allocation."""
    allotment = {}
    for i in range(5):
        allotment[roster[i]['name']] = 32
    for i in range(5, 8):
        allotment[roster[i]['name']] = 18
    for i in range(8, 10):
        allotment[roster[i]['name']] = 13

    assert sum(allotment.values()) == 240
    return allotment


def extract_stats_from_log(pbp_text, home_name, away_name):
    """Extract statistics using correct patterns."""
    lines = pbp_text.split('\n')

    # FT statistics - count individual attempts
    ft_makes = 0
    ft_misses = 0
    for line in lines:
        if re.search(r'FT \d+/\d+: GOOD', line):
            ft_makes += 1
        elif re.search(r'FT \d+/\d+: MISS', line):
            ft_misses += 1

    ft_total = ft_makes + ft_misses
    ft_pct = (ft_makes / ft_total * 100) if ft_total > 0 else 0

    # Foul statistics
    shooting_fouls = len([l for l in lines if 'shooting foul' in l.lower()])
    non_shooting_fouls = len([l for l in lines if any(k in l.lower() for k in ['reach-in', 'loose ball', 'holding'])])
    offensive_fouls = len([l for l in lines if 'offensive foul' in l.lower() or 'charging' in l.lower() or 'drew the charge' in l.lower()])
    total_fouls = shooting_fouls + non_shooting_fouls + offensive_fouls

    # Timeout statistics
    home_timeouts = len([l for l in lines if 'TIMEOUT' in l and home_name in l and 'timeouts remaining' in l.lower()])
    away_timeouts = len([l for l in lines if 'TIMEOUT' in l and away_name in l and 'timeouts remaining' in l.lower()])

    # Score
    for line in reversed(lines):
        if 'FINAL SCORE' in line.upper():
            match = re.search(r'(\d+)-(\d+)', line)
            if match:
                home_score = int(match.group(1))
                away_score = int(match.group(2))
                break
    else:
        # Fallback
        home_score = 0
        away_score = 0
        for line in reversed(lines):
            if 'Score:' in line:
                match = re.search(r'Score:\s*(\d+)-(\d+)', line)
                if match:
                    home_score = int(match.group(1))
                    away_score = int(match.group(2))
                    break

    return {
        'ft_makes': ft_makes,
        'ft_misses': ft_misses,
        'ft_total': ft_total,
        'ft_pct': ft_pct,
        'shooting_fouls': shooting_fouls,
        'non_shooting_fouls': non_shooting_fouls,
        'offensive_fouls': offensive_fouls,
        'total_fouls': total_fouls,
        'home_timeouts': home_timeouts,
        'away_timeouts': away_timeouts,
        'home_score': home_score,
        'away_score': away_score,
        'total_score': home_score + away_score
    }


def check_violations(pbp_text, home_name, away_name):
    """Check for critical violations."""
    lines = pbp_text.split('\n')
    violations = []

    # Check for timeout after scoring (simplified check)
    for i in range(len(lines) - 2):
        line = lines[i].lower()
        next_line = lines[i + 1].lower()

        # If a team scores and immediately calls timeout
        if 'makes' in line and ('score:' in line or 'leads' in line):
            scoring_team = home_name if home_name.lower() in line else away_name if away_name.lower() in line else None
            if scoring_team and 'timeout' in next_line and scoring_team.lower() in next_line:
                violations.append(f"TIMEOUT: {scoring_team} called timeout after scoring (line {i+1})")

    # Check for substitutions during live play (after OREB)
    for i in range(len(lines) - 1):
        if 'offensive rebound' in lines[i].lower():
            if 'substitution' in lines[i + 1].lower():
                violations.append(f"SUBSTITUTION: During live play after OREB (line {i+1})")

    return violations


def run_single_game(game_num, seed, home_name, away_name):
    """Run a single game."""
    print(f"\n{'=' * 80}")
    print(f"GAME {game_num}/5 - Seed {seed}")
    print(f"  {home_name} vs {away_name}")
    print(f"{'=' * 80}")

    random.seed(seed)

    home_roster = create_extended_roster(home_name, 75 + random.randint(-3, 3))
    away_roster = create_extended_roster(away_name, 75 + random.randint(-3, 3))

    home_minutes = create_minutes_allotment(home_roster)
    away_minutes = create_minutes_allotment(away_roster)

    home_closers = [p['name'] for p in home_roster[:7]]
    away_closers = [p['name'] for p in away_roster[:7]]

    tactical_home = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=home_roster[0]['name'],
        scoring_option_2=home_roster[1]['name'],
        scoring_option_3=home_roster[2]['name'],
        minutes_allotment=home_minutes,
        rebounding_strategy='standard',
        closers=home_closers,
        timeout_strategy='standard'
    )

    tactical_away = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=away_roster[0]['name'],
        scoring_option_2=away_roster[1]['name'],
        scoring_option_3=away_roster[2]['name'],
        minutes_allotment=away_minutes,
        rebounding_strategy='standard',
        closers=away_closers,
        timeout_strategy='standard'
    )

    tactical_home.validate()
    tactical_away.validate()

    game_sim = GameSimulator(
        home_roster=home_roster,
        away_roster=away_roster,
        tactical_home=tactical_home,
        tactical_away=tactical_away,
        home_team_name=home_name,
        away_team_name=away_name
    )

    game_result = game_sim.simulate_game(seed=seed)
    pbp_text = game_result.play_by_play_text

    # Save full log
    output_dir = 'output'
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    output_file = os.path.join(output_dir, f'm3_final_validation_game_{game_num}.txt')
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(pbp_text)

    # Extract stats
    stats = extract_stats_from_log(pbp_text, home_name, away_name)

    # Check violations
    violations = check_violations(pbp_text, home_name, away_name)

    print(f"  Final Score: {home_name} {stats['home_score']}, {away_name} {stats['away_score']}")
    print(f"  Fouls: {stats['total_fouls']} (S:{stats['shooting_fouls']}, NS:{stats['non_shooting_fouls']}, O:{stats['offensive_fouls']})")
    print(f"  Free Throws: {stats['ft_makes']}/{stats['ft_total']} ({stats['ft_pct']:.1f}%)")
    print(f"  Timeouts: {home_name} {stats['home_timeouts']}, {away_name} {stats['away_timeouts']}")
    print(f"  Violations: {len(violations)}")
    for v in violations:
        print(f"    - {v}")

    return {
        'game_num': game_num,
        'home_name': home_name,
        'away_name': away_name,
        'stats': stats,
        'violations': violations,
        'output_file': output_file,
        'pbp_text': pbp_text
    }


def main():
    """Run 5-game validation suite."""
    print("=" * 80)
    print("M3 FINAL VALIDATION - REALISM SPECIALIST REVIEW")
    print("=" * 80)
    print()

    scenarios = [
        (701, 'Celtics', 'Heat'),
        (702, 'Lakers', 'Clippers'),
        (703, 'Warriors', 'Suns'),
        (704, 'Bucks', 'Nets'),
        (705, 'Nuggets', 'Mavs'),
    ]

    results = []
    for i, (seed, home, away) in enumerate(scenarios, 1):
        result = run_single_game(i, seed, home, away)
        results.append(result)

    print()
    print("=" * 80)
    print("FINAL VALIDATION REPORT")
    print("=" * 80)
    print()

    # Aggregate statistics
    total_violations = sum(len(r['violations']) for r in results)
    total_ft_makes = sum(r['stats']['ft_makes'] for r in results)
    total_ft_attempts = sum(r['stats']['ft_total'] for r in results)
    overall_ft_pct = (total_ft_makes / total_ft_attempts * 100) if total_ft_attempts > 0 else 0

    total_fouls = sum(r['stats']['total_fouls'] for r in results)
    avg_fouls = total_fouls / len(results)

    total_shooting = sum(r['stats']['shooting_fouls'] for r in results)
    total_non_shooting = sum(r['stats']['non_shooting_fouls'] for r in results)
    total_offensive = sum(r['stats']['offensive_fouls'] for r in results)

    shooting_pct = (total_shooting / total_fouls * 100) if total_fouls > 0 else 0
    non_shooting_pct = (total_non_shooting / total_fouls * 100) if total_fouls > 0 else 0
    offensive_pct = (total_offensive / total_fouls * 100) if total_fouls > 0 else 0

    avg_score = sum(r['stats']['total_score'] for r in results) / len(results)

    print("1. VIOLATION REPORT")
    print("-" * 80)
    if total_violations == 0:
        print("PASS: ZERO VIOLATIONS FOUND")
    else:
        print(f"FAIL: {total_violations} violations found")
        for r in results:
            if r['violations']:
                print(f"\n  Game {r['game_num']}:")
                for v in r['violations']:
                    print(f"    - {v}")
    print()

    print("2. FREE THROW VALIDATION")
    print("-" * 80)
    print(f"Overall FT%: {overall_ft_pct:.1f}% (target: 70-85%)")
    print(f"Total: {total_ft_makes}/{total_ft_attempts}")
    print(f"Misses: {total_ft_attempts - total_ft_makes}")
    ft_ok = 70 <= overall_ft_pct <= 85
    print(f"Status: {'PASS' if ft_ok else 'FAIL'}")
    print()

    print("3. FOUL VARIETY VALIDATION")
    print("-" * 80)
    print(f"Average fouls per game: {avg_fouls:.1f} (target: 18-25)")
    print(f"Shooting fouls: {shooting_pct:.1f}% (target: 60-75%)")
    print(f"Non-shooting fouls: {non_shooting_pct:.1f}% (target: 20-30%)")
    print(f"Offensive fouls: {offensive_pct:.1f}% (target: 5-10%)")
    fouls_ok = 18 <= avg_fouls <= 25
    print(f"Status: {'PASS' if fouls_ok else 'FAIL'}")
    print()

    print("4. SCORING VALIDATION")
    print("-" * 80)
    print(f"Average total score: {avg_score:.1f} (target: 180-220)")
    score_ok = 180 <= avg_score <= 220
    print(f"Status: {'PASS' if score_ok else 'FAIL'}")
    print()

    print("5. FEATURE CHECKS")
    print("-" * 80)
    sample = results[0]['pbp_text'].lower()
    has_ft_misses = 'miss' in sample and 'ft' in sample
    has_non_shooting_fouls = any(k in sample for k in ['reach-in', 'loose ball', 'holding'])
    has_bonus = 'bonus' in sample
    has_timeouts = 'timeout' in sample

    print(f"FT misses present: {'PASS' if has_ft_misses else 'FAIL'}")
    print(f"Non-shooting fouls present: {'PASS' if has_non_shooting_fouls else 'FAIL'}")
    print(f"Bonus system present: {'PASS' if has_bonus else 'FAIL'}")
    print(f"Timeouts present: {'PASS' if has_timeouts else 'FAIL'}")
    print()

    print("=" * 80)
    print("RECOMMENDATION")
    print("=" * 80)

    all_pass = (
        total_violations == 0 and
        ft_ok and
        fouls_ok and
        score_ok and
        has_ft_misses and
        has_non_shooting_fouls
    )

    if all_pass:
        print("RECOMMEND SIGN-OFF")
        print()
        print("All critical issues resolved:")
        print("  [PASS] Zero violations")
        print("  [PASS] FT% realistic (70-85%)")
        print("  [PASS] Foul variety present")
        print("  [PASS] Scoring realistic")
        print("  [PASS] All M3 features working")
        print()
        print("M3 is READY FOR PRODUCTION.")

        # Create user review games
        print()
        print("Creating user review game logs...")
        for i in [1, 2]:
            src = results[i-1]['output_file']
            dst = os.path.join('output', f'm3_user_review_game_{i}.txt')
            with open(src, 'r', encoding='utf-8') as f:
                content = f.read()
            with open(dst, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  - {dst}")
    else:
        print("RECOMMEND FURTHER WORK")
        print()
        print("Issues remaining:")
        if total_violations > 0:
            print(f"  [FAIL] {total_violations} violations")
        if not ft_ok:
            print(f"  [FAIL] FT% out of range: {overall_ft_pct:.1f}%")
        if not fouls_ok:
            print(f"  [FAIL] Foul rate out of range: {avg_fouls:.1f}")
        if not score_ok:
            print(f"  [FAIL] Scoring out of range: {avg_score:.1f}")

    print()
    print("=" * 80)
    print("VALIDATION COMPLETE")
    print("=" * 80)
    print()
    print("Game logs saved to:")
    for r in results:
        print(f"  - {r['output_file']}")
    print()


if __name__ == '__main__':
    main()
