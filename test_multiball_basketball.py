import unittest
import random
from multiball_basketball import PlayerAttributes, Player, Team, Match

def make_random_player(name):
    # Random attributes between 40 and 99 for realism
    attrs = PlayerAttributes(
        grip_strength=random.uniform(40, 99),
        arm_strength=random.uniform(40, 99),
        core_strength=random.uniform(40, 99),
        agility=random.uniform(40, 99),
        acceleration=random.uniform(40, 99),
        top_speed=random.uniform(40, 99),
        jumping=random.uniform(40, 99),
        reactions=random.uniform(40, 99),
        stamina=random.uniform(40, 99),
        balance=random.uniform(40, 99),
        awareness=random.uniform(40, 99),
        creativity=random.uniform(40, 99),
        determination=random.uniform(40, 99),
        bravery=random.uniform(40, 99),
        consistency=random.uniform(40, 99),
        composure=random.uniform(40, 99),
        deception=random.uniform(40, 99),
        teamwork=random.uniform(40, 99),
        patience=random.uniform(40, 99),
        hand_eye_coordination=random.uniform(40, 99),
        throw_accuracy=random.uniform(40, 99),
        form_technique=random.uniform(40, 99),
        finesse=random.uniform(40, 99),
        height=random.uniform(68, 87)  # 5'8" to 7'3"
    )
    return Player(name=name, attributes=attrs)

def make_random_team(team_name, prefix):
    return Team(
        name=team_name,
        roster=[make_random_player(f"{prefix}{i+1}") for i in range(10)]
    )

class TestMultiballBasketballSimulator(unittest.TestCase):
    def test_simulation_runs_and_outputs(self):
        team_a = make_random_team("Testers", "T")
        team_b = make_random_team("Debuggers", "D")
        match = Match(team_a, team_b)
        match.simulate()
        # Check play-by-play log is not empty
        self.assertTrue(len(match.play_by_play) > 0)
        # Check both teams have a non-negative score
        self.assertGreaterEqual(team_a.score, 0)
        self.assertGreaterEqual(team_b.score, 0)
        # Check each team has 10 players
        self.assertEqual(len(team_a.roster), 10)
        self.assertEqual(len(team_b.roster), 10)

    def test_100_game_stat_averages(self):
        NUM_RUNS = 100
        stat_keys = ['FGA', 'FGM', '3PA', '3PM', 'FTA', 'FTM', 'TO', 'PTS', 'FOUL', 'AST', 'REB', 'STL', 'BLK']
        team_stats = {
            'A': {k: 0 for k in stat_keys},
            'B': {k: 0 for k in stat_keys}
        }
        forfeits = 0
        for _ in range(NUM_RUNS):
            team_a = make_random_team("Testers", "T")
            team_b = make_random_team("Debuggers", "D")
            match = Match(team_a, team_b)
            try:
                match.simulate()
            except Exception as e:
                if "FORFEIT" in str(e):
                    forfeits += 1
                    continue  # skip this run if a team forfeits
                else:
                    raise  # re-raise unexpected exceptions
            for team, key in [(team_a, 'A'), (team_b, 'B')]:
                for player in team.roster:
                    team_stats[key]['FGA'] += player.stats.get('FGA', 0)
                    team_stats[key]['FGM'] += player.stats.get('FGM', 0)
                    team_stats[key]['3PA'] += player.stats.get('3PA', 0)
                    team_stats[key]['3PM'] += player.stats.get('3PM', 0)
                    team_stats[key]['FTA'] += player.stats.get('FTA', 0)
                    team_stats[key]['FTM'] += player.stats.get('FTM', 0)
                    team_stats[key]['TO']  += player.stats.get('TO', 0)
                    team_stats[key]['PTS'] += player.stats.get('PTS', 0)
                    team_stats[key]['FOUL']+= player.stats.get('FOUL', 0)
                    team_stats[key]['AST'] += player.stats.get('AST', 0)
                    team_stats[key]['REB'] += player.stats.get('REB', 0)
                    team_stats[key]['STL'] += player.stats.get('STL', 0)
                    team_stats[key]['BLK'] += player.stats.get('BLK', 0)
        print("\n--- 100 Game Stat Averages ---")
        for key, label in [('A', 'Testers'), ('B', 'Debuggers')]:
            print(f"{label}:")
            for stat in stat_keys:
                avg = team_stats[key][stat] / (NUM_RUNS - forfeits) if (NUM_RUNS - forfeits) > 0 else 0
                print(f"  {stat}: {avg:.2f}")
        print(f"\nForfeits: {forfeits} out of {NUM_RUNS}")

if __name__ == "__main__":
    unittest.main()
