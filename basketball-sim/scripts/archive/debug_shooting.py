"""Debug shooting probabilities."""

from src.systems.shooting import attempt_3pt_shot
from src.core.data_structures import PossessionContext
from src.core.probability import set_seed


def create_elite_shooter():
    return {
        'name': 'Elite Shooter',
        'position': 'PG',
        'form_technique': 97,
        'throw_accuracy': 98,
        'finesse': 95,
        'hand_eye_coordination': 96,
        'balance': 92,
        'composure': 94,
        'consistency': 93,
        'agility': 90,
        'jumping': 75,
        'height': 75,
        'arm_strength': 70,
        'awareness': 95,
        'reactions': 92,
        'grip_strength': 70,
        'core_strength': 70,
        'acceleration': 85,
        'top_speed': 80,
        'stamina': 90,
        'durability': 85,
        'creativity': 90,
        'determination': 95,
        'bravery': 80,
        'patience': 90,
        'deception': 85,
        'teamwork': 92,
    }


def create_poor_defender():
    return {
        'name': 'Poor Defender',
        'position': 'PG',
        'height': 72,
        'reactions': 30,
        'agility': 35,
        'awareness': 28,
        'top_speed': 40,
        'jumping': 40,
        'arm_strength': 30,
        'core_strength': 35,
        'balance': 40,
        'stamina': 60,
        'form_technique': 70,
        'throw_accuracy': 75,
        'finesse': 65,
        'hand_eye_coordination': 70,
        'composure': 60,
        'consistency': 55,
        'grip_strength': 35,
        'acceleration': 45,
        'durability': 50,
        'creativity': 60,
        'determination': 55,
        'bravery': 50,
        'patience': 65,
        'deception': 60,
        'teamwork': 70,
    }


set_seed(42)

elite_shooter = create_elite_shooter()
poor_defender = create_poor_defender()
context = PossessionContext(is_transition=False)

success, debug = attempt_3pt_shot(
    shooter=elite_shooter,
    defender=poor_defender,
    contest_distance=6.0,  # Wide open
    possession_context=context,
    defense_type='man'
)

print("=== DEBUG INFO ===")
for key, value in debug.items():
    print(f"{key}: {value}")

print("\n=== ANALYSIS ===")
print(f"Shooter composite: {debug['shooter_composite']}")
print(f"Defender composite: {debug['defender_composite']}")
print(f"Attribute diff: {debug['attribute_diff']}")
print(f"Base rate: {debug['base_rate']}")
print(f"Base success (before contest): {debug['base_success']}")
print(f"Contest penalty: {debug['contest_penalty']}")
print(f"Final success rate: {debug['final_success_rate']}")
