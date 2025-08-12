# Goal: Realistic basketball play-by-play and box scores

Tighten the basketball simulation so the validator passes:

- Possession must flip after made field goals and turnovers.
- After a missed shot, a rebound must occur within the next 2 events and to the correct team.
- Free-throw sequences: 2 FTs for shooting fouls on 2PT, 3 FTs for 3PT; 1 FT for and-1. Possession resumes after final FT unless there’s a rebound on a missed FT.
- Inline score brackets must always match the running total.
- Box score tallies (FGM/FGA/3PM/FTM/FTA/PTS) must match play-by-play.

Modify `multiball_basketball.py` and/or `test_multiball_basketball.py` accordingly (don’t change the validator).
