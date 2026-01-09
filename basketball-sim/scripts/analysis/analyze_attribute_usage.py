"""
Analyze which attributes are actually used in game mechanics and their weights.
"""

from src.constants import *

# Collect all WEIGHTS_* constants
weights_constants = {}
for name in dir():
    if name.startswith('WEIGHTS_'):
        obj = eval(name)
        if isinstance(obj, dict):
            weights_constants[name] = obj

# Count how often each attribute appears and total weight
attribute_usage = {}
for const_name, weights in weights_constants.items():
    for attr, weight in weights.items():
        if attr not in attribute_usage:
            attribute_usage[attr] = {'count': 0, 'total_weight': 0.0, 'used_in': []}
        attribute_usage[attr]['count'] += 1
        attribute_usage[attr]['total_weight'] += weight
        attribute_usage[attr]['used_in'].append(f'{const_name[8:]}: {weight:.2f}')

# Sort by total weight (descending)
sorted_attrs = sorted(attribute_usage.items(), key=lambda x: x[1]['total_weight'], reverse=True)

print('ATTRIBUTE USAGE IN GAME MECHANICS')
print('=' * 80)
print(f'{"Attribute":<25} {"Contexts":<10} {"Total Weight":<15}')
print('-' * 80)

for attr, data in sorted_attrs:
    print(f'{attr:<25} {data["count"]:<10} {data["total_weight"]:<15.2f}')

print('\n' + '=' * 80)
print('ATTRIBUTES NOT USED IN ANY GAME MECHANICS:')
print('=' * 80)

all_attributes = ['grip_strength', 'arm_strength', 'core_strength', 'agility', 'acceleration',
                  'top_speed', 'jumping', 'reactions', 'stamina', 'balance', 'height', 'durability',
                  'awareness', 'creativity', 'determination', 'bravery', 'consistency', 'composure',
                  'patience', 'hand_eye_coordination', 'throw_accuracy', 'form_technique', 'finesse',
                  'deception', 'teamwork']

unused = [attr for attr in all_attributes if attr not in attribute_usage]
for attr in unused:
    print(f'  - {attr}')

print('\n' + '=' * 80)
print('NORMALIZED ATTRIBUTE IMPORTANCE (for overall rating)')
print('=' * 80)

# Normalize total weights to create an overall rating formula
total_weight_sum = sum(data['total_weight'] for _, data in sorted_attrs)
normalized_weights = {}

for attr, data in sorted_attrs:
    normalized_weights[attr] = data['total_weight'] / total_weight_sum

print(f'{"Attribute":<25} {"Weight %":<15}')
print('-' * 80)
for attr in sorted(normalized_weights.keys(), key=lambda x: normalized_weights[x], reverse=True):
    print(f'{attr:<25} {normalized_weights[attr]*100:>14.2f}%')
