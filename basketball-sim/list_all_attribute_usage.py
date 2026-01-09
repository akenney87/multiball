"""
Complete audit of all 25 attributes and their usage in weight dictionaries.
"""

import re
from pathlib import Path

# All 25 attributes
ALL_ATTRIBUTES = [
    # Physical (12)
    'grip_strength', 'arm_strength', 'core_strength', 'agility',
    'acceleration', 'top_speed', 'jumping', 'reactions',
    'stamina', 'balance', 'height', 'durability',
    # Mental (7)
    'awareness', 'creativity', 'determination', 'bravery',
    'consistency', 'composure', 'patience',
    # Technical (6)
    'hand_eye_coordination', 'throw_accuracy', 'form_technique',
    'finesse', 'deception', 'teamwork'
]

def extract_weights_from_constants():
    """Parse constants.py to extract all WEIGHTS_ dictionaries."""
    constants_path = Path('src/constants.py')
    content = constants_path.read_text(encoding='utf-8')

    # Find all WEIGHTS_ dictionary definitions
    # Pattern: WEIGHTS_NAME = { ... }
    pattern = r'(WEIGHTS_\w+)\s*=\s*\{([^}]+)\}'
    matches = re.finditer(pattern, content, re.MULTILINE | re.DOTALL)

    weights_dicts = {}
    for match in matches:
        weight_name = match.group(1)
        weight_content = match.group(2)

        # Extract attribute names and their weights
        attr_pattern = r"['\"](\w+)['\"]:\s*([\d.]+)"
        attrs = {}
        for attr_match in re.finditer(attr_pattern, weight_content):
            attr_name = attr_match.group(1)
            attr_weight = float(attr_match.group(2))
            attrs[attr_name] = attr_weight

        weights_dicts[weight_name] = attrs

    return weights_dicts

def extract_weights_from_fouls():
    """Parse fouls.py for any additional weight dictionaries."""
    fouls_path = Path('src/systems/fouls.py')
    content = fouls_path.read_text(encoding='utf-8')

    pattern = r'((?:SHOOTING_FOUL_)?WEIGHTS_\w+)\s*=\s*\{([^}]+)\}'
    matches = re.finditer(pattern, content, re.MULTILINE | re.DOTALL)

    weights_dicts = {}
    for match in matches:
        weight_name = match.group(1)
        weight_content = match.group(2)

        attr_pattern = r"['\"](\w+)['\"]:\s*([\d.]+)"
        attrs = {}
        for attr_match in re.finditer(attr_pattern, weight_content):
            attr_name = attr_match.group(1)
            attr_weight = float(attr_match.group(2))
            attrs[attr_name] = attr_weight

        weights_dicts[weight_name] = attrs

    return weights_dicts

def main():
    print("=" * 100)
    print("COMPLETE ATTRIBUTE USAGE REPORT")
    print("=" * 100)
    print()

    # Get all weight dictionaries
    constants_weights = extract_weights_from_constants()
    fouls_weights = extract_weights_from_fouls()

    all_weights = {**constants_weights, **fouls_weights}

    print(f"Total weight dictionaries found: {len(all_weights)}")
    print()

    # Build reverse index: attribute -> list of weight dicts
    attribute_usage = {attr: [] for attr in ALL_ATTRIBUTES}

    for weight_name, attrs in all_weights.items():
        for attr in attrs:
            if attr in attribute_usage:
                attribute_usage[attr].append(weight_name)

    # Print results
    print("=" * 100)
    print("ATTRIBUTE USAGE BY ATTRIBUTE")
    print("=" * 100)
    print()

    for attr in ALL_ATTRIBUTES:
        usage = attribute_usage[attr]
        if usage:
            print(f"{attr}:")
            print(f"  Used in {len(usage)} actions:")
            for weight_name in sorted(usage):
                action = weight_name.replace('WEIGHTS_', '').replace('_', ' ').title()
                print(f"    - {action}")
            print()
        else:
            print(f"{attr}: NOT USED")
            print()

    print("=" * 100)
    print("SUMMARY")
    print("=" * 100)

    used_count = sum(1 for attr in ALL_ATTRIBUTES if attribute_usage[attr])
    unused_count = 25 - used_count

    print(f"Used: {used_count}/25 ({used_count/25*100:.1f}%)")
    print(f"Unused: {unused_count}/25 ({unused_count/25*100:.1f}%)")
    print()

    print("Unused attributes:")
    for attr in ALL_ATTRIBUTES:
        if not attribute_usage[attr]:
            print(f"  - {attr}")

    print()
    print("=" * 100)
    print("ACTIONS AND THEIR ATTRIBUTES")
    print("=" * 100)
    print()

    for weight_name in sorted(all_weights.keys()):
        attrs = all_weights[weight_name]
        action = weight_name.replace('WEIGHTS_', '').replace('_', ' ').title()
        print(f"{action}:")
        print(f"  Attributes ({len(attrs)}):")
        for attr, weight in sorted(attrs.items(), key=lambda x: x[1], reverse=True):
            print(f"    {attr}: {weight}")
        print()

if __name__ == '__main__':
    main()
