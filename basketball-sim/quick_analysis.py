import json
import os

# Analyze validation results
dir_path = 'validation/current/validation_results/games'

# Collect data
tov_rates = []
margins = []
ppg = []
poss_list = []

for i in range(1, 101):
    filepath = f'{dir_path}/game_{i:03d}.json'
    with open(filepath, 'r') as f:
        g = json.load(f)

    poss = g['statistics']['possessions']
    tov_home = g['statistics']['home_totals']['tov']
    tov_away = g['statistics']['away_totals']['tov']
    home_score = g['final_score']['home']
    away_score = g['final_score']['away']

    tov_rate = ((tov_home + tov_away) / (poss * 2)) * 100
    margin = abs(home_score - away_score)
    avg_score = (home_score + away_score) / 2

    tov_rates.append(tov_rate)
    margins.append(margin)
    ppg.append(avg_score)
    poss_list.append(poss)

# Calculate statistics
avg_tov_rate = sum(tov_rates) / len(tov_rates)
avg_margin = sum(margins) / len(margins)
avg_ppg = sum(ppg) / len(ppg)
avg_poss = sum(poss_list) / len(poss_list)

blowouts = sum(1 for m in margins if m >= 20)
close_games = sum(1 for m in margins if m <= 5)

print("CURRENT VALIDATION RESULTS (100 games)")
print("=" * 50)
print(f"Average PPG: {avg_ppg:.1f}")
print(f"Average possessions per team: {avg_poss:.1f}")
print(f"Average turnover rate: {avg_tov_rate:.1f}%")
print(f"Average margin: {avg_margin:.1f}")
print()
print("DISTRIBUTIONS:")
print(f"Blowouts (20+ margin): {blowouts}/100 ({blowouts}%)")
print(f"Close games (<=5 margin): {close_games}/100 ({close_games}%)")
print()
print("SAMPLE TOV RATES (first 10 games):")
for i in range(10):
    print(f"  Game {i+1}: {tov_rates[i]:.1f}%")
