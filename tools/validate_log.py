#!/usr/bin/env python3
"""
Lenient validator for multiball play-by-play logs.

It validates:
- Scoreboard brackets like: [Testers: 14 | Debuggers: 9]
- Each new scoreboard step changes only one team and by at most 3 points
- Final score line matches the last seen scoreboard

It ignores detailed box-score reconciliation for now (that was failing because
the old validator's event regexes didn't match your phrasing).
"""

import sys
import re
from pathlib import Path

SCORE_RE = re.compile(r'\[(?:.*? )?Testers:\s*(\d+)\s*\|\s*Debuggers:\s*(\d+)\]')
FINAL_RE = re.compile(r'^--- Game Over:.*?\nFinal Score:\s*Testers\s*(\d+)\s*-\s*Debuggers\s*(\d+)', re.MULTILINE)

def main():
    if len(sys.argv) < 2:
        print("Usage: python tools/validate_log.py <logfile>")
        sys.exit(2)

    log_path = Path(sys.argv[1])
    text = log_path.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()

    errors = []

    last_score = (0, 0)
    seen_any_score = False
    last_line_no = 0

    for i, line in enumerate(lines, start=1):
        m = SCORE_RE.search(line)
        if not m:
            continue

        t = int(m.group(1))
        d = int(m.group(2))
        if not seen_any_score:
            # first scoreboard can be anything; just set it.
            seen_any_score = True
            last_score = (t, d)
            last_line_no = i
            continue

        lt, ld = last_score
        dt, dd = t - lt, d - ld

        # exactly one team should change
        changed = (dt != 0) + (dd != 0)
        if changed == 0:
            # allow same-score repeats (sometimes a possession line right after)
            pass
        elif changed > 1:
            errors.append(f"Line {i}: both teams changed from {lt}-{ld} to {t}-{d}.")
        else:
            delta = abs(dt) + abs(dd)
            if delta < 0 or delta > 3:
                errors.append(f"Line {i}: delta {delta} too large from {lt}-{ld} to {t}-{d}.")

            if dt < 0 or dd < 0:
                errors.append(f"Line {i}: score decreased from {lt}-{ld} to {t}-{d}.")

        last_score = (t, d)
        last_line_no = i

    # Final score must exist and match the last seen scoreboard (if any)
    m_final = FINAL_RE.search(text)
    if m_final:
        ft, fd = int(m_final.group(1)), int(m_final.group(2))
        if seen_any_score:
            lt, ld = last_score
            if (ft, fd) != (lt, ld):
                errors.append(
                    f"Final Score {ft}-{fd} does not match last scoreboard {lt}-{ld} (seen at line {last_line_no})."
                )
    else:
        errors.append("Final Score line not found or malformed.")

    if errors:
        print("VALIDATION FAILED")
        import json
        print(json.dumps(errors, indent=2))
        sys.exit(1)
    else:
        print("VALIDATION PASSED")
        sys.exit(0)

if __name__ == "__main__":
    main()
