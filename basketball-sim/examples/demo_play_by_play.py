"""
Basketball Simulator - Play-by-Play Demo

Generates sample quarter narratives for user review (M2 final approval gate).

Creates three sample outputs:
1. Fast pace quarter
2. Standard pace quarter
3. Slow pace quarter
"""

import random
import os
from src.systems.play_by_play import PlayByPlayLogger
from src.systems import possession
from src.core.data_structures import PossessionContext, TacticalSettings, create_player

# Set seed for reproducibility
random.seed(42)


# =============================================================================
# SAMPLE TEAMS
# =============================================================================

def create_sample_warriors():
    """Create sample Warriors roster."""
    return [
        create_player(
            name='Stephen Curry',
            position='PG',
            # Physical
            grip_strength=75, arm_strength=70, core_strength=75, agility=88,
            acceleration=85, top_speed=82, jumping=75, reactions=90,
            stamina=85, balance=85, height=75, durability=78,
            # Mental
            awareness=92, creativity=95, determination=90, bravery=85,
            consistency=88, composure=92, patience=85,
            # Technical
            hand_eye_coordination=95, throw_accuracy=96, form_technique=95,
            finesse=92, deception=88, teamwork=90
        ),
        create_player(
            name='Klay Thompson',
            position='SG',
            grip_strength=78, arm_strength=75, core_strength=78, agility=82,
            acceleration=80, top_speed=78, jumping=78, reactions=85,
            stamina=88, balance=82, height=78, durability=85,
            awareness=88, creativity=75, determination=85, bravery=82,
            consistency=92, composure=90, patience=88,
            hand_eye_coordination=92, throw_accuracy=94, form_technique=96,
            finesse=85, deception=75, teamwork=88
        ),
        create_player(
            name='Andrew Wiggins',
            position='SF',
            grip_strength=82, arm_strength=80, core_strength=80, agility=85,
            acceleration=88, top_speed=85, jumping=88, reactions=82,
            stamina=85, balance=82, height=82, durability=80,
            awareness=75, creativity=78, determination=80, bravery=78,
            consistency=75, composure=78, patience=75,
            hand_eye_coordination=82, throw_accuracy=78, form_technique=80,
            finesse=80, deception=82, teamwork=75
        ),
        create_player(
            name='Draymond Green',
            position='PF',
            grip_strength=85, arm_strength=82, core_strength=88, agility=78,
            acceleration=75, top_speed=72, jumping=80, reactions=88,
            stamina=90, balance=85, height=78, durability=85,
            awareness=95, creativity=85, determination=92, bravery=90,
            consistency=82, composure=85, patience=88,
            hand_eye_coordination=80, throw_accuracy=75, form_technique=70,
            finesse=75, deception=78, teamwork=95
        ),
        create_player(
            name='Kevon Looney',
            position='C',
            grip_strength=88, arm_strength=85, core_strength=90, agility=70,
            acceleration=68, top_speed=65, jumping=75, reactions=75,
            stamina=82, balance=80, height=85, durability=88,
            awareness=82, creativity=65, determination=85, bravery=80,
            consistency=78, composure=80, patience=82,
            hand_eye_coordination=75, throw_accuracy=65, form_technique=68,
            finesse=70, deception=65, teamwork=85
        )
    ]


def create_sample_lakers():
    """Create sample Lakers roster."""
    return [
        create_player(
            name='LeBron James',
            position='SF',
            grip_strength=88, arm_strength=90, core_strength=92, agility=85,
            acceleration=82, top_speed=85, jumping=85, reactions=92,
            stamina=88, balance=88, height=82, durability=90,
            awareness=98, creativity=95, determination=95, bravery=92,
            consistency=90, composure=95, patience=92,
            hand_eye_coordination=92, throw_accuracy=85, form_technique=88,
            finesse=90, deception=88, teamwork=95
        ),
        create_player(
            name='Anthony Davis',
            position='PF',
            grip_strength=85, arm_strength=88, core_strength=90, agility=82,
            acceleration=85, top_speed=82, jumping=90, reactions=88,
            stamina=80, balance=85, height=90, durability=75,
            awareness=88, creativity=82, determination=85, bravery=80,
            consistency=82, composure=82, patience=80,
            hand_eye_coordination=88, throw_accuracy=82, form_technique=85,
            finesse=85, deception=80, teamwork=82
        ),
        create_player(
            name='D\'Angelo Russell',
            position='PG',
            grip_strength=72, arm_strength=70, core_strength=75, agility=82,
            acceleration=80, top_speed=78, jumping=75, reactions=82,
            stamina=78, balance=80, height=75, durability=75,
            awareness=82, creativity=85, determination=75, bravery=72,
            consistency=75, composure=80, patience=78,
            hand_eye_coordination=88, throw_accuracy=86, form_technique=85,
            finesse=85, deception=82, teamwork=80
        ),
        create_player(
            name='Austin Reaves',
            position='SG',
            grip_strength=75, arm_strength=72, core_strength=75, agility=78,
            acceleration=75, top_speed=75, jumping=72, reactions=80,
            stamina=82, balance=78, height=78, durability=78,
            awareness=80, creativity=78, determination=82, bravery=78,
            consistency=80, composure=78, patience=80,
            hand_eye_coordination=82, throw_accuracy=82, form_technique=82,
            finesse=80, deception=75, teamwork=85
        ),
        create_player(
            name='Jarred Vanderbilt',
            position='C',
            grip_strength=82, arm_strength=80, core_strength=85, agility=75,
            acceleration=78, top_speed=75, jumping=82, reactions=78,
            stamina=85, balance=80, height=82, durability=80,
            awareness=75, creativity=65, determination=80, bravery=78,
            consistency=72, composure=72, patience=75,
            hand_eye_coordination=72, throw_accuracy=65, form_technique=65,
            finesse=68, deception=70, teamwork=80
        )
    ]


# =============================================================================
# QUARTER SIMULATION HELPERS
# =============================================================================

def simulate_sample_quarter(
    home_team,
    away_team,
    home_name,
    away_name,
    pace,
    quarter_number=1,
    num_possessions=25
):
    """
    Simulate a sample quarter.

    Args:
        home_team: List of 5 home players
        away_team: List of 5 away players
        home_name: Home team name
        away_name: Away team name
        pace: 'fast', 'standard', or 'slow'
        quarter_number: Quarter number (1-4)
        num_possessions: Number of possessions to simulate

    Returns:
        PlayByPlayLogger with complete quarter
    """
    # Initialize logger
    logger = PlayByPlayLogger(home_name, away_name, quarter_number)

    # Tactical settings
    home_tactics = TacticalSettings(
        pace=pace,
        man_defense_pct=60,
        scoring_option_1='Stephen Curry',
        scoring_option_2='Klay Thompson',
        scoring_option_3='Andrew Wiggins',
        rebounding_strategy='standard'
    )

    away_tactics = TacticalSettings(
        pace=pace,
        man_defense_pct=50,
        scoring_option_1='LeBron James',
        scoring_option_2='Anthony Davis',
        scoring_option_3='D\'Angelo Russell',
        rebounding_strategy='standard'
    )

    # Starting clock (720 seconds = 12 minutes)
    game_clock = 720

    # Average possession time by pace
    possession_times = {
        'fast': 18,    # 18 seconds per possession
        'standard': 24,  # 24 seconds per possession
        'slow': 30     # 30 seconds per possession
    }

    avg_possession_time = possession_times[pace]

    # Simulate possessions
    home_possession = True  # Home team starts

    for i in range(num_possessions):
        if game_clock <= 0:
            break

        # Determine offense/defense
        if home_possession:
            offense = home_team
            defense = away_team
            offense_tactics = home_tactics
            defense_tactics = away_tactics
            offense_team_name = 'Home'
        else:
            offense = away_team
            defense = home_team
            offense_tactics = away_tactics
            defense_tactics = home_tactics
            offense_team_name = 'Away'

        # Create possession context
        context = PossessionContext(
            is_transition=False,  # No transition for demo
            shot_clock=24,
            score_differential=logger.home_score - logger.away_score,
            game_time_remaining=game_clock
        )

        # Simulate possession
        result = possession.simulate_possession(
            offensive_team=offense,
            defensive_team=defense,
            tactical_settings_offense=offense_tactics,
            tactical_settings_defense=defense_tactics,
            possession_context=context,
            seed=None  # Random
        )

        # Log possession
        logger.add_possession(game_clock, offense_team_name, result)

        # Advance clock
        # Add randomness: ±5 seconds
        time_variation = random.randint(-5, 5)
        possession_time = avg_possession_time + time_variation
        game_clock -= max(10, possession_time)  # Minimum 10 seconds

        # Alternate possession
        home_possession = not home_possession

        # Simulate substitutions (every ~4-5 possessions)
        if i > 0 and i % 5 == 0:
            # Substitute for home team
            if random.random() < 0.6:
                sub_clock = game_clock + random.randint(5, 15)
                logger.add_substitution(
                    game_clock=sub_clock,
                    team='Home',
                    player_out=random.choice(['Klay Thompson', 'Andrew Wiggins']),
                    player_in='Jordan Poole',
                    reason='minutes_allocation',
                    stamina_out=random.uniform(60, 80)
                )

            # Substitute for away team
            if random.random() < 0.5:
                sub_clock = game_clock + random.randint(5, 15)
                logger.add_substitution(
                    game_clock=sub_clock,
                    team='Away',
                    player_out=random.choice(['Austin Reaves', 'Jarred Vanderbilt']),
                    player_in='Rui Hachimura',
                    reason='low_stamina',
                    stamina_out=random.uniform(50, 70)
                )

    return logger


# =============================================================================
# MAIN DEMO
# =============================================================================

def main():
    """Generate sample play-by-play outputs for user review."""
    print("Generating play-by-play demo samples...")
    print("=" * 80)

    # Create teams
    warriors = create_sample_warriors()
    lakers = create_sample_lakers()

    # Create output directory
    output_dir = 'output'
    os.makedirs(output_dir, exist_ok=True)

    # 1. Fast pace quarter
    print("\n1. Simulating FAST pace quarter...")
    fast_logger = simulate_sample_quarter(
        warriors, lakers,
        "Golden State Warriors", "Los Angeles Lakers",
        pace='fast',
        quarter_number=1,
        num_possessions=28
    )

    fast_output = os.path.join(output_dir, 'quarter_playbyplay_fast.txt')
    fast_logger.write_to_file(fast_output)
    print(f"   Written to: {fast_output}")
    print(f"   Final Score: Warriors {fast_logger.home_score}, Lakers {fast_logger.away_score}")
    print(f"   Possessions: {len(fast_logger.possession_events)}")

    # 2. Standard pace quarter
    print("\n2. Simulating STANDARD pace quarter...")
    standard_logger = simulate_sample_quarter(
        warriors, lakers,
        "Golden State Warriors", "Los Angeles Lakers",
        pace='standard',
        quarter_number=2,
        num_possessions=25
    )

    standard_output = os.path.join(output_dir, 'quarter_playbyplay_standard.txt')
    standard_logger.write_to_file(standard_output)
    print(f"   Written to: {standard_output}")
    print(f"   Final Score: Warriors {standard_logger.home_score}, Lakers {standard_logger.away_score}")
    print(f"   Possessions: {len(standard_logger.possession_events)}")

    # 3. Slow pace quarter
    print("\n3. Simulating SLOW pace quarter...")
    slow_logger = simulate_sample_quarter(
        warriors, lakers,
        "Golden State Warriors", "Los Angeles Lakers",
        pace='slow',
        quarter_number=3,
        num_possessions=22
    )

    slow_output = os.path.join(output_dir, 'quarter_playbyplay_slow.txt')
    slow_logger.write_to_file(slow_output)
    print(f"   Written to: {slow_output}")
    print(f"   Final Score: Warriors {slow_logger.home_score}, Lakers {slow_logger.away_score}")
    print(f"   Possessions: {len(slow_logger.possession_events)}")

    # Print summary
    print("\n" + "=" * 80)
    print("DEMO COMPLETE")
    print("=" * 80)
    print("\nSample outputs generated:")
    print(f"  1. {fast_output}")
    print(f"  2. {standard_output}")
    print(f"  3. {slow_output}")
    print("\nPlease review these files for:")
    print("  - Readability and formatting")
    print("  - Chronological event ordering")
    print("  - Score tracking accuracy")
    print("  - Substitution formatting")
    print("  - Quarter summary statistics")
    print("\nThis is the FINAL M2 approval gate.")
    print("=" * 80)


if __name__ == '__main__':
    main()
