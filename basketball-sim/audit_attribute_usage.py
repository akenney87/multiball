"""
Audit all 25 attributes to see where they're currently used in gameplay.
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

# Search for weight dictionaries in all Python files
def find_attribute_usage():
    usage = {attr: [] for attr in ALL_ATTRIBUTES}

    # Search in src/systems for WEIGHTS_ dictionaries
    src_path = Path('src/systems')

    for py_file in src_path.glob('*.py'):
        content = py_file.read_text(encoding='utf-8')

        # Find all WEIGHTS_ dictionary definitions
        weight_pattern = r'(WEIGHTS_\w+)\s*=\s*\{([^}]+)\}'
        matches = re.finditer(weight_pattern, content, re.MULTILINE | re.DOTALL)

        for match in matches:
            weight_name = match.group(1)
            weight_content = match.group(2)

            # Check which attributes are in this weight dict
            for attr in ALL_ATTRIBUTES:
                if f"'{attr}'" in weight_content or f'"{attr}"' in weight_content:
                    usage[attr].append(f"{py_file.name}:{weight_name}")

    return usage

def main():
    print("=" * 80)
    print("ATTRIBUTE USAGE AUDIT - Current Gameplay Impact")
    print("=" * 80)
    print()

    usage = find_attribute_usage()

    # Group by usage count
    used = []
    unused = []

    for attr in ALL_ATTRIBUTES:
        locations = usage[attr]
        if locations:
            used.append((attr, locations))
        else:
            unused.append(attr)

    print(f"ATTRIBUTES IN USE: {len(used)}/25")
    print("-" * 80)
    for attr, locations in sorted(used, key=lambda x: len(x[1]), reverse=True):
        print(f"\n{attr}:")
        print(f"  Used in {len(locations)} weight dictionaries:")
        for loc in locations:
            print(f"    - {loc}")

    print()
    print("=" * 80)
    print(f"UNUSED ATTRIBUTES: {len(unused)}/25")
    print("-" * 80)
    if unused:
        for attr in unused:
            print(f"  - {attr}")
    else:
        print("  All attributes are used!")

    print()
    print("=" * 80)
    print("SUMMARY BY CATEGORY")
    print("=" * 80)

    categories = {
        'Physical': ['grip_strength', 'arm_strength', 'core_strength', 'agility',
                     'acceleration', 'top_speed', 'jumping', 'reactions',
                     'stamina', 'balance', 'height', 'durability'],
        'Mental': ['awareness', 'creativity', 'determination', 'bravery',
                   'consistency', 'composure', 'patience'],
        'Technical': ['hand_eye_coordination', 'throw_accuracy', 'form_technique',
                      'finesse', 'deception', 'teamwork']
    }

    for category, attrs in categories.items():
        used_in_cat = sum(1 for attr in attrs if usage[attr])
        print(f"\n{category}: {used_in_cat}/{len(attrs)} used")
        unused_in_cat = [attr for attr in attrs if not usage[attr]]
        if unused_in_cat:
            print(f"  Unused: {', '.join(unused_in_cat)}")

if __name__ == '__main__':
    main()
