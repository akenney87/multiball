"""
Generate a comprehensive game review for manual inspection.
Simulates one game with full logging and creates a detailed analysis report.
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load two teams
with open('teams/team_001.json', 'r') as f:
    team1 = json.load(f)
with open('teams/team_050.json', 'r') as f:
    team2 = json.load(f)

# Standard tactical settings
tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    rebounding_strategy='standard'
)

# Run game with seed for reproducibility
print(f"Simulating game: {team1['name']} vs {team2['name']}")
print("=" * 80)

simulator = GameSimulator(
    home_roster=team1['roster'],
    away_roster=team2['roster'],
    tactical_home=tactics,
    tactical_away=tactics,
    home_team_name=team1['name'],
    away_team_name=team2['name']
)

result = simulator.simulate_game(seed=9999)

# Save play-by-play log
log_path = 'output/REVIEW_GAME_PROPER.txt'
with open(log_path, 'w', encoding='utf-8') as f:
    f.write("=" * 100 + "\n")
    f.write(f"GAME REVIEW: {team1['name']} vs {team2['name']}\n")
    f.write("=" * 100 + "\n")
    f.write(f"SEED: 9999\n")
    f.write(f"Final Score: {result.home_score} - {result.away_score}\n")
    f.write(f"Margin: {abs(result.home_score - result.away_score)} points\n")
    f.write("=" * 100 + "\n\n")

    # Write full play-by-play
    f.write(result.play_by_play_text)

    f.write("\n" + "=" * 100 + "\n")
    f.write("TEAM STATISTICS\n")
    f.write("=" * 100 + "\n\n")

    # Get team stats
    home_stats = result.game_statistics['home_stats']
    away_stats = result.game_statistics['away_stats']

    # Calculate quarter scores
    f.write("QUARTER BREAKDOWN:\n")
    f.write("-" * 100 + "\n")
    home_q_cumulative = 0
    away_q_cumulative = 0
    for i, (home_q, away_q) in enumerate(result.quarter_scores, 1):
        home_q_score = home_q - home_q_cumulative
        away_q_score = away_q - away_q_cumulative
        f.write(f"Q{i}: {team1['name']} {home_q_score} (Total: {home_q}), ")
        f.write(f"{team2['name']} {away_q_score} (Total: {away_q})\n")
        home_q_cumulative = home_q
        away_q_cumulative = away_q

    f.write("\n" + "=" * 100 + "\n")
    f.write(f"{team1['name']} STATISTICS\n")
    f.write("=" * 100 + "\n\n")

    f.write(f"Points: {result.home_score}\n")
    f.write(f"Field Goals: {home_stats['fgm']}/{home_stats['fga']} ({home_stats['fgm']/home_stats['fga']*100:.1f}%)\n")
    f.write(f"3-Pointers: {home_stats['fg3m']}/{home_stats['fg3a']} ({home_stats['fg3m']/home_stats['fg3a']*100:.1f}%)\n")
    f.write(f"Free Throws: {home_stats['ftm']}/{home_stats['fta']} ({home_stats['ftm']/home_stats['fta']*100:.1f}%)\n")
    f.write(f"Rebounds: {home_stats['oreb'] + home_stats['dreb']} (Off: {home_stats['oreb']}, Def: {home_stats['dreb']})\n")
    f.write(f"Assists: {home_stats['ast']}\n")
    f.write(f"Turnovers: {home_stats['tov']}\n")
    f.write(f"Steals: {home_stats['stl']}\n")
    f.write(f"Blocks: {home_stats['blk']}\n")
    f.write(f"Fouls: {home_stats['pf']}\n")

    f.write("\n" + "=" * 100 + "\n")
    f.write(f"{team2['name']} STATISTICS\n")
    f.write("=" * 100 + "\n\n")

    f.write(f"Points: {result.away_score}\n")
    f.write(f"Field Goals: {away_stats['fgm']}/{away_stats['fga']} ({away_stats['fgm']/away_stats['fga']*100:.1f}%)\n")
    f.write(f"3-Pointers: {away_stats['fg3m']}/{away_stats['fg3a']} ({away_stats['fg3m']/away_stats['fg3a']*100:.1f}%)\n")
    f.write(f"Free Throws: {away_stats['ftm']}/{away_stats['fta']} ({away_stats['ftm']/away_stats['fta']*100:.1f}%)\n")
    f.write(f"Rebounds: {away_stats['oreb'] + away_stats['dreb']} (Off: {away_stats['oreb']}, Def: {away_stats['dreb']})\n")
    f.write(f"Assists: {away_stats['ast']}\n")
    f.write(f"Turnovers: {away_stats['tov']}\n")
    f.write(f"Steals: {away_stats['stl']}\n")
    f.write(f"Blocks: {away_stats['blk']}\n")
    f.write(f"Fouls: {away_stats['pf']}\n")

    f.write("\n" + "=" * 100 + "\n")
    f.write("ADVANCED METRICS\n")
    f.write("=" * 100 + "\n\n")

    # Calculate advanced stats
    home_pace = home_stats['fga'] + home_stats['tov'] - home_stats['oreb']
    away_pace = away_stats['fga'] + away_stats['tov'] - away_stats['oreb']

    f.write(f"Pace (possession estimate): {team1['name']} ~{home_pace}, {team2['name']} ~{away_pace}\n")
    f.write(f"Assist Rate: {team1['name']} {home_stats['ast']}/{home_stats['fgm']} ({home_stats['ast']/home_stats['fgm']*100:.1f}%), ")
    f.write(f"{team2['name']} {away_stats['ast']}/{away_stats['fgm']} ({away_stats['ast']/away_stats['fgm']*100:.1f}%)\n")
    f.write(f"Turnover Rate: {team1['name']} {home_stats['tov']}, {team2['name']} {away_stats['tov']}\n")
    f.write(f"Steals per Opponent TO: {team1['name']} {home_stats['stl']}/{away_stats['tov']} ({home_stats['stl']/away_stats['tov']*100:.1f}%), ")
    f.write(f"{team2['name']} {away_stats['stl']}/{home_stats['tov']} ({away_stats['stl']/home_stats['tov']*100:.1f}%)\n")

    home_oreb_pct = home_stats['oreb']/(home_stats['oreb']+away_stats['dreb'])*100
    away_oreb_pct = away_stats['oreb']/(away_stats['oreb']+home_stats['dreb'])*100
    f.write(f"Offensive Rebound Rate: {team1['name']} {home_stats['oreb']}/{home_stats['oreb']+away_stats['dreb']} ({home_oreb_pct:.1f}%), ")
    f.write(f"{team2['name']} {away_stats['oreb']}/{away_stats['oreb']+home_stats['dreb']} ({away_oreb_pct:.1f}%)\n")

    f.write("\n" + "-" * 100 + "\n")
    f.write("TUNING VALIDATION (POST-TUNING TARGETS)\n")
    f.write("-" * 100 + "\n\n")

    avg_3pa = (home_stats['fg3a'] + away_stats['fg3a']) / 2
    avg_stl = (home_stats['stl'] + away_stats['stl']) / 2
    avg_blk = (home_stats['blk'] + away_stats['blk']) / 2

    f.write(f"3-Point Attempts: {team1['name']} {home_stats['fg3a']}, {team2['name']} {away_stats['fg3a']} ")
    f.write(f"(Combined: {home_stats['fg3a'] + away_stats['fg3a']}, Avg per team: {avg_3pa:.1f})\n")
    f.write(f"Target: 35.0 per team - {'✅ ON TARGET' if 33 <= avg_3pa <= 37 else '⚠️ OFF TARGET'}\n\n")

    f.write(f"Steals: {team1['name']} {home_stats['stl']}, {team2['name']} {away_stats['stl']} ")
    f.write(f"(Combined: {home_stats['stl'] + away_stats['stl']}, Avg per team: {avg_stl:.1f})\n")
    f.write(f"Target: 7.5 per team - {'✅ ON TARGET' if 6.5 <= avg_stl <= 8.5 else '⚠️ OFF TARGET'}\n\n")

    f.write(f"Blocks: {team1['name']} {home_stats['blk']}, {team2['name']} {away_stats['blk']} ")
    f.write(f"(Combined: {home_stats['blk'] + away_stats['blk']}, Avg per team: {avg_blk:.1f})\n")
    f.write(f"Target: 4.0 per team - {'✅ ON TARGET' if 3.0 <= avg_blk <= 5.0 else '⚠️ OFF TARGET'}\n\n")

    f.write("\n" + "=" * 100 + "\n")
    f.write("REVIEW CHECKLIST\n")
    f.write("=" * 100 + "\n\n")

    f.write("□ Score progression realistic across quarters?\n")
    f.write("□ Shooting percentages realistic (FG ~45-55%, 3PT ~35-42%, FT ~70-85%)?\n")
    f.write("□ Assist concentration working (elite playmakers getting 20-40% of team assists)?\n")
    f.write("□ Foul tracking correct (no players with 6+ fouls still playing)?\n")
    f.write("□ Turnovers attributed correctly (steals vs. out-of-bounds)?\n")
    f.write("□ Play-by-play narrative flows naturally?\n")
    f.write("□ No unrealistic stat lines (e.g., 50+ points, 20+ assists for one player)?\n")
    f.write("□ Substitution patterns make sense?\n")
    f.write("□ Close game execution proper (Q4 adjustments)?\n")
    f.write("□ Any bugs, anomalies, or unrealistic events?\n\n")

    f.write("=" * 100 + "\n")
    f.write("END OF REPORT\n")
    f.write("=" * 100 + "\n")

print("\n" + "=" * 80)
print(f"Game review saved to: {log_path}")
print(f"Final Score: {team1['name']} {result.home_score}, {team2['name']} {result.away_score}")
print("=" * 80)
