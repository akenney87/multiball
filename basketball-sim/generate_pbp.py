"""
Generate detailed play-by-play for a single game.
"""
import random
import json
from pathlib import Path
from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings


def format_possession(poss_result, home_team, away_team, poss_num):
    """Format a possession result as play-by-play text."""
    lines = []

    # Possession header
    lines.append(f"\n{'='*60}")
    lines.append(f"Possession #{poss_num}")
    lines.append(f"{'='*60}")

    # Use the built-in play-by-play text
    if poss_result.play_by_play_text:
        lines.append(poss_result.play_by_play_text)

    # Add debug info if available
    if poss_result.debug:
        debug_items = []
        if 'is_transition' in poss_result.debug and poss_result.debug['is_transition']:
            debug_items.append("TRANSITION")
        if 'shot_type' in poss_result.debug:
            debug_items.append(f"Shot: {poss_result.debug['shot_type']}")
        if 'turnover_type' in poss_result.debug:
            debug_items.append(f"TO: {poss_result.debug['turnover_type']}")

        if debug_items:
            lines.append(f"  [{' | '.join(debug_items)}]")

    # Summary
    outcome_text = f"Outcome: {poss_result.possession_outcome}"
    if poss_result.points_scored > 0:
        outcome_text += f" (+{poss_result.points_scored} pts)"
    lines.append(f"  {outcome_text}")

    return "\n".join(lines)


def main():
    # Load teams
    team1 = json.loads(Path('teams/team_001.json').read_text())
    team2 = json.loads(Path('teams/team_050.json').read_text())

    # Create tactical settings
    def create_minutes(roster):
        return {p['name']: 35 if i < 5 else 13 for i, p in enumerate(roster)}

    tactics_home = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=None,
        scoring_option_2=None,
        scoring_option_3=None,
        minutes_allotment=create_minutes(team1['roster']),
        rebounding_strategy='standard'
    )

    tactics_away = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=None,
        scoring_option_2=None,
        scoring_option_3=None,
        minutes_allotment=create_minutes(team2['roster']),
        rebounding_strategy='standard'
    )

    # Simulate game
    print("Simulating game with detailed play-by-play...")
    random.seed(77)

    game_sim = GameSimulator(
        home_roster=team1['roster'],
        away_roster=team2['roster'],
        tactical_home=tactics_home,
        tactical_away=tactics_away,
        home_team_name=team1['name'],
        away_team_name=team2['name']
    )

    result = game_sim.simulate_game(seed=77)

    # Generate play-by-play
    pbp_lines = []
    pbp_lines.append("="*80)
    pbp_lines.append(f"GAME: {team1['name']} vs {team2['name']}")
    pbp_lines.append(f"Ratings: {team1['name']} ({team1['actual_overall_rating']}) vs {team2['name']} ({team2['actual_overall_rating']})")
    pbp_lines.append("="*80)
    pbp_lines.append("")

    # Use the built-in play-by-play text if available
    if result.play_by_play_text:
        pbp_lines.append(result.play_by_play_text)
    else:
        # Try to extract from quarters
        if hasattr(result, 'quarter_results') and result.quarter_results:
            for q_idx, quarter in enumerate(result.quarter_results, 1):
                pbp_lines.append(f"\n\n{'#'*80}")
                pbp_lines.append(f"QUARTER {q_idx}")
                pbp_lines.append(f"{'#'*80}")

                if hasattr(quarter, 'possession_results') and quarter.possession_results:
                    for poss_idx, poss in enumerate(quarter.possession_results, 1):
                        pbp_lines.append(format_possession(poss, team1['name'], team2['name'], poss_idx))
                else:
                    pbp_lines.append("\n  [Quarter possession details not available]")
        else:
            pbp_lines.append("\n  [Play-by-play not available]")

    # Final stats
    pbp_lines.append(f"\n\n{'='*80}")
    pbp_lines.append("FINAL SCORE")
    pbp_lines.append(f"{'='*80}")
    pbp_lines.append(f"{team1['name']}: {result.home_score}")
    pbp_lines.append(f"{team2['name']}: {result.away_score}")
    pbp_lines.append(f"\nQuarter Scores: {result.quarter_scores}")

    stats = result.game_statistics
    home_stats = stats['home_stats']
    away_stats = stats['away_stats']

    pbp_lines.append(f"\n{'='*80}")
    pbp_lines.append("BOX SCORE")
    pbp_lines.append(f"{'='*80}")
    pbp_lines.append(f"\n{team1['name']}:")
    pbp_lines.append(f"  FG: {home_stats['fgm']}/{home_stats['fga']} ({home_stats['fgm']/home_stats['fga']*100:.1f}%)")
    pbp_lines.append(f"  3PT: {home_stats['fg3m']}/{home_stats['fg3a']} ({home_stats['fg3m']/home_stats['fg3a']*100:.1f}%)")
    pbp_lines.append(f"  FT: {home_stats['ftm']}/{home_stats['fta']} ({home_stats['ftm']/home_stats['fta']*100:.1f}%)")
    pbp_lines.append(f"  Rebounds: {home_stats['oreb']+home_stats['dreb']} (OFF: {home_stats['oreb']}, DEF: {home_stats['dreb']})")
    pbp_lines.append(f"  Assists: {home_stats['ast']}")
    pbp_lines.append(f"  Turnovers: {home_stats['tov']}")
    pbp_lines.append(f"  Steals: {home_stats['stl']}")
    pbp_lines.append(f"  Blocks: {home_stats['blk']}")
    pbp_lines.append(f"  Fouls: {home_stats['pf']}")

    pbp_lines.append(f"\n{team2['name']}:")
    pbp_lines.append(f"  FG: {away_stats['fgm']}/{away_stats['fga']} ({away_stats['fgm']/away_stats['fga']*100:.1f}%)")
    pbp_lines.append(f"  3PT: {away_stats['fg3m']}/{away_stats['fg3a']} ({away_stats['fg3m']/away_stats['fg3a']*100:.1f}%)")
    pbp_lines.append(f"  FT: {away_stats['ftm']}/{away_stats['fta']} ({away_stats['ftm']/away_stats['fta']*100:.1f}%)")
    pbp_lines.append(f"  Rebounds: {away_stats['oreb']+away_stats['dreb']} (OFF: {away_stats['oreb']}, DEF: {away_stats['dreb']})")
    pbp_lines.append(f"  Assists: {away_stats['ast']}")
    pbp_lines.append(f"  Turnovers: {away_stats['tov']}")
    pbp_lines.append(f"  Steals: {away_stats['stl']}")
    pbp_lines.append(f"  Blocks: {away_stats['blk']}")
    pbp_lines.append(f"  Fouls: {away_stats['pf']}")

    # Save to file
    output_path = Path('output/PLAY_BY_PLAY_SAMPLE.txt')
    output_path.write_text('\n'.join(pbp_lines), encoding='utf-8')

    print(f"\nPlay-by-play saved to: {output_path}")
    print(f"Total possessions tracked: {len([l for l in pbp_lines if 'POSSESSION' in l])}")


if __name__ == '__main__':
    main()
