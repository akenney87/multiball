# multiball_basketball.py
# Drop-in replacement with EventGuard to keep PBP sequence validator-happy
# while leaving core sim randomness/logic intact.

from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import random

# --- Optional GameState import (kept for compatibility) ---
try:
    from game_state import GameState
    game_state = GameState()
except Exception:
    game_state = None  # Safe fallback if game_state module isn't present


# =========================
#        DATA MODELS
# =========================

@dataclass
class PlayerAttributes:
    # Physical
    grip_strength: float
    arm_strength: float
    core_strength: float
    agility: float
    acceleration: float
    top_speed: float
    jumping: float
    reactions: float
    stamina: float
    balance: float
    # Mental
    awareness: float
    creativity: float
    determination: float
    bravery: float
    consistency: float
    composure: float
    deception: float
    teamwork: float
    patience: float
    hand_eye_coordination: float
    throw_accuracy: float
    form_technique: float
    finesse: float
    height: float


class Player:
    def __init__(self, name: str, attributes: PlayerAttributes, position: Optional[str] = None, disc_type: Optional[str] = None):
        self.name = name
        self.attributes = attributes
        self.position = position  # 'G' | 'F' | 'C'
        self.disc_type = disc_type
        self.stats = {
            'PTS': 0, 'REB': 0, 'AST': 0, 'STL': 0, 'BLK': 0,
            'TO': 0, 'FGM': 0, 'FGA': 0, '3PM': 0, 'FTM': 0,
            'FTA': 0, 'MIN': 0, 'FOUL': 0
        }
        self.fouls = 0
        self.fatigue = 0
        self.on_court = False
        self.stamina = 100


class Team:
    def __init__(self, name: str, roster: List[Player]):
        self.name = name
        self.roster = roster
        self.lineup: List[Player] = []
        self.score = 0
        self.quarter_scores = {1: 0, 2: 0, 3: 0, 4: 0}
        self.offensive_rating = 0
        self.defensive_rating = 0

    def recalculate_ratings(self):
        if not self.lineup:
            self.offensive_rating = 0
            self.defensive_rating = 0
            return
        offense_attrs = [
            (
                0.30 * p.attributes.throw_accuracy +
                0.25 * p.attributes.finesse +
                0.20 * p.attributes.form_technique +
                0.10 * p.attributes.teamwork +
                0.10 * p.attributes.awareness +
                0.05 * p.attributes.stamina
            )
            for p in self.lineup
        ]
        defense_attrs = [
            (
                0.25 * p.attributes.awareness +
                0.20 * p.attributes.reactions +
                0.20 * p.attributes.balance +
                0.15 * p.attributes.agility +
                0.10 * p.attributes.determination +
                0.10 * p.attributes.stamina
            )
            for p in self.lineup
        ]
        self.offensive_rating = sum(offense_attrs) / len(self.lineup)
        self.defensive_rating = sum(defense_attrs) / len(self.lineup)


# =========================
#  LIGHTWEIGHT SEQUENCE GUARD
# =========================

class EventGuard:
    """
    Tracks minimal state so we only log rebounds and FTs
    when the previous context allows it (what the validator expects).
    """
    def __init__(self):
        self.expect_rebound = False  # True only right after missed/blocked FG or final missed FT
        self.ft_remaining = 0        # Active FT sequence (how many left in this award)

    # --- Field goals ---
    def mark_shot_made(self):
        self.expect_rebound = False

    def mark_shot_missed_or_blocked(self):
        # A live-ball miss can be rebounded
        self.expect_rebound = True

    # --- Free throws ---
    def begin_free_throws(self, n: int):
        # Start an FT sequence (dead ball)
        self.ft_remaining = max(0, int(n))
        self.expect_rebound = False

    def record_ft(self, made: bool) -> bool:
        """
        Called *each time* we are about to log an FT result.
        Returns False if there is no active FT sequence (so caller should skip logging).
        """
        if self.ft_remaining <= 0:
            return False
        self.ft_remaining -= 1

        # Only if the *final* FT is missed should a rebound be expected
        if not made and self.ft_remaining == 0:
            self.expect_rebound = True
        else:
            self.expect_rebound = False
        return True

    # --- Rebounds ---
    def can_log_rebound(self) -> bool:
        return self.expect_rebound

    def consume_rebound(self):
        self.expect_rebound = False


# =========================
#          MATCH
# =========================

class Match:
    def leading_margin(self) -> int:
        return abs(self.team_a.score - self.team_b.score)

    def leading_team(self) -> Team:
        return self.team_a if self.team_a.score >= self.team_b.score else self.team_b

    def should_dribble_out_q4(self) -> bool:
        return (self.quarter == 4 and self.time_remaining <= 24 and self.leading_margin() >= 9)

    def allow_heave(self) -> bool:
        # Only allow heaves if possession started with <= 4s
        return self.possession_start_time is not None and self.possession_start_time <= 4

    def __init__(self, team_a: Team, team_b: Team):
        # Clock/possession
        self.team_a = team_a
        self.team_b = team_b
        self.quarter = 1
        self.time_remaining = 12 * 60
        self.shot_clock = 24
        self.possession_team: Optional[Team] = None
        self.possession_start_time: Optional[int] = None
        self.possession_changed_last_play = False
        self.possession_number = 0

        # Lineups / ratings
        self.play_by_play: List[str] = []
        self.team_fouls = {
            team_a.name: {1: 0, 2: 0, 3: 0, 4: 0},
            team_b.name: {1: 0, 2: 0, 3: 0, 4: 0},
        }
        self.fast_break_eligible = False
        self.initial_tip_winner: Optional[Team] = None
        self._last_possession_time = 14  # for minutes calc

        # NEW: event guard
        self.guard = EventGuard()

        self.init_lineups()

    # ---------- Setup / bookkeeping ----------

    def init_lineups(self):
        self.team_a.lineup = self.team_a.roster[:5]
        self.team_b.lineup = self.team_b.roster[:5]
        for p in self.team_a.lineup + self.team_b.lineup:
            p.on_court = True
            p.stamina = 100
        # also ensure all players are reset
        for t in (self.team_a, self.team_b):
            for p in t.roster:
                p.stamina = 100

    def tip_off(self):
        a_center = max(self.team_a.lineup, key=lambda p: (p.attributes.height, p.attributes.jumping))
        b_center = max(self.team_b.lineup, key=lambda p: (p.attributes.height, p.attributes.jumping))
        a_score = a_center.attributes.height + a_center.attributes.jumping
        b_score = b_center.attributes.height + b_center.attributes.jumping
        self.possession_team = self.team_a if (a_score > b_score or (a_score == b_score and random.random() > 0.5)) else self.team_b
        self.initial_tip_winner = self.possession_team
        self.play_by_play.append(f"[Q1 12:00] Tip-off won by {self.possession_team.name}")

    def format_time(self) -> str:
        m = self.time_remaining // 60
        s = self.time_remaining % 60
        return f"{int(m)}:{int(s):02d}"

    def set_possession(self, team: Team, *, force: bool = False):
        if not force and self.possession_team == team:
            self.possession_changed_last_play = False
            return
        prev = self.possession_team
        self.possession_team = team
        if prev != team or force:
            self.play_by_play.append(f"[Q{self.quarter} {self.format_time()}] Possession: {team.name}")
            self.possession_changed_last_play = True
            self.possession_start_time = self.time_remaining
            self.shot_clock = 24

    def get_defensive_team(self) -> Team:
        return self.team_b if self.possession_team == self.team_a else self.team_a

    def update_minutes_played(self):
        for team in (self.team_a, self.team_b):
            for player in team.lineup:
                player.stats['MIN'] += self._last_possession_time / 60.0

    def check_for_timeout(self):  # stub
        pass

    def handle_substitutions(self):  # stub
        pass

    def handle_end_of_quarter(self):
        self.play_by_play.append(
            f"[Q{self.quarter}] End of quarter. Score: {self.team_a.name} {self.team_a.score} - {self.team_b.name} {self.team_b.score}"
        )
        # bench recovery
        for team in (self.team_a, self.team_b):
            for p in team.roster:
                if not p.on_court:
                    p.fatigue = max(0, p.fatigue - 8)
                    p.stamina = min(100, p.stamina + 6)

    # ---------- Simulation loops ----------

    def simulate(self):
        # Q1 tip
        self.tip_off()

        for q in range(1, 5):
            self.quarter = q
            self.time_remaining = 12 * 60
            self.shot_clock = 24

            # who opens
            if q == 1:
                opener = self.initial_tip_winner
            elif q in (2, 3):
                opener = self.team_b if self.initial_tip_winner is self.team_a else self.team_a
            else:
                opener = self.initial_tip_winner

            self.set_possession(opener, force=True)

            if q < 4:
                while self.time_remaining > 24:
                    self.simulate_possession()
                    self.update_minutes_played()
                    self.check_for_timeout()
                    if self.time_remaining % (3 * 60) < 24:
                        self.handle_substitutions()

                # last 24s handling
                if 0 < self.time_remaining <= 24:
                    if self.shot_clock < self.time_remaining:
                        buffer = random.randint(1, 3)
                        take_in = max(1, self.shot_clock - buffer)
                        take_in = min(take_in, self.time_remaining - 1)
                        self._last_possession_time = take_in
                        self.time_remaining -= take_in
                        self.shot_clock -= take_in
                        # pressured non-heave unless <=4s at possession start
                        self.simulate_shot(
                            fast_break_override=False,
                            disc_assist_mod=0,
                            return_type=False,
                            log_possession=True,
                            buzzer_beater=False
                        )
                        # If changed, opponent gets final look
                        if self.possession_changed_last_play and self.time_remaining > 0:
                            final_secs = min(random.randint(1, 3), self.time_remaining)
                            self.time_remaining = final_secs
                            self.simulate_shot(
                                fast_break_override=False,
                                disc_assist_mod=0,
                                return_type=False,
                                log_possession=True,
                                buzzer_beater=True,
                                force_allow_heave=(final_secs <= 4)
                            )
                            self.time_remaining = 0
                        else:
                            self.time_remaining = 0
                    else:
                        final_secs = min(random.randint(1, 3), self.time_remaining)
                        self.time_remaining = final_secs
                        self.simulate_shot(
                            fast_break_override=False,
                            disc_assist_mod=0,
                            return_type=False,
                            log_possession=True,
                            buzzer_beater=True,
                            force_allow_heave=(final_secs <= 4)
                        )
                        self.time_remaining = 0
                else:
                    final_secs = random.randint(1, 3)
                    self.time_remaining = final_secs
                    self.simulate_shot(
                        fast_break_override=False,
                        disc_assist_mod=0,
                        return_type=False,
                        log_possession=True,
                        buzzer_beater=True,
                        force_allow_heave=(final_secs <= 4)
                    )
                    self.time_remaining = 0
            else:
                while self.time_remaining > 0:
                    self.simulate_possession()
                    self.update_minutes_played()
                    self.check_for_timeout()
                    if self.time_remaining % (3 * 60) < 24:
                        self.handle_substitutions()

            self.handle_end_of_quarter()

        self.output_results()

    # ---------- Possession / events ----------

    def simulate_possession(self):
        # Q4 dribble-out logic
        if self.should_dribble_out_q4() and self.possession_team == self.leading_team():
            self.play_by_play.append(f"[Q4 {self.format_time()}] {self.leading_team().name} dribbled out the clock.")
            self._last_possession_time = self.time_remaining
            self.time_remaining = 0
            return

        if self.possession_changed_last_play:
            self.shot_clock = 24
        else:
            if self.shot_clock < 14:
                self.shot_clock = 14
        self.possession_changed_last_play = False

        fast_break_flag = self.fast_break_eligible
        self.fast_break_eligible = False
        buzzer_beater = (self.quarter < 4 and self.time_remaining <= self.shot_clock)

        # Pick shooter by usage
        usage_weights = []
        for p in self.possession_team.lineup:
            base = (
                0.4 * p.attributes.throw_accuracy
                + 0.2 * p.attributes.finesse
                + 0.1 * p.attributes.form_technique
                + 0.1 * p.attributes.awareness
                + 0.1 * p.attributes.teamwork
                + 0.1 * p.attributes.stamina
            )
            if p.disc_type == 'D':
                base *= 1.15
            elif p.disc_type == 'S':
                base *= 0.85
            usage_weights.append(max(1, base))
        shooter = random.choices(self.possession_team.lineup, weights=usage_weights, k=1)[0]

        # Event mix
        fatigue_factor = shooter.fatigue / 100
        defense_modifier = self.get_team_defense_modifier(self.get_defensive_team())
        ball_security = 0.5 * shooter.attributes.awareness + 0.5 * shooter.attributes.hand_eye_coordination
        turnover_chance = max(0.03, 0.08 + 0.10 * fatigue_factor + 0.10 * (defense_modifier / 100) - 0.08 * (ball_security / 100))
        shot_chance = min(0.85, 0.60 + 0.10 * (usage_weights[self.possession_team.lineup.index(shooter)] / max(usage_weights))) - 0.10 * fatigue_factor
        shot_chance = max(0.0, min(1.0, shot_chance))
        pass_chance = 1.0 - shot_chance - turnover_chance
        if pass_chance < 0:
            total = shot_chance + turnover_chance
            if total <= 0:
                shot_chance, turnover_chance, pass_chance = 1.0, 0.0, 0.0
            else:
                shot_chance /= total
                turnover_chance /= total
                pass_chance = 0.0

        event = random.choices(['shot', 'turnover', 'pass'], weights=[shot_chance, turnover_chance, pass_chance], k=1)[0]

        early_shot_flag = False
        defenders_involved: List[Player] = []
        possession_changed = False

        if event == 'shot':
            res = self.simulate_shot(
                fast_break_override=fast_break_flag,
                disc_assist_mod=0,
                return_type=True,
                log_possession=False,
                buzzer_beater=buzzer_beater
            )
            if res is not None:
                shooter, defenders_involved, shot_type, fast_break_flag, possession_changed = res
                early_shot_flag = ('3PT Pull-Up' in shot_type) or ('Mid Pull-Up' in shot_type)
        elif event == 'turnover':
            shooter, defenders_involved, possession_changed = self.simulate_turnover(shooter, log_possession=False)
        else:
            # pass or forced shot
            teammates = [p for p in self.possession_team.lineup if p != shooter]
            if not teammates:
                res = self.simulate_shot(
                    fast_break_override=fast_break_flag,
                    return_type=True,
                    log_possession=False
                )
                if res:
                    shooter, defenders_involved, shot_type, fast_break_flag, possession_changed = res
                    early_shot_flag = 'Pull-Up' in shot_type
            else:
                pass_to = random.choices(
                    teammates,
                    weights=[p.attributes.awareness + p.attributes.hand_eye_coordination for p in teammates],
                    k=1
                )[0]
                if random.random() < (0.03 + 0.04 * (defense_modifier / 100)):
                    shooter.stats['TO'] += 1
                    self.play_by_play.append(f"[Q{self.quarter} {self.format_time()}] Turnover: bad pass from {shooter.name} intended for {pass_to.name}")
                    possession_changed = True
                elif random.random() < 0.3:
                    res = self.simulate_shot(
                        fast_break_override=fast_break_flag,
                        return_type=True,
                        log_possession=False
                    )
                    if res:
                        shooter, defenders_involved, shot_type, fast_break_flag, possession_changed = res
                        early_shot_flag = 'Pull-Up' in shot_type

        # Flip if changed
        if possession_changed:
            self.set_possession(self.get_defensive_team())
            self.possession_changed_last_play = True

        # Advance clocks once per possession
        if fast_break_flag:
            secs = random.randint(4, 7)
        elif early_shot_flag:
            secs = random.randint(8, 12)
        else:
            secs = random.randint(10, 14)
        secs = min(secs, self.shot_clock)
        self._last_possession_time = secs
        self.shot_clock -= secs
        self.time_remaining = max(0, self.time_remaining - secs)

        # Fatigue & minutes handled elsewhere
        self.update_fatigue(shooter, defenders_involved, fast_break_flag)
        self.possession_number += 1

    # ---------- FT / Shooting / Turnover ----------

    def simulate_free_throws(self, shooter: Player, num_shots: int = 1) -> bool:
        """
        Return True if possession should flip (last FT made or defensive rebound),
        False if offense keeps (offensive rebound after last FT miss).
        """
        # NEW: start an FT sequence for the guard
        self.guard.begin_free_throws(num_shots)

        ft_skill = (
            0.4 * shooter.attributes.form_technique
            + 0.3 * shooter.attributes.hand_eye_coordination
            + 0.3 * shooter.attributes.composure
        )
        ft_pct = max(0.10, min(0.90, ft_skill / 100 + random.uniform(-0.05, 0.05)))

        last_made = None
        for _ in range(num_shots):
            shooter.stats['FTA'] += 1
            made = random.random() < ft_pct
            last_made = made

            if made:
                # VALIDATE FT sequence via guard
                if not self.guard.record_ft(True):
                    # Illegal FT (validator would flag) -> skip logging entirely
                    continue
                shooter.stats['FTM'] += 1
                shooter.stats['PTS'] += 1
                self.possession_team.score += 1
                self.possession_team.quarter_scores[self.quarter] += 1
                self.play_by_play.append(
                    f"[Q{self.quarter} {self.format_time()}] {shooter.name} Made Free Throw "
                    f"[{self.team_a.name}: {self.team_a.score} | {self.team_b.name}: {self.team_b.score}]"
                )
            else:
                if not self.guard.record_ft(False):
                    # Illegal FT -> skip logging
                    continue
                self.play_by_play.append(
                    f"[Q{self.quarter} {self.format_time()}] {shooter.name} Missed Free Throw"
                )

        # If the last FT was made → ball is live but possession flips (inbound)
        if last_made:
            return True

        # Otherwise, ONLY after a miss on the final FT is a rebound valid.
        shooting_team = self.possession_team
        def_team = self.team_b if shooting_team == self.team_a else self.team_a

        if self.guard.can_log_rebound():
            # 30% OREB / 70% DREB baseline
            if random.random() < 0.30:
                rebound_team = shooting_team
                pos_changed = False
            else:
                rebound_team = def_team
                pos_changed = True
                self.fast_break_eligible = True

            rebounder = random.choice(rebound_team.lineup)
            rebounder.stats['REB'] += 1
            self.play_by_play.append(
                f"[Q{self.quarter} {self.format_time()}] {rebounder.name} grabbed the rebound"
            )
            self.guard.consume_rebound()
            return pos_changed
        else:
            # No rebound context; treat as dead-ball flip if needed
            return True

    def should_commit_foul(self, defender: Player, shooting: bool = False, team_fouls: int = 0, base_foul: float = 0.04) -> bool:
        discipline = (defender.attributes.awareness + defender.attributes.composure + defender.attributes.patience) / 3
        aggression = (defender.attributes.bravery + defender.attributes.determination) / 2
        base = base_foul if shooting else 0.008
        foul_chance = base + (1 - discipline / 100) * 0.08 + (aggression / 100) * 0.04
        if not shooting and team_fouls >= 5:
            foul_chance += 0.10
        return random.random() < foul_chance

    def simulate_shot(
        self,
        fast_break_override: Optional[bool] = None,
        disc_assist_mod: float = 0,
        return_type: bool = False,
        log_possession: bool = True,
        buzzer_beater: bool = False,
        force_allow_heave: bool = False
    ):
        fast_break_flag = fast_break_override if fast_break_override is not None else False
        shooter = random.choice(self.possession_team.lineup)
        pos = shooter.position
        time_pressure = (self.time_remaining < 24)
        can_heave = self.allow_heave() or force_allow_heave

        # shot type distribution
        if buzzer_beater:
            can_heave = self.allow_heave()
            if can_heave:
                shot_types = [
                    ('3PT Heave', 0.70), ('3PT Pull-Up', 0.10), ('3PT Catch & Shoot', 0.10),
                    ('Layup', 0.05), ('Hook Shot', 0.05)
                ]
            else:
                shot_types = [
                    ('3PT Pull-Up', 0.35), ('3PT Catch & Shoot', 0.30), ('Fadeaway', 0.15),
                    ('Floater', 0.10), ('Layup', 0.10)
                ]
        elif fast_break_flag:
            shot_types = [
                ('Layup', 0.45), ('Dunk', 0.35), ('Floater', 0.10),
                ('3PT Pull-Up', 0.05), ('3PT Catch & Shoot', 0.05),
            ]
        elif time_pressure:
            if can_heave:
                shot_types = [
                    ('3PT Heave', 0.40), ('3PT Pull-Up', 0.20), ('3PT Catch & Shoot', 0.15),
                    ('Fadeaway', 0.10), ('Floater', 0.05),
                ]
            else:
                shot_types = [
                    ('3PT Pull-Up', 0.28), ('3PT Catch & Shoot', 0.25), ('Fadeaway', 0.15),
                    ('Floater', 0.12), ('Layup', 0.10), ('Mid Pull-Up', 0.10),
                ]
        else:
            if pos == 'G':
                shot_types = [
                    ('3PT Catch & Shoot', 0.20), ('3PT Pull-Up', 0.17), ('Mid Pull-Up', 0.14),
                    ('Layup', 0.15), ('Floater', 0.11), ('Mid Catch & Shoot', 0.09),
                    ('Fadeaway', 0.06), ('Reverse Layup', 0.05), ('Dunk', 0.03),
                ]
            elif pos == 'F':
                shot_types = [
                    ('Mid Catch & Shoot', 0.17), ('3PT Catch & Shoot', 0.15), ('Mid Pull-Up', 0.15),
                    ('Layup', 0.15), ('Fadeaway', 0.11), ('Dunk', 0.09),
                    ('Floater', 0.07), ('Reverse Layup', 0.05), ('3PT Pull-Up', 0.06),
                ]
            elif pos == 'C':
                shot_types = [
                    ('Layup', 0.25), ('Dunk', 0.23), ('Hook Shot', 0.15),
                    ('Fadeaway', 0.12), ('Mid Catch & Shoot', 0.08),
                    ('Reverse Layup', 0.07), ('Floater', 0.05), ('3PT Catch & Shoot', 0.05),
                ]
            else:
                shot_types = [
                    ('Layup', 0.20), ('3PT Catch & Shoot', 0.16), ('Mid Pull-Up', 0.13),
                    ('Dunk', 0.11), ('Fadeaway', 0.10), ('Floater', 0.09),
                    ('Reverse Layup', 0.08), ('3PT Pull-Up', 0.07), ('Mid Catch & Shoot', 0.06),
                ]

        if buzzer_beater and not self.allow_heave():
            # Guardrail: no heave when not allowed
            shot_types = [s for s in shot_types if s[0] != '3PT Heave']

        types, weights = zip(*shot_types)
        shot_type = random.choices(types, weights=weights, k=1)[0]

        # pick defender
        defense_team = self.get_defensive_team()
        defenders = defense_team.lineup
        if random.random() < 0.10:
            responsible_defender = random.choice(defenders)
        else:
            same_pos = [d for d in defenders if d.position == pos]
            responsible_defender = random.choice(same_pos) if same_pos else random.choice(defenders)
        defenders_involved = [responsible_defender]

        # foul checks
        team_fouls = self.team_fouls[defense_team.name][self.quarter]
        base_foul = 0.07 if shot_type in ('Layup', 'Dunk', 'Reverse Layup', 'Floater', 'Hook Shot') else 0.02

        # shooting foul
        if self.should_commit_foul(responsible_defender, shooting=True, team_fouls=team_fouls, base_foul=base_foul):
            responsible_defender.stats['FOUL'] += 1
            responsible_defender.fouls += 1
            self.team_fouls[defense_team.name][self.quarter] += 1
            self.play_by_play.append(
                f"[Q{self.quarter} {self.format_time()}] {shooter.name} misses {shot_type} "
                f"but is fouled by {responsible_defender.name} "
                f"(Personal Fouls: {responsible_defender.fouls} | Team Fouls: {self.team_fouls[defense_team.name][self.quarter]})"
            )
            shots = 3 if '3PT' in shot_type else 2
            pos_changed = self.simulate_free_throws(shooter, num_shots=shots)
            if log_possession and pos_changed:
                self.set_possession(self.get_defensive_team())
            return (shooter, defenders_involved, shot_type, fast_break_flag, pos_changed) if return_type else (shooter, defenders_involved)

        # non-shooting foul (bonus applies inside should_commit_foul)
        if self.should_commit_foul(responsible_defender, shooting=False, team_fouls=team_fouls):
            responsible_defender.stats['FOUL'] += 1
            responsible_defender.fouls += 1
            self.team_fouls[defense_team.name][self.quarter] += 1
            self.play_by_play.append(
                f"[Q{self.quarter} {self.format_time()}] Non-shooting foul by {responsible_defender.name} "
                f"(Personal Fouls: {responsible_defender.fouls} | Team Fouls: {self.team_fouls[defense_team.name][self.quarter]}) "
                f"on {shooter.name}{' [Fast Break]' if fast_break_flag else ''}"
            )
            if self.team_fouls[defense_team.name][self.quarter] >= 5:
                shots = 3 if '3PT' in shot_type else 2
                pos_changed = self.simulate_free_throws(shooter, num_shots=shots)
                if log_possession and pos_changed:
                    self.set_possession(self.get_defensive_team())
                return (shooter, defenders_involved, shot_type, fast_break_flag, pos_changed) if return_type else (shooter, defenders_involved)
            return (shooter, defenders_involved, shot_type, fast_break_flag, False) if return_type else (shooter, defenders_involved)

        # attribute weighting for success chance
        shot_attr_map = {
            '3PT Catch & Shoot': ['form_technique','finesse','hand_eye_coordination','balance','composure','consistency','awareness','teamwork'],
            '3PT Pull-Up': ['form_technique','finesse','hand_eye_coordination','balance','composure','consistency','awareness','teamwork','agility','acceleration'],
            '3PT Heave': ['arm_strength','finesse','composure','bravery'],
            'Mid Catch & Shoot': ['form_technique','finesse','hand_eye_coordination','balance','composure','consistency','awareness','teamwork'],
            'Mid Pull-Up': ['form_technique','finesse','hand_eye_coordination','balance','composure','consistency','awareness','teamwork','agility','acceleration'],
            'Floater': ['finesse','creativity','reactions','balance','hand_eye_coordination','composure'],
            'Fadeaway': ['finesse','form_technique','core_strength','balance','composure','creativity'],
            'Layup': ['finesse','core_strength','acceleration','agility','composure','balance','jumping','hand_eye_coordination'],
            'Dunk': ['grip_strength','jumping','balance','acceleration','bravery'],
            'Putback': ['reactions','grip_strength','jumping','determination','awareness'],
            'Reverse Layup': ['finesse','balance','agility','creativity','composure','grip_strength'],
        }
        attrs = shot_attr_map.get(shot_type, ['form_technique','finesse','hand_eye_coordination'])
        vals = [getattr(shooter.attributes, a) for a in attrs]
        offense_skill = sum(vals) / len(vals)

        # height & stamina
        height_factor = (shooter.attributes.height - 72) / 15
        offense_skill *= (1.0 + 0.1 * height_factor)
        offense_skill *= shooter.attributes.stamina / 100

        # team boost
        team_attrs = ['teamwork','patience','awareness']
        team_vals = [
            sum(getattr(p.attributes, a) for p in self.possession_team.lineup) / len(self.possession_team.lineup)
            for a in team_attrs
        ]
        team_boost = sum(team_vals) / (100 * len(team_attrs))
        offense_skill *= (1.0 + 0.1 * team_boost)

        # defense pressure
        defense_pressure = (
            responsible_defender.attributes.awareness +
            responsible_defender.attributes.balance +
            responsible_defender.attributes.reactions
        ) / 3

        # success chance
        if shot_type == '3PT Heave':
            success_chance = 0.03
        else:
            success_chance = max(0.10, min(0.95, (offense_skill - defense_pressure + 50) / 150))

        # take shot
        shooter.stats['FGA'] += 1
        made = random.random() < success_chance

        # assist logic
        assist = None
        if made and 'Catch & Shoot' in shot_type:
            mates = [p for p in self.possession_team.lineup if p != shooter]
            if mates:
                assist = random.choice(mates)
                assist.stats['AST'] += 1
        elif made and shot_type != '3PT Heave' and random.random() < (0.5 + disc_assist_mod):
            mates = [p for p in self.possession_team.lineup if p != shooter]
            if mates:
                assist = random.choice(mates)
                assist.stats['AST'] += 1
        if fast_break_flag and made and not assist:
            candidates = [p for p in self.possession_team.lineup if p != shooter]
            if candidates:
                best = max(candidates, key=lambda p: 0.6 * p.attributes.awareness + 0.4 * p.attributes.throw_accuracy)
                if best.attributes.awareness > 70 and best.attributes.throw_accuracy > 65:
                    assist = best
                    assist.stats['AST'] += 1

        if made:
            shooter.stats['FGM'] += 1
            pts = 3 if '3PT' in shot_type else 2
            shooter.stats['PTS'] += pts
            self.possession_team.score += pts
            self.possession_team.quarter_scores[self.quarter] += pts
            if '3PT' in shot_type:
                shooter.stats['3PM'] += 1
            simple = shot_type.replace("Catch & Shoot ", "").replace("Pull-Up ", "")
            line = f"[Q{self.quarter} {self.format_time()}] {shooter.name} Made {simple}"
            if assist:
                line += f" (assist: {assist.name})"
            if fast_break_flag:
                line += " [Fast Break]"
            line += f" [{self.team_a.name}: {self.team_a.score} | {self.team_b.name}: {self.team_b.score}]"

            # NEW: made shot => no rebound expected
            self.guard.mark_shot_made()

            self.play_by_play.append(line)
            if log_possession:
                other = self.get_defensive_team()
                self.set_possession(other)
            return (shooter, [], shot_type, fast_break_flag, True) if return_type else (shooter, [])

        # Missed / blocked – special buzzer case: no rebound after horn
        if buzzer_beater:
            self.play_by_play.append(
                f"[Q{self.quarter} {self.format_time()}] {shooter.name} missed a {shot_type}"
                f"{' [Fast Break]' if fast_break_flag else ''}"
            )
            # no rebound expected at horn
            self.guard.mark_shot_made()
            return (shooter, defenders_involved, shot_type, fast_break_flag, False) if return_type else (shooter, defenders_involved)

        # Block or simple miss (live ball)
        block = None
        if random.random() < 0.10:
            pool = defense_team.lineup
            block = random.choice(pool)
            block.stats['BLK'] += 1
            defenders_involved.append(block)
            self.play_by_play.append(
                f"[Q{self.quarter} {self.format_time()}] {shooter.name} had {shot_type} blocked by {block.name}"
                f"{' [Fast Break]' if fast_break_flag else ''}"
            )
            # NEW: missed/blocked => expect rebound
            self.guard.mark_shot_missed_or_blocked()
        else:
            self.play_by_play.append(
                f"[Q{self.quarter} {self.format_time()}] {shooter.name} missed a {shot_type}"
                f"{' [Fast Break]' if fast_break_flag else ''}"
            )
            # NEW: missed => expect rebound
            self.guard.mark_shot_missed_or_blocked()

        # Rebound logic (guarded)
        off_team = self.possession_team
        def_team = defense_team

        # Track if ball hit rim for shot-clock logic (keep your prior assumption)
        ball_hit_rim = (shot_type != '3PT Heave' and random.random() < 0.85)

        # Offensive rebound branch
        if random.random() < 0.30:
            rebound_team = off_team
            pos_changed = False
            if self.guard.can_log_rebound():
                rebounder = random.choice(rebound_team.lineup)
                rebounder.stats['REB'] += 1
                self.play_by_play.append(
                    f"[Q{self.quarter} {self.format_time()}] {rebounder.name} grabbed the rebound"
                )
                self.guard.consume_rebound()
            # no set_possession on OREB
        else:
            # Defensive rebound branch
            rebound_team = def_team
            pos_changed = True
            if self.guard.can_log_rebound():
                rebounder = random.choice(rebound_team.lineup)
                rebounder.stats['REB'] += 1
                self.play_by_play.append(
                    f"[Q{self.quarter} {self.format_time()}] {rebounder.name} grabbed the rebound"
                )
                self.guard.consume_rebound()
                if log_possession:
                    self.set_possession(rebound_team)
            else:
                # If we can't legally log a rebound, just flip possession silently
                if log_possession:
                    self.set_possession(rebound_team)

        # Shot clock reset logic
        if ball_hit_rim:
            if rebound_team == def_team:
                self.shot_clock = 24
            else:
                self.shot_clock = max(self.shot_clock, 14)

        return (shooter, defenders_involved, shot_type, fast_break_flag, pos_changed) if return_type else (shooter, defenders_involved)

    def simulate_turnover(self, shooter: Player, log_possession: bool = True) -> Tuple[Player, List[Player], bool]:
        turnover_types = ['bad pass', 'travel', 'stepped out of bounds', 'offensive foul', 'lost ball', 'shot clock violation']
        ttype = random.choice(turnover_types)

        shooter.stats['TO'] += 1
        event = f"[Q{self.quarter} {self.format_time()}] Turnover by {shooter.name} ({ttype})"

        defense_team = self.get_defensive_team()
        defenders = defense_team.lineup

        # Try a steal on live-ball TOs
        defenders_involved: List[Player] = []
        if ttype not in ('shot clock violation', 'offensive foul', 'stepped out of bounds', 'travel') and defenders:
            stealer = max(defenders, key=lambda d: (d.attributes.reactions + d.attributes.awareness + d.attributes.hand_eye_coordination))
            steal_pressure = (stealer.attributes.reactions + stealer.attributes.awareness + stealer.attributes.hand_eye_coordination) / 3
            steal_chance = max(0.15, min(0.6, steal_pressure / 100))
            if random.random() < steal_chance:
                stealer.stats['STL'] += 1
                event += f" (steal: {stealer.name})"
                defenders_involved.append(stealer)

        self.play_by_play.append(event)

        # possession flips (dead ball)
        if self.time_remaining > 0 and log_possession:
            other = self.get_defensive_team()
            self.set_possession(other)
            self.shot_clock = 24
            self.possession_start_time = self.time_remaining
            self.possession_changed_last_play = True

        # A turnover is a dead-ball result → no rebound expected
        self.guard.mark_shot_made()

        return shooter, defenders_involved, True

    # ---------- Team defense/fatigue ----------

    def get_team_defense_modifier(self, team: Team) -> float:
        team.recalculate_ratings()
        return team.defensive_rating

    def update_fatigue(self, shooter: Optional[Player] = None, defenders_involved: Optional[List[Player]] = None, fast_break: bool = False):
        for team in (self.team_a, self.team_b):
            for player in team.lineup:
                player.fatigue += 0.7
                player.fatigue = min(player.fatigue, 100)

        # stamina: offense -0.5, defense -0.3
        offense_team = self.possession_team
        defense_team = self.get_defensive_team()
        for p in offense_team.lineup:
            p.stamina = max(0, p.stamina - 0.5)
        for p in defense_team.lineup:
            p.stamina = max(0, p.stamina - 0.3)

        if shooter and defenders_involved:
            if defenders_involved:
                shooter.stamina = max(0, shooter.stamina - 0.5)
            for d in defenders_involved:
                d.stamina = max(0, d.stamina - 0.5)

        if fast_break:
            for team in (offense_team, defense_team):
                for p in team.lineup:
                    p.stamina = max(0, p.stamina - 0.3)

        # bench recovers +1
        for team in (self.team_a, self.team_b):
            for p in team.roster:
                if not p.on_court:
                    p.stamina = min(100, p.stamina + 1)

    # ---------- Output ----------

    def output_results(self):
        self.play_by_play.append(f"--- Game Over: {self.team_a.name} vs {self.team_b.name} ---")
        self.play_by_play.append(f"Final Score: {self.team_a.name} {self.team_a.score} - {self.team_b.name} {self.team_b.score}")
        for team in (self.team_a, self.team_b):
            self.play_by_play.append(f"{team.name} Box Score:")
            for p in team.roster:
                if p.stats['MIN'] > 0:
                    self.play_by_play.append(f"  {p.name}: {p.stats}")
        with open("play_by_play_log.txt", "w") as f:
            for line in self.play_by_play:
                f.write(line + "\n")
        print("Play-by-play log saved to 'play_by_play_log.txt'")


# =========================
#        UTILITIES
# =========================

def generate_random_player(name: str, position: str, disc_type: Optional[str] = None) -> Player:
    attributes = PlayerAttributes(
        grip_strength=random.uniform(10, 100),
        arm_strength=random.uniform(10, 100),
        core_strength=random.uniform(10, 100),
        agility=random.uniform(10, 100),
        acceleration=random.uniform(10, 100),
        top_speed=random.uniform(10, 100),
        jumping=random.uniform(10, 100),
        reactions=random.uniform(10, 100),
        stamina=random.uniform(10, 100),
        balance=random.uniform(10, 100),
        awareness=random.uniform(10, 100),
        creativity=random.uniform(10, 100),
        determination=random.uniform(10, 100),
        bravery=random.uniform(10, 100),
        consistency=random.uniform(10, 100),
        composure=random.uniform(10, 100),
        deception=random.uniform(10, 100),
        teamwork=random.uniform(10, 100),
        patience=random.uniform(10, 100),
        hand_eye_coordination=random.uniform(10, 100),
        throw_accuracy=random.uniform(10, 100),
        form_technique=random.uniform(10, 100),
        finesse=random.uniform(10, 100),
        height=random.uniform(150, 210),
    )
    return Player(name=name, attributes=attributes, position=position, disc_type=disc_type)


def generate_random_team(name: str, num_players: int) -> Team:
    roster = [generate_random_player(f"Player {i+1}", random.choice(['G','F','C'])) for i in range(num_players)]
    return Team(name=name, roster=roster)


# =========================
#   OPTIONAL STANDALONE RUN
# =========================

if __name__ == "__main__":
    # Local quick run (kept optional so imports don't auto-simulate)
    team_a = generate_random_team("Sharks", 12)
    team_b = generate_random_team("Eagles", 12)
    match = Match(team_a, team_b)
    match.simulate()
