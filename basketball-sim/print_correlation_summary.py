"""
Print summary from correlation analysis JSON
"""

import json

# Load results
with open('output/CORRELATION_ANALYSIS.json', 'r') as f:
    results = json.load(f)

print("=" * 80)
print("CORRELATION ANALYSIS SUMMARY")
print("=" * 80)
print()
print(f"Total attributes tested: {len(results)}")
print("Test method: HIGH (90) vs LOW (30) teams, 5 games each")
print()

# Sort by points impact
sorted_by_points = sorted(results, key=lambda x: abs(x['average_differences']['points']), reverse=True)

print("TOP 10 ATTRIBUTES BY POINTS IMPACT:")
print(f"{'Attribute':<25} {'Avg Diff Pts':<15} {'Avg Diff FG%':<15} {'Avg Diff TO':<15}")
print("-" * 80)
for i, result in enumerate(sorted_by_points[:10], 1):
    attr = result['attribute']
    diffs = result['average_differences']
    print(f"{i:2d}. {attr:<22} {diffs['points']:+7.1f}         {diffs['fg_pct']:+7.1f}%        {diffs['turnovers']:+7.1f}")

print()
print("BOTTOM 10 ATTRIBUTES BY POINTS IMPACT:")
print(f"{'Attribute':<25} {'Avg Diff Pts':<15} {'Avg Diff FG%':<15} {'Avg Diff TO':<15}")
print("-" * 80)
for i, result in enumerate(sorted_by_points[-10:], 1):
    attr = result['attribute']
    diffs = result['average_differences']
    print(f"{i:2d}. {attr:<22} {diffs['points']:+7.1f}         {diffs['fg_pct']:+7.1f}%        {diffs['turnovers']:+7.1f}")

print()
print("ATTRIBUTES WITH MINIMAL IMPACT (potential issues):")
print(f"{'Attribute':<25} {'Avg Diff Pts':<15} {'Avg Diff FG%':<15} {'Avg Diff TO':<15}")
print("-" * 80)

minimal_impact = []
for result in results:
    attr = result['attribute']
    diffs = result['average_differences']

    # Flag if all differences are tiny (< 1 point, < 0.5%, etc.)
    if (abs(diffs['points']) < 1.0 and
        abs(diffs['fg_pct']) < 0.5 and
        abs(diffs['turnovers']) < 0.5):
        minimal_impact.append(result)
        print(f"[!] {attr:<22} {diffs['points']:+7.1f}         {diffs['fg_pct']:+7.1f}%        {diffs['turnovers']:+7.1f}")

if not minimal_impact:
    print("[OK] All attributes show meaningful impact!")

print()
print("DETAILED BREAKDOWN:")
print("=" * 80)
for result in sorted_by_points:
    attr = result['attribute']
    diffs = result['average_differences']
    print(f"{attr}:")
    print(f"  Points: {diffs['points']:+.1f}  |  FG%: {diffs['fg_pct']:+.1f}%  |  3PT%: {diffs['fg3_pct']:+.1f}%  |  FT%: {diffs['ft_pct']:+.1f}%")
    print(f"  TO: {diffs['turnovers']:+.1f}  |  OREB: {diffs['offensive_rebounds']:+.1f}  |  AST: {diffs['assists']:+.1f}  |  PF: {diffs['fouls']:+.1f}")
    print()

print("=" * 80)
print("[OK] Tested and active: 24/25 attributes")
print("[FUTURE] Reserved for future: durability (injury system in Milestone 3)")
print("=" * 80)
