"""
Test Q1 rotation system to diagnose issues.
Simulates just Q1 with Lakers roster setup matching user's description.
"""
import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from src.core.data_structures import TacticalSettings, create_player
from src.systems.quarter_simulation import QuarterSimulator
import random

# Create Lakers-like roster (using real names from user's description)
def create_lakers_roster():
    """Create 10-player Lakers roster matching user's description."""
    # Starters (32 min)
    lebron = create_player(
        name="LeBron James", position="SF",
        grip_strength=85, arm_strength=85, core_strength=90,
        agility=75, acceleration=75, top_speed=75, jumping=80,
        reactions=85, stamina=80, balance=80, height=80,
        durability=85, awareness=90, creativity=90,
        determination=85, bravery=85, consistency=85,
        composure=90, patience=85, hand_eye_coordination=85,
        throw_accuracy=75, form_technique=75, finesse=80,
        deception=85, teamwork=90
    )

    ad = create_player(
        name="Anthony Davis", position="PF",
        grip_strength=80, arm_strength=80, core_strength=85,
        agility=75, acceleration=75, top_speed=75, jumping=90,
        reactions=85, stamina=75, balance=75, height=85,
        durability=70, awareness=85, creativity=75,
        determination=80, bravery=80, consistency=75,
        composure=80, patience=75, hand_eye_coordination=80,
        throw_accuracy=70, form_technique=75, finesse=75,
        deception=75, teamwork=80
    )

    austin = create_player(
        name="Austin Reaves", position="SG",
        grip_strength=70, arm_strength=65, core_strength=70,
        agility=70, acceleration=70, top_speed=70, jumping=65,
        reactions=75, stamina=75, balance=70, height=70,
        durability=75, awareness=80, creativity=75,
        determination=80, bravery=75, consistency=70,
        composure=75, patience=75, hand_eye_coordination=75,
        throw_accuracy=75, form_technique=80, finesse=75,
        deception=70, teamwork=80
    )

    dlo = create_player(
        name="D'Angelo Russell", position="PG",
        grip_strength=70, arm_strength=65, core_strength=70,
        agility=75, acceleration=75, top_speed=75, jumping=70,
        reactions=80, stamina=70, balance=70, height=70,
        durability=70, awareness=80, creativity=85,
        determination=70, bravery=70, consistency=65,
        composure=70, patience=75, hand_eye_coordination=80,
        throw_accuracy=80, form_technique=85, finesse=80,
        deception=80, teamwork=75
    )

    jaxson = create_player(
        name="Jaxson Hayes", position="C",
        grip_strength=75, arm_strength=80, core_strength=80,
        agility=70, acceleration=70, top_speed=70, jumping=85,
        reactions=70, stamina=75, balance=70, height=85,
        durability=75, awareness=70, creativity=60,
        determination=75, bravery=75, consistency=70,
        composure=70, patience=70, hand_eye_coordination=70,
        throw_accuracy=60, form_technique=65, finesse=65,
        deception=65, teamwork=75
    )

    # Bench rotation players (18 or 13 min)
    rui = create_player(
        name="Rui Hachimura", position="PF",
        grip_strength=75, arm_strength=75, core_strength=75,
        agility=70, acceleration=70, top_speed=70, jumping=75,
        reactions=70, stamina=75, balance=70, height=80,
        durability=75, awareness=70, creativity=65,
        determination=75, bravery=75, consistency=70,
        composure=70, patience=70, hand_eye_coordination=70,
        throw_accuracy=70, form_technique=75, finesse=70,
        deception=70, teamwork=70
    )

    gabe = create_player(
        name="Gabe Vincent", position="PG",
        grip_strength=65, arm_strength=60, core_strength=65,
        agility=75, acceleration=75, top_speed=75, jumping=65,
        reactions=75, stamina=75, balance=70, height=65,
        durability=70, awareness=75, creativity=70,
        determination=75, bravery=70, consistency=70,
        composure=70, patience=70, hand_eye_coordination=70,
        throw_accuracy=70, form_technique=70, finesse=70,
        deception=70, teamwork=75
    )

    max = create_player(
        name="Max Christie", position="SG",
        grip_strength=65, arm_strength=60, core_strength=65,
        agility=70, acceleration=70, top_speed=70, jumping=70,
        reactions=70, stamina=75, balance=70, height=70,
        durability=75, awareness=70, creativity=65,
        determination=70, bravery=70, consistency=65,
        composure=65, patience=65, hand_eye_coordination=70,
        throw_accuracy=70, form_technique=70, finesse=70,
        deception=65, teamwork=70
    )

    jarred = create_player(
        name="Jarred Vanderbilt", position="SF",
        grip_strength=70, arm_strength=70, core_strength=75,
        agility=75, acceleration=75, top_speed=75, jumping=80,
        reactions=75, stamina=80, balance=75, height=75,
        durability=75, awareness=75, creativity=60,
        determination=80, bravery=80, consistency=70,
        composure=70, patience=65, hand_eye_coordination=65,
        throw_accuracy=60, form_technique=60, finesse=60,
        deception=65, teamwork=75
    )

    jalen = create_player(
        name="Jalen Hood-Schifino", position="PG",
        grip_strength=60, arm_strength=55, core_strength=60,
        agility=70, acceleration=70, top_speed=70, jumping=65,
        reactions=70, stamina=75, balance=65, height=70,
        durability=70, awareness=70, creativity=65,
        determination=70, bravery=65, consistency=60,
        composure=65, patience=65, hand_eye_coordination=65,
        throw_accuracy=65, form_technique=65, finesse=65,
        deception=65, teamwork=70
    )

    # Cam Reddish - should NOT play (0.5 min)
    cam = create_player(
        name="Cam Reddish", position="SF",
        grip_strength=65, arm_strength=65, core_strength=70,
        agility=70, acceleration=70, top_speed=70, jumping=75,
        reactions=70, stamina=75, balance=70, height=75,
        durability=70, awareness=70, creativity=65,
        determination=65, bravery=65, consistency=60,
        composure=65, patience=65, hand_eye_coordination=65,
        throw_accuracy=65, form_technique=70, finesse=70,
        deception=70, teamwork=65
    )

    return [lebron, ad, austin, dlo, jaxson, rui, gabe, max, jarred, jalen, cam]

# Create generic opponent
def create_opponent_roster():
    """Create generic opponent roster."""
    players = []
    positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C']
    for i, pos in enumerate(positions):
        is_starter = i < 5
        rating = 75 + (5 if is_starter else -5)
        player = create_player(
            name=f"Opponent_{i+1}_{pos}",
            position=pos,
            grip_strength=rating, arm_strength=rating, core_strength=rating,
            agility=rating, acceleration=rating, top_speed=rating, jumping=rating,
            reactions=rating, stamina=rating, balance=rating,
            height=75 if pos in ['PG','SG'] else 85 if pos=='SF' else 90,
            durability=rating, awareness=rating, creativity=rating,
            determination=rating, bravery=rating, consistency=rating,
            composure=rating, patience=rating, hand_eye_coordination=rating,
            throw_accuracy=rating, form_technique=rating, finesse=rating,
            deception=rating, teamwork=rating
        )
        players.append(player)
    return players

# Create minutes allocation matching user's description
def create_lakers_minutes(roster):
    """
    Lakers minutes allocation:
    - 5 starters: 32 min each
    - 3 bench: 18 min each (Rui, Gabe, Max)
    - 2 bench: 13 min each (Jarred, Jalen)
    - 1 DNP: 0.5 min (Cam Reddish - should NOT play)
    """
    return {
        roster[0]['name']: 32,  # LeBron
        roster[1]['name']: 32,  # AD
        roster[2]['name']: 32,  # Austin
        roster[3]['name']: 32,  # D'Angelo
        roster[4]['name']: 32,  # Jaxson
        roster[5]['name']: 18,  # Rui
        roster[6]['name']: 18,  # Gabe
        roster[7]['name']: 18,  # Max
        roster[8]['name']: 13,  # Jarred
        roster[9]['name']: 13,  # Jalen
        roster[10]['name']: 0.5  # Cam (should NOT play in Q1)
    }

def create_generic_minutes(roster):
    """Generic minutes for opponent."""
    allotment = {}
    for i in range(5): allotment[roster[i]['name']] = 32
    for i in range(5,8): allotment[roster[i]['name']] = 18
    for i in range(8,10): allotment[roster[i]['name']] = 13
    return allotment

# Run Q1 test
if __name__ == "__main__":
    random.seed(42)

    lakers = create_lakers_roster()
    opponent = create_opponent_roster()

    lakers_minutes = create_lakers_minutes(lakers)
    opponent_minutes = create_generic_minutes(opponent)

    print("="*80)
    print("Q1 ROTATION TEST - Lakers Roster")
    print("="*80)
    print("\nLakers Minutes Allocation (Q1 = Game/4):")
    for player_name, total_min in lakers_minutes.items():
        q1_min = total_min / 4.0
        print(f"  {player_name}: {total_min} min/game -> {q1_min:.2f} min in Q1")

    print("\n" + "="*80)
    print("Expected behavior in Q1:")
    print("="*80)
    print("1. ALL 5 starters should have rotation plans (LeBron, AD, Austin, D'Angelo, Jaxson)")
    print("2. ALL bench players >2.0 min should have rotation plans (Rui, Gabe, Max, Jarred, Jalen)")
    print("3. Cam Reddish (0.5 min / 0.125 min Q1) should NOT play")
    print("4. ALL 5 starters should sub out at designated times")
    print("5. ALL 5 eligible bench players should sub in")
    print("\n" + "="*80)

    # Create tactical settings
    lakers_tactics = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1="LeBron James",
        scoring_option_2="Anthony Davis",
        scoring_option_3="D'Angelo Russell",
        minutes_allotment=lakers_minutes,
        rebounding_strategy='standard'
    )

    opponent_tactics = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=opponent[0]['name'],
        scoring_option_2=opponent[1]['name'],
        scoring_option_3=opponent[2]['name'],
        minutes_allotment=opponent_minutes,
        rebounding_strategy='standard'
    )

    # Simulate Q1
    print("Simulating Q1...")
    print("="*80 + "\n")

    sim = QuarterSimulator(
        home_roster=lakers,
        away_roster=opponent,
        tactical_home=lakers_tactics,
        tactical_away=opponent_tactics,
        home_team_name="Lakers",
        away_team_name="Opponent",
        quarter_number=1
    )

    result = sim.simulate_quarter(seed=42)

    # Analyze result
    print("\n" + "="*80)
    print("Q1 RESULTS ANALYSIS")
    print("="*80)

    print(f"\nScore: Lakers {result.home_score}, Opponent {result.away_score}")
    print(f"Possessions: {result.possession_count}")

    # Check minutes played
    print("\n" + "-"*80)
    print("LAKERS MINUTES PLAYED IN Q1:")
    print("-"*80)
    lakers_played = {}
    for player in lakers:
        minutes = result.minutes_played.get(player['name'], 0.0)
        expected_q1 = lakers_minutes[player['name']] / 4.0
        lakers_played[player['name']] = minutes
        status = "OK" if minutes > 0 else "NO"
        print(f"[{status}] {player['name']:25s}: {minutes:5.2f} min (expected {expected_q1:5.2f} min)")

    # Check substitutions
    print("\n" + "-"*80)
    print("LAKERS SUBSTITUTIONS IN Q1:")
    print("-"*80)
    lakers_subs = [s for s in sim.substitution_manager.get_all_substitution_events() if s.team == 'home']
    if lakers_subs:
        for i, sub in enumerate(lakers_subs, 1):
            print(f"{i}. {sub.quarter_time} - OUT: {sub.player_out:25s} IN: {sub.player_in:25s} (Reason: {sub.reason})")
    else:
        print("[NO] NO SUBSTITUTIONS OCCURRED")

    # Analysis
    print("\n" + "="*80)
    print("ISSUE DIAGNOSIS:")
    print("="*80)

    # Count how many starters played
    starters = lakers[:5]
    starters_played = sum(1 for s in starters if lakers_played[s['name']] > 0)
    print(f"\n1. Starters who played: {starters_played}/5")
    for starter in starters:
        if lakers_played[starter['name']] == 0:
            print(f"   [BAD] {starter['name']} did NOT play (should have played)")

    # Count how many bench players played
    eligible_bench = lakers[5:10]  # Exclude Cam Reddish
    bench_played = sum(1 for b in eligible_bench if lakers_played[b['name']] > 0)
    print(f"\n2. Eligible bench players who played: {bench_played}/5")
    for bench in eligible_bench:
        if lakers_played[bench['name']] == 0:
            print(f"   [BAD] {bench['name']} did NOT play (should have played)")

    # Check Cam Reddish
    cam_minutes = lakers_played[lakers[10]['name']]
    print(f"\n3. Cam Reddish (should NOT play): {cam_minutes:.2f} min")
    if cam_minutes > 0:
        print(f"   [BAD] Cam played {cam_minutes:.2f} min (should be 0)")
    else:
        print(f"   [OK] Cam correctly did NOT play")

    # Count substitutions
    print(f"\n4. Total Lakers substitutions: {len(lakers_subs)}")
    if len(lakers_subs) < 5:
        print(f"   [BAD] Only {len(lakers_subs)} subs occurred (should be at least 5 - one for each eligible bench player)")

    # Check if substitutions match expectations
    print("\n5. Substitution pattern check:")
    subs_in = set(sub.player_in for sub in lakers_subs)
    subs_out = set(sub.player_out for sub in lakers_subs)

    expected_subs_in = set(b['name'] for b in eligible_bench)
    expected_subs_out = set(s['name'] for s in starters)

    missing_subs_in = expected_subs_in - subs_in
    if missing_subs_in:
        print(f"   [BAD] Bench players who never subbed IN: {missing_subs_in}")
    else:
        print(f"   [OK] All eligible bench players subbed in")

    missing_subs_out = expected_subs_out - subs_out
    if missing_subs_out:
        print(f"   [BAD] Starters who never subbed OUT: {missing_subs_out}")
    else:
        print(f"   [OK] All starters subbed out")

    # Save detailed play-by-play
    with open('output/Q1_ROTATION_TEST.txt', 'w', encoding='utf-8') as f:
        f.write(result.play_by_play_text)

    print("\n" + "="*80)
    print("Full play-by-play saved to: output/Q1_ROTATION_TEST.txt")
    print("="*80)
