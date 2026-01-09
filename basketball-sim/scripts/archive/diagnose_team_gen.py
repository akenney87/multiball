"""
Diagnose team generation issue: Why are teams 8 points below target?
"""

from generate_teams import POSITION_ARCHETYPES, ALL_ATTRIBUTES

print("=" * 80)
print("TEAM GENERATION DIAGNOSIS")
print("=" * 80)

# Calculate average attribute value for each position
print("\nPosition archetype average attributes:")
for position, archetype in POSITION_ARCHETYPES.items():
    attr_sum = sum(archetype['mean'][attr] for attr in ALL_ATTRIBUTES)
    avg = attr_sum / len(ALL_ATTRIBUTES)
    print(f"  {position}: {avg:.1f}")

# Calculate overall average across all positions
all_position_avgs = []
for position, archetype in POSITION_ARCHETYPES.items():
    attr_sum = sum(archetype['mean'][attr] for attr in ALL_ATTRIBUTES)
    avg = attr_sum / len(ALL_ATTRIBUTES)
    all_position_avgs.append(avg)

overall_avg = sum(all_position_avgs) / len(all_position_avgs)
print(f"\nOverall average across all positions: {overall_avg:.1f}")

# Calculate expected team rating with quality_modifier = 0 (target rating 75)
print("\n" + "=" * 80)
print("EXPECTED TEAM RATING WITH CURRENT FORMULA")
print("=" * 80)

print("\nCurrent formula: quality_modifier = overall_rating - 75")
print(f"With overall_rating = 75 (baseline):")
print(f"  quality_modifier = 0")
print(f"  Expected actual_rating = {overall_avg:.1f} (archetype average)")
print(f"  Gap from target: {overall_avg - 75:.1f}")

print("\n" + "=" * 80)
print("PROPOSED FIX")
print("=" * 80)

print(f"\nChange baseline from 75 to {overall_avg:.0f}")
print(f"New formula: quality_modifier = overall_rating - {overall_avg:.0f}")
print(f"\nWith overall_rating = 75:")
print(f"  quality_modifier = 75 - {overall_avg:.0f} = {75 - overall_avg:.0f}")
print(f"  Expected actual_rating = {overall_avg:.1f} + {75 - overall_avg:.0f} = {overall_avg + (75 - overall_avg):.1f}")

print("\nWith overall_rating = 70:")
print(f"  quality_modifier = 70 - {overall_avg:.0f} = {70 - overall_avg:.0f}")
print(f"  Expected actual_rating = {overall_avg:.1f} + {70 - overall_avg:.0f} = {overall_avg + (70 - overall_avg):.1f}")

print("\nWith overall_rating = 80:")
print(f"  quality_modifier = 80 - {overall_avg:.0f} = {80 - overall_avg:.0f}")
print(f"  Expected actual_rating = {overall_avg:.1f} + {80 - overall_avg:.0f} = {overall_avg + (80 - overall_avg):.1f}")

print("\n" + "=" * 80)
