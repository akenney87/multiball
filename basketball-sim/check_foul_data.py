import json, sys, os, random
sys.path.insert(0, '.')
from pathlib import Path
from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

team_files = list(Path('teams').glob('Team_*.json'))
tf = random.sample(team_files, 2)
team_a = json.load(open(tf[0]))
team_b = json.load(open(tf[1]))

tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=team_a['roster'][0]['name'],
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment={},
    rebounding_strategy='standard'
)

sim = GameSimulator(team_a['roster'], team_b['roster'], tactics, tactics, team_a['name'], team_b['name'])
result = sim.simulate_game()

fouls = [p for q in result.quarter_results for p in q.possession_results if p.possession_outcome == 'foul']

print(f'Total fouls: {len(fouls)}')
print(f'Total score: {result.home_score + result.away_score}')
print('\nFirst 5 foul possessions:')
for i, f in enumerate(fouls[:5]):
    print(f'\nFoul {i+1}:')
    print(f'  Outcome: {f.possession_outcome}')
    print(f'  Debug keys: {list(f.debug.keys())}')
    print(f'  Debug: {f.debug}')
