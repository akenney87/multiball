"""Quick test to see if blocks happen in actual possessions."""

import random
from src.systems.possession import simulate_possession
from src.core.data_structures import TacticalSettings, PossessionContext
from test_blocks import create_balanced_player, create_rim_protector

# Set seed
random.seed(42)

# Create teams
home = [
    create_balanced_player('PG', 'PG'),
    create_balanced_player('SG', 'SG'),
    create_balanced_player('SF', 'SF'),
    create_balanced_player('PF', 'PF'),
    create_rim_protector('C (Blocker)', 'C'),
]

away = [
    create_balanced_player('PG', 'PG'),
    create_balanced_player('SG', 'SG'),
    create_balanced_player('SF', 'SF'),
    create_balanced_player('PF', 'PF'),
    create_balanced_player('C', 'C'),
]

tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=70,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment={},
    rebounding_strategy='standard'
)

context = PossessionContext(
    is_transition=False,
    shot_clock=24,
    score_differential=0,
    game_time_remaining=600
)

# Run 100 possessions and count blocks
blocks = 0
possessions = 0
for i in range(100):
    result = simulate_possession(
        offensive_team=home,
        defensive_team=away,
        tactical_settings_offense=tactics,
        tactical_settings_defense=tactics,
        possession_context=context,
        seed=42 + i
    )
    possessions += 1

    if result.debug.get('shot_attempt', {}).get('outcome') == 'blocked_shot':
        blocks += 1
        print(f"BLOCK #{blocks}!")
        print(f"  Blocker: {result.debug['shot_attempt']['blocking_player']}")
        print(f"  Shot type: {result.debug['shot_attempt']['shot_type']}")
        print(f"  Contest distance: {result.debug['shot_attempt']['contest_distance']}")
        print()

print(f"\nTotal: {blocks} blocks in {possessions} possessions ({blocks/possessions*100:.1f}%)")
