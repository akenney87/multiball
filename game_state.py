class GameState:
    def __init__(self):
        self.last_event = None          # e.g. 'shot_missed', 'shot_made', 'ft_missed', 'ft_made', 'block'
        self.last_shooter_team = None   # 'TeamA' or 'TeamB'
        self.last_foul_type = None      # e.g. 'shooting', 'technical', 'flagrant', 'bonus'
