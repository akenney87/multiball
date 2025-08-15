from game_state import GameState

import random
from typing import List, Dict, Optional
from dataclasses import dataclass, field

# --- Player Attributes ---
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
    def __init__(self, name, attributes, position=None, disc_type=None):
        self.name = name
        self.attributes = attributes
        self.position = position
        self.disc_type = disc_type
        self.stats = {
            'PTS': 0, 'REB': 0, 'AST': 0, 'STL': 0, 'BLK': 0, 'TO': 0,
            'FGM': 0, 'FGA': 0, '3PM': 0, 'FTM': 0, 'FTA': 0, 'MIN': 0, 'FOUL': 0
        }
        self.fouls = 0
        self.fatigue = 0
        self.on_court = False
        self.stamina = 100

class Team:
    def __init__(self, name, roster):
        self.name = name
        self.roster = roster
        self.lineup = []
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

# --- Global lightweight tracker (shared via import) ---
game_state = GameState()

# --- Match Simulation ---
class Match:
    def leading_margin(self) -> int:
        return abs(self.team_a.score - self.team_b.score)

    def leading_team(self):
        if self.team_a.score >= self.team_b.score:
            return self.team_a
        else:
            return self.team_b

    def should_dribble_out_q4(self) -> bool:
        return (
            self.quarter == 4 and
            self.time_remaining <= 24 and
            self.leading_margin() >= 9
        )

    def allow_heave(self):
        return self.possession_start_time is not None and self.possession_start_time <= 4

    def simulate_free_throws(self, shooter, num_shots=1):
        # tag start of FT sequence
        game_state.last_event = 'ft_sequence'
        game_state.last_shooter_team = self.possession_team.name

        ft_skill = (
            0.4 * shooter.attributes.form_technique
            + 0.3 * shooter.attributes.hand_eye_coordination
            + 0.3 * shooter.attributes.composure
        )
        ft_pct = max(0.1, min(0.90, ft_skill / 100 + random.uniform(-0.05, 0.05)))

        last_made = None
        for _ in range(num_shots):
            shooter.stats['FTA'] += 1
            made = random.random() < ft_pct
            last_made = made
            if made:
                game_state.last_event = 'ft_made'
                shooter.stats['FTM'] += 1
                shooter.stats['PTS'] += 1
                self.possession_team.score += 1
                self.possession_team.quarter_scores[self.quarter] += 1
                self.play_by_play.append(
                    f"[Q{self.quarter} {self.format_time()}] {shooter.name} Made Free Throw "
                    f"[{self.team_a.name}: {self.team_a.score} | {self.team_b.name}: {self.team_b.score}]"
                )
            else:
                game_state.last_event = 'ft_missed'
                self.play_by_play.append(
                    f"[Q{self.quarter} {self.format_time()}] {shooter.name} Missed Free Throw"
                )

        # If last FT was made, possession flips (no rebound context)
        if last_made:
            game_state.last_event = None
            game_state.last_shooter_team = None
            return True

        # Missed last FT → simulate rebound with bias
        shooting_team = self.possession_team
        def_team = self.team_b if shooting_team == self.team_a else self.team_a

        # ~22% offensive board on missed FT, else defensive
        if random.random() < 0.22:
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
        game_state.last_event = 'rebound'
        game_state.last_shooter_team = None

        # If defensive rebound, flip possession now
        if pos_changed:
            self.set_possession(rebound_team)

        return pos_changed

    def __init__(self, team_a, team_b):
        # 24-second shot clock
        self.shot_clock = 24
        self.possession_start_time = None
        self.possession_changed_last_play = False
        self.team_a = team_a
        self.team_b = team_b
        self.quarter = 1
        self.possession_team = None
        self.play_by_play = []
        self.time_remaining = 12 * 60  # seconds in quarter
        self.possession_number = 0
        self.team_fouls = {team_a.name: {1: 0, 2: 0, 3: 0, 4: 0}, team_b.name: {1: 0, 2: 0, 3: 0, 4: 0}}
        self.fast_break_eligible = False
        self.initial_tip_winner = None

        self.init_lineups()

        # reset lightweight state tracker
        game_state.last_event = None
        game_state.last_shooter_team = None
        game_state.last_foul_type = None

    def init_lineups(self):
        self.team_a.lineup = self.team_a.roster[:5]
        self.team_b.lineup = self.team_b.roster[:5]
        for p in self.team_a.lineup + self.team_b.lineup:
            p.on_court = True
            p.stamina = 100
        for team in [self.team_a, self.team_b]:
            for p in team.roster:
                p.stamina = 100

    def check_for_forfeit(self):
        for team, other_team in [(self.team_a, self.team_b), (self.team_b, self.team_a)]:
            eligible = [p for p in team.roster if p.on_court and p.fouls < 6]
            if len(eligible) < 5:
                self.play_by_play.append(f"[Q{self.quarter} {self.format_time()}] FORFEIT: {team.name} cannot field 5 eligible players. {other_team.name} wins by forfeit.")
                other_team.score = max(other_team.score, team.score + 20)
                self.output_results()
                raise Exception(f"FORFEIT: {team.name} cannot field 5 eligible players.")

    def simulate(self):
        # 1) Opening tip
        self.tip_off()

        # 2) Four quarters
        for q in range(1, 5):
            self.quarter = q
            self.time_remaining = 12 * 60
            self.shot_clock = 24

            # 2a) Determine opener for this quarter
            if q == 1:
                opener = self.initial_tip_winner
            elif q in (2, 3):
                opener = self.team_b if self.initial_tip_winner is self.team_a else self.team_a
            else:  # q == 4
                opener = self.initial_tip_winner

            # 2b) Award opening possession & start clock immediately
            self.set_possession(opener)

            # 2c) In Q1–Q3, play until ~24s remain, then last-shot management
            if q < 4:
                while self.time_remaining > 24:
                    self.simulate_possession()
                    self.update_minutes_played()
                    self.check_for_timeout()
                    if self.time_remaining % (3 * 60) < 24:
                        self.handle_substitutions()

                # Final 24s logic (Q1–Q3)
                if 0 < self.time_remaining <= 24:
                    if self.shot_clock < self.time_remaining:
                        buffer = random.randint(1, 3)
                        take_in = max(1, self.shot_clock - buffer)
                        take_in = min(take_in, self.time_remaining - 1)
                        self._last_possession_time = take_in
                        self.time_remaining -= take_in
                        self.shot_clock -= take_in
                        self.simulate_shot(
                            fast_break_override=False,
                            disc_assist_mod=0,
                            return_type=False,
                            log_possession=True,
                            buzzer_beater=False
                        )
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
            # 2d) In Q4, just play to zero
            else:
                while self.time_remaining > 0:
                    self.simulate_possession()
                    self.update_minutes_played()
                    self.check_for_timeout()
                    if self.time_remaining % (3 * 60) < 24:
                        self.handle_substitutions()

            # End of quarter housekeeping
            self.handle_end_of_quarter()

        # Game over
        self.output_results()

    def _simulate_last_shot(self):
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

        shooter = random.choices(
            self.possession_team.lineup,
            weights=usage_weights,
            k=1
        )[0]

        fatigue_factor = shooter.fatigue / 100
        defense_team = self.get_defensive_team()
        defense_modifier = self.get_team_defense_modifier(defense_team)
        ball_security = 0.5 * shooter.attributes.awareness + 0.5 * shooter.attributes.hand_eye_coordination

        turnover_chance = max(
            0.03,
            0.08
            + 0.10 * fatigue_factor
            + 0.10 * (defense_modifier / 100)
            - 0.08 * (ball_security / 100)
        )
        shot_chance = min(
            0.85,
            0.60 + 0.10 * (
                usage_weights[self.possession_team.lineup.index(shooter)]
                / max(usage_weights)
            )
        ) - 0.10 * fatigue_factor

        event = random.choices(
            ['shot', 'turnover'],
            weights=[shot_chance, turnover_chance],
            k=1
        )[0]

        if event == 'shot':
            self.simulate_shot(
                fast_break_override=False,
                disc_assist_mod=0,
                return_type=False,
                log_possession=True,
                buzzer_beater=True
            )
        else:
            self.simulate_turnover(shooter, log_possession=True)

        self.time_remaining = 0

    def update_minutes_played(self):
        possession_time = getattr(self, '_last_possession_time', 14)
        for team in [self.team_a, self.team_b]:
            for player in team.lineup:
                player.stats['MIN'] += possession_time / 60

    def check_for_timeout(self):
        pass

    def handle_substitutions(self):
        pass

    def tip_off(self):
        a_center = max(self.team_a.lineup, key=lambda p: (p.attributes.height, p.attributes.jumping))
        b_center = max(self.team_b.lineup, key=lambda p: (p.attributes.height, p.attributes.jumping))
        a_score = a_center.attributes.height + a_center.attributes.jumping
        b_score = b_center.attributes.height + b_center.attributes.jumping

        if a_score > b_score or (a_score == b_score and random.random() > 0.5):
            self.possession_team = self.team_a
        else:
            self.possession_team = self.team_b

        self.initial_tip_winner = self.possession_team
        self.play_by_play.append(f"[Q1 12:00] Tip-off won by {self.possession_team.name}")

    def format_time(self):
        min_left = self.time_remaining // 60
        sec_left = self.time_remaining % 60
        return f"{int(min_left)}:{int(sec_left):02d}"

    def set_possession(self, team, *, force=False):
        # Only log and update on true possession changes
        if not force and self.possession_team == team:
            return
        prev_team = self.possession_team
        self.possession_team = team
        if prev_team != team or force:
            self.play_by_play.append(f"[Q{self.quarter} {self.format_time()}] Possession: {team.name}")
            self.possession_changed_last_play = True
            self.possession_start_time = self.time_remaining
            # clear rebound-able context
            game_state.last_event = None
            game_state.last_shooter_team = None
        else:
            self.possession_changed_last_play = False

    def advance_time(self, fast_break=False, early_shot=False, free_throw=False):
        if fast_break:
            seconds = random.randint(4, 7)
        elif early_shot:
            seconds = random.randint(8, 12)
        elif free_throw:
            seconds = random.randint(3, 6)
        else:
            seconds = random.randint(12, 18)
        self._last_possession_time = min(seconds, self.time_remaining)
        self.time_remaining = max(0, self.time_remaining - seconds)

    def simulate_possession(self):
        # Q4 dribble-out logic
        if self.should_dribble_out_q4() and self.possession_team == self.leading_team():
            self.play_by_play.append(
                f"[Q4 {self.format_time()}] {self.leading_team().name} dribbled out the clock."
            )
            self._last_possession_time = self.time_remaining
            self.time_remaining = 0
            return

        if self.possession_changed_last_play:
            self.shot_clock = 24
        else:
            if self.shot_clock < 14:
                self.shot_clock = 14

        self.possession_changed_last_play = False

        # 0) Fast break?
        fast_break_flag = self.fast_break_eligible
        self.fast_break_eligible = False

        # 0) Buzzer‐beater logic for Q1–Q3:
        buzzer_beater = (self.quarter < 4 and self.time_remaining <= self.shot_clock)

        # 1) Build usage weights & pick shooter
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

        shooter = random.choices(
            self.possession_team.lineup,
            weights=usage_weights,
            k=1
        )[0]

        # 2) Decide event
        fatigue_factor = shooter.fatigue / 100
        defense_modifier = self.get_team_defense_modifier(self.get_defensive_team())
        ball_security = 0.5 * shooter.attributes.awareness + 0.5 * shooter.attributes.hand_eye_coordination

        turnover_chance = max(
            0.03,
            0.08
            + 0.10 * fatigue_factor
            + 0.10 * (defense_modifier / 100)
            - 0.08 * (ball_security / 100)
        )
        shot_chance = min(
            0.85,
            0.60 + 0.10 * (
                usage_weights[self.possession_team.lineup.index(shooter)]
                / max(usage_weights)
            )
        ) - 0.10 * fatigue_factor
        pass_chance = 1.0 - shot_chance - turnover_chance

        # clamp/normalize
        shot_chance = max(0.0, min(1.0, shot_chance))
        turnover_chance = max(0.0, min(1.0, turnover_chance))
        pass_chance = 1.0 - shot_chance - turnover_chance
        if pass_chance < 0.0:
            total = shot_chance + turnover_chance
            if total <= 0.0:
                shot_chance, turnover_chance, pass_chance = 1.0, 0.0, 0.0
            else:
                shot_chance /= total
                turnover_chance /= total
                pass_chance = 0.0

        event = random.choices(
            ['shot', 'turnover', 'pass'],
            weights=[shot_chance, turnover_chance, pass_chance],
            k=1
        )[0]

        # 3) Execute event
        early_shot_flag = False
        defenders_involved = []
        possession_changed = False

        if event == 'shot':
            shot_result = self.simulate_shot(
                fast_break_override=fast_break_flag,
                disc_assist_mod=0,
                return_type=True,
                log_possession=False,
                buzzer_beater=buzzer_beater
            )
            if shot_result is not None:
                shooter, defenders_involved, shot_type, fast_break_flag, possession_changed = shot_result
                early_shot_flag = ('3PT Pull-Up' in shot_type) or ('Mid Pull-Up' in shot_type)
            else:
                shooter, defenders_involved, shot_type, fast_break_flag, possession_changed = shooter, [], '', False, False

        elif event == 'turnover':
            self.simulate_turnover(shooter, log_possession=False)
            possession_changed = True

        else:  # pass
            teammates = [p for p in self.possession_team.lineup if p != shooter]
            if not teammates:
                self.play_by_play.append(
                    f"[Q{self.quarter} {self.format_time()}] "
                    f"{shooter.name} forced to shoot (no teammates available)"
                )
                res = self.simulate_shot(
                    fast_break_override=fast_break_flag,
                    return_type=True,
                    log_possession=False
                )
                if res:
                    shooter, defenders_involved, shot_type, fb_override, possession_changed = res
                    fast_break_flag = fb_override
                    early_shot_flag = 'Pull-Up' in shot_type
            else:
                pass_to = random.choices(
                    teammates,
                    weights=[
                        p.attributes.awareness + p.attributes.hand_eye_coordination
                        for p in teammates
                    ],
                    k=1
                )[0]
                if random.random() < (0.03 + 0.04 * (defense_modifier / 100)):
                    shooter.stats['TO'] += 1
                    self.play_by_play.append(
                        f"[Q{self.quarter} {self.format_time()}] Turnover: bad pass "
                        f"from {shooter.name} intended for {pass_to.name}"
                    )
                    possession_changed = True
                elif random.random() < 0.3:
                    res = self.simulate_shot(
                        fast_break_override=fast_break_flag,
                        return_type=True,
                        log_possession=False
                    )
                    if res:
                        shooter, defenders_involved, shot_type, fb_override, possession_changed = res
                        fast_break_flag = fb_override
                        early_shot_flag = 'Pull-Up' in shot_type

        # Flip possession if it actually changed
        if possession_changed:
            self.set_possession(self.get_defensive_team())
            self.possession_changed_last_play = True

        # Advance clocks once
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

        # Bookkeeping
        self.update_fatigue(
            shooter,
            defenders_involved,
            fast_break=fast_break_flag
        )
        self.possession_number += 1

    def get_team_defense_modifier(self, team):
        team.recalculate_ratings()
        return team.defensive_rating

    def update_fatigue(self, shooter=None, defenders_involved=None, fast_break=False):
        for team in [self.team_a, self.team_b]:
            for player in team.lineup:
                player.fatigue += 0.7
                if shooter and player == shooter:
                    player.fatigue += 0.7
                if defenders_involved and player in defenders_involved:
                    player.fatigue += 0.5
                if fast_break:
                    player.fatigue += 0.5
                player.fatigue = min(player.fatigue, 100)
        for team in [self.team_a, self.team_b]:
            for player in team.roster:
                if not player.on_court:
                    player.fatigue = max(0, player.fatigue - 1.2)

        offense_team = self.possession_team
        defense_team = self.team_b if self.possession_team == self.team_a else self.team_a
        for player in offense_team.lineup:
            player.stamina = max(0, player.stamina - 0.5)
        for player in defense_team.lineup:
            player.stamina = max(0, player.stamina - 0.3)

        if shooter and shooter in offense_team.lineup:
            if defenders_involved is not None and len(defenders_involved) > 0:
                shooter.stamina = max(0, shooter.stamina - 0.5)
        if defenders_involved:
            for p in defenders_involved:
                p.stamina = max(0, p.stamina - 0.5)
        if fast_break:
            for team in [offense_team, defense_team]:
                for player in team.lineup:
                    player.stamina = max(0, player.stamina - 0.3)
        for team in [self.team_a, self.team_b]:
            for player in team.roster:
                if not player.on_court:
                    player.stamina = min(100, player.stamina + 1)

    def handle_end_of_quarter(self):
        self.play_by_play.append(
            f"[Q{self.quarter}] End of quarter. Score: {self.team_a.name} {self.team_a.score} - {self.team_b.name} {self.team_b.score}"
        )
        for team in [self.team_a, self.team_b]:
            for player in team.roster:
                if not player.on_court:
                    player.fatigue = max(0, player.fatigue - 8)
                    player.stamina = min(100, player.stamina + 6)

    def should_commit_foul(self, defender, shooting=False, team_fouls=0, base_foul=0.04):
        discipline = (
            defender.attributes.awareness +
            defender.attributes.composure +
            defender.attributes.patience
        ) / 3
        aggression = (
            defender.attributes.bravery + defender.attributes.determination
        ) / 2
        base = base_foul if shooting else 0.008
        foul_chance = base + (1 - discipline / 100) * 0.08 + (aggression / 100) * 0.04
        if not shooting and team_fouls >= 5:
            foul_chance += 0.10  # bonus
        return random.random() < foul_chance

    def simulate_shot(
        self,
        fast_break_override=None,
        disc_assist_mod=0,
        return_type=False,
        log_possession=True,
        buzzer_beater=False,
        force_allow_heave=False,
    ):
        fast_break_flag = fast_break_override if fast_break_override is not None else False

        shooter = random.choice(self.possession_team.lineup)
        pos = shooter.position
        time_pressure = (self.time_remaining < 24)
        can_heave = self.allow_heave() or force_allow_heave

        # --- Shot-type distribution ---
        if buzzer_beater:
            can_heave = self.allow_heave()
            if can_heave:
                shot_types = [
                    ('3PT Heave',         0.70),
                    ('3PT Pull-Up',       0.10),
                    ('3PT Catch & Shoot', 0.10),
                    ('Layup',             0.05),
                    ('Hook Shot',         0.05),
                ]
            else:
                shot_types = [
                    ('3PT Pull-Up',       0.35),
                    ('3PT Catch & Shoot', 0.30),
                    ('Fadeaway',          0.15),
                    ('Floater',           0.10),
                    ('Layup',             0.10),
                ]
        elif fast_break_flag:
            shot_types = [
                ('Layup',             0.45),
                ('Dunk',              0.35),
                ('Floater',           0.10),
                ('3PT Pull-Up',       0.05),
                ('3PT Catch & Shoot', 0.05),
            ]
        elif time_pressure:
            can_heave = self.allow_heave()
            if can_heave:
                shot_types = [
                    ('3PT Heave',         0.40),
                    ('3PT Pull-Up',       0.20),
                    ('3PT Catch & Shoot', 0.15),
                    ('Fadeaway',          0.10),
                    ('Floater',           0.05),
                ]
            else:
                shot_types = [
                    ('3PT Pull-Up',       0.28),
                    ('3PT Catch & Shoot', 0.25),
                    ('Fadeaway',          0.15),
                    ('Floater',           0.12),
                    ('Layup',             0.10),
                    ('Mid Pull-Up',       0.10),
                ]
        else:
            if pos == 'G':
                shot_types = [
                    ('3PT Catch & Shoot', 0.20),
                    ('3PT Pull-Up',       0.17),
                    ('Mid Pull-Up',       0.14),
                    ('Layup',             0.15),
                    ('Floater',           0.11),
                    ('Mid Catch & Shoot', 0.09),
                    ('Fadeaway',          0.06),
                    ('Reverse Layup',     0.05),
                    ('Dunk',              0.03),
                ]
            elif pos == 'F':
                shot_types = [
                    ('Mid Catch & Shoot', 0.17),
                    ('3PT Catch & Shoot', 0.15),
                    ('Mid Pull-Up',       0.15),
                    ('Layup',             0.15),
                    ('Fadeaway',          0.11),
                    ('Dunk',              0.09),
                    ('Floater',           0.07),
                    ('Reverse Layup',     0.05),
                    ('3PT Pull-Up',       0.06),
                ]
            elif pos == 'C':
                shot_types = [
                    ('Layup',             0.25),
                    ('Dunk',              0.23),
                    ('Hook Shot',         0.15),
                    ('Fadeaway',          0.12),
                    ('Mid Catch & Shoot', 0.08),
                    ('Reverse Layup',     0.07),
                    ('Floater',           0.05),
                    ('3PT Catch & Shoot', 0.05),
                ]
            else:
                shot_types = [
                    ('Layup',             0.20),
                    ('3PT Catch & Shoot', 0.16),
                    ('Mid Pull-Up',       0.13),
                    ('Dunk',              0.11),
                    ('Fadeaway',          0.10),
                    ('Floater',           0.09),
                    ('Reverse Layup',     0.08),
                    ('3PT Pull-Up',       0.07),
                    ('Mid Catch & Shoot', 0.06),
                ]

        if buzzer_beater and not self.allow_heave():
            assert all(s[0] != '3PT Heave' for s in shot_types), "Heave not allowed"

        types, weights = zip(*shot_types)
        shot_type = random.choices(types, weights=weights, k=1)[0]

        # 4) Assign defender
        defense_team = self.team_b if self.possession_team == self.team_a else self.team_a
        defenders = defense_team.lineup
        if random.random() < 0.10:
            responsible_defender = random.choice(defenders)
        else:
            same_pos = [d for d in defenders if d.position == pos]
            responsible_defender = random.choice(same_pos) if same_pos else random.choice(defenders)
        defenders_involved = [responsible_defender]

        # 5) Foul checks
        team_fouls = self.team_fouls[defense_team.name][self.quarter]
        base_foul = 0.07 if shot_type in ('Layup', 'Dunk', 'Reverse Layup', 'Floater', 'Hook Shot') else 0.02

        # Shooting foul → free throws
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
                f"[Q{self.quarter} {self.format_time()}] Non-shooting foul by "
                f"{responsible_defender.name} "
                f"(Personal Fouls: {responsible_defender.fouls} | "
                f"Team Fouls: {self.team_fouls[defense_team.name][self.quarter]}) "
                f"on {shooter.name}{' [Fast Break]' if fast_break_flag else ''}"
            )
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

        # --- Normal shot attempt → success logic ---
        # attribute maps
        shot_attr_map = {
            '3PT Catch & Shoot': [
                'form_technique','finesse','hand_eye_coordination',
                'balance','composure','consistency','awareness','teamwork'
            ],
            '3PT Pull-Up': [
                'form_technique','finesse','hand_eye_coordination',
                'balance','composure','consistency','awareness','teamwork',
                'agility','acceleration'
            ],
            '3PT Heave': ['arm_strength','finesse','composure','bravery'],
            'Mid Catch & Shoot': [
                'form_technique','finesse','hand_eye_coordination',
                'balance','composure','consistency','awareness','teamwork'
            ],
            'Mid Pull-Up': [
                'form_technique','finesse','hand_eye_coordination',
                'balance','composure','consistency','awareness','teamwork',
                'agility','acceleration'
            ],
            'Floater': [
                'finesse','creativity','reactions',
                'balance','hand_eye_coordination','composure'
            ],
            'Fadeaway': [
                'finesse','form_technique','core_strength',
                'balance','composure','creativity'
            ],
            'Layup': [
                'finesse','core_strength','acceleration','agility',
                'composure','balance','jumping','hand_eye_coordination'
            ],
            'Dunk': [
                'grip_strength','jumping','balance',
                'acceleration','bravery'
            ],
            'Putback': [
                'reactions','grip_strength','jumping',
                'determination','awareness'
            ],
            'Reverse Layup': [
                'finesse','balance','agility',
                'creativity','composure','grip_strength'
            ]
        }
        attrs = shot_attr_map.get(shot_type, [
            'form_technique','finesse','hand_eye_coordination'
        ])
        vals = [getattr(shooter.attributes, a) for a in attrs]
        offense_skill = sum(vals) / len(vals)

        # height & stamina
        height_factor = (shooter.attributes.height - 72) / 15
        offense_skill *= (1.0 + 0.1 * height_factor)
        offense_skill *= shooter.attributes.stamina / 100

        # team boost
        team_attrs = ['teamwork','patience','awareness']
        team_vals = [
            sum(getattr(p.attributes, a) for p in self.possession_team.lineup)
            / len(self.possession_team.lineup)
            for a in team_attrs
        ]
        team_boost = sum(team_vals) / (100 * len(team_attrs))
        offense_skill *= (1.0 + 0.1 * team_boost)

        # defense pressure
        defense_pressure = (
            responsible_defender.attributes.awareness
            + responsible_defender.attributes.balance
            + responsible_defender.attributes.reactions
        ) / 3

        # success chance
        if shot_type == '3PT Heave':
            success_chance = 0.03
        else:
            success_chance = max(
                0.10,
                min(0.95, (offense_skill - defense_pressure + 50) / 150)
            )

        shooter.stats['FGA'] += 1
        made = random.random() < success_chance

        # 7) Assist logic on made only
        assist = None
        if made and 'Catch & Shoot' in shot_type:
            mates = [p for p in self.possession_team.lineup if p != shooter]
            if mates:
                assist = random.choice(mates)
                assist.stats['AST'] += 1
        elif made and shot_type not in ('3PT Heave',) and random.random() < (0.5 + disc_assist_mod):
            mates = [p for p in self.possession_team.lineup if p != shooter]
            if mates:
                assist = random.choice(mates)
                assist.stats['AST'] += 1
        if fast_break_flag and made and not assist:
            candidates = [p for p in self.possession_team.lineup if p != shooter]
            if candidates:
                best = max(candidates, key=lambda p: 0.6*p.attributes.awareness + 0.4*p.attributes.throw_accuracy)
                if best.attributes.awareness > 70 and best.attributes.throw_accuracy > 65:
                    assist = best
                    assist.stats['AST'] += 1

        # 8) Made shot → log, flip, return
        if made:
            game_state.last_event = 'shot_made'
            game_state.last_shooter_team = self.possession_team.name

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
            self.play_by_play.append(line)
            if log_possession:
                other = self.team_b if self.possession_team == self.team_a else self.team_a
                self.set_possession(other)
            if return_type:
                return shooter, [], shot_type, fast_break_flag, True
            return shooter, []

        # 9) Missed shot → no block/rebound if buzzer_beater
        if buzzer_beater:
            game_state.last_event = 'shot_missed'
            game_state.last_shooter_team = self.possession_team.name
            self.play_by_play.append(
                f"[Q{self.quarter} {self.format_time()}] {shooter.name} missed a {shot_type}"
                f"{' [Fast Break]' if fast_break_flag else ''}"
            )
            if return_type:
                return shooter, defenders_involved, shot_type, fast_break_flag, False
            return shooter, defenders_involved

        # 10) Missed shot → block or miss
        if random.random() < 0.10:
            # block
            pool = self.team_b.lineup if self.possession_team == self.team_a else self.team_a.lineup
            block = random.choice(pool)
            block.stats['BLK'] += 1
            defenders_involved.append(block)
            game_state.last_event = 'block'
            game_state.last_shooter_team = self.possession_team.name
            self.play_by_play.append(
                f"[Q{self.quarter} {self.format_time()}] "
                f"{shooter.name} had {shot_type} blocked by {block.name}"
                f"{' [Fast Break]' if fast_break_flag else ''}"
            )
        else:
            # normal miss
            game_state.last_event = 'shot_missed'
            game_state.last_shooter_team = self.possession_team.name
            self.play_by_play.append(
                f"[Q{self.quarter} {self.format_time()}] {shooter.name} missed a {shot_type}"
                f"{' [Fast Break]' if fast_break_flag else ''}"
            )

        # 11) Rebound logic (guarded)
        # Only allow rebounds after a missed shot or block
        if game_state.last_event not in ('shot_missed', 'block'):
            if return_type:
                return shooter, defenders_involved, shot_type, fast_break_flag, False
            return shooter, defenders_involved

        off_team = self.possession_team
        def_team = self.team_b if off_team == self.team_a else self.team_a

        # Track if shot hit rim (for clock reset)
        ball_hit_rim = (shot_type != '3PT Heave') and (random.random() < 0.85)

        # ~22% offensive board baseline, otherwise defensive (you can tune later per attributes)
        if random.random() < 0.22:
            rebound_team = off_team
            pos_changed = False
        else:
            rebound_team = def_team
            pos_changed = True

        rebounder = random.choice(rebound_team.lineup)
        rebounder.stats['REB'] += 1
        self.play_by_play.append(
            f"[Q{self.quarter} {self.format_time()}] {rebounder.name} grabbed the rebound"
        )
        game_state.last_event = 'rebound'
        game_state.last_shooter_team = None

        if pos_changed and log_possession:
            self.set_possession(rebound_team)

        # Shot clock reset
        if ball_hit_rim:
            if rebound_team == def_team:
                self.shot_clock = 24
            else:
                self.shot_clock = max(self.shot_clock, 14)

        if return_type:
            return shooter, defenders_involved, shot_type, fast_break_flag, pos_changed
        return shooter, defenders_involved

    def get_defensive_team(self):
        return self.team_b if self.possession_team == self.team_a else self.team_a

    def simulate_turnover(self, shooter, log_possession=True):
        turnover_types = [
            'bad pass', 'travel', 'stepped out of bounds',
            'offensive foul', 'lost ball', 'shot clock violation'
        ]
        turnover_type = random.choice(turnover_types)

        shooter.stats['TO'] += 1
        event = f"[Q{self.quarter} {self.format_time()}] Turnover by {shooter.name} ({turnover_type})"
        defense_team = self.get_defensive_team()
        defenders = defense_team.lineup

        # Attempt a steal only on live-ball turnovers
        if turnover_type not in (
            'shot clock violation',
            'offensive foul',
            'stepped out of bounds',
            'travel'
        ) and defenders:
            def_stealer = max(
                defenders,
                key=lambda d: (
                    d.attributes.reactions
                    + d.attributes.awareness
                    + d.attributes.hand_eye_coordination
                )
            )
            steal_pressure = (
                def_stealer.attributes.reactions
                + def_stealer.attributes.awareness
                + def_stealer.attributes.hand_eye_coordination
            ) / 3
            steal_chance = max(0.15, min(0.6, steal_pressure / 100))
            if random.random() < steal_chance:
                def_stealer.stats['STL'] += 1
                event += f" (steal: {def_stealer.name})"

        self.play_by_play.append(event)

        # turnovers clear shot/FT context
        game_state.last_event = None
        game_state.last_shooter_team = None

        # Always flip possession and reset clocks after turnover (unless horn)
        if self.time_remaining > 0:
            other = self.team_b if self.possession_team == self.team_a else self.team_a
            self.set_possession(other)
            self.shot_clock = 24
            self.possession_start_time = self.time_remaining
            self.possession_changed_last_play = True

    def resolve_shot_result(self, shooter, shot_type, defenders_involved, fast_break):
        # Kept for backward-compat; not used by main flow
        return None

    def output_results(self):
        self.play_by_play.append(f"--- Game Over: {self.team_a.name} vs {self.team_b.name} ---")
        self.play_by_play.append(f"Final Score: {self.team_a.name} {self.team_a.score} - {self.team_b.name} {self.team_b.score}")
        for team in [self.team_a, self.team_b]:
            self.play_by_play.append(f"{team.name} Box Score:")
            for player in team.roster:
                if player.stats['MIN'] > 0:
                    self.play_by_play.append(f"  {player.name}: {player.stats}")
        with open("play_by_play_log.txt", "w") as f:
            for line in self.play_by_play:
                f.write(f"{line}\n")
        print("Play-by-play log saved to 'play_by_play_log.txt'")

def generate_random_player(name: str, position: str, disc_type: Optional[str] = None):
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
        height=random.uniform(150, 210)
    )
    return Player(name=name, attributes=attributes, position=position, disc_type=disc_type)

def generate_random_team(name: str, num_players: int):
    roster = [generate_random_player(f"Player {i+1}", random.choice(['G', 'F', 'C'])) for i in range(num_players)]
    return Team(name=name, roster=roster)

# Example usage (keep or remove as needed for your tests)
if __name__ == "__main__":
    team_a = generate_random_team("Sharks", 12)
    team_b = generate_random_team("Eagles", 12)
    match = Match(team_a, team_b)
    match.simulate()
