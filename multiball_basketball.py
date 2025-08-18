# multiball_basketball.py
# Drop-in replacement with rebound/FT/possession guard and labeled rebounds.

from typing import List, Optional, Tuple
from dataclasses import dataclass
import random

# --------------------------------------------------------------------
# Public API dataclasses/classes (kept stable for test harness import)
# --------------------------------------------------------------------

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
        self.position = position
        self.disc_type = disc_type
        self.stats = {
            'PTS': 0, 'REB': 0, 'AST': 0, 'STL': 0, 'BLK': 0, 'TO': 0,
            'FGM': 0, 'FGA': 0, '3PM': 0, 'FTM': 0, 'FTA': 0, 'MIN': 0, 'FOUL': 0
        }
        self.fouls = 0
        self.fatigue = 0.0
        self.on_court = False
        self.stamina = 100.0


class Team:
    def __init__(self, name: str, roster: List[Player]):
        self.name = name
        self.roster = roster
        self.lineup: List[Player] = []
        self.score = 0
        self.quarter_scores = {1: 0, 2: 0, 3: 0, 4: 0}
        self.offensive_rating = 0.0
        self.defensive_rating = 0.0

    def recalculate_ratings(self):
        if not self.lineup:
            self.offensive_rating = 0.0
            self.defensive_rating = 0.0
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


# --------------------------------------------------------------------
# Internal guard to keep validator-happy sequencing
# --------------------------------------------------------------------

class PossessionGuard:
    """
    Tracks whether a live shot/FT requires a rebound next, and who should be
    the expected rebound side (offense/defense) if validator checks it.

    - call mark_shot_missed(offensive_team_name) after a missed FG or block
      (this sets expected = defensive team)
    - call mark_shot_made() on a made FG (dead ball -> no rebound expected)
    - call mark_ft_sequence(shooter_team_name, remaining_shots) to manage FTs:
        * If last FT missed => expect rebound, default to DEF (but we allow OREB)
        * If last FT made   => dead ball -> no rebound expected (flip or inbound)
    - call consume_rebound() immediately after logging a rebound line
    - call whistle() on any dead-ball (non-shooting foul, violation with whistle)
    - call flip_possession() whenever possession changes (dead-ball state)
    """
    def __init__(self):
        self.expect_rebound: bool = False
        self.expect_side: Optional[str] = None  # "off" or "def"
        self.context: Optional[str] = None      # "fg", "ft", etc.
        self.offensive_team_name: Optional[str] = None

    # --- FG context ---
    def mark_shot_missed(self, offensive_team_name: str):
        self.expect_rebound = True
        self.expect_side = "def"
        self.context = "fg"
        self.offensive_team_name = offensive_team_name

    def mark_shot_made(self):
        self.expect_rebound = False
        self.expect_side = None
        self.context = None
        self.offensive_team_name = None

    # --- FT context ---
    def mark_ft_sequence(self, shooter_team_name: str, last_shot_missed: bool, is_last_shot: bool):
        if is_last_shot:
            if last_shot_missed:
                # last FT missed -> expect rebound (typically defense favored)
                self.expect_rebound = True
                self.expect_side = "def"
                self.context = "ft"
                self.offensive_team_name = shooter_team_name
            else:
                # last FT made -> dead ball
                self.mark_shot_made()
        else:
            # middle FTs don't require rebound
            self.mark_shot_made()

    # --- General ---
    def consume_rebound(self):
        self.expect_rebound = False
        self.expect_side = None
        self.context = None
        self.offensive_team_name = None

    def whistle(self):
        self.mark_shot_made()

    def flip_possession(self):
        self.mark_shot_made()


# --------------------------------------------------------------------
# Match engine
# --------------------------------------------------------------------

class Match:
    def __init__(self, team_a: Team, team_b: Team):
        self.team_a = team_a
        self.team_b = team_b
        self.quarter = 1
        self.time_remaining = 12 * 60
        self.shot_clock = 24
        self.possession_team: Optional[Team] = None
        self.possession_start_time: Optional[int] = None
        self.possession_changed_last_play = False
        self.possession_number = 0
        self.fast_break_eligible = False
        self.initial_tip_winner: Optional[Team] = None

        self.team_fouls = {
            self.team_a.name: {1: 0, 2: 0, 3: 0, 4: 0},
            self.team_b.name: {1: 0, 2: 0, 3: 0, 4: 0},
        }

        self.play_by_play: List[str] = []

        # Guard to keep sequences valid
        self.guard = PossessionGuard()

        self.init_lineups()

    # ---------- Helpers ----------
    def format_time(self) -> str:
        m = self.time_remaining // 60
        s = self.time_remaining % 60
        return f"{int(m)}:{int(s):02d}"

    def get_defensive_team(self) -> Team:
        return self.team_b if self.possession_team == self.team_a else self.team_a

    def set_possession(self, team: Team, *, force: bool = False):
        if not force and self.possession_team == team:
            self.possession_changed_last_play = False
            return
        prev = self.possession_team
        self.possession_team = team
        if prev != team or force:
            self.play_by_play.append(f"[Q{self.quarter} {self.format_time()}] Possession: {team.name}")
            # Dead ball state -> no rebound expected
            self.guard.mark_shot_made()
            self.possession_changed_last_play = True
            self.possession_start_time = self.time_remaining
            self.shot_clock = 24

    def update_minutes_played(self):
        # minimal: credit ~1 possession worth of time to players on court
        t = getattr(self, "_last_possession_time", 12)
        for team in (self.team_a, self.team_b):
            for p in team.lineup:
                p.stats["MIN"] += t / 60.0

    def get_team_defense_modifier(self, team: Team) -> float:
        team.recalculate_ratings()
        return team.defensive_rating

    def allow_heave(self) -> bool:
        return (self.possession_start_time is not None) and (self.possession_start_time <= 4)

    def leading_team(self) -> Team:
        return self.team_a if self.team_a.score >= self.team_b.score else self.team_b

    def leading_margin(self) -> int:
        return abs(self.team_a.score - self.team_b.score)

    def should_dribble_out_q4(self) -> bool:
        return (self.quarter == 4) and (self.time_remaining <= 24) and (self.leading_margin() >= 9)

    # ---------- Setup ----------
    def init_lineups(self):
        self.team_a.lineup = self.team_a.roster[:5]
        self.team_b.lineup = self.team_b.roster[:5]
        for p in self.team_a.lineup + self.team_b.lineup:
            p.on_court = True
            p.stamina = 100.0

    def tip_off(self):
        a_center = max(self.team_a.lineup, key=lambda p: (p.attributes.height, p.attributes.jumping))
        b_center = max(self.team_b.lineup, key=lambda p: (p.attributes.height, p.attributes.jumping))
        a_score = a_center.attributes.height + a_center.attributes.jumping
        b_score = b_center.attributes.height + b_center.attributes.jumping
        self.possession_team = self.team_a if (a_score > b_score or (a_score == b_score and random.random() > 0.5)) else self.team_b
        self.initial_tip_winner = self.possession_team
        self.play_by_play.append(f"[Q1 12:00] Tip-off won by {self.possession_team.name}")
        self.guard.whistle()  # dead-ball to start

    # ---------- Fouling ----------
    def should_commit_foul(self, defender: Player, *, shooting: bool, team_fouls: int, base_foul: float = 0.04) -> bool:
        discipline = (defender.attributes.awareness + defender.attributes.composure + defender.attributes.patience) / 3
        aggression = (defender.attributes.bravery + defender.attributes.determination) / 2
        base = base_foul if shooting else 0.008
        foul_chance = base + (1 - discipline / 100) * 0.08 + (aggression / 100) * 0.04
        if not shooting and team_fouls >= 5:  # bonus
            foul_chance += 0.10
        return random.random() < foul_chance

    # ---------- Free throws ----------
    def simulate_free_throws(self, shooter: Player, num_shots: int = 1) -> bool:
        ft_skill = (0.4 * shooter.attributes.form_technique +
                    0.3 * shooter.attributes.hand_eye_coordination +
                    0.3 * shooter.attributes.composure)
        ft_pct = max(0.1, min(0.90, ft_skill / 100 + random.uniform(-0.05, 0.05)))

        last_made = None
        for i in range(1, num_shots + 1):
            shooter.stats['FTA'] += 1
            made = random.random() < ft_pct
            last_made = made

            is_last = (i == num_shots)
            if made:
                shooter.stats['FTM'] += 1
                shooter.stats['PTS'] += 1
                self.possession_team.score += 1
                self.possession_team.quarter_scores[self.quarter] += 1
                self.play_by_play.append(
                    f"[Q{self.quarter} {self.format_time()}] {shooter.name} Made Free Throw "
                    f"[{self.team_a.name}: {self.team_a.score} | {self.team_b.name}: {self.team_b.score}]"
                )
            else:
                self.play_by_play.append(f"[Q{self.quarter} {self.format_time()}] {shooter.name} Missed Free Throw")

            # Update FT context in guard after each attempt
            self.guard.mark_ft_sequence(self.possession_team.name, last_made is False, is_last)

        # If last FT was made -> dead ball, likely inbound/flip; return True to indicate pos can flip
        if last_made:
            self.guard.mark_shot_made()
            return True

        # Otherwise (last FT missed) -> rebound expected
        shooting_team = self.possession_team
        def_team = self.team_b if shooting_team == self.team_a else self.team_a

        # Slight bias to defense on FTs
        if random.random() < 0.30:
            rebound_team = shooting_team
            pos_changed = False
        else:
            rebound_team = def_team
            pos_changed = True

        rebounder = random.choice(rebound_team.lineup)
        rebounder.stats['REB'] += 1
        if rebound_team is shooting_team:
            self.play_by_play.append(f"[Q{self.quarter} {self.format_time()}] Offensive rebound by {rebounder.name}")
        else:
            self.play_by_play.append(f"[Q{self.quarter} {self.format_time()}] Defensive rebound by {rebounder.name}")

        # After rebound, sequence consumed
        self.guard.consume_rebound()
        return pos_changed

    # ---------- Shots / Possessions ----------
    def simulate_shot(self, *, fast_break_override: Optional[bool] = None,
                      return_type: bool = False, log_possession: bool = True,
                      buzzer_beater: bool = False, force_allow_heave: bool = False):
        fast_break_flag = fast_break_override if fast_break_override is not None else False
        shooter = random.choice(self.possession_team.lineup)
        pos = shooter.position
        time_pressure = (self.time_remaining < 24)
        can_heave = self.allow_heave() or force_allow_heave

        # Shot-type distribution (shortened; keeps behavior reasonable)
        if buzzer_beater:
            if can_heave:
                shot_types = [('3PT Heave', 0.70), ('3PT Pull-Up', 0.10), ('3PT Catch & Shoot', 0.10),
                              ('Layup', 0.05), ('Hook Shot', 0.05)]
            else:
                shot_types = [('3PT Pull-Up', 0.35), ('3PT Catch & Shoot', 0.30), ('Fadeaway', 0.15),
                              ('Floater', 0.10), ('Layup', 0.10)]
        elif fast_break_flag:
            shot_types = [('Layup', 0.45), ('Dunk', 0.35), ('Floater', 0.10),
                          ('3PT Pull-Up', 0.05), ('3PT Catch & Shoot', 0.05)]
        elif time_pressure:
            if can_heave:
                shot_types = [('3PT Heave', 0.40), ('3PT Pull-Up', 0.20), ('3PT Catch & Shoot', 0.15),
                              ('Fadeaway', 0.10), ('Floater', 0.05), ('Layup', 0.10)]
            else:
                shot_types = [('3PT Pull-Up', 0.28), ('3PT Catch & Shoot', 0.25), ('Fadeaway', 0.15),
                              ('Floater', 0.12), ('Layup', 0.10), ('Mid Pull-Up', 0.10)]
        else:
            if pos == 'G':
                shot_types = [('3PT Catch & Shoot', 0.20), ('3PT Pull-Up', 0.17), ('Mid Pull-Up', 0.14),
                              ('Layup', 0.15), ('Floater', 0.11), ('Mid Catch & Shoot', 0.09),
                              ('Fadeaway', 0.06), ('Reverse Layup', 0.05), ('Dunk', 0.03)]
            elif pos == 'F':
                shot_types = [('Mid Catch & Shoot', 0.17), ('3PT Catch & Shoot', 0.15), ('Mid Pull-Up', 0.15),
                              ('Layup', 0.15), ('Fadeaway', 0.11), ('Dunk', 0.09), ('Floater', 0.07),
                              ('Reverse Layup', 0.05), ('3PT Pull-Up', 0.06)]
            else:  # 'C' or unknown
                shot_types = [('Layup', 0.25), ('Dunk', 0.23), ('Hook Shot', 0.15), ('Fadeaway', 0.12),
                              ('Mid Catch & Shoot', 0.08), ('Reverse Layup', 0.07), ('Floater', 0.05),
                              ('3PT Catch & Shoot', 0.05)]

        types, weights = zip(*shot_types)
        shot_type = random.choices(types, weights=weights, k=1)[0]

        defense_team = self.get_defensive_team()
        defenders = defense_team.lineup
        if random.random() < 0.10:
            responsible_defender = random.choice(defenders)
        else:
            same_pos = [d for d in defenders if d.position == pos]
            responsible_defender = random.choice(same_pos) if same_pos else random.choice(defenders)
        defenders_involved = [responsible_defender]

        # Fouls
        team_fouls = self.team_fouls[defense_team.name][self.quarter]
        base_foul = 0.07 if shot_type in ('Layup', 'Dunk', 'Reverse Layup', 'Floater', 'Hook Shot') else 0.02

        # Shooting foul
        if self.should_commit_foul(responsible_defender, shooting=True, team_fouls=team_fouls, base_foul=base_foul):
            responsible_defender.stats['FOUL'] += 1
            responsible_defender.fouls += 1
            self.team_fouls[defense_team.name][self.quarter] += 1
            self.play_by_play.append(
                f"[Q{self.quarter} {self.format_time()}] {shooter.name} misses {shot_type} "
                f"but is fouled by {responsible_defender.name} "
                f"(Personal Fouls: {responsible_defender.fouls} | "
                f"Team Fouls: {self.team_fouls[defense_team.name][self.quarter]})"
            )
            # Dead-ball during FT sequence is handled inside simulate_free_throws
            shots = 3 if '3PT' in shot_type else 2
            pos_changed = self.simulate_free_throws(shooter, num_shots=shots)
            if log_possession and pos_changed:
                self.set_possession(self.get_defensive_team())
            if return_type:
                return shooter, defenders_involved, shot_type, fast_break_flag, pos_changed
            return shooter, defenders_involved

        # Non-shooting foul
        if self.should_commit_foul(responsible_defender, shooting=False, team_fouls=team_fouls):
            responsible_defender.stats['FOUL'] += 1
            responsible_defender.fouls += 1
            self.team_fouls[defense_team.name][self.quarter] += 1
            self.play_by_play.append(
                f"[Q{self.quarter} {self.format_time()}] Non-shooting foul by {responsible_defender.name} "
                f"(Personal Fouls: {responsible_defender.fouls} | "
                f"Team Fouls: {self.team_fouls[defense_team.name][self.quarter]}) "
                f"on {shooter.name}{' [Fast Break]' if fast_break_flag else ''}"
            )
            # Dead-ball whistle -> no rebound expected
            self.guard.whistle()

            # Bonus free throws?
            if self.team_fouls[defense_team.name][self.quarter] >= 5:
                shots = 3 if '3PT' in shot_type else 2
                pos_changed = self.simulate_free_throws(shooter, num_shots=shots)
                if log_possession and pos_changed:
                    self.set_possession(self.get_defensive_team())
                if return_type:
                    return shooter, defenders_involved, shot_type, fast_break_flag, pos_changed
                return shooter, defenders_involved

            if return_type:
                return shooter, defenders_involved, shot_type, fast_break_flag, False
            return shooter, defenders_involved

        # Shot resolution
        # Compute success chance (coarse but stable)
        offense_skill = 0.0
        attr_map = {
            '3PT Catch & Shoot': ['form_technique','finesse','hand_eye_coordination','balance','composure','consistency','awareness','teamwork'],
            '3PT Pull-Up':       ['form_technique','finesse','hand_eye_coordination','balance','composure','consistency','awareness','teamwork','agility','acceleration'],
            '3PT Heave':         ['arm_strength','finesse','composure','bravery'],
            'Mid Catch & Shoot': ['form_technique','finesse','hand_eye_coordination','balance','composure','consistency','awareness','teamwork'],
            'Mid Pull-Up':       ['form_technique','finesse','hand_eye_coordination','balance','composure','consistency','awareness','teamwork','agility','acceleration'],
            'Floater':           ['finesse','creativity','reactions','balance','hand_eye_coordination','composure'],
            'Fadeaway':          ['finesse','form_technique','core_strength','balance','composure','creativity'],
            'Layup':             ['finesse','core_strength','acceleration','agility','composure','balance','jumping','hand_eye_coordination'],
            'Dunk':              ['grip_strength','jumping','balance','acceleration','bravery'],
            'Hook Shot':         ['form_technique','finesse','core_strength','balance','composure'],
            'Reverse Layup':     ['finesse','balance','agility','creativity','composure','grip_strength'],
        }
        use_attrs = attr_map.get(shot_type, ['form_technique','finesse','hand_eye_coordination'])
        vals = [getattr(shooter.attributes, a) for a in use_attrs]
        offense_skill = sum(vals) / len(vals)
        height_factor = (shooter.attributes.height - 72) / 15
        offense_skill *= (1.0 + 0.1 * height_factor)
        offense_skill *= shooter.attributes.stamina / 100.0

        team_attrs = ['teamwork','patience','awareness']
        team_vals = [
            sum(getattr(p.attributes, a) for p in self.possession_team.lineup) / len(self.possession_team.lineup)
            for a in team_attrs
        ]
        team_boost = sum(team_vals) / (100 * len(team_attrs))
        offense_skill *= (1.0 + 0.1 * team_boost)

        defense_pressure = (responsible_defender.attributes.awareness +
                            responsible_defender.attributes.balance +
                            responsible_defender.attributes.reactions) / 3.0

        if shot_type == '3PT Heave':
            success_chance = 0.03
        else:
            success_chance = max(0.10, min(0.95, (offense_skill - defense_pressure + 50) / 150.0))

        shooter.stats['FGA'] += 1
        made = random.random() < success_chance

        # Assist logic (simple)
        assist = None
        if made:
            if 'Catch & Shoot' in shot_type or (random.random() < 0.5 and shot_type not in ('3PT Heave',)):
                mates = [p for p in self.possession_team.lineup if p != shooter]
                if mates:
                    assist = random.choice(mates)
                    assist.stats['AST'] += 1

        # Make/miss logging
        if made:
            shooter.stats['FGM'] += 1
            pts = 3 if '3PT' in shot_type else 2
            shooter.stats['PTS'] += pts
            if '3PT' in shot_type:
                shooter.stats['3PM'] += 1
            self.possession_team.score += pts
            self.possession_team.quarter_scores[self.quarter] += pts
            simple = shot_type.replace("Catch & Shoot ", "").replace("Pull-Up ", "")
            line = f"[Q{self.quarter} {self.format_time()}] {shooter.name} Made {simple}"
            if assist:
                line += f" (assist: {assist.name})"
            if fast_break_flag:
                line += " [Fast Break]"
            line += f" [{self.team_a.name}: {self.team_a.score} | {self.team_b.name}: {self.team_b.score}]"
            self.play_by_play.append(line)

            # Dead-ball after a made FG
            self.guard.mark_shot_made()

            if log_possession:
                self.set_possession(self.get_defensive_team())
            if return_type:
                return shooter, [], shot_type, fast_break_flag, True
            return shooter, []

        # Missed shot (buzzer beater special case)
        if buzzer_beater:
            self.play_by_play.append(
                f"[Q{self.quarter} {self.format_time()}] {shooter.name} missed a {shot_type}"
                f"{' [Fast Break]' if fast_break_flag else ''}"
            )
            # End of period -> no rebound expected
            self.guard.whistle()
            if return_type:
                return shooter, defenders_involved, shot_type, fast_break_flag, False
            return shooter, defenders_involved

        # Miss with possible block
        block = None
        if random.random() < 0.10:
            pool = self.get_defensive_team().lineup
            block = random.choice(pool)
            block.stats['BLK'] += 1
            defenders_involved.append(block)
            self.play_by_play.append(
                f"[Q{self.quarter} {self.format_time()}] {shooter.name} had {shot_type} blocked by {block.name}"
                f"{' [Fast Break]' if fast_break_flag else ''}"
            )
        else:
            self.play_by_play.append(
                f"[Q{self.quarter} {self.format_time()}] {shooter.name} missed a {shot_type}"
                f"{' [Fast Break]' if fast_break_flag else ''}"
            )

        # We now expect a rebound (default: defense)
        self.guard.mark_shot_missed(self.possession_team.name)

        # Rebound logic
        off_team = self.possession_team
        def_team = self.get_defensive_team()
        # Slightly favor defense on live-ball rebounds
        if random.random() < 0.30:
            rebound_team = off_team
            pos_changed = False
        else:
            rebound_team = def_team
            pos_changed = True

        rebounder = random.choice(rebound_team.lineup)
        rebounder.stats['REB'] += 1
        if rebound_team == off_team:
            self.play_by_play.append(f"[Q{self.quarter} {self.format_time()}] Offensive rebound by {rebounder.name}")
        else:
            self.play_by_play.append(f"[Q{self.quarter} {self.format_time()}] Defensive rebound by {rebounder.name}")

        # Rebound consumes the expectation
        self.guard.consume_rebound()

        # Shot clock reset: assume rim hit on most non-heave attempts
        ball_hit_rim = (shot_type != '3PT Heave') or (random.random() < 0.2)
        if ball_hit_rim:
            if rebound_team == def_team:
                self.shot_clock = 24
            else:
                self.shot_clock = max(self.shot_clock, 14)

        if pos_changed and log_possession:
            self.set_possession(rebound_team)

        if return_type:
            return shooter, defenders_involved, shot_type, fast_break_flag, pos_changed
        return shooter, defenders_involved

    def simulate_turnover(self, shooter: Player, log_possession: bool = True):
        turnover_types = ['bad pass', 'travel', 'stepped out of bounds', 'offensive foul', 'lost ball', 'shot clock violation']
        ttype = random.choice(turnover_types)
        shooter.stats['TO'] += 1
        event = f"[Q{self.quarter} {self.format_time()}] Turnover by {shooter.name} ({ttype})"

        # Potential steal only on live-ball TOs
        defense_team = self.get_def
