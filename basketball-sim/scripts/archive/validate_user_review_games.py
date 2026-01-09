import re
import json

def scan_game(filename, game_num):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    
    violations = {
        'timeout_after_own_score': [],
        'illegal_subs': [],
        'bonus_issues': []
    }
    
    # Track stats
    ft_made = 0
    ft_total = 0
    fouls = 0
    home_score = 0
    away_score = 0
    
    prev_line = ''
    for i, line in enumerate(lines):
        # Check timeout violations
        if 'TIMEOUT' in line and prev_line:
            if 'makes' in prev_line.lower() or 'GOOD' in prev_line.upper():
                # Extract teams
                timeout_team = None
                if 'Warriors' in line or 'Celtics' in line or 'Bucks' in line:
                    timeout_team = line.split()[0]
                
                scoring_team = None
                if 'Warriors' in prev_line or 'Celtics' in prev_line or 'Bucks' in prev_line:
                    words = prev_line.split()
                    for word in words:
                        if word in ['Warriors', 'Celtics', 'Bucks', 'Lakers', 'Heat', 'Nets']:
                            scoring_team = word
                            break
                
                if timeout_team and scoring_team and timeout_team == scoring_team:
                    violations['timeout_after_own_score'].append(f"Line {i}")
        
        # Check substitution after made FT
        if 'SUB' in line.upper() and 'makes free throw' in prev_line.lower():
            if '1 of 2' in prev_line or '2 of 2' in prev_line:
                violations['illegal_subs'].append(f"Line {i}: Sub after made FT")
        
        # Track FT stats
        if 'free throw' in line.lower():
            ft_total += 1
            if 'makes' in line.lower() or 'GOOD' in line.upper():
                ft_made += 1
        
        # Track fouls
        if 'FOUL' in line.upper() and 'Team fouls:' in line:
            fouls += 1
        
        # Get final score
        if 'FINAL SCORE:' in line:
            parts = line.split()
            try:
                home_score = int(parts[-3].replace(',', ''))
                away_score = int(parts[-1])
            except:
                pass
        
        prev_line = line
    
    ft_pct = (ft_made / ft_total * 100) if ft_total > 0 else 0
    margin = abs(home_score - away_score)
    total_points = home_score + away_score
    
    has_violations = any(len(v) > 0 for v in violations.values())
    
    return {
        'game': game_num,
        'filename': filename,
        'violations': violations,
        'has_violations': has_violations,
        'ft_made': ft_made,
        'ft_total': ft_total,
        'ft_pct': ft_pct,
        'fouls': fouls,
        'home_score': home_score,
        'away_score': away_score,
        'margin': margin,
        'total_points': total_points
    }

print("="*80)
print("M3 USER REVIEW GAME VALIDATION")
print("="*80)

games = []
for i in range(1, 4):
    filename = f'output/M3_USER_REVIEW_GAME_{i}.txt'
    print(f"\nValidating Game {i}...")
    result = scan_game(filename, i)
    games.append(result)
    
    print(f"  Score: {result['home_score']}-{result['away_score']} (Margin: {result['margin']})")
    print(f"  Total Points: {result['total_points']}")
    print(f"  Fouls: {result['fouls']}")
    print(f"  FT: {result['ft_made']}/{result['ft_total']} ({result['ft_pct']:.1f}%)")
    
    if result['has_violations']:
        print(f"  VIOLATIONS FOUND:")
        for vtype, vlist in result['violations'].items():
            if vlist:
                print(f"    - {vtype}: {len(vlist)}")
    else:
        print(f"  No violations detected")

print("\n" + "="*80)
print("SUMMARY")
print("="*80)

total_violations = sum(1 for g in games if g['has_violations'])
avg_score = sum(g['total_points'] for g in games) / len(games)
avg_ft_pct = sum(g['ft_pct'] for g in games) / len(games)
avg_fouls = sum(g['fouls'] for g in games) / len(games)

print(f"\nGames with violations: {total_violations}/3")
print(f"Average total points: {avg_score:.1f}")
print(f"Average FT%: {avg_ft_pct:.1f}%")
print(f"Average fouls: {avg_fouls:.1f}")

if total_violations == 0:
    print("\nSTATUS: READY FOR USER REVIEW")
else:
    print("\nSTATUS: VIOLATIONS FOUND - NEEDS REVIEW")

# Save results
with open('output/M3_USER_REVIEW_METRICS.json', 'w') as f:
    json.dump({
        'games': games,
        'summary': {
            'total_violations': total_violations,
            'avg_score': avg_score,
            'avg_ft_pct': avg_ft_pct,
            'avg_fouls': avg_fouls
        }
    }, f, indent=2)

print("\nMetrics saved to output/M3_USER_REVIEW_METRICS.json")
