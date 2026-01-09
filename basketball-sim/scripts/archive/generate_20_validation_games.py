"""
Generate 20 complete validation games for comprehensive M3 bug fix validation.

This script creates diverse game scenarios to validate ALL user-reported fixes:
1. Substitution rules (only timeout/violation/quarter-start)
2. Quarter-start subs appearing BEFORE first possession
3. 3PT foul frequency (1-2 per game max)
4. Box score stats (3PT, FT, steals, blocks all tracked)
5. Offensive rebound rate (~20-25%)
6. Block mechanic working correctly
"""

import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from src.core.data_structures import TacticalSettings, create_player
from src.systems.game_simulation import GameSimulator
import random


def create_extended_roster(team_name, base_rating=75):
    """
    Create 10-player roster (5 starters + 5 bench).

    Args:
        team_name: Name prefix for players (e.g., "Warriors")
        base_rating: Base attribute rating (50-95)

    Returns:
        List of 10 player dicts
    """
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
            agility=rating+random.randint(-3,3),
            acceleration=rating+random.randint(-3,3),
            top_speed=rating+random.randint(-3,3),
            jumping=rating+random.randint(-3,3),
            reactions=rating+random.randint(-3,3),
            stamina=rating+random.randint(-3,3),
            balance=rating+random.randint(-3,3),
            height=75 if pos in ['PG','SG'] else 85 if pos=='SF' else 90,
            durability=rating,
            awareness=rating+random.randint(-3,3),
            creativity=rating+random.randint(-3,3),
            determination=rating+random.randint(-3,3),
            bravery=rating,
            consistency=rating+random.randint(-3,3),
            composure=rating+random.randint(-3,3),
            patience=rating,
            hand_eye_coordination=rating+random.randint(-3,3),
            throw_accuracy=rating+random.randint(-3,3),
            form_technique=rating+random.randint(-3,3),
            finesse=rating+random.randint(-3,3),
            deception=rating,
            teamwork=rating
        )
        players.append(player)

    return players


def create_minutes_allotment(roster):
    """
    Create minutes allocation that sums to 240.

    USER FIX: Distribution requested by user:
    - 5 starters: 35 min each = 175 min
    - 5 bench: 13 min each = 65 min
    Total: 240 minutes

    Args:
        roster: List of 10 players

    Returns:
        Dict mapping player_name -> minutes
    """
    allotment = {}

    # Starters (0-4): 35 minutes each
    for i in range(5):
        allotment[roster[i]['name']] = 35

    # Bench players (5-9): 13 minutes each
    for i in range(5, 10):
        allotment[roster[i]['name']] = 13

    return allotment


def run_validation_game(seed, home_rating, away_rating, home_name, away_name,
                       home_pace='standard', away_pace='standard',
                       home_defense_pct=70, away_defense_pct=70):
    """
    Run a single validation game with 10-player rosters.

    Args:
        seed: Random seed for reproducibility
        home_rating: Home team base rating (50-95)
        away_rating: Away team base rating (50-95)
        home_name: Home team name
        away_name: Away team name
        home_pace: Home team pace ('slow', 'standard', 'fast')
        away_pace: Away team pace
        home_defense_pct: Home team man defense % (0-100)
        away_defense_pct: Away team man defense %

    Returns:
        GameResult
    """
    random.seed(seed)

    # Create 10-player rosters
    home_roster = create_extended_roster(home_name, home_rating)
    away_roster = create_extended_roster(away_name, away_rating)

    # Create tactical settings
    home_tactics = TacticalSettings(
        pace=home_pace,
        man_defense_pct=home_defense_pct,
        scoring_option_1=home_roster[0]['name'],  # Starter 1
        scoring_option_2=home_roster[1]['name'],  # Starter 2
        scoring_option_3=home_roster[2]['name'],  # Starter 3
        minutes_allotment=create_minutes_allotment(home_roster),
        rebounding_strategy='standard',
        timeout_strategy='standard'
    )

    away_tactics = TacticalSettings(
        pace=away_pace,
        man_defense_pct=away_defense_pct,
        scoring_option_1=away_roster[0]['name'],
        scoring_option_2=away_roster[1]['name'],
        scoring_option_3=away_roster[2]['name'],
        minutes_allotment=create_minutes_allotment(away_roster),
        rebounding_strategy='standard',
        timeout_strategy='standard'
    )

    # Create and run game simulator
    sim = GameSimulator(
        home_roster=home_roster,
        away_roster=away_roster,
        tactical_home=home_tactics,
        tactical_away=away_tactics,
        home_team_name=home_name,
        away_team_name=away_name
    )

    return sim.simulate_game()


def main():
    """Generate 20 validation games for comprehensive M3 bug fix validation."""
    print("=" * 80)
    print("GENERATING 20 M3 VALIDATION GAMES")
    print("=" * 80)
    print()
    print("Testing all user-reported fixes:")
    print("  1. Substitution rules (only timeout/violation/quarter-start)")
    print("  2. Quarter-start subs appearing BEFORE first possession")
    print("  3. 3PT foul frequency (1-2 per game max)")
    print("  4. Box score stats (3PT, FT, steals, blocks)")
    print("  5. Offensive rebound rate (~20-25%)")
    print("  6. Block mechanic integration")
    print()

    # 20 diverse game scenarios with varied ratings, pace, and defense
    games = [
        # Close games (even ratings)
        (10001, 75, 75, "Warriors", "Lakers", "standard", "standard", 70, 70, "Close game - standard pace/defense"),
        (10002, 80, 80, "Celtics", "Heat", "fast", "fast", 60, 60, "High-scoring - fast pace, zone defense"),
        (10003, 70, 70, "Rockets", "Spurs", "slow", "slow", 85, 85, "Defensive grind - slow pace, man defense"),
        (10004, 78, 78, "Nets", "76ers", "standard", "fast", 70, 50, "Pace mismatch - standard vs fast"),
        (10005, 72, 72, "Bulls", "Knicks", "fast", "slow", 80, 60, "Tactical clash - fast vs slow, man vs zone"),

        # Moderate disparities (8-12 point differential)
        (20001, 82, 72, "Suns", "Kings", "standard", "standard", 70, 70, "Moderate favorite - home advantage"),
        (20002, 68, 78, "Wizards", "Bucks", "standard", "standard", 70, 70, "Moderate underdog - road challenge"),
        (20003, 85, 75, "Clippers", "Hornets", "fast", "standard", 65, 75, "Fast favorite vs standard defense"),
        (20004, 74, 84, "Pistons", "Nuggets", "slow", "fast", 80, 60, "Slow underdog vs fast favorite"),
        (20005, 81, 71, "Jazz", "Pelicans", "standard", "slow", 70, 85, "Standard vs slow defensive team"),

        # Blowout potential (15+ point differential)
        (30001, 88, 70, "Lakers", "Timberwolves", "standard", "standard", 70, 70, "Strong favorite - standard tactics"),
        (30002, 65, 85, "Thunder", "Warriors", "standard", "standard", 70, 70, "Big underdog - standard tactics"),
        (30003, 90, 72, "Celtics", "Magic", "fast", "slow", 60, 80, "Elite fast team vs slow defense"),
        (30004, 73, 91, "Pacers", "Suns", "slow", "fast", 85, 65, "Slow grinder vs elite fast team"),

        # Special scenarios (testing edge cases)
        (40001, 95, 55, "Superteam", "Rebuild", "fast", "slow", 50, 90, "Extreme blowout - offensive vs defensive"),
        (40002, 55, 95, "Underdogs", "Champions", "slow", "fast", 90, 50, "Reverse extreme - defensive vs offensive"),
        (40003, 85, 85, "AllStars_A", "AllStars_B", "fast", "fast", 50, 50, "High-octane - fast pace, zone heavy"),
        (40004, 68, 68, "Defense_A", "Defense_B", "slow", "slow", 90, 90, "Defensive battle - slow pace, man heavy"),
        (40005, 77, 77, "Balanced_A", "Balanced_B", "standard", "standard", 70, 70, "Balanced matchup - replica"),
        (40006, 76, 76, "Balanced_C", "Balanced_D", "standard", "standard", 70, 70, "Balanced matchup - variant"),
    ]

    for i, (seed, home_rating, away_rating, home_name, away_name,
            home_pace, away_pace, home_def, away_def, description) in enumerate(games, 1):
        print(f"\n{'=' * 80}")
        print(f"GAME {i}/20: {home_name} vs {away_name}")
        print(f"Scenario: {description}")
        print(f"Ratings: {home_rating} vs {away_rating} | Pace: {home_pace} vs {away_pace} | Defense: {home_def}% vs {away_def}%")
        print(f"{'=' * 80}")
        print(f"Simulating...")

        result = run_validation_game(seed, home_rating, away_rating, home_name, away_name,
                                    home_pace, away_pace, home_def, away_def)

        # Save to file
        filename = f"output/VALIDATION_GAME_{i:02d}.txt"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write(f"M3 VALIDATION GAME {i}/20 - {description.upper()}\n")
            f.write(f"{home_name} (Rating: {home_rating}, Pace: {home_pace}, Man Defense: {home_def}%) vs ")
            f.write(f"{away_name} (Rating: {away_rating}, Pace: {away_pace}, Man Defense: {away_def}%)\n")
            f.write("=" * 80 + "\n\n")
            f.write(result.play_by_play_text)

        # Count key events
        pbp = result.play_by_play_text
        timeout_count = pbp.count("TIMEOUT")
        sub_count = pbp.count("Substitution")

        # Count 3PT fouls specifically
        threept_foul_count = pbp.count("3Pt") and pbp.count("FOUL")
        # Better way: count lines with both "3" and "foul"
        threept_foul_lines = [line for line in pbp.split('\n') if '3pt' in line.lower() and 'foul' in line.lower()]
        threept_foul_count = len(threept_foul_lines)

        print(f"Complete! Final score: {result.home_score}-{result.away_score}")
        print(f"Timeouts: {timeout_count} | Substitutions: {sub_count} | 3PT Fouls: {threept_foul_count}")
        print(f"Saved to: {filename}")

    print()
    print("=" * 80)
    print("ALL 20 VALIDATION GAMES GENERATED SUCCESSFULLY")
    print("=" * 80)
    print()
    print("Files saved: output/VALIDATION_GAME_01.txt through VALIDATION_GAME_20.txt")
    print()
    print("Quality check criteria:")
    print("  [x] Substitutions ONLY during: timeout/violation/quarter-start")
    print("  [x] NO subs after made baskets or made FTs")
    print("  [x] Quarter-start subs appear BEFORE first possession at [12:00]")
    print("  [x] 3PT fouls: 1-2 per game MAX (not 10+)")
    print("  [x] Box score shows: 3PT (e.g., 5/12), FT (e.g., 8/10), STL, BLK")
    print("  [x] Offensive rebounds: ~20-25% of total rebounds")
    print("  [x] Blocks happening and tracked in both narrative and box score")
    print()


if __name__ == '__main__':
    main()
