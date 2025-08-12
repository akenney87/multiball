import re, sys, ast, json
from collections import defaultdict, Counter
from pathlib import Path

LOG_PATH = Path(sys.argv[1] if len(sys.argv) > 1 else "play_by_play_log.txt")

SHOT_VALUE_RE = re.compile(r"Made (?:3PT\b.*|Free Throw|.*)")
SCORE_RE = re.compile(r"\[Testers:\s*(\d+)\s*\|\s*Debuggers:\s*(\d+)\]")
MADE_RE = re.compile(r"^(T|D)(\d)\s+Made\s+(.*)")
MISSED_RE = re.compile(r"^(T|D)(\d)\s+miss(?:ed|es)\s+(.*)", re.IGNORECASE)
FT_MADE_RE = re.compile(r"^(T|D)(\d)\s+Made Free Throw")
FT_MISS_RE = re.compile(r"^(T|D)(\d)\s+Missed Free Throw")

def shot_points(desc: str) -> int:
    d = desc.lower()
    if "free throw" in d: return 1
    if "3pt" in d: return 3
    # default all other makes to 2
    return 2

def load_lines():
    if not LOG_PATH.exists():
        print(f"ERROR: Log not found at {LOG_PATH}")
        sys.exit(2)
    return [ln.strip() for ln in LOG_PATH.read_text(encoding="utf-8", errors="ignore").splitlines()]

def parse_box_scores(lines):
    # Grab dict-ish lines after "Testers Box Score:" and "Debuggers Box Score:"
    def take_block(start_idx):
        data = {}
        i = start_idx + 1
        while i < len(lines) and lines[i].strip():
            # e.g.: "  T1: {'PTS': 10, 'REB': 13, ...}"
            m = re.match(r"\s*([TD]\d):\s*(\{.*\})\s*$", lines[i])
            if m:
                who = m.group(1)
                try:
                    d = ast.literal_eval(m.group(2))
                    data[who] = d
                except Exception:
                    pass
                i += 1
            else:
                break
        return data

    testers_idx = next((i for i,l in enumerate(lines) if l.strip().startswith("Testers Box Score:")), -1)
    dbg_idx = next((i for i,l in enumerate(lines) if l.strip().startswith("Debuggers Box Score:")), -1)
    testers = take_block(testers_idx) if testers_idx != -1 else {}
    dbg = take_block(dbg_idx) if dbg_idx != -1 else {}
    return testers | dbg

def main():
    lines = load_lines()

    # Running score we compute
    score = {"T": 0, "D": 0}
    last_seen_score = {"T": 0, "D": 0}

    # Derived box from PBP
    makes = Counter()
    misses = Counter()
    threes_made = Counter()
    ftm = Counter()
    fta = Counter()
    pts = Counter()

    errors = []

    for i, ln in enumerate(lines):
        # On any line that shows a scoreboard, verify it matches our running total so far
        s = SCORE_RE.search(ln)
        if s:
            shown_T = int(s.group(1))
            shown_D = int(s.group(2))
            if shown_T < last_seen_score["T"] or shown_D < last_seen_score["D"]:
                errors.append(f"Line {i+1}: scoreboard decreased ({shown_T},{shown_D}) from prior ({last_seen_score['T']},{last_seen_score['D']}).")
            # If we've already tallied a make earlier on this line, score should equal 'score'
            if (shown_T, shown_D) != (score["T"], score["D"]):
                errors.append(f"Line {i+1}: scoreboard {shown_T}-{shown_D} does not match computed {score['T']}-{score['D']}.")
            last_seen_score["T"], last_seen_score["D"] = shown_T, shown_D

        # Track shot outcomes to build player stats from PBP
        m = MADE_RE.search(ln)
        if m:
            team, pnum, desc = m.group(1), m.group(2), m.group(3)
            key = f"{team}{pnum}"
            pts_gained = shot_points(desc)
            score["T" if team=="T" else "D"] += pts_gained
            makes[key] += (0 if "Free Throw" in desc else 1)
            if "3PT" in desc.upper(): threes_made[key] += 1
            if "Free Throw" in desc: 
                ftm[key] += 1; fta[key] += 1
            pts[key] += pts_gained

        m2 = MISSED_RE.search(ln)
        if m2:
            team, pnum, desc = m2.group(1), m2.group(2), m2.group(3)
            key = f"{team}{pnum}"
            if "Free Throw" in desc:
                fta[key] += 1
            else:
                misses[key] += 1

        if FT_MADE_RE.search(ln):  # lines sometimes omit "Team" name earlier
            m3 = FT_MADE_RE.search(ln)
            team, pnum = m3.group(1), m3.group(2)
            key = f"{team}{pnum}"
            # ensure we didn't double-count: only count if not already counted via MADE_RE
            # (Many logs have "T3 Made Free Throw ..." captured by MADE_RE already.)
            # Here we only add if this line *didn't* also match MADE_RE:
            pass

        if FT_MISS_RE.search(ln):
            pass

    # Validate final score line if present
    final_line_idx = next((i for i,l in enumerate(lines) if l.startswith("Final Score:")), -1)
    if final_line_idx != -1:
        m = re.search(r"Final Score:\s*Testers\s*(\d+)\s*-\s*Debuggers\s*(\d+)", lines[final_line_idx])
        if m:
            fT, fD = int(m.group(1)), int(m.group(2))
            if (fT, fD) != (score["T"], score["D"]):
                errors.append(f"Final Score {fT}-{fD} does not match computed {score['T']}-{score['D']}.")

    # Cross-check box scores if present
    boxes = parse_box_scores(lines)
    for who, stats in boxes.items():
        made = makes[who]
        missed = misses[who]
        three_m = threes_made[who]
        ft_m = ftm[who]
        ft_a = fta[who]
        calc_FGM = made + three_m  # 'made' excludes 3s because we incremented only non-FT non-3 makes above
        # Wait: we incremented makes only for non-FT; and we separately counted threes_made.
        # So FGM should be makes(non-3, non-FT) + threes_made
        FGM = stats.get("FGM")
        FGA = stats.get("FGA")
        TPM = stats.get("3PM")
        FTM = stats.get("FTM")
        FTA = stats.get("FTA")
        PTS = stats.get("PTS")

        calc_FGA = calc_FGM + missed
        calc_TPM = three_m
        calc_FTM = ft_m
        calc_FTA = ft_a
        # Recompute points from our tallies:
        calc_PTS = 2*(calc_FGM - calc_TPM) + 3*calc_TPM + calc_FTM

        def add_err(field, calc, box):
            if box is None: return
            if calc != box:
                errors.append(f"{who}: {field} mismatch (box {box} vs PBP {calc}).")

        add_err("FGM", calc_FGM, FGM)
        add_err("FGA", calc_FGA, FGA)
        add_err("3PM", calc_TPM, TPM)
        add_err("FTM", calc_FTM, FTM)
        add_err("FTA", calc_FTA, FTA)
        add_err("PTS", calc_PTS, PTS)

    if errors:
        print("VALIDATION FAILED")
        print(json.dumps(errors, indent=2))
        sys.exit(1)
    else:
        print("OK: validation passed.")
        sys.exit(0)

if __name__ == "__main__":
    main()
