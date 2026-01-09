"""
Comprehensive Attribute Usage Audit

Verifies that:
1. All 25 attributes are used in at least one action
2. Every action properly weights attributes
3. Attribute weights are actually being applied in calculations

If attributes don't correlate with outcomes, it means they're not
actually affecting the simulation - which is a critical bug.
"""

import ast
import re
from pathlib import Path
from typing import Dict, Set, List, Tuple

# All 25 attributes
ALL_ATTRIBUTES = {
    # Physical (12)
    'grip_strength', 'arm_strength', 'core_strength', 'agility',
    'acceleration', 'top_speed', 'jumping', 'reactions', 'stamina',
    'balance', 'height', 'durability',
    # Mental (7)
    'awareness', 'creativity', 'determination', 'bravery',
    'consistency', 'composure', 'patience',
    # Technical (6)
    'hand_eye_coordination', 'throw_accuracy', 'form_technique',
    'finesse', 'deception', 'teamwork'
}

# Expected attribute weights from basketball_sim.md
EXPECTED_WEIGHTS = {
    '3PT Shooting': {
        'form_technique': 0.25,
        'throw_accuracy': 0.20,
        'finesse': 0.15,
        'hand_eye_coordination': 0.12,
        'balance': 0.10,
        'composure': 0.08,
        'consistency': 0.06,
        'agility': 0.04,
    },
    'Midrange Shooting': {
        'form_technique': 0.25,
        'throw_accuracy': 0.20,
        'finesse': 0.15,
        'hand_eye_coordination': 0.12,
        'balance': 0.10,
        'composure': 0.08,
        'consistency': 0.06,
        'agility': 0.04,
    },
    'Layup': {
        'finesse': 0.35,
        'hand_eye_coordination': 0.30,
        'balance': 0.20,
        'jumping': 0.15,
    },
    'Dunk': {
        'jumping': 0.40,
        'height': 0.30,
        'arm_strength': 0.20,
        'agility': 0.10,
    },
    'Contest Defense': {
        'awareness': 0.30,
        'reactions': 0.25,
        'agility': 0.20,
        'height': 0.15,
        'jumping': 0.10,
    },
    'Rebounding': {
        'jumping': 0.25,
        'height': 0.25,
        'awareness': 0.20,
        'core_strength': 0.15,
        'reactions': 0.10,
        'determination': 0.05,
    },
    'Ball Handling': {
        'awareness': 0.40,
        'composure': 0.30,
        'consistency': 0.20,
        'hand_eye_coordination': 0.10,
    },
    'Passing': {
        'teamwork': 0.40,
        'awareness': 0.35,
        'composure': 0.25,
    },
}


def find_weight_definitions(src_dir: str = "src") -> Dict[str, Dict[str, float]]:
    """Find all WEIGHTS_* dictionaries in source code."""
    weights_found = {}

    src_path = Path(src_dir)

    for py_file in src_path.rglob("*.py"):
        with open(py_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Find WEIGHTS_* = {...} patterns
        weight_pattern = r'(WEIGHTS_\w+)\s*=\s*\{([^}]+)\}'
        matches = re.finditer(weight_pattern, content, re.MULTILINE | re.DOTALL)

        for match in matches:
            var_name = match.group(1)
            dict_content = match.group(2)

            # Parse the dictionary
            weights = {}
            for line in dict_content.split('\n'):
                line = line.strip()
                if ':' in line:
                    # Extract 'attribute': value
                    parts = line.split(':')
                    if len(parts) == 2:
                        attr = parts[0].strip().strip("'\"")
                        try:
                            value = float(parts[1].strip().rstrip(','))
                            weights[attr] = value
                        except:
                            pass

            if weights:
                weights_found[f"{py_file.name}::{var_name}"] = weights

    return weights_found


def find_calculate_composite_calls(src_dir: str = "src") -> List[Tuple[str, str]]:
    """Find all calls to calculate_composite() function."""
    calls = []

    src_path = Path(src_dir)

    for py_file in src_path.rglob("*.py"):
        with open(py_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Find calculate_composite(player, WEIGHTS_*)
        pattern = r'calculate_composite\([^,]+,\s*(\w+)\)'
        matches = re.finditer(pattern, content)

        for match in matches:
            weight_var = match.group(1)
            calls.append((py_file.name, weight_var))

    return calls


def check_attribute_coverage(weights_found: Dict[str, Dict[str, float]]) -> Dict[str, List[str]]:
    """Check which attributes are used and which are missing."""
    used_attributes = set()

    for weight_dict in weights_found.values():
        used_attributes.update(weight_dict.keys())

    missing_attributes = ALL_ATTRIBUTES - used_attributes

    # Count usage frequency
    attribute_usage = {attr: 0 for attr in ALL_ATTRIBUTES}
    for weight_dict in weights_found.values():
        for attr in weight_dict.keys():
            if attr in attribute_usage:
                attribute_usage[attr] += 1

    return {
        'used': sorted(used_attributes),
        'missing': sorted(missing_attributes),
        'usage_count': attribute_usage
    }


def verify_weight_sums(weights_found: Dict[str, Dict[str, float]]) -> Dict[str, float]:
    """Verify that all weight dictionaries sum to 1.0."""
    weight_sums = {}

    for name, weights in weights_found.items():
        total = sum(weights.values())
        weight_sums[name] = total

    return weight_sums


def main():
    print("="*80)
    print("ATTRIBUTE USAGE AUDIT")
    print("="*80)
    print("\nPurpose: Verify all 25 attributes are properly integrated")
    print("Hypothesis: Low correlation may indicate attributes aren't being used\n")

    # Step 1: Find all weight definitions
    print("\n" + "="*80)
    print("STEP 1: FINDING ATTRIBUTE WEIGHT DEFINITIONS")
    print("="*80)

    weights_found = find_weight_definitions("src")

    print(f"\nFound {len(weights_found)} weight dictionaries:\n")
    for name, weights in weights_found.items():
        print(f"{name}:")
        for attr, value in sorted(weights.items(), key=lambda x: x[1], reverse=True):
            print(f"  {attr}: {value:.2f}")
        print()

    # Step 2: Check attribute coverage
    print("\n" + "="*80)
    print("STEP 2: ATTRIBUTE COVERAGE ANALYSIS")
    print("="*80)

    coverage = check_attribute_coverage(weights_found)

    print(f"\nAttributes USED: {len(coverage['used'])}/25")
    for attr in coverage['used']:
        count = coverage['usage_count'][attr]
        print(f"  {attr}: used in {count} action(s)")

    if coverage['missing']:
        print(f"\nATTENTION: Attributes NOT USED: {len(coverage['missing'])}/25")
        for attr in coverage['missing']:
            print(f"  {attr}: NEVER USED")
    else:
        print("\nALL 25 ATTRIBUTES ARE USED!")

    # Step 3: Verify weight sums
    print("\n" + "="*80)
    print("STEP 3: WEIGHT SUM VERIFICATION")
    print("="*80)

    weight_sums = verify_weight_sums(weights_found)

    print("\nChecking if weights sum to 1.0:")
    for name, total in weight_sums.items():
        status = "OK" if abs(total - 1.0) < 0.01 else "ERROR"
        print(f"  {name}: {total:.3f} [{status}]")

    # Step 4: Find calculate_composite calls
    print("\n" + "="*80)
    print("STEP 4: CALCULATE_COMPOSITE USAGE")
    print("="*80)

    composite_calls = find_calculate_composite_calls("src")

    print(f"\nFound {len(composite_calls)} calls to calculate_composite():\n")
    for file, weight_var in composite_calls:
        print(f"  {file}: calculate_composite(player, {weight_var})")

    # Summary
    print("\n" + "="*80)
    print("DIAGNOSTIC SUMMARY")
    print("="*80)

    print(f"\n1. Weight Definitions Found: {len(weights_found)}")
    print(f"2. Attributes Used: {len(coverage['used'])}/25")
    print(f"3. Attributes Missing: {len(coverage['missing'])}/25")
    print(f"4. Calculate Composite Calls: {len(composite_calls)}")

    if coverage['missing']:
        print(f"\nCRITICAL ISSUE: {len(coverage['missing'])} attributes are NOT being used!")
        print("This would explain low correlation between attributes and outcomes.")
        print("\nMissing attributes:")
        for attr in coverage['missing']:
            print(f"  - {attr}")

    # Check for attributes used in only 1 action
    underused = [attr for attr, count in coverage['usage_count'].items()
                 if count == 1 and count > 0]
    if underused:
        print(f"\nWARNING: {len(underused)} attributes used in only 1 action:")
        for attr in underused:
            print(f"  - {attr}")

    print("\n" + "="*80)
    print("NEXT STEPS")
    print("="*80)

    if coverage['missing']:
        print("\n1. Add missing attributes to appropriate weight dictionaries")
        print("2. Verify calculate_composite is being called for all actions")
        print("3. Re-run validation to test if correlation improves")
    else:
        print("\n1. All attributes are used - good!")
        print("2. Next: Verify calculate_composite is actually applying weights")
        print("3. Test with extreme attribute values to confirm impact")


if __name__ == "__main__":
    main()
