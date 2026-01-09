"""
Analyze blowout patterns and rubber-band effectiveness from validation games
"""

import re

# Parse the validation output
with open('output/M48_FINAL_VALIDATION.txt', 'r') as f:
    content = f.read()

# Extract all quarter-end scores
pattern = r'Quarter (\d+) complete: Team_Specialized_A (\d+), Team_Specialized_B (\d+)'
matches = re.findall(pattern, content)

game_num = 0
current_game_scores = []
blowout_games = []
comeback_games = []
close_games = []

for i, (quarter, score_a, score_b) in enumerate(matches):
    quarter = int(quarter)
    score_a = int(score_a)
    score_b = int(score_b)

    current_game_scores.append((quarter, score_a, score_b))

    # End of game (Quarter 4)
    if quarter == 4:
        game_num += 1

        # Analyze this game's progression
        q1_a, q1_b = current_game_scores[0][1], current_game_scores[0][2]
        q2_a, q2_b = current_game_scores[1][1], current_game_scores[1][2]
        q3_a, q3_b = current_game_scores[2][1], current_game_scores[2][2]
        q4_a, q4_b = current_game_scores[3][1], current_game_scores[3][2]

        # Calculate margins at each quarter
        q1_margin = abs(q1_a - q1_b)
        q2_margin = abs(q2_a - q2_b)
        q3_margin = abs(q3_a - q3_b)
        q4_margin = abs(q4_a - q4_b)

        # Detect patterns
        final_margin = q4_margin
        max_margin = max(q1_margin, q2_margin, q3_margin, q4_margin)

        # Blowout game (final margin 20+)
        if final_margin >= 20:
            blowout_games.append({
                'game': game_num,
                'q1_margin': q1_margin,
                'q2_margin': q2_margin,
                'q3_margin': q3_margin,
                'q4_margin': q4_margin,
                'final_score': f"{q4_a}-{q4_b}"
            })

        # Comeback attempt (max margin in Q1-Q3 was 15+, but final < 10)
        early_max = max(q1_margin, q2_margin, q3_margin)
        if early_max >= 15 and final_margin < 10:
            comeback_games.append({
                'game': game_num,
                'q1_margin': q1_margin,
                'q2_margin': q2_margin,
                'q3_margin': q3_margin,
                'q4_margin': q4_margin,
                'early_max': early_max,
                'final_score': f"{q4_a}-{q4_b}"
            })

        # Close game throughout (all quarters <= 8)
        if q1_margin <= 8 and q2_margin <= 8 and q3_margin <= 8 and q4_margin <= 8:
            close_games.append({
                'game': game_num,
                'q1_margin': q1_margin,
                'q2_margin': q2_margin,
                'q3_margin': q3_margin,
                'q4_margin': q4_margin,
                'final_score': f"{q4_a}-{q4_b}"
            })

        # Reset for next game
        current_game_scores = []

print("=" * 80)
print("BLOWOUT PATTERN ANALYSIS - M4.8 VALIDATION")
print("=" * 80)
print()

print(f"Total games analyzed: {game_num}")
print(f"Blowout games (final margin >=20): {len(blowout_games)} ({len(blowout_games)/game_num*100:.1f}%)")
print(f"Comeback attempts (early 15+ lead -> final <10): {len(comeback_games)} ({len(comeback_games)/game_num*100:.1f}%)")
print(f"Close games (all quarters <=8): {len(close_games)} ({len(close_games)/game_num*100:.1f}%)")
print()

print("=" * 80)
print("BLOWOUT GAME DETAILS")
print("=" * 80)
print()
print(f"{'Game':<8} {'Q1':<8} {'Q2':<8} {'Q3':<8} {'Q4':<8} {'Final Score':<15} {'Pattern'}")
print("-" * 80)

for game in blowout_games[:15]:  # Show first 15
    # Analyze pattern: growing, shrinking, or stable
    margins = [game['q1_margin'], game['q2_margin'], game['q3_margin'], game['q4_margin']]
    if margins[-1] > margins[0] + 5:
        pattern = "Growing"
    elif margins[-1] < margins[0] - 5:
        pattern = "Shrinking"
    else:
        pattern = "Stable"

    print(f"{game['game']:<8} {game['q1_margin']:<8} {game['q2_margin']:<8} {game['q3_margin']:<8} "
          f"{game['q4_margin']:<8} {game['final_score']:<15} {pattern}")

print()
print("=" * 80)
print("COMEBACK ATTEMPT DETAILS (Rubber-Band Working?)")
print("=" * 80)
print()

if comeback_games:
    print(f"{'Game':<8} {'Q1':<8} {'Q2':<8} {'Q3':<8} {'Q4':<8} {'Max Early':<10} {'Final Score'}")
    print("-" * 80)
    for game in comeback_games:
        print(f"{game['game']:<8} {game['q1_margin']:<8} {game['q2_margin']:<8} {game['q3_margin']:<8} "
              f"{game['q4_margin']:<8} {game['early_max']:<10} {game['final_score']}")
    print()
    print("[PASS] Rubber-band effect appears to be working - teams mounting comebacks from 15+ deficits")
else:
    print("[FAIL] No comeback attempts detected (15+ early lead -> <10 final)")
    print("  This suggests rubber-band effect may be too weak")

print()
print("=" * 80)
print("RUBBER-BAND EFFECTIVENESS ASSESSMENT")
print("=" * 80)
print()

# Calculate what % of blowout games showed any shrinking
shrinking_blowouts = 0
for game in blowout_games:
    if game['q4_margin'] < max(game['q1_margin'], game['q2_margin'], game['q3_margin']):
        shrinking_blowouts += 1

if blowout_games:
    shrink_rate = shrinking_blowouts / len(blowout_games) * 100
    print(f"Blowout games where margin shrank at some point: {shrinking_blowouts}/{len(blowout_games)} ({shrink_rate:.1f}%)")
else:
    shrink_rate = 0.0

print()
if comeback_games:
    print("STATUS: [PASS] Rubber-band effect is active and producing comebacks")
elif shrink_rate > 30:
    print("STATUS: [WEAK] Rubber-band effect is weak - margins shrink but not enough")
else:
    print("STATUS: [FAIL] Rubber-band effect appears ineffective")

print()
print("RECOMMENDATION:")
if comeback_games:
    print("  Current settings appear effective. Blowout rate (37%) could potentially be reduced further")
    print("  by strengthening the rubber-band modifiers or activating at lower deficits.")
else:
    print("  Consider strengthening rubber-band modifiers:")
    print("    - Current: 10-14pts=+5%, 15-19pts=+7.5%, 20+pts=+10%")
    print("    - Suggested: 10-14pts=+7.5%, 15-19pts=+12.5%, 20+pts=+15%")
    print("  Or activate at lower thresholds (e.g., 8+ instead of 10+)")
