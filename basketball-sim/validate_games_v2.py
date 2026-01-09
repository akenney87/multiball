import re

def extract_game_stats(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    # Extract final score
    final_score_match = re.search(r'FINAL SCORE: Team_001 (\d+), Team_002 (\d+)', content)
    if not final_score_match:
        return None

    team1_score = int(final_score_match.group(1))
    team2_score = int(final_score_match.group(2))

    # Find the LAST occurrence of team stats (full game, not quarterly)
    # Split by "FULL GAME BOX SCORE" and get everything after
    parts = content.split("FULL GAME BOX SCORE")
    if len(parts) < 2:
        return None

    full_game_section = parts[-1]

    # Find Team_001 stats
    team1_match = re.search(r'Team_001.*?TEAM: FG: (\d+)/(\d+) \(([\d.]+)%\), 3PT: (\d+)/(\d+) \(([\d.]+)%\), REB: (\d+) \((\d+) off, (\d+) def\), AST: (\d+), TO: (\d+)', full_game_section, re.DOTALL)

    # Find Team_002 stats
    team2_match = re.search(r'Team_002.*?TEAM: FG: (\d+)/(\d+) \(([\d.]+)%\), 3PT: (\d+)/(\d+) \(([\d.]+)%\), REB: (\d+) \((\d+) off, (\d+) def\), AST: (\d+), TO: (\d+)', full_game_section, re.DOTALL)

    if not team1_match or not team2_match:
        return None

    team1_fga = int(team1_match.group(2))
    team1_oreb = int(team1_match.group(8))
    team1_to = int(team1_match.group(11))
    team1_fg_pct = float(team1_match.group(3))
    team1_3pt_pct = float(team1_match.group(6))
    team1_reb = int(team1_match.group(7))

    team2_fga = int(team2_match.group(2))
    team2_oreb = int(team2_match.group(8))
    team2_to = int(team2_match.group(11))
    team2_fg_pct = float(team2_match.group(3))
    team2_3pt_pct = float(team2_match.group(6))
    team2_reb = int(team2_match.group(7))

    # Calculate possession-based stats
    team1_poss = team1_fga - team1_oreb + team1_to
    team2_poss = team2_fga - team2_oreb + team2_to

    team1_to_rate = (team1_to / team1_poss * 100) if team1_poss > 0 else 0
    team2_to_rate = (team2_to / team2_poss * 100) if team2_poss > 0 else 0

    # OREB%
    team1_dreb = team1_reb - team1_oreb
    team2_dreb = team2_reb - team2_oreb

    team1_oreb_rate = (team1_oreb / (team1_oreb + team2_dreb) * 100) if (team1_oreb + team2_dreb) > 0 else 0
    team2_oreb_rate = (team2_oreb / (team2_oreb + team1_dreb) * 100) if (team2_oreb + team1_dreb) > 0 else 0

    return {
        'final_score': f"{team1_score}-{team2_score}",
        'team1_score': team1_score,
        'team2_score': team2_score,
        'team1_fg_pct': team1_fg_pct,
        'team2_fg_pct': team2_fg_pct,
        'team1_3pt_pct': team1_3pt_pct,
        'team2_3pt_pct': team2_3pt_pct,
        'team1_to_rate': round(team1_to_rate, 1),
        'team2_to_rate': round(team2_to_rate, 1),
        'team1_oreb_rate': round(team1_oreb_rate, 1),
        'team2_oreb_rate': round(team2_oreb_rate, 1),
        'team1_to': team1_to,
        'team2_to': team2_to,
        'team1_oreb': team1_oreb,
        'team2_oreb': team2_oreb
    }

# Analyze all 10 games
results = []
for i in range(1, 11):
    file_path = f"output/validation_game_{i:02d}.txt"
    print(f"\nGAME {i:02d}")
    print("="*80)

    stats = extract_game_stats(file_path)
    if not stats:
        print("ERROR: Could not extract stats")
        continue

    print(f"Final Score: {stats['final_score']}")
    print(f"Team_001: FG={stats['team1_fg_pct']:5.1f}%, 3PT={stats['team1_3pt_pct']:5.1f}%, TO={stats['team1_to_rate']:5.1f}%, OREB={stats['team1_oreb_rate']:5.1f}%  (TO:{stats['team1_to']}, OREB:{stats['team1_oreb']})")
    print(f"Team_002: FG={stats['team2_fg_pct']:5.1f}%, 3PT={stats['team2_3pt_pct']:5.1f}%, TO={stats['team2_to_rate']:5.1f}%, OREB={stats['team2_oreb_rate']:5.1f}%  (TO:{stats['team2_to']}, OREB:{stats['team2_oreb']})")

    # Validation
    fg_pass = 40 <= stats['team1_fg_pct'] <= 55 and 40 <= stats['team2_fg_pct'] <= 55
    three_pass = 25 <= stats['team1_3pt_pct'] <= 45 and 25 <= stats['team2_3pt_pct'] <= 45
    to_pass = 10 <= stats['team1_to_rate'] <= 16 and 10 <= stats['team2_to_rate'] <= 16
    oreb_pass = 18 <= stats['team1_oreb_rate'] <= 32 and 18 <= stats['team2_oreb_rate'] <= 32
    score_pass = 68 <= stats['team1_score'] <= 120 and 68 <= stats['team2_score'] <= 120

    overall = fg_pass and three_pass and to_pass and oreb_pass and score_pass

    failures = []
    if not fg_pass: failures.append("FG%")
    if not three_pass: failures.append("3PT%")
    if not to_pass: failures.append(f"TO (T1:{stats['team1_to_rate']}%, T2:{stats['team2_to_rate']}%)")
    if not oreb_pass: failures.append(f"OREB (T1:{stats['team1_oreb_rate']}%, T2:{stats['team2_oreb_rate']}%)")
    if not score_pass: failures.append("Score")

    if overall:
        print(f">>> GAME {i:02d}: PASS")
    else:
        print(f">>> GAME {i:02d}: FAIL - {', '.join(failures)}")

    results.append({
        'game': i,
        'pass': overall,
        'stats': stats,
        'failures': failures
    })

# Summary
print(f"\n\n{'='*80}")
print("VALIDATION SUMMARY - ITERATION 6")
print('='*80)
passed = sum(1 for r in results if r['pass'])
print(f"Overall: {passed}/10 games PASSED")

if passed < 9:
    print("\nFailed games breakdown:")
    for r in results:
        if not r['pass']:
            print(f"  Game {r['game']:02d}: {', '.join(r['failures'])}")
