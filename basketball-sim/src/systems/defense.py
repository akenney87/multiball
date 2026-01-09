"""
Basketball Simulator - Defense System

Handles defensive assignment, contest distance calculation, help defense,
and zone defense modifiers. All defensive mechanics flow through this module.
"""

import random
from typing import Dict, List, Any, Optional, Tuple

from ..core.probability import calculate_composite, sigmoid
from ..constants import (
    WEIGHTS_CONTEST,
    WEIGHTS_FIND_OPEN_TEAMMATE,
    WEIGHTS_SHOT_SEPARATION,
    WEIGHTS_HELP_DEFENSE_ROTATION,
    ZONE_DEFENSE_CONTEST_PENALTY,
    ZONE_DEFENSE_DRIVE_PENALTY,
    HELP_DEFENSE_AWARENESS_K,
    PATIENCE_DISTANCE_MODIFIER_SCALE,
    CONTEST_DISTANCE_SIGMA,
)


# =============================================================================
# DEFENSIVE ASSIGNMENT WEIGHTS
# =============================================================================

# Defensive assignment composite weights (Section 4.4)
DEFENSIVE_ASSIGNMENT_WEIGHTS = {
    'perimeter_defense': 0.40,
    'reactions': 0.30,
    'agility': 0.20,
    'awareness': 0.10,
}

# REMOVED: Old 3-attribute version of help defense weights
# Now using WEIGHTS_HELP_DEFENSE_ROTATION from constants.py (5-attribute version)

# Position compatibility scores for defensive assignments
POSITION_COMPATIBILITY = {
    # (offensive_pos, defensive_pos): compatibility_score
    ('PG', 'PG'): 1.0,  # Perfect match
    ('PG', 'SG'): 0.8,  # Good match
    ('PG', 'SF'): 0.5,  # Poor match
    ('PG', 'PF'): 0.2,  # Very poor
    ('PG', 'C'): 0.1,   # Terrible

    ('SG', 'PG'): 0.8,
    ('SG', 'SG'): 1.0,
    ('SG', 'SF'): 0.8,
    ('SG', 'PF'): 0.4,
    ('SG', 'C'): 0.2,

    ('SF', 'PG'): 0.5,
    ('SF', 'SG'): 0.8,
    ('SF', 'SF'): 1.0,
    ('SF', 'PF'): 0.8,
    ('SF', 'C'): 0.5,

    ('PF', 'PG'): 0.2,
    ('PF', 'SG'): 0.4,
    ('PF', 'SF'): 0.8,
    ('PF', 'PF'): 1.0,
    ('PF', 'C'): 0.9,

    ('C', 'PG'): 0.1,
    ('C', 'SG'): 0.2,
    ('C', 'SF'): 0.5,
    ('C', 'PF'): 0.9,
    ('C', 'C'): 1.0,
}


# =============================================================================
# DEFENSIVE ASSIGNMENT
# =============================================================================

def assign_zone_defender_by_location(
    shot_type: str,
    defensive_team: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Assign zone defender based on shot LOCATION, not shooter position.

    Implements NBA-realistic zone defense principles:
    - 3PT shots: Perimeter defenders rotate (guards/wings)
    - Rim shots: Paint defenders protect (bigs)
    - Midrange: Forwards typically defend

    Args:
        shot_type: '3pt', 'midrange', 'rim', 'dunk', 'layup'
        defensive_team: Full defensive team (5 players)

    Returns:
        Best defender for that shot location (dict)

    Algorithm:
    1. Filter eligible defenders by shot location
    2. Weight by relevant defensive attributes
    3. Select best weighted defender (with slight randomness)

    Examples:
        - 3PT attempt: 85-90% chance guard/wing defends
        - Rim attempt: 75-85% chance big defends
        - Midrange: 60% forwards, 30% guards, 10% bigs
    """
    import random

    # Normalize shot_type (dunk/layup → rim)
    if shot_type in ['dunk', 'layup']:
        shot_location = 'rim'
    else:
        shot_location = shot_type

    # Filter eligible defenders based on shot location
    if shot_location == '3pt':
        # Perimeter defenders: prioritize guards and wings
        perimeter = [p for p in defensive_team if p['position'] in ['PG', 'SG', 'SF', 'PF']]

        if perimeter:
            # Weight by perimeter defensive attributes (agility + speed + reactions)
            weights = []
            for p in perimeter:
                weight = (p['agility'] + p['top_speed'] + p['reactions']) / 3
                weights.append(weight)

            # Select defender (weighted random with 80% best, 20% variance)
            best_idx = weights.index(max(weights))
            if random.random() < 0.80:
                return perimeter[best_idx].copy()
            else:
                # Occasionally not the best (rotations, late closeouts)
                return random.choice(perimeter).copy()
        else:
            # Fallback if no perimeter defenders (shouldn't happen)
            return random.choice(defensive_team).copy()

    elif shot_location == 'rim':
        # Paint defenders: prioritize bigs
        bigs = [p for p in defensive_team if p['position'] in ['PF', 'C']]

        if bigs:
            # Weight by rim protection attributes (jumping + height + reactions)
            weights = []
            for p in bigs:
                weight = (p['jumping'] + p['height'] + p['reactions']) / 3
                weights.append(weight)

            # Select defender (weighted random with 85% best, 15% variance)
            best_idx = weights.index(max(weights))
            if random.random() < 0.85:
                return bigs[best_idx].copy()
            else:
                # Occasionally not the best (help from weak side, small-ball)
                return random.choice(bigs).copy()
        else:
            # Fallback if no bigs (small-ball lineup)
            return random.choice(defensive_team).copy()

    else:  # midrange
        # Midrange: bias toward forwards, but more random
        forwards = [p for p in defensive_team if p['position'] in ['SF', 'PF', 'SG']]

        if forwards:
            # 70% chance forward defends, 30% chance anyone
            if random.random() < 0.70:
                return random.choice(forwards).copy()
            else:
                return random.choice(defensive_team).copy()
        else:
            return random.choice(defensive_team).copy()


def assign_defender(
    offensive_player: Dict[str, Any],
    defensive_team: List[Dict[str, Any]],
    available_defenders: List[str],
) -> Dict[str, Any]:
    """
    Assign best available defender to offensive player.

    Uses position compatibility and defensive composite to determine
    optimal matchup when manual assignments are not provided.

    Args:
        offensive_player: Offensive player dict
        defensive_team: Full defensive team (list of 5 players)
        available_defenders: List of defender names still available

    Returns:
        Defender dict with debug info attached

    Algorithm:
    1. Filter defensive_team to only available defenders
    2. For each available defender:
       - Calculate position compatibility score
       - Calculate defensive composite (perimeter_defense, reactions, agility, awareness)
       - Combined score = compatibility * 0.6 + (composite / 100) * 0.4
    3. Return defender with highest combined score
    """
    if not available_defenders:
        raise ValueError("No available defenders to assign")

    # Filter to available defenders only
    available = [p for p in defensive_team if p['name'] in available_defenders]

    if not available:
        raise ValueError(
            f"None of the specified defenders found: {available_defenders}"
        )

    offensive_pos = offensive_player['position']

    # Score each available defender
    best_defender = None
    best_score = -1.0
    debug_scores = {}

    for defender in available:
        defensive_pos = defender['position']

        # Position compatibility
        compatibility = POSITION_COMPATIBILITY.get(
            (offensive_pos, defensive_pos),
            0.5  # Default to average if not found
        )

        # Calculate defensive composite
        # Note: 'perimeter_defense' is not a standard attribute in our 25-attribute model
        # We'll use related attributes: reactions, agility, awareness, and add height as proxy
        defensive_composite = calculate_composite(
            defender,
            {
                'reactions': 0.40,
                'agility': 0.30,
                'awareness': 0.20,
                'height': 0.10,
            }
        )

        # Combined score
        score = compatibility * 0.6 + (defensive_composite / 100.0) * 0.4

        debug_scores[defender['name']] = {
            'position': defensive_pos,
            'compatibility': compatibility,
            'defensive_composite': defensive_composite,
            'combined_score': score,
        }

        if score > best_score:
            best_score = score
            best_defender = defender

    # Attach debug info
    result = best_defender.copy()
    result['_assignment_debug'] = {
        'offensive_player': offensive_player['name'],
        'offensive_position': offensive_pos,
        'all_scores': debug_scores,
        'selected': best_defender['name'],
        'selected_score': best_score,
    }

    return result


# =============================================================================
# CONTEST DISTANCE CALCULATION
# =============================================================================

def calculate_contest_distance(
    defender: Dict[str, Any],
    is_help_defense: bool = False,
    zone_pct: float = 0.0,
    passer: Optional[Dict[str, Any]] = None,
    shooter: Optional[Dict[str, Any]] = None,
    shot_type: str = 'midrange',
) -> float:
    """
    Calculate how close defender gets to contest the shot.

    Formula (from task specification):
        distance = 10 - (defender_composite / 10)

    Where defender_composite uses WEIGHTS_CONTEST (height, reactions, agility).

    ATTRIBUTE EXPANSIONS:
        - creativity: If passer provided (kickout), use WEIGHTS_FIND_OPEN_TEAMMATE
          to increase contest distance (find wider open teammates)
        - deception: If shooter provided, use WEIGHTS_SHOT_SEPARATION to increase
          contest distance (create separation with moves/fakes)

    Args:
        defender: Defender dict
        is_help_defense: If True, add +3 ft penalty
        zone_pct: Zone defense percentage (0-100), affects contest quality
        passer: Optional passer dict (for kickouts) - adds creativity bonus
        shooter: Optional shooter dict - adds deception/separation bonus
        shot_type: Type of shot ('3pt', 'midrange', 'rim', 'layup', 'dunk')

    Returns:
        Distance in feet (float)

    Examples:
        Elite defender (90 composite): 10 - (90/10) = 1.0 ft (heavily contested)
        Average defender (50 composite): 10 - (50/10) = 5.0 ft (contested)
        Poor defender (30 composite): 10 - (30/10) = 7.0 ft (wide open)
    """
    # Calculate defender's contest composite
    defender_composite = calculate_composite(defender, WEIGHTS_CONTEST)

    # Base distance formula
    base_distance = 10.0 - (defender_composite / 10.0)

    # PHASE 1: Acceleration-based closeout modifier
    # Fast defenders close out more quickly, reducing effective contest distance
    # Formula: (acceleration - 50) * -0.02 for ±1.0 ft at ±50 acceleration difference
    defender_acceleration = defender.get('acceleration', 50)
    acceleration_closeout_modifier = (defender_acceleration - 50) * -0.02
    base_distance += acceleration_closeout_modifier

    # Apply help defense penalty
    if is_help_defense:
        base_distance += 3.0

    # M4.6 UPDATE: Zone defense affects perimeter and paint differently
    # Perimeter (3PT/midrange): Zone WEAKENS contests (gaps in zone, +distance)
    # Paint (rim/layup/dunk): Zone STRENGTHENS contests (packed paint, -distance)
    if zone_pct > 0:
        zone_modifier = zone_pct / 100.0  # Convert to 0-1 scale

        # Normalize shot type
        normalized_shot_type = shot_type.lower()
        is_rim_shot = normalized_shot_type in ['rim', 'layup', 'dunk']

        if is_rim_shot:
            # Zone packs the paint - STRONGER rim contest (reduce distance)
            # At 100% zone: -1.5 ft (elite defender goes from 1.0ft to -0.5ft, clamped to 0)
            zone_distance_penalty = -1.5 * zone_modifier
        else:
            # Zone leaves gaps on perimeter - WEAKER perimeter contest (increase distance)
            # At 100% zone: +1.5 ft (defender 5.0ft becomes 6.5ft)
            zone_distance_penalty = 1.5 * zone_modifier

        base_distance += zone_distance_penalty

    # ATTRIBUTE EXPANSION: Creativity - finding open teammates on kickouts
    # DISABLED: Adding variance to contest distance hurts correlation
    # Creative passers (high creativity/awareness/teamwork) find wider open teammates
    # if passer is not None:
    #     passer_composite = calculate_composite(passer, WEIGHTS_FIND_OPEN_TEAMMATE)
    #     # Higher passer composite = wider open shot for teammate
    #     # Formula: (passer_composite - 50) * 0.01 for ±0.5 ft at ±50 difference
    #     creativity_bonus = (passer_composite - 50) * 0.01
    #     base_distance += creativity_bonus

    # ATTRIBUTE EXPANSION: Deception - creating shot separation
    # DISABLED: Adding variance to contest distance hurts correlation
    # Deceptive shooters (deception/agility/acceleration/creativity) create space
    # if shooter is not None:
    #     shooter_composite = calculate_composite(shooter, WEIGHTS_SHOT_SEPARATION)
    #     # Higher shooter composite = better at creating separation
    #     # Formula: (shooter_composite - 50) * 0.008 for ±0.4 ft at ±50 difference
    #     deception_bonus = (shooter_composite - 50) * 0.008
    #     base_distance += deception_bonus

    # PHASE 3A: Patience Contest Distance Modifier
    # Patient shooters make defenders think they're not ready, gaining more space
    # Higher patience = further contest distance (easier shots)
    if shooter is not None:
        patience = shooter.get('patience', 50)
        patience_modifier = (patience - 50) * PATIENCE_DISTANCE_MODIFIER_SCALE
        base_distance += patience_modifier
        # patience=90: +0.8ft (defenders give more space)
        # patience=50: +0.0ft (baseline)
        # patience=10: -0.8ft (rushed, defenders crowd)

    # Contest Distance Variance: Add Gaussian noise for realistic distribution
    # Adds variance to achieve NBA playoff-intensity contest distribution
    # Target: ~30% wide open, ~35% open, ~25% tight, ~10% very tight
    # Without variance: 96.4% contested (too deterministic)
    # With variance: Achieves target distribution while maintaining attribute influence
    variance = random.gauss(0, CONTEST_DISTANCE_SIGMA)
    base_distance += variance

    # Clamp to realistic range [0.5, 10.0 feet]
    final_distance = max(0.5, min(10.0, base_distance))

    return final_distance


# =============================================================================
# HELP DEFENSE
# =============================================================================

def select_help_defender(
    defensive_team: List[Dict[str, Any]],
    primary_defender: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """
    Select best available help defender when primary defender is beaten.

    Uses HELP_DEFENSE_WEIGHTS (height, reactions, agility) to determine
    which defender provides best help defense.

    Args:
        defensive_team: Full defensive team (list of 5 players)
        primary_defender: The primary defender who was beaten

    Returns:
        Best help defender dict, or None if no valid help available

    Algorithm:
    1. Exclude primary defender from consideration
    2. Calculate help defense composite for each remaining defender
    3. For each defender, roll probability based on awareness:
       P = sigmoid(-k * (awareness - 50)) where k = 0.05
    4. Return first defender who successfully rotates
    5. If multiple rotate, return highest composite (best interior defender)
    """
    # Filter out primary defender
    available_helpers = [
        p for p in defensive_team
        if p['name'] != primary_defender['name']
    ]

    if not available_helpers:
        return None

    # Calculate help defense composite for each potential helper
    helper_candidates = []

    for helper in available_helpers:
        # Calculate help defense ability using 5-attribute version from constants
        help_composite = calculate_composite(helper, WEIGHTS_HELP_DEFENSE_ROTATION)

        # ORIGINAL (PRE-EXPANSION) FORMULA: Use awareness for rotation probability
        # P = sigmoid(-k * (awareness - 50))
        # Lower awareness → higher rotation probability (willing to help but maybe wrong timing)
        # Higher awareness → lower rotation probability (staying disciplined on assignment)
        awareness = helper.get('awareness', 50)
        rotation_prob = sigmoid(-HELP_DEFENSE_AWARENESS_K * (awareness - 50))

        # Roll to see if this defender rotates
        rotates = random.random() < rotation_prob

        helper_candidates.append({
            'player': helper,
            'composite': help_composite,
            'awareness': awareness,
            'rotation_prob': rotation_prob,
            'rotates': rotates,
        })

    # Filter to only those who rotated
    rotators = [h for h in helper_candidates if h['rotates']]

    if not rotators:
        return None

    # Return best (highest composite) rotator
    best_rotator = max(rotators, key=lambda h: h['composite'])

    # Attach debug info
    result = best_rotator['player'].copy()
    result['_help_defense_debug'] = {
        'primary_defender': primary_defender['name'],
        'all_candidates': [
            {
                'name': h['player']['name'],
                'composite': h['composite'],
                'awareness': h['awareness'],
                'rotation_prob': h['rotation_prob'],
                'rotated': h['rotates'],
            }
            for h in helper_candidates
        ],
        'selected_helper': best_rotator['player']['name'],
        'selected_composite': best_rotator['composite'],
    }

    return result


# =============================================================================
# ZONE DEFENSE MODIFIERS
# =============================================================================

def apply_zone_modifiers(
    base_contest_effectiveness: float,
    zone_pct: float,
) -> float:
    """
    Apply zone defense modifiers to contest effectiveness.

    Zone defense effects (from constants):
    - -15% to contest effectiveness on perimeter shots
    - This is applied proportionally based on zone_pct

    Args:
        base_contest_effectiveness: Base contest quality (0-1 scale)
        zone_pct: Zone defense percentage (0-100)

    Returns:
        Modified contest effectiveness

    Example:
        base = 0.80 (strong contest)
        zone_pct = 100 (full zone)
        result = 0.80 + (-0.15) = 0.65 (weaker contest due to zone)
    """
    if zone_pct <= 0:
        return base_contest_effectiveness

    # Convert zone_pct to 0-1 scale
    zone_factor = zone_pct / 100.0

    # Apply contest penalty proportionally
    # ZONE_DEFENSE_CONTEST_PENALTY = -0.15
    zone_penalty = ZONE_DEFENSE_CONTEST_PENALTY * zone_factor

    # Apply penalty (additive)
    modified_effectiveness = base_contest_effectiveness + zone_penalty

    # Clamp to [0, 1]
    return max(0.0, min(1.0, modified_effectiveness))


def get_zone_drive_modifier(zone_pct: float) -> float:
    """
    Get drive success modifier based on zone defense percentage.

    Zone defense effects (from constants):
    - -10% to drive success rate
    - Applied proportionally based on zone_pct

    Args:
        zone_pct: Zone defense percentage (0-100)

    Returns:
        Drive modifier as multiplier (e.g., 0.90 = -10% success)

    Example:
        zone_pct = 100 → returns 0.90 (10% penalty)
        zone_pct = 50 → returns 0.95 (5% penalty)
        zone_pct = 0 → returns 1.00 (no penalty)
    """
    if zone_pct <= 0:
        return 1.0

    # Convert zone_pct to 0-1 scale
    zone_factor = zone_pct / 100.0

    # ZONE_DEFENSE_DRIVE_PENALTY = -0.10
    penalty = ZONE_DEFENSE_DRIVE_PENALTY * zone_factor

    # Return as multiplier (1.0 + negative penalty)
    return 1.0 + penalty


# =============================================================================
# INTEGRATED DEFENSE COORDINATOR
# =============================================================================

def get_primary_defender(
    shooter: Dict[str, Any],
    defensive_team: List[Dict[str, Any]],
    defensive_assignments: Dict[str, str],
    defense_type: str,
    shot_type: Optional[str] = None
) -> Dict[str, Any]:
    """
    Determine primary contest defender based on defense type.

    This is the main entry point for defensive assignment during possession.

    Args:
        shooter: Offensive player taking the shot
        defensive_team: Full defensive team (5 players)
        defensive_assignments: Manual assignments dict {offensive_name: defensive_name}
        defense_type: 'man' or 'zone'
        shot_type: Shot location ('3pt', 'midrange', 'rim', 'dunk', 'layup') - used for zone defense

    Returns:
        Primary defender dict with debug info

    Algorithm:
    Man Defense:
    1. Check if shooter has manual assignment in defensive_assignments
    2. If yes and defender is available: use that defender
    3. If no/invalid: fallback to position-based matching via assign_defender

    Zone Defense (Location-Based):
    1. If shot_type provided: assign defender based on shot LOCATION, not shooter position
       - 3PT shots: guards/wings defend (PG/SG/SF/PF)
       - Rim shots (dunk/layup): bigs defend (PF/C)
       - Midrange: bias toward forwards (SF/PF/SG)
    2. If no shot_type: fallback to position-based matching
    3. Use weighted selection based on defensive attributes
    """
    shooter_name = shooter['name']

    if defense_type == 'man':
        # Check for manual assignment
        if shooter_name in defensive_assignments:
            assigned_defender_name = defensive_assignments[shooter_name]

            # Find defender in defensive_team
            assigned_defender = None
            for defender in defensive_team:
                if defender['name'] == assigned_defender_name:
                    assigned_defender = defender
                    break

            if assigned_defender:
                # Valid manual assignment
                result = assigned_defender.copy()
                result['_assignment_type'] = 'manual'
                result['_assignment_debug'] = {
                    'shooter': shooter_name,
                    'assigned_defender': assigned_defender_name,
                    'assignment_source': 'manual',
                }
                return result

        # Fallback to position-based
        available_defenders = [p['name'] for p in defensive_team]
        defender = assign_defender(shooter, defensive_team, available_defenders)
        defender['_assignment_type'] = 'position_fallback'
        return defender

    elif defense_type == 'zone':
        # Zone defense: location-based matching if shot_type provided
        if shot_type:
            defender = assign_zone_defender_by_location(
                shot_type=shot_type,
                defensive_team=defensive_team
            )
            defender['_assignment_type'] = 'zone_location'
            return defender
        else:
            # Fallback to position-based if no shot type yet
            available_defenders = [p['name'] for p in defensive_team]
            defender = assign_defender(shooter, defensive_team, available_defenders)
            defender['_assignment_type'] = 'zone_proximity'
            return defender

    else:
        raise ValueError(f"Invalid defense_type: {defense_type}. Must be 'man' or 'zone'")


def calculate_contest_quality(
    defender: Dict[str, Any],
    contest_distance: float,
) -> float:
    """
    Calculate overall contest quality based on defender ability and distance.

    Used to determine if help defense is needed.

    Args:
        defender: Defender dict
        contest_distance: Distance in feet

    Returns:
        Contest quality score (0-1 scale)
        0 = no contest, 1 = perfect contest

    Algorithm:
    1. Calculate defender composite
    2. Convert distance to contest factor:
       - < 2 ft: 1.0 (heavy contest)
       - 2-6 ft: 0.5 (contested)
       - >= 6 ft: 0.1 (wide open)
    3. Combine: quality = (composite / 100) * distance_factor
    """
    # Calculate defender composite
    defender_composite = calculate_composite(defender, WEIGHTS_CONTEST)

    # Distance factor
    if contest_distance < 2.0:
        distance_factor = 1.0  # Heavy contest
    elif contest_distance < 6.0:
        distance_factor = 0.5  # Contested
    else:
        distance_factor = 0.1  # Wide open

    # Combined quality
    quality = (defender_composite / 100.0) * distance_factor

    return max(0.0, min(1.0, quality))


# =============================================================================
# DEBUG UTILITIES
# =============================================================================

def format_defense_debug(defender: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract and format all defensive debug information.

    Args:
        defender: Defender dict (may have debug keys attached)

    Returns:
        Formatted debug dict
    """
    debug = {
        'defender_name': defender['name'],
        'defender_position': defender['position'],
    }

    # Extract debug keys
    if '_assignment_type' in defender:
        debug['assignment_type'] = defender['_assignment_type']

    if '_assignment_debug' in defender:
        debug['assignment_details'] = defender['_assignment_debug']

    if '_help_defense_debug' in defender:
        debug['help_defense'] = defender['_help_defense_debug']

    return debug
