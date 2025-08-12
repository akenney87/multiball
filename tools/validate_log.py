# tools/validate_log.py
import re
import sys
from collections import defaultdict, deque

LOG_PATH = sys.argv[1] if len(sys.argv) > 1 else "play_by_play_log.txt"

TEAM_TAGS = ("Testers", "Debuggers")

# --- Regexes ---
re_score_bracket = re.compile(r"\[(?:Testers|Home):?\s*(\d+)\s*\|\s*(?:Debuggers|Away):?\s*(\d+)\]")
re_made = re.compile(r"\] ([TD]\d) Made (.+?)(?: \((?:assist: ([TD]\d))\))?(?: \[.*\])?$")
re_miss = re.compile(r"\] ([TD]\d) missed(?:| a) (.+?)(?: \[.*\])?$")
re_block = re.compile(r"\] ([TD]\d) had .* blocked by ([TD]\d)")
re_rebound = re.compile(r"\] ([TD]\d) grabbed the rebound")
re_poss = re.compile(r"\] Possession: (Testers|Debuggers)")
re_turnover = re.compile(r"\] Turnover(?:.*)")
re_foul_shoot = re.compile(r"\] ([TD]\d) misses? .+? but is fouled by ([TD]\d)")
re_foul_nonshoot = re.compile(r"\] Non-shooting foul by ([TD]\d)")
re_ft_made = re.compile(r"\] ([TD]\d) Made Free Throw(?: .*?)?(?: \[.*\])?$")
re_ft_miss = re.compile(r"\] ([TD]\d) Missed Free Throw")
re_end_q = re.compile(r"End of quarter\. Score: .*?(\d+)\s*-\s*(\d+)")
re_final = re.compile(r"Final Score: .*?(\d+)\s*-\s*(\d+)")
re_box_header = re.compile(r"--- Game Over.*")
re_box_line = re.compile(
    r"^\s+([TD]\d): \{.*'PTS': (\d+).+'FGM': (\d+), 'FGA': (\d+), '3PM': (\d+), 'FTM': (\d+), 'FTA': (\d+).*}$"
)

# very light mapping of shot type -> points & 3pt flag
def shot_points(desc: str):
    if desc.startswith("3PT"):
        return 3, True
    if desc.startswith("Free Throw"):
        return 1, False
    # all other field goals assumed 2
    return 2, False

def expect_fts_for_foul(last_shot_desc: str):
    if last_shot_desc.startswith("3PT"): return 3
    # “and-1” not handled here; we only trigger from “misses … but is fouled”
    return 2

def main():
    lines = open(LOG_PATH, "r", encoding="utf-8").read().splitlines()
    errors = []

    # running score we compute from events
    score = {"Testers": 0, "Debuggers": 0}
    last_poss = None

    # basic per-player tallies from PBP
    fgm = defaultdict(int); fga = defaultdict(int)
    tpm = defaultdict(int)
    ftm = defaultdict(int); fta = defaultdict(int)
    pts = defaultdict(int)

    # state machines
    need_rebound = False
    rebound_to = None  # team who should rebound after a miss
    must_flip_poss_after_make = False

    # free-throw state
    pending_ft = 0
    pending_ft_shooter = None
    last_shot_desc = None

    # for end-of-quarter checks
    quarter_running = 1

    # helper
    def player_team(pid):
        return "Testers" if pid.startswith("T") else "Debuggers"

    # walk through log until box score header
    i = 0
    while i < len(lines) and not re_box_header.search(lines[i]):
        line = lines[i]

        # inline score shown on some made FT/FG lines
        sb = re_score_bracket.search(line)

        # possession lines
        m = re_poss.search(line)
        if m:
            poss_team = m.group(1)
            # If a make happened just before, possession must flip
            if must_flip_poss_after_make and poss_team == last_poss:
                errors.append(f"Line {i+1}: possession did not flip after made FG.")
            last_poss = poss_team
            must_flip_poss_after_make = False
            i += 1
            continue

        # made FG
        m = re_made.search(line)
        if m and "Free Throw" not in m.group(2):
            shooter, desc, _ast = m.groups()
            pts_val, is3 = shot_points(desc)
            team = player_team(shooter)
            score[team] += pts_val
            fgm[shooter] += 1; fga[shooter] += 1; pts[shooter] += pts_val
            if is3: tpm[shooter] += 1

            # after a made FG: must flip possession (next Possession line should be other team)
            must_flip_poss_after_make = True
            need_rebound = False
            rebound_to = None
            last_shot_desc = desc
            if sb:
                shownT, shownD = map(int, sb.groups())
                if (shownT, shownD) != (score["Testers"], score["Debuggers"]):
                    errors.append(f"Line {i+1}: scoreboard {shownT}-{shownD} does not match computed {score['Testers']}-{score['Debuggers']}.")
            i += 1
            continue

        # missed FG
        m = re_miss.search(line)
        if m and "Free Throw" not in m.group(2):
            shooter, desc = m.groups()
            fga[shooter] += 1
            need_rebound = True
            rebound_to = "Debuggers" if player_team(shooter) == "Testers" else "Testers"
            last_shot_desc = desc
            i += 1
            continue

        # block events (treated like a miss already handled above)
        if re_block.search(line):
            i += 1
            continue

        # rebound
        m = re_rebound.search(line)
        if m:
            rbd = m.group(1)
            team = player_team(rbd)
            if not need_rebound:
                errors.append(f"Line {i+1}: rebound without a preceding missed shot.")
            elif rebound_to and team != rebound_to:
                errors.append(f"Line {i+1}: rebound to {team} but expected {rebound_to}.")
            need_rebound = False
            rebound_to = None
            i += 1
            continue

        # turnover
        if re_turnover.search(line):
            # possession must flip after a turnover
            must_flip_poss_after_make = False
            need_rebound = False
            rebound_to = None
            i += 1
            continue

        # shooting foul on a miss -> set pending FTs
        m = re_foul_shoot.search(line)
        if m:
            shooter = m.group(1)
            pending_ft = expect_fts_for_foul(last_shot_desc or "")
            pending_ft_shooter = shooter
            i += 1
            continue

        # non-shooting foul: nothing to validate besides existence (clock, bonuses out of scope)
        if re_foul_nonshoot.search(line):
            i += 1
            continue

        # free throws
        m = re_ft_made.search(line)
        if m:
            shooter = m.group(1)
            team = player_team(shooter)
            ftm[shooter] += 1; fta[shooter] += 1; pts[shooter] += 1
            score[team] += 1
            if pending_ft <= 0 or shooter != pending_ft_shooter:
                errors.append(f"Line {i+1}: unexpected made FT by {shooter}.")
            else:
                pending_ft -= 1
            if sb:
                shownT, shownD = map(int, sb.groups())
                if (shownT, shownD) != (score["Testers"], score["Debuggers"]):
                    errors.append(f"Line {i+1}: scoreboard {shownT}-{shownD} does not match computed {score['Testers']}-{score['Debuggers']}.")
            i += 1
            continue

        m = re_ft_miss.search(line)
        if m:
            shooter = m.group(1)
            fta[shooter] += 1
            if pending_ft <= 0 or shooter != pending_ft_shooter:
                errors.append(f"Line {i+1}: unexpected missed FT by {shooter}.")
            else:
                pending_ft -= 1
                # after a missed last FT we expect a rebound soon
                if pending_ft == 0:
                    need_rebound = True
                    rebound_to = None  # either team could get it
            i += 1
            continue

        # end of quarter check (use current running score)
        m = re_end_q.search(line)
        if m:
            shownT, shownD = map(int, m.groups())
            if (shownT, shownD) != (score["Testers"], score["Debuggers"]):
                errors.append(f"End Q{quarter_running}: scoreboard {shownT}-{shownD} does not match computed {score['Testers']}-{score['Debuggers']}.")
            quarter_running += 1
            i += 1
            continue

        # anything else, just move on
        i += 1

    # final score check
    while i < len(lines):
        m = re_final.search(lines[i])
        if m:
            shownT, shownD = map(int, m.groups())
            if (shownT, shownD) != (score["Testers"], score["Debuggers"]):
                errors.append(f"Final Score {shownT}-{shownD} does not match computed {score['Testers']}-{score['Debuggers']}.")
            break
        i += 1

    # box score reconciliation (if present)
    # Walk forward to player lines
    tallies = {"PTS": pts, "FGM": fgm, "FGA": fga, "3PM": tpm, "FTM": ftm, "FTA": fta}
    while i < len(lines):
        m = re_box_line.search(lines[i])
        if m:
            pid, PTS, FGM, FGA, TPM, FTM, FTA = m.groups()
            PTS, FGM, FGA, TPM, FTM, FTA = map(int, (PTS, FGM, FGA, TPM, FTM, FTA))
            # compare each stat
            if tallies["PTS"][pid] != PTS:
                errors.append(f"{pid}: PTS mismatch (box {PTS} vs PBP {tallies['PTS'][pid]}).")
            if tallies["FGM"][pid] != FGM:
                errors.append(f"{pid}: FGM mismatch (box {FGM} vs PBP {tallies['FGM'][pid]}).")
            if tallies["FGA"][pid] != FGA:
                errors.append(f"{pid}: FGA mismatch (box {FGA} vs PBP {tallies['FGA'][pid]}).")
            if tallies["3PM"][pid] != TPM:
                errors.append(f"{pid}: 3PM mismatch (box {TPM} vs PBP {tallies['3PM'][pid]}).")
            if tallies["FTM"][pid] != FTM:
                errors.append(f"{pid}: FTM mismatch (box {FTM} vs PBP {tallies['FTM'][pid]}).")
            if tallies["FTA"][pid] != FTA:
                errors.append(f"{pid}: FTA mismatch (box {FTA} vs PBP {tallies['FTA'][pid]}).")
        i += 1

    if errors:
        print("VALIDATION FAILED")
        print("[")
        for e in errors:
            print(f'  "{e}",')
        print("]")
        sys.exit(1)
    else:
        print("VALIDATION PASSED")

if __name__ == "__main__":
    main()
