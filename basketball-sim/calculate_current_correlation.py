"""
Calculate correlation between team rating gaps and score margins.
"""
import json
from scipy import stats

# Load team ratings
teams = {}
for i in range(1, 101):
    team_file = f'teams/Team_{i:03d}.json'
    try:
        with open(team_file, 'r') as f:
            team_data = json.load(f)
            teams[team_data['name']] = team_data['actual_overall_rating']
    except:
        pass

# Load game results
rating_gaps = []
margins = []

for i in range(1, 101):
    game_file = f'validation/correlation_test/games/game_{i:03d}.json'
    try:
        with open(game_file, 'r') as f:
            game = json.load(f)

        home_team = game['home_team']
        away_team = game['away_team']
        home_score = game['final_score']['home']
        away_score = game['final_score']['away']

        home_rating = teams.get(home_team, 60)
        away_rating = teams.get(away_team, 60)

        rating_gap = home_rating - away_rating
        margin = home_score - away_score  # positive if home won

        rating_gaps.append(rating_gap)
        margins.append(margin)
    except:
        pass

# Calculate correlation
correlation, p_value = stats.pearsonr(rating_gaps, margins)

print("=" * 80)
print("SKILL RATING -> SCORE MARGIN CORRELATION")
print("=" * 80)
print(f"\nCorrelation: {correlation:.4f}")
print(f"P-value: {p_value:.6f}")
print(f"Sample size: {len(rating_gaps)} games")
print()

# Interpretation
print("Interpretation:")
if correlation > 0.7:
    print("✓ STRONG positive correlation - attributes drive outcomes")
elif correlation > 0.4:
    print("⚠️ MODERATE correlation - attributes matter but variance is high")
elif correlation > 0.1:
    print("⚠️ WEAK correlation - high variance overwhelming attributes")
elif correlation > -0.1:
    print("❌ NO correlation - random outcomes")
else:
    print("❌ NEGATIVE correlation - BROKEN! Better teams lose more!")

print()
print("Expected target: 0.35 - 0.50")
print(f"Current: {correlation:.3f}")
if correlation >= 0.35:
    print("✓ TARGET ACHIEVED")
elif correlation >= 0:
    print(f"⚠️ Below target by {0.35 - correlation:.3f}")
else:
    print(f"❌ CRITICAL: Negative correlation indicates broken mechanics")

print()
print("Historical context:")
print("  - Broken formula era: 0.0685")
print("  - Fixed formula era: 0.162")
print("  - Target range: 0.35-0.50")
print(f"  - Current (NOW): {correlation:.3f}")
