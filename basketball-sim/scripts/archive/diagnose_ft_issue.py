"""
M4.5 PHASE 4: Comprehensive FT% Diagnostic

Expected: 75.1% FT (for composite 67.2)
Phase 2: 66.7% FT
Phase 3: 56.8% FT

Investigate all possible causes.
"""
import json
import math

def sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))

def calculate_expected_ft_pct(composite, base_rate=0.40, k=0.02, pressure=0.0):
    """Calculate expected FT% for given composite."""
    composite_diff = composite - 50.0
    sigmoid_input = k * composite_diff
    sigmoid_output = sigmoid(sigmoid_input)
    attribute_bonus = (1.0 - base_rate) * sigmoid_output
    probability = base_rate + attribute_bonus + pressure
    return max(0.0, min(1.0, probability))

# Test the formula
print('='*70)
print('FT FORMULA VERIFICATION')
print('='*70)
print()

test_composites = [40, 50, 60, 67.2, 70, 80]
for comp in test_composites:
    normal_pct = calculate_expected_ft_pct(comp) * 100
    bonus_pct = calculate_expected_ft_pct(comp, pressure=-0.03) * 100
    clutch_pct = calculate_expected_ft_pct(comp, pressure=-0.05) * 100
    and1_pct = calculate_expected_ft_pct(comp, pressure=+0.05) * 100

    print(f'Composite {comp:.1f}:')
    print(f'  Normal: {normal_pct:.1f}%')
    print(f'  Bonus (-3%): {bonus_pct:.1f}%')
    print(f'  Clutch (-5%): {clutch_pct:.1f}%')
    print(f'  And-1 (+5%): {and1_pct:.1f}%')
    print()

print('='*70)
print('HYPOTHESIS TESTING')
print('='*70)
print()

# If ALL FTs were treated as clutch, what would the percentage be?
avg_comp = 67.2
all_clutch = calculate_expected_ft_pct(avg_comp, pressure=-0.05) * 100
all_bonus = calculate_expected_ft_pct(avg_comp, pressure=-0.03) * 100
all_normal = calculate_expected_ft_pct(avg_comp, pressure=0.0) * 100

print(f'For average composite {avg_comp}:')
print(f'  If all FTs were normal: {all_normal:.1f}%')
print(f'  If all FTs were bonus: {all_bonus:.1f}%')
print(f'  If all FTs were clutch: {all_clutch:.1f}%')
print()

print('Phase 3 actual: 56.8%')
print()

# What mix of situations would produce 56.8%?
target = 56.8
print(f'To achieve {target}% with composite {avg_comp}:')

# Try different mixes
for clutch_pct_frac in [0, 0.1, 0.2, 0.3, 0.4, 0.5]:
    for bonus_pct_frac in [0, 0.2, 0.4, 0.6, 0.8]:
        normal_pct_frac = 1.0 - clutch_pct_frac - bonus_pct_frac
        if normal_pct_frac < 0:
            continue

        weighted_avg = (
            normal_pct_frac * all_normal +
            bonus_pct_frac * all_bonus +
            clutch_pct_frac * all_clutch
        )

        if abs(weighted_avg - target) < 1.0:
            print(f'  {normal_pct_frac*100:.0f}% normal, {bonus_pct_frac*100:.0f}% bonus, {clutch_pct_frac*100:.0f}% clutch = {weighted_avg:.1f}%')

print()
print('='*70)
print('ALTERNATIVE HYPOTHESIS')
print('='*70)
print()

# What if the k value is wrong?
print('What if SIGMOID_K is not 0.02 but something else?')
for test_k in [0.01, 0.015, 0.02, 0.025, 0.03]:
    test_pct = calculate_expected_ft_pct(avg_comp, k=test_k) * 100
    print(f'  k={test_k:.3f}: {test_pct:.1f}%')

print()

# What if BaseRate is wrong?
print('What if BASE_RATE is not 0.40 but something else?')
for test_base in [0.30, 0.35, 0.40, 0.45, 0.50]:
    test_pct = calculate_expected_ft_pct(avg_comp, base_rate=test_base) * 100
    print(f'  BaseRate={test_base:.2f}: {test_pct:.1f}%')

print()

# What if the actual composite is lower?
print('What if teams are actually shooting with lower composite?')
for test_comp in [30, 40, 45, 50, 55, 60, 67.2]:
    test_pct = calculate_expected_ft_pct(test_comp) * 100
    print(f'  Composite {test_comp:.1f}: {test_pct:.1f}%')
    if abs(test_pct - 56.8) < 1.0:
        print(f'    *** MATCH! If actual composite is {test_comp:.1f}, would produce {test_pct:.1f}% ***')

print()
print('='*70)
print('CONCLUSION')
print('='*70)
print()
print('To explain 56.8% FT with formula expecting 75.1%:')
print('1. Almost all FTs would need to be clutch (70%+)')
print('2. OR actual shooting composite is ~43-45 (much lower than team avg)')
print('3. OR there is a bug in the FT formula implementation')
print('4. OR players with lower FT composites are shooting disproportionately')
