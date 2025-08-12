# Goal: Realistic basketball play-by-play and box scores

Make the simulation produce a plausible basketball game log and box scores.

Hard requirements (validator enforces these):
- Scoreboard never decreases.
- Every scoring event updates the right team by the right amount:
  - “Made 3PT …” = +3
  - “Made Free Throw” = +1
  - All other “Made …” shots = +2
- The running scoreboard shown in brackets on lines that display it is correct after that event.
- The final scoreboard line matches the last running scoreboard.
- Per-player tallies from the PBP match their box score for FGM, FGA, 3PM, FTM, FTA, and PTS.

Nice-to-haves (improve if easy):
- Fewer illegal sequences (eg, “Possession” bouncing wrong without rebounds/turnovers).
- Reasonable foul counts and team-foul usage per quarter.

When changing code, prefer small, targeted fixes. Return exact file rewrites in the response format the CI expects.
