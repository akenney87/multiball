# End-Game Modes - Decision Tree

**Visual guide for mode detection logic**

---

## Mode Detection Flow

```
START: New possession begins
│
├─ Is game_time_remaining < 120 seconds? (Under 2 minutes)
│  │
│  NO  → NORMAL POSSESSION (no end-game mode)
│  │
│  YES → Continue to end-game checks
│       │
│       ├─ DEFENSIVE POSSESSION (opponent has ball)?
│       │  │
│       │  YES → Check intentional foul conditions
│       │  │    │
│       │  │    ├─ Is team trailing (score_diff < 0)?
│       │  │    │  │
│       │  │    │  NO → NORMAL DEFENSE
│       │  │    │  │
│       │  │    │  YES → Is deficit between 3-8 points?
│       │  │    │       │
│       │  │    │       NO (down 1-2 or 9+) → NORMAL DEFENSE
│       │  │    │       │
│       │  │    │       YES → Is game_time < 60 seconds?
│       │  │    │            │
│       │  │    │            NO → NORMAL DEFENSE
│       │  │    │            │
│       │  │    │            YES → [PHASE 2] INTENTIONAL FOUL MODE
│       │  │    │
│       │  │    └─ [RETURN: intentional_foul]
│       │  │
│       │  NO → Continue to offensive checks
│       │
│       ├─ OFFENSIVE POSSESSION (team has ball)?
│       │  │
│       │  YES → Check score differential
│       │  │    │
│       │  │    ├─ Is game_time_remaining <= 24 seconds?
│       │  │    │  │
│       │  │    │  YES → Check score situation
│       │  │    │  │    │
│       │  │    │  │    ├─ score_diff == 0? (TIED GAME)
│       │  │    │  │    │  │
│       │  │    │  │    │  YES → [RETURN: last_second_tied]
│       │  │    │  │    │  │     Action: Hold for last shot (3 sec)
│       │  │    │  │    │  │
│       │  │    │  │    │  NO → Is score_diff < 0? (LOSING)
│       │  │    │  │    │       │
│       │  │    │  │    │       YES → [RETURN: last_second_losing]
│       │  │    │  │    │       │     Action: Hold for last shot (4 sec)
│       │  │    │  │    │       │     Force 3PT if down 3+
│       │  │    │  │    │       │
│       │  │    │  │    │       NO (leading) → Check clock kill below
│       │  │    │  │    │
│       │  │    │  NO (> 24 seconds) → Check clock kill
│       │  │    │
│       │  │    └─ Is score_diff > 0? (LEADING)
│       │  │       │
│       │  │       NO → NORMAL POSSESSION (losing but too much time)
│       │  │       │
│       │  │       YES → Is game_time > shot_clock? (Can burn clock?)
│       │  │            │
│       │  │            NO → NORMAL POSSESSION (can't burn)
│       │  │            │
│       │  │            YES → Determine intensity
│       │  │                 │
│       │  │                 ├─ game_time < 30 AND score_diff >= 1?
│       │  │                 │  YES → [RETURN: clock_kill_aggressive]
│       │  │                 │         Target: 3 sec shot clock
│       │  │                 │
│       │  │                 ├─ game_time < 90 AND score_diff >= 3?
│       │  │                 │  YES → [RETURN: clock_kill_standard]
│       │  │                 │         Target: 5 sec shot clock
│       │  │                 │
│       │  │                 └─ game_time < 120 AND score_diff >= 7?
│       │  │                    YES → [RETURN: clock_kill_conservative]
│       │  │                           Target: 8 sec shot clock
│       │  │
│       │  NO → ERROR (should not reach here)
│       │
│       └─ [RETURN: None] (Normal possession, no end-game mode)
│
END: Return detected mode or None
```

---

## Mode Priority Table

| Game Time | Score Diff | Possession | Mode                    | Priority |
|-----------|------------|------------|-------------------------|----------|
| <60 sec   | -3 to -8   | Defense    | Intentional Foul        | 1        |
| <24 sec   | 0 (Tied)   | Offense    | Last Second Tied        | 2        |
| <24 sec   | <0 (Lose)  | Offense    | Last Second Losing      | 3        |
| <30 sec   | +1 or more | Offense    | Clock Kill Aggressive   | 4        |
| <90 sec   | +3 or more | Offense    | Clock Kill Standard     | 5        |
| <120 sec  | +7 or more | Offense    | Clock Kill Conservative | 6        |
| Any       | Any        | Any        | Normal Possession       | 7        |

---

## Shot Clock Consumption Decision Tree

```
START: End-game mode active
│
├─ Mode: clock_kill_*
│  │
│  ├─ Determine target shot clock
│  │  │
│  │  ├─ Aggressive: target = 3 seconds
│  │  ├─ Standard: target = 5 seconds
│  │  └─ Conservative: target = 8 seconds
│  │
│  ├─ Check edge case: Is game_time < (shot_clock + target)?
│  │  │
│  │  YES → time_to_burn = game_time - target - buffer
│  │  NO  → time_to_burn = shot_clock - target - buffer
│  │
│  └─ shot_clock_remaining = max(0, shot_clock - time_to_burn)
│
├─ Mode: last_second_tied
│  │
│  ├─ target_game_time = 3 seconds
│  │
│  ├─ time_to_burn = game_time - target_game_time
│  │
│  └─ shot_clock_remaining = max(1, shot_clock - time_to_burn)
│       (Ensure >= 1 to prevent violation)
│
├─ Mode: last_second_losing
│  │
│  ├─ target_game_time = 4 seconds (allows OREB)
│  │
│  ├─ time_to_burn = game_time - target_game_time
│  │
│  └─ shot_clock_remaining = max(1, shot_clock - time_to_burn)
│
└─ Mode: intentional_foul [Phase 2]
   │
   └─ Foul within 2-4 seconds (no clock consumption)
```

---

## Shot Type Selection Decision Tree

```
START: Determine shot type
│
├─ Is mode: last_second_losing?
│  │
│  YES → Is score_diff <= -3? (Down 3 or more)
│  │    │
│  │    YES → FORCE shot_type = '3pt'
│  │    │     (Must shoot 3PT to tie)
│  │    │
│  │    NO → Is score_diff == -2?
│  │         │
│  │         YES → PREFER 3PT
│  │         │     shot_distribution['3pt'] += 0.20
│  │         │     shot_distribution['midrange'] -= 0.25
│  │         │
│  │         NO (down 1) → Use normal distribution
│  │
│  NO → Is mode: clock_kill_*?
│       │
│       YES → SLIGHTLY PREFER SAFER SHOTS
│       │     shot_distribution['3pt'] -= 0.05
│       │     shot_distribution['rim'] += 0.05
│       │
│       NO → Use normal shot distribution
│
END: Return shot_type or distribution modifiers
```

---

## Shooter Selection Decision Tree

```
START: Select shooter
│
├─ Is mode: last_second_* (tied or losing)?
│  │
│  YES → Check tactical settings
│  │    │
│  │    ├─ Is scoring_option_1 available?
│  │    │  (stamina > 40, not fouled out)
│  │    │  │
│  │    │  YES → shooter = scoring_option_1
│  │    │  │     usage_boost = 0.50 (50% more likely)
│  │    │  │
│  │    │  NO → Is scoring_option_2 available?
│  │    │       │
│  │    │       YES → shooter = scoring_option_2
│  │    │       │     usage_boost = 0.30
│  │    │       │
│  │    │       NO → shooter = best_available_scorer()
│  │    │             usage_boost = 0.20
│  │    │
│  │    └─ If last_second_losing AND down 3+
│  │       │
│  │       └─ Override: shooter = best_3pt_shooter_available()
│  │
│  NO → Use normal usage distribution
│       (scoring options get 30%/20%/15% as usual)
│
END: Return selected shooter
```

---

## Intentional Foul Target Selection [Phase 2]

```
START: Select foul target (offensive player to foul)
│
├─ Calculate FT composite for all offensive players
│  │
│  └─ FT_composite = weighted_sum(
│        throw_accuracy: 0.40,
│        composure: 0.25,
│        form_technique: 0.20,
│        consistency: 0.15
│     )
│
├─ Identify worst FT shooter
│  │
│  └─ target = min(offensive_team, key=FT_composite)
│
└─ [RETURN: target]

---

START: Select fouling player (defensive player to commit foul)
│
├─ Filter available players
│  │
│  └─ available = [p for p in defense if personal_fouls < 5]
│
├─ Is available empty? (All players have 5 fouls)
│  │
│  YES → EMERGENCY: Use starter with highest stamina
│  │     (Accept foul-out risk, game is desperate)
│  │
│  NO → Select player with fewest personal fouls
│       │
│       └─ fouler = min(available, key=personal_fouls)
│
└─ [RETURN: fouler]
```

---

## Foul Loop Prevention [Phase 2]

```
START: Check if intentional foul should occur
│
├─ Has trailing team already fouled 3 times in a row?
│  │
│  YES → STOP FOULING
│  │     intentional_foul_count >= 3
│  │     [RETURN: False]
│  │
│  NO → Is this a valid foul situation?
│       │
│       YES → Execute intentional foul
│       │     intentional_foul_count += 1
│       │     [RETURN: True]
│       │
│       NO → Reset counter
│            intentional_foul_count = 0
│            [RETURN: False]
│
---

RESET CONDITIONS:
│
├─ Trailing team scores
│  └─ intentional_foul_count = 0
│
├─ Leading team turns ball over
│  └─ intentional_foul_count = 0
│
└─ Possession changes naturally (defensive rebound)
   └─ intentional_foul_count = 0
```

---

## Example Scenarios

### Scenario 1: Clock Kill
```
Game State:
- Quarter 4
- Game Time: 90 seconds
- Score: +5 (Leading by 5)
- Shot Clock: 24 seconds
- Possession: Leading team

Decision:
- Mode: clock_kill_standard (5 sec target)
- time_to_burn = 24 - 5 - 1 = 18 seconds
- shot_clock_remaining = 6 seconds
- Action: Burn 18 seconds, shoot at 6 seconds

Result:
- Game time after possession: ~70 seconds
- Opponent gets ~70 seconds to score 6 points (2 possessions max)
```

### Scenario 2: Last Second Shot - Tied
```
Game State:
- Quarter 4
- Game Time: 20 seconds
- Score: Tied
- Shot Clock: 24 seconds
- Possession: Home team

Decision:
- Mode: last_second_tied
- target_game_time = 3 seconds
- time_to_burn = 20 - 3 = 17 seconds
- shot_clock_remaining = 7 seconds
- Action: Hold ball for 17 seconds, shoot at 3 seconds game clock

Result:
- If make: Win game (opponent has 3 seconds, very difficult)
- If miss: Opponent rebounds with 2-3 seconds (very difficult to score)
```

### Scenario 3: Last Second Shot - Losing (Down 3)
```
Game State:
- Quarter 4
- Game Time: 18 seconds
- Score: -3 (Down by 3)
- Shot Clock: 14 seconds (offensive rebound)
- Possession: Trailing team

Decision:
- Mode: last_second_losing
- target_game_time = 4 seconds
- time_to_burn = 18 - 4 = 14 seconds
- shot_clock_remaining = 0 (full shot clock used)
- force_shot_type = '3pt' (MUST shoot 3 to tie)
- Action: Hold for 14 seconds, shoot 3PT at 4 seconds game clock

Result:
- If 3PT makes: Tied game with 4 seconds (opponent's ball)
- If 3PT misses: Can attempt OREB and tip-in within 4 seconds
```

### Scenario 4: Intentional Foul [Phase 2]
```
Game State:
- Quarter 4
- Game Time: 45 seconds
- Score: -5 (Down by 5)
- Shot Clock: 24 seconds (full)
- Possession: Leading team (opponent)
- Opponent in bonus: Yes

Decision:
- Mode: intentional_foul
- Target: Worst FT shooter on opponent (50% FT shooter)
- Fouler: Player with 2 personal fouls (fewest on team)
- Action: Foul within 3 seconds of possession start

Result:
- Opponent shoots 2 FT (makes 1 on average, 50% shooter)
- Game time after: ~41 seconds
- Trailing team gets possession with 41 seconds, down 6
- Can intentionally foul again (2nd time)
```

### Scenario 5: Edge Case - Game Time < Shot Clock
```
Game State:
- Quarter 4
- Game Time: 20 seconds
- Score: +1 (Leading by 1)
- Shot Clock: 24 seconds (offensive rebound reset)
- Possession: Leading team

Decision:
- Mode: clock_kill_aggressive (3 sec target)
- Edge case: game_time (20) < shot_clock (24) + target (3)
- time_to_burn = 20 - 3 - 1 = 16 seconds
- shot_clock_remaining = 8 seconds (24 - 16)
- Action: Burn 16 seconds, shoot at 4 seconds game clock

Result:
- Shot taken at 4 seconds game clock
- If make: Win game (opponent has 4 seconds)
- If miss: Opponent has 3-4 seconds (very difficult)
```

---

## Mode Activation Frequency (Estimated)

Based on 100 simulated games:

| Mode                    | Games Affected | Possessions per Game | Total Impact |
|-------------------------|----------------|----------------------|--------------|
| Clock Kill              | ~35 games      | 2-4 possessions      | HIGH         |
| Last Second Tied        | ~15 games      | 1 possession         | MEDIUM       |
| Last Second Losing      | ~25 games      | 1 possession         | MEDIUM       |
| Intentional Foul [P2]   | ~10 games      | 2-3 possessions      | LOW          |

**Interpretation:**
- Clock Kill: Most frequent (every close game in final 2 min)
- Last Second Shot: 40% of games end with these scenarios
- Intentional Foul: Least frequent (only desperation situations)

---

**END OF DECISION TREE**
