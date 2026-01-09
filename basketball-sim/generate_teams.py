"""
M4 PHASE 1: RANDOM TEAM GENERATOR

Generates diverse teams with realistic NBA attribute distributions.
Ensures position-appropriate attribute profiles and team quality variance.

Usage:
    python generate_teams.py --count 100 --output teams/
"""

import random
import json
import os
from typing import Dict, List, Any

# Realistic NBA player names
FIRST_NAMES = [
    "LeBron", "Stephen", "Kevin", "Giannis", "Luka", "Nikola", "Joel", "Kawhi",
    "James", "Anthony", "Damian", "Kyrie", "Chris", "Russell", "Devin", "Jayson",
    "Jimmy", "Trae", "Donovan", "Karl", "Rudy", "Bradley", "Paul", "Kyle", "DeMar",
    "Brandon", "Tobias", "Kristaps", "Ben", "Klay", "Draymond", "Khris", "Jrue",
    "CJ", "Pascal", "Victor", "Jaren", "Bam", "Julius", "Zach", "Dejounte", "Shai",
    "Tyrese", "Cade", "Scottie", "Evan", "Franz", "Paolo", "Jalen", "Jabari",
    "Michael", "Larry", "Magic", "Shaquille", "Tim", "Kobe", "Allen", "Dirk",
    "Dwyane", "Carmelo", "Tony", "Manu", "Pau", "Vince", "Tracy", "Yao",
    "Derrick", "Blake", "John", "Zion", "Ja", "Lamelo", "Tyler", "Jordan",
    "Collin", "De'Aaron", "Domantas", "D'Angelo", "Jarrett", "Lauri", "Myles",
    "Malcolm", "Terry", "Miles", "Anfernee", "OG", "Gary", "Austin", "Desmond",
    "Bones", "Ayo", "Josh", "Wendell", "Cole", "Immanuel", "Isaiah", "RJ"
]

LAST_NAMES = [
    "James", "Curry", "Durant", "Antetokounmpo", "Doncic", "Jokic", "Embiid", "Leonard",
    "Harden", "Davis", "Lillard", "Irving", "Paul", "Westbrook", "Booker", "Tatum",
    "Butler", "Young", "Mitchell", "Towns", "Gobert", "Beal", "George", "Lowry", "DeRozan",
    "Ingram", "Harris", "Porzingis", "Simmons", "Thompson", "Green", "Middleton", "Holiday",
    "McCollum", "Siakam", "Oladipo", "Jackson", "Adebayo", "Randle", "LaVine", "Murray", "Gilgeous-Alexander",
    "Haliburton", "Cunningham", "Barnes", "Mobley", "Wagner", "Banchero", "Green", "Smith",
    "Jordan", "Bird", "Johnson", "O'Neal", "Duncan", "Bryant", "Iverson", "Nowitzki",
    "Wade", "Anthony", "Parker", "Ginobili", "Gasol", "Carter", "McGrady", "Ming",
    "Rose", "Griffin", "Wall", "Williamson", "Morant", "Ball", "Herro", "Poole",
    "Sexton", "Fox", "Sabonis", "Russell", "Allen", "Markkanen", "Turner",
    "Brogdon", "Rozier", "Bridges", "Simons", "Anunoby", "Trent", "Reaves", "Bane",
    "Hyland", "Dosunmu", "Giddey", "Carter", "Anthony", "Quickley", "Stewart", "Barrett"
]


# NBA Positional Archetypes (attribute means by position)
# M4 FIX PHASE 2: Lowered all means by 18 points to calibrate for spec base rates
# Spec base rates (30% 3PT, 62% layup, 80% dunk) are designed for attributes ~50
# Previous means averaged 69, causing 52% FG and 48% 3PT (way too high)
POSITION_ARCHETYPES = {
    'PG': {
        # Ball handling, speed, passing - high
        # Height, strength - lower
        'mean': {
            # Physical
            'grip_strength': 42, 'arm_strength': 37, 'core_strength': 42,
            'agility': 57, 'acceleration': 57, 'top_speed': 57,
            'jumping': 47, 'reactions': 57, 'stamina': 52,
            'balance': 52, 'height': 27, 'durability': 47,
            # Mental
            'awareness': 57, 'creativity': 52, 'determination': 52,
            'bravery': 47, 'consistency': 52, 'composure': 57,
            'patience': 52,
            # Technical
            'hand_eye_coordination': 57, 'throw_accuracy': 52, 'form_technique': 50,
            'finesse': 57, 'deception': 57, 'teamwork': 57
        },
        'std_dev': 12  # Standard deviation for normal distribution
    },
    'SG': {
        # Shooting, athleticism - high
        # Balanced physical profile
        'mean': {
            # Physical
            'grip_strength': 47, 'arm_strength': 42, 'core_strength': 47,
            'agility': 54, 'acceleration': 54, 'top_speed': 54,
            'jumping': 52, 'reactions': 54, 'stamina': 54,
            'balance': 52, 'height': 37, 'durability': 50,
            # Mental
            'awareness': 52, 'creativity': 50, 'determination': 54,
            'bravery': 52, 'consistency': 54, 'composure': 54,
            'patience': 50,
            # Technical
            'hand_eye_coordination': 57, 'throw_accuracy': 57, 'form_technique': 57,
            'finesse': 54, 'deception': 52, 'teamwork': 52
        },
        'std_dev': 12
    },
    'SF': {
        # Versatile - balanced across all attributes
        # Slightly above average everything
        'mean': {
            # Physical
            'grip_strength': 50, 'arm_strength': 50, 'core_strength': 50,
            'agility': 52, 'acceleration': 52, 'top_speed': 52,
            'jumping': 52, 'reactions': 52, 'stamina': 54,
            'balance': 52, 'height': 47, 'durability': 52,
            # Mental
            'awareness': 54, 'creativity': 52, 'determination': 54,
            'bravery': 54, 'consistency': 52, 'composure': 52,
            'patience': 52,
            # Technical
            'hand_eye_coordination': 54, 'throw_accuracy': 54, 'form_technique': 52,
            'finesse': 52, 'deception': 52, 'teamwork': 54
        },
        'std_dev': 12
    },
    'PF': {
        # Strength, rebounding - high
        # Speed, finesse - lower
        'mean': {
            # Physical
            'grip_strength': 57, 'arm_strength': 57, 'core_strength': 57,
            'agility': 47, 'acceleration': 47, 'top_speed': 47,
            'jumping': 54, 'reactions': 50, 'stamina': 52,
            'balance': 52, 'height': 57, 'durability': 54,
            # Mental
            'awareness': 52, 'creativity': 47, 'determination': 57,
            'bravery': 57, 'consistency': 50, 'composure': 50,
            'patience': 52,
            # Technical
            'hand_eye_coordination': 50, 'throw_accuracy': 47, 'form_technique': 47,
            'finesse': 47, 'deception': 42, 'teamwork': 52
        },
        'std_dev': 12
    },
    'C': {
        # Height, strength, rebounding - very high
        # Speed, perimeter skills - low
        'mean': {
            # Physical
            'grip_strength': 62, 'arm_strength': 62, 'core_strength': 62,
            'agility': 42, 'acceleration': 42, 'top_speed': 42,
            'jumping': 52, 'reactions': 47, 'stamina': 50,
            'balance': 52, 'height': 67, 'durability': 57,
            # Mental
            'awareness': 50, 'creativity': 42, 'determination': 57,
            'bravery': 57, 'consistency': 47, 'composure': 47,
            'patience': 52,
            # Technical
            'hand_eye_coordination': 47, 'throw_accuracy': 42, 'form_technique': 42,
            'finesse': 42, 'deception': 37, 'teamwork': 50
        },
        'std_dev': 12
    }
}

# All 25 attributes
ALL_ATTRIBUTES = [
    # Physical
    'grip_strength', 'arm_strength', 'core_strength', 'agility',
    'acceleration', 'top_speed', 'jumping', 'reactions',
    'stamina', 'balance', 'height', 'durability',
    # Mental
    'awareness', 'creativity', 'determination', 'bravery',
    'consistency', 'composure', 'patience',
    # Technical
    'hand_eye_coordination', 'throw_accuracy', 'form_technique',
    'finesse', 'deception', 'teamwork'
]

# M4.5 CORRELATION FIX v2: Complete gameplay-weighted attribute importance
# These weights reflect how much each attribute actually affects game outcomes
# Calculated from ALL game systems including Phase 3 additions:
# - Shooting, rebounding, defense, turnovers, drives (base systems)
# - Transition, shot separation, help defense, blocks (Phase 1-2)
# - Patience (contest distance), bravery (drive tendency), consistency (variance) (Phase 3)
# - Stamina/durability remain 0 (rates/injuries, not outcomes)
#
# Calculation methodology:
# raw_weight = sum(action_frequency_per_100_poss * attribute_weight_in_action)
# normalized_weight = raw_weight / sum(all_raw_weights)
# Total raw weight: 530.015 → normalized to 1.0
ATTRIBUTE_GAMEPLAY_WEIGHTS = {
    'agility': 0.1014,           # 53.765 / 530.015 - contest, shot separation, transition
    'consistency': 0.0854,       # 45.28 / 530.015 - variance modifier (ALL rolls!) + turnover prevention
    'awareness': 0.0810,         # 42.925 / 530.015 - rebounding, turnovers, drives, help defense
    'height': 0.0768,            # 40.70 / 530.015 - dunks, rebounding, contest, blocks
    'reactions': 0.0642,         # 34.05 / 530.015 - contest, rebounding, transition defense
    'composure': 0.0596,         # 31.57 / 530.015 - shooting, turnovers, drives, foul defense
    'balance': 0.0516,           # 27.37 / 530.015 - shooting, layups, contest
    'jumping': 0.0430,           # 22.81 / 530.015 - dunks, rebounding, blocks
    'finesse': 0.0426,           # 22.6 / 530.015 - shooting (all types), layups
    'hand_eye_coordination': 0.0420,  # 22.28 / 530.015 - shooting, layups, turnovers
    'throw_accuracy': 0.0405,    # 21.44 / 530.015 - shooting, passing, kickouts
    'form_technique': 0.0371,    # 19.64 / 530.015 - 3PT, midrange, free throws
    'patience': 0.0340,          # 18.0 / 530.015 - contest distance modifier (ALL shots!)
    'acceleration': 0.0335,      # 17.75 / 530.015 - drives, transition, shot separation
    'bravery': 0.0325,           # 17.2 / 530.015 - drive tendency, blocks, shooting fouls
    'core_strength': 0.0320,     # 16.95 / 530.015 - layups, rebounding, finishing through contact
    'deception': 0.0271,         # 14.35 / 530.015 - shot separation, blocks
    'determination': 0.0258,     # 13.65 / 530.015 - rebounding, contest, help defense
    'teamwork': 0.0198,          # 10.5 / 530.015 - kickouts, passing, help defense
    'creativity': 0.0179,        # 9.5 / 530.015 - shot separation, finding open teammates
    'arm_strength': 0.0169,      # 8.95 / 530.015 - dunks, rebounding
    'top_speed': 0.0164,         # 8.7 / 530.015 - transition (success + defense)
    'grip_strength': 0.0117,     # 6.2 / 530.015 - rebounding, turnover prevention
    'stamina': 0.0000,           # Only affects drain/recovery rates (Phase 3B)
    'durability': 0.0000,        # Reserved for injury system (not implemented)
}


def generate_player(position: str, player_number: int, quality_modifier: float = 0, used_names: set = None) -> Dict[str, Any]:
    """
    Generate a single player with realistic attributes for their position.

    Args:
        position: Position string (PG, SG, SF, PF, C)
        player_number: Player number (1-10 for roster)
        quality_modifier: Overall quality adjustment (-10 to +10)
            Positive = better team, Negative = worse team
        used_names: Set of already-used player names for uniqueness

    Returns:
        Player dict with name, position, and 25 attributes
    """
    if used_names is None:
        used_names = set()

    # Generate unique realistic name
    max_attempts = 100
    for _ in range(max_attempts):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        full_name = f"{first} {last}"

        if full_name not in used_names:
            used_names.add(full_name)
            break
    else:
        # Fallback to numbered name if we can't find a unique combination
        full_name = f"{first} {last} {player_number}"
        used_names.add(full_name)

    archetype = POSITION_ARCHETYPES[position]
    player = {
        'name': full_name,
        'position': position
    }

    # Generate attributes using normal distribution
    for attr in ALL_ATTRIBUTES:
        mean = archetype['mean'][attr] + quality_modifier
        std_dev = archetype['std_dev']

        # Sample from normal distribution
        value = random.gauss(mean, std_dev)

        # Clamp to 1-100 range
        value = max(1, min(100, int(round(value))))

        player[attr] = value

    return player


def generate_team(team_name: str, overall_rating: int = 75, used_names: set = None) -> Dict[str, Any]:
    """
    Generate a complete 10-player team.

    Args:
        team_name: Name of the team
        overall_rating: Target team quality (60-90)
            60 = weak team, 75 = average, 90 = elite
        used_names: Set of already-used player names for global uniqueness

    Returns:
        Team dict with roster and metadata
    """
    if used_names is None:
        used_names = set()

    # Calculate quality modifier from overall rating
    # M4 FIX v4: Changed baseline from 69 to 51 (new archetype average after -18 adjustment)
    # 51 = baseline (0 modifier), 70 = +19, 85 = +34
    quality_modifier = overall_rating - 51

    # Roster: 2 of each position (starters + bench)
    roster = []

    # Starters (positions 1-5)
    for i, position in enumerate(['PG', 'SG', 'SF', 'PF', 'C'], start=1):
        player = generate_player(position, i, quality_modifier, used_names)
        roster.append(player)

    # Bench (positions 6-10)
    for i, position in enumerate(['PG', 'SG', 'SF', 'PF', 'C'], start=6):
        # Bench players slightly worse than starters (-5 modifier)
        bench_modifier = quality_modifier - 5
        player = generate_player(position, i, bench_modifier, used_names)
        roster.append(player)

    # M4.5 CORRELATION FIX: Calculate weighted team rating (average of top 8 players)
    # Use gameplay weights instead of treating all attributes equally
    # This ensures team rating accurately reflects game impact
    top_8 = roster[:8]
    weighted_ratings = []
    for player in top_8:
        # Calculate weighted composite for each player
        weighted_sum = sum(player[attr] * ATTRIBUTE_GAMEPLAY_WEIGHTS[attr] for attr in ALL_ATTRIBUTES)
        weighted_ratings.append(weighted_sum)

    actual_rating = sum(weighted_ratings) / len(weighted_ratings)

    team = {
        'name': team_name,
        'target_overall_rating': overall_rating,
        'actual_overall_rating': round(actual_rating, 1),
        'roster': roster
    }

    return team


def generate_teams(count: int, output_dir: str) -> List[Dict[str, Any]]:
    """
    Generate multiple teams with varied quality levels.

    Args:
        count: Number of teams to generate
        output_dir: Directory to save team JSON files

    Returns:
        List of generated teams
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)

    teams = []

    # M4 FIX v6: Ultra-tight 57-65 range for realistic competitive balance
    # With baseline 51, this creates attribute ranges of ~57-65 (8-point spread)
    # Matches NBA reality: even tanking teams are competitive, only 5-10% skill gap
    # Quality distribution:
    # 15% elite (64-65) - Top tier contenders
    # 35% above average (62-63) - Solid playoff teams
    # 35% average (60-61) - Bubble/mid-tier
    # 15% below average (57-59) - Rebuilding but competitive

    quality_distribution = (
        [random.randint(64, 65) for _ in range(int(count * 0.15))] +
        [random.randint(62, 63) for _ in range(int(count * 0.35))] +
        [random.randint(60, 61) for _ in range(int(count * 0.35))] +
        [random.randint(57, 59) for _ in range(int(count * 0.15))]
    )

    # Pad if rounding caused shortage
    while len(quality_distribution) < count:
        quality_distribution.append(random.randint(59, 62))  # Add average teams

    # Shuffle to randomize order
    random.shuffle(quality_distribution)

    print(f"Generating {count} teams with quality distribution:")
    print(f"  Elite (67-70): {sum(1 for q in quality_distribution if q >= 67)}")
    print(f"  Above Avg (63-66): {sum(1 for q in quality_distribution if 63 <= q < 67)}")
    print(f"  Average (59-62): {sum(1 for q in quality_distribution if 59 <= q < 63)}")
    print(f"  Below Avg (55-58): {sum(1 for q in quality_distribution if q < 59)}")
    print()

    # BUG FIX: Global name tracking to prevent duplicate player names across teams
    used_names = set()

    for i, target_rating in enumerate(quality_distribution[:count], start=1):
        team_name = f"Team_{i:03d}"
        team = generate_team(team_name, target_rating, used_names)
        teams.append(team)

        # Save to JSON file
        output_path = os.path.join(output_dir, f"{team_name}.json")
        with open(output_path, 'w') as f:
            json.dump(team, f, indent=2)

        if i % 10 == 0 or i == count:
            print(f"Generated {i}/{count} teams...")

    print(f"\nAll {count} teams saved to {output_dir}")

    # Save summary
    summary = {
        'total_teams': count,
        'quality_distribution': {
            'elite_82_85': sum(1 for q in quality_distribution if q >= 82),
            'above_avg_78_81': sum(1 for q in quality_distribution if 78 <= q < 82),
            'average_74_77': sum(1 for q in quality_distribution if 74 <= q < 78),
            'below_avg_70_73': sum(1 for q in quality_distribution if q < 74)
        },
        'teams': [
            {
                'name': t['name'],
                'target_rating': t['target_overall_rating'],
                'actual_rating': t['actual_overall_rating']
            }
            for t in teams
        ]
    }

    summary_path = os.path.join(output_dir, '_SUMMARY.json')
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)

    print(f"Summary saved to {summary_path}")

    return teams


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Generate random NBA teams')
    parser.add_argument('--count', type=int, default=100,
                        help='Number of teams to generate (default: 100)')
    parser.add_argument('--output', type=str, default='teams',
                        help='Output directory (default: teams/)')
    parser.add_argument('--seed', type=int, default=None,
                        help='Random seed for reproducibility (default: random)')

    args = parser.parse_args()

    # Set random seed if provided
    if args.seed is not None:
        random.seed(args.seed)
        print(f"Using random seed: {args.seed}\n")

    # Generate teams
    teams = generate_teams(args.count, args.output)

    print(f"\n{'='*80}")
    print("TEAM GENERATION COMPLETE")
    print(f"{'='*80}")
    print(f"Total teams: {len(teams)}")
    print(f"Output directory: {args.output}/")
    print(f"Files: Team_001.json through Team_{len(teams):03d}.json")
    print(f"Summary: {args.output}/_SUMMARY.json")
