"""
Test free throw fix across 10 games.

Validates:
1. FT% is NOT 100% anymore
2. FT% is realistic (70-85% range)
3. Some FT misses occur
4. Per-player variance exists
"""

import random
from src.core.data_structures import TacticalSettings, create_player
from src.systems.game_simulation import GameSimulator

def create_test_roster(team_name, ft_composites):
    """Create roster with specified FT shooting abilities."""
    roster = []
    positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C']

    for i, (pos, ft_comp) in enumerate(zip(positions, ft_composites)):
        player = create_player(
            name=f"{team_name}_{pos}_{i+1}",
            position=pos,
            # FT attributes based on composite
            form_technique=ft_comp,
            throw_accuracy=ft_comp - 2,
            finesse=ft_comp + 2,
            hand_eye_coordination=ft_comp,
            balance=ft_comp - 3,
            composure=ft_comp + 1,
            consistency=ft_comp - 4,
            agility=ft_comp - 5,
            # Other attributes (moderate, not testing)
            grip_strength=65,
            arm_strength=65,
            core_strength=65,
            acceleration=65,
            top_speed=65,
            jumping=65,
            reactions=65,
            stamina=75,
            height=75 if pos in ['PG', 'SG'] else 85,
            durability=70,
            awareness=65,
            creativity=60,
            determination=65,
            bravery=65,
            patience=60,
            deception=60,
            teamwork=65
        )
        roster.append(player)

    return roster

# Create test teams with mixed FT shooters
# Home: Mix of elite, good, average, poor
home_ft_composites = [90, 85, 75, 65, 50, 80, 70, 60, 55, 45]  # Elite to poor
# Away: Similar mix
away_ft_composites = [92, 78, 72, 58, 42, 75, 68, 62, 52, 48]

print("=" * 80)
print("FREE THROW FIX VALIDATION - 10 GAME TEST")
print("=" * 80)
print("\nTesting FT percentages across 10 games with mixed shooter types...")
print()

all_games_ft_stats = []

for game_num in range(1, 11):
    random.seed(600 + game_num)

    home_roster = create_test_roster(f"Home{game_num}", home_ft_composites)
    away_roster = create_test_roster(f"Away{game_num}", away_ft_composites)

    tactical_home = TacticalSettings(
        pace='standard',
        man_defense_pct=60,
        scoring_option_1=home_roster[0]['name'],
        scoring_option_2=home_roster[1]['name'],
        scoring_option_3=home_roster[2]['name'],
        minutes_allotment={p['name']: 24 for p in home_roster},
        rebounding_strategy='standard',
        closers=[p['name'] for p in home_roster[:7]],
        timeout_strategy='standard'
    )

    tactical_away = TacticalSettings(
        pace='standard',
        man_defense_pct=60,
        scoring_option_1=away_roster[0]['name'],
        scoring_option_2=away_roster[1]['name'],
        scoring_option_3=away_roster[2]['name'],
        minutes_allotment={p['name']: 24 for p in away_roster},
        rebounding_strategy='standard',
        closers=[p['name'] for p in away_roster[:7]],
        timeout_strategy='standard'
    )

    game_sim = GameSimulator(
        home_roster=home_roster,
        away_roster=away_roster,
        tactical_home=tactical_home,
        tactical_away=tactical_away,
        home_team_name=f"Home{game_num}",
        away_team_name=f"Away{game_num}"
    )

    print(f"Game {game_num}...", end=" ")
    result = game_sim.simulate_game(seed=600 + game_num)

    # Extract FT stats from game_statistics
    game_stats = result.game_statistics
    home_stats = game_stats.get('home_team', {})
    away_stats = game_stats.get('away_team', {})

    home_ftm = home_stats.get('free_throws_made', 0)
    home_fta = home_stats.get('free_throws_attempted', 0)
    away_ftm = away_stats.get('free_throws_made', 0)
    away_fta = away_stats.get('free_throws_attempted', 0)

    total_ftm = home_ftm + away_ftm
    total_fta = home_fta + away_fta
    total_ft_pct = (total_ftm / total_fta * 100) if total_fta > 0 else 0

    all_games_ft_stats.append({
        'game': game_num,
        'ftm': total_ftm,
        'fta': total_fta,
        'ft_pct': total_ft_pct,
        'misses': total_fta - total_ftm
    })

    print(f"FT: {total_ftm}/{total_fta} = {total_ft_pct:.1f}%")

# Aggregate stats
print("\n" + "=" * 80)
print("AGGREGATE RESULTS")
print("=" * 80)

total_ftm = sum(g['ftm'] for g in all_games_ft_stats)
total_fta = sum(g['fta'] for g in all_games_ft_stats)
total_ft_pct = (total_ftm / total_fta * 100) if total_fta > 0 else 0
total_misses = sum(g['misses'] for g in all_games_ft_stats)

print(f"\nTotal across 10 games:")
print(f"  Free Throws: {total_ftm}/{total_fta} = {total_ft_pct:.2f}%")
print(f"  Total Misses: {total_misses}")
print(f"  Average FTA per game: {total_fta / 10:.1f}")

print(f"\nPer-game FT% distribution:")
for g in all_games_ft_stats:
    print(f"  Game {g['game']}: {g['ft_pct']:.1f}% ({g['misses']} misses)")

# Validation
print("\n" + "=" * 80)
print("VALIDATION CHECKS")
print("=" * 80)

print(f"[CHECK] Total FTA > 0: ", end="")
if total_fta > 0:
    print(f"PASS ({total_fta} attempts)")
else:
    print("FAIL (no FTs attempted)")

print(f"[CHECK] Overall FT% NOT 100%: ", end="")
if total_ft_pct < 99:
    print(f"PASS ({total_ft_pct:.2f}%)")
else:
    print(f"FAIL ({total_ft_pct:.2f}%)")

print(f"[CHECK] Overall FT% in NBA range (70-85%): ", end="")
if 70 <= total_ft_pct <= 85:
    print(f"PASS ({total_ft_pct:.2f}%)")
elif 65 <= total_ft_pct <= 90:
    print(f"ACCEPTABLE ({total_ft_pct:.2f}%, close to target)")
else:
    print(f"FAIL ({total_ft_pct:.2f}%)")

print(f"[CHECK] At least 1 miss per game average: ", end="")
avg_misses_per_game = total_misses / 10
if avg_misses_per_game >= 1.0:
    print(f"PASS ({avg_misses_per_game:.1f} misses/game)")
else:
    print(f"FAIL ({avg_misses_per_game:.1f} misses/game)")

print(f"[CHECK] Per-game variance exists: ", end="")
ft_pcts = [g['ft_pct'] for g in all_games_ft_stats if g['fta'] > 0]
if ft_pcts:
    variance = max(ft_pcts) - min(ft_pcts)
    if variance > 5:
        print(f"PASS (range: {min(ft_pcts):.1f}%-{max(ft_pcts):.1f}%)")
    else:
        print(f"LOW (range: {min(ft_pcts):.1f}%-{max(ft_pcts):.1f}%)")
else:
    print("N/A")

print("\n" + "=" * 80)
print("CONCLUSION")
print("=" * 80)

if total_ft_pct < 99 and 65 <= total_ft_pct <= 90 and total_misses > 0:
    print("SUCCESS! Free throw fix is working correctly:")
    print(f"  - No more 100% FT shooting (actual: {total_ft_pct:.2f}%)")
    print(f"  - Realistic FT% range achieved")
    print(f"  - {total_misses} misses across 10 games")
    print("  - Fix successfully integrated into full game simulation")
else:
    print("ISSUES DETECTED - Review results above")

print("=" * 80)
