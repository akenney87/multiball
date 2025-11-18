#!/usr/bin/env python3
"""
Phase 2 Quick Formula Validation

Tests the most critical formulas from each Phase 2 module.
Run from project root: python validation/phase2_quick_validation.py
"""

import sys
import os

# Add basketball-sim to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'basketball-sim'))

import json
import random
from src.core.probability import calculate_composite, weighted_sigmoid_probability
from src.constants import *

def test_contest_penalties():
    """Test contest penalty constants match spec."""
    print("\n=== CONTEST PENALTIES ===")
    print(f"3PT Wide Open: {CONTEST_PENALTIES['3PT']['wide_open']}")
    print(f"3PT Contested: {CONTEST_PENALTIES['3PT']['contested']}")
    print(f"3PT Heavy: {CONTEST_PENALTIES['3PT']['heavy']}")
    print(f"Rim Wide Open: {CONTEST_PENALTIES['rim']['wide_open']}")
    print(f"Rim Contested: {CONTEST_PENALTIES['rim']['contested']}")
    print(f"Rim Heavy: {CONTEST_PENALTIES['rim']['heavy']}")
    
    # Verify expected values
    assert CONTEST_PENALTIES['3PT']['wide_open'] == 0.0
    assert CONTEST_PENALTIES['3PT']['contested'] == -0.15
    assert CONTEST_PENALTIES['3PT']['heavy'] == -0.35
    print("✓ Contest penalties match spec")

def test_transition_bonuses():
    """Test transition bonus constants."""
    print("\n=== TRANSITION BONUSES ===")
    print(f"Rim: {TRANSITION_BONUS_RIM}")
    print(f"Midrange: {TRANSITION_BONUS_MIDRANGE}")
    print(f"3PT: {TRANSITION_BONUS_3PT}")
    
    assert TRANSITION_BONUS_RIM == 0.08
    assert TRANSITION_BONUS_MIDRANGE == 0.05
    assert TRANSITION_BONUS_3PT == 0.03
    print("✓ Transition bonuses match spec")

def test_block_rates():
    """Test block base rates."""
    print("\n=== BLOCK BASE RATES ===")
    for shot_type, rate in BLOCK_BASE_RATES.items():
        print(f"{shot_type}: {rate}")
    
    assert BLOCK_BASE_RATES['dunk'] == 0.08
    assert BLOCK_BASE_RATES['layup'] == 0.12
    assert BLOCK_BASE_RATES['3pt'] == 0.0
    print("✓ Block base rates match spec")

def test_turnover_constants():
    """Test turnover constants."""
    print("\n=== TURNOVER CONSTANTS ===")
    print(f"Base rate: {BASE_TURNOVER_RATE}")
    print(f"Max rate: {MAX_TURNOVER_RATE}")
    print(f"Pace fast mod: {PACE_TURNOVER_MOD['fast']}")
    print(f"Pace slow mod: {PACE_TURNOVER_MOD['slow']}")
    print(f"Transition mod: {TRANSITION_TURNOVER_REDUCTION}")
    
    assert BASE_TURNOVER_RATE == 0.08
    assert MAX_TURNOVER_RATE == 0.12
    assert PACE_TURNOVER_MOD['fast'] == 0.025
    assert PACE_TURNOVER_MOD['slow'] == -0.025
    assert TRANSITION_TURNOVER_REDUCTION == -0.02
    print("✓ Turnover constants match spec")

def test_foul_constants():
    """Test foul constants."""
    print("\n=== FOUL CONSTANTS ===")
    print(f"Shooting foul base (contested): {SHOOTING_FOUL_BASE_RATES['contested']}")
    print(f"Shooting foul base (heavily): {SHOOTING_FOUL_BASE_RATES['heavily']}")
    print(f"Shot type 3PT mult: {SHOT_TYPE_FOUL_MULTIPLIERS['3pt']}")
    print(f"Shot type layup mult: {SHOT_TYPE_FOUL_MULTIPLIERS['layup']}")
    print(f"Non-shooting foul rate: {NON_SHOOTING_FOUL_RATE}")
    print(f"Bonus threshold: {BONUS_THRESHOLD}")
    
    assert SHOOTING_FOUL_BASE_RATES['contested'] == 0.21
    assert SHOOTING_FOUL_BASE_RATES['heavily'] == 0.35
    assert SHOT_TYPE_FOUL_MULTIPLIERS['3pt'] == 0.15
    assert SHOT_TYPE_FOUL_MULTIPLIERS['layup'] == 1.0
    assert NON_SHOOTING_FOUL_RATE == 0.066
    assert BONUS_THRESHOLD == 5
    print("✓ Foul constants match spec")

def test_ft_constants():
    """Test free throw constants."""
    print("\n=== FREE THROW CONSTANTS ===")
    print(f"Base rate: {BASE_RATE_FREE_THROW}")
    print(f"FT k: {FREE_THROW_K}")
    print(f"And-1 bonus: {FT_PRESSURE_AND1_BONUS}")
    print(f"Bonus penalty: {FT_PRESSURE_BONUS_PENALTY}")
    print(f"Clutch penalty: {FT_PRESSURE_CLUTCH_PENALTY}")
    
    assert BASE_RATE_FREE_THROW == 0.50
    assert FREE_THROW_K == 0.02
    assert FT_PRESSURE_AND1_BONUS == 0.05
    assert FT_PRESSURE_BONUS_PENALTY == -0.03
    assert FT_PRESSURE_CLUTCH_PENALTY == -0.05
    print("✓ Free throw constants match spec")

def test_rebounding_constants():
    """Test rebounding constants."""
    print("\n=== REBOUNDING CONSTANTS ===")
    print(f"Putback height threshold: {PUTBACK_HEIGHT_THRESHOLD}")
    print(f"Defensive advantage: {DEFENSIVE_REBOUND_ADVANTAGE}")
    print(f"Strategy crash glass: {REBOUNDING_STRATEGY_MODS['crash_glass']}")
    print(f"Strategy prevent transition: {REBOUNDING_STRATEGY_MODS['prevent_transition']}")
    print(f"Shot type 3pt mod: {SHOT_TYPE_REBOUND_MODS['3pt']}")
    print(f"Shot type rim mod: {SHOT_TYPE_REBOUND_MODS['rim']}")
    
    assert PUTBACK_HEIGHT_THRESHOLD == 75
    assert DEFENSIVE_REBOUND_ADVANTAGE == 0.15
    assert REBOUNDING_STRATEGY_MODS['crash_glass'] == 0.05
    assert REBOUNDING_STRATEGY_MODS['prevent_transition'] == -0.03
    assert SHOT_TYPE_REBOUND_MODS['3pt'] == -0.03
    assert SHOT_TYPE_REBOUND_MODS['rim'] == 0.02
    print("✓ Rebounding constants match spec")

def main():
    print("="  * 70)
    print("PHASE 2 QUICK FORMULA VALIDATION")
    print("=" * 70)
    
    try:
        test_contest_penalties()
        test_transition_bonuses()
        test_block_rates()
        test_turnover_constants()
        test_foul_constants()
        test_ft_constants()
        test_rebounding_constants()
        
        print("\n" + "=" * 70)
        print("✓ ALL CRITICAL CONSTANTS VERIFIED")
        print("=" * 70)
        
        return 0
    except Exception as e:
        print(f"\n✗ VALIDATION FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())
