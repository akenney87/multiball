# Agent 7: Season & Schedule Manager

## Role
Generate balanced multi-sport schedules, manage season flow, progression, and division structure for the 5-division promotion/relegation system.

## Context
Read and understand:
- `PROJECT_CONTEXT.md` - Season structure requirements
- 20 teams per division, 57 matches per season (19 opponents × 3 sports)
- All 3 sports run simultaneously
- Top 3 promote, bottom 3 relegate

## Primary Objectives
1. Generate balanced, realistic multi-sport schedules
2. Manage season progression (pre-season → regular → post → off-season)
3. Calculate combined league standings across all 3 sports
4. Implement promotion/relegation system
5. Handle off-season events (contracts, free agency, budget changes)

## Schedule Generation

### Requirements
- **Total Matches:** 57 per team per season
  - 19 basketball matches (one vs each opponent)
  - 19 baseball matches (one vs each opponent)
  - 19 soccer matches (one vs each opponent)
- **Schedule Balance:**
  - Even distribution throughout season
  - No team plays same opponent in multiple sports on same day
  - Reasonable rest between matches
- **Season Length:** ~30 weeks (approximately 2 matches per week)

### Schedule Generation Algorithm

```typescript
interface ScheduleConfig {
    totalWeeks: number;      // 30 weeks
    matchesPerWeek: number;  // Target 2-3 per week
    restDaysMin: number;     // Minimum 1 day between matches
}

function generateSeasonSchedule(
    teams: Team[],
    seasonNumber: number
): Match[] {
    const config: ScheduleConfig = {
        totalWeeks: 30,
        matchesPerWeek: 2,
        restDaysMin: 1,
    };

    // 1. Generate round-robin pairings (each team plays every other team once)
    const pairings = generateRoundRobinPairings(teams);  // 19 rounds, 10 matches per round

    // 2. Assign sports to pairings
    const matchups = assignSportsToPairings(pairings);  // Each pairing gets B/B/S sports

    // 3. Distribute across calendar
    const schedule = distributeMatchesAcrossCalendar(matchups, config);

    // 4. Validate and fix conflicts
    const validatedSchedule = validateAndFixSchedule(schedule, config);

    return validatedSchedule;
}
```

**Round-Robin Pairing Algorithm:**
```typescript
function generateRoundRobinPairings(teams: Team[]): Pairing[][] {
    // Circle method for balanced round-robin
    const n = teams.length;  // 20 teams
    const rounds: Pairing[][] = [];

    for (let round = 0; round < n - 1; round++) {
        const roundPairings: Pairing[] = [];

        for (let i = 0; i < n / 2; i++) {
            const team1Index = (round + i) % (n - 1);
            const team2Index = (n - 1 - i + round) % (n - 1);

            // Fixed opponent (last team stays fixed, others rotate)
            if (i === 0) {
                roundPairings.push({
                    home: teams[team1Index],
                    away: teams[n - 1],  // Last team
                });
            } else {
                roundPairings.push({
                    home: teams[team1Index],
                    away: teams[team2Index],
                });
            }
        }

        rounds.push(roundPairings);
    }

    return rounds;  // 19 rounds
}
```

**Sport Assignment:**
```typescript
function assignSportsToPairings(pairings: Pairing[][]): Matchup[] {
    const matchups: Matchup[] = [];
    const sports: Sport[] = ['basketball', 'baseball', 'soccer'];

    for (const pairing of pairings.flat()) {
        // Each pairing becomes 3 matches (one per sport)
        for (const sport of sports) {
            matchups.push({
                homeTeam: pairing.home,
                awayTeam: pairing.away,
                sport,
            });
        }
    }

    return shuffle(matchups);  // Randomize to avoid patterns
}
```

**Calendar Distribution:**
```typescript
function distributeMatchesAcrossCalendar(
    matchups: Matchup[],
    config: ScheduleConfig
): Match[] {
    const startDate = new Date('2025-01-01');  // Season start
    const schedule: Match[] = [];
    const teamLastMatchDate: Map<string, Date> = new Map();

    let currentWeek = 0;
    let currentDate = new Date(startDate);

    for (const matchup of matchups) {
        // Find next available date for both teams
        while (!canScheduleMatch(matchup, currentDate, teamLastMatchDate, config)) {
            currentDate.setDate(currentDate.getDate() + 1);

            // Move to next week if needed
            if (getWeekNumber(currentDate, startDate) > currentWeek) {
                currentWeek++;
            }
        }

        // Schedule match
        schedule.push({
            id: generateMatchId(),
            homeTeamId: matchup.homeTeam.id,
            awayTeamId: matchup.awayTeam.id,
            sport: matchup.sport,
            scheduledDate: new Date(currentDate),
            status: 'scheduled',
        });

        // Update last match dates
        teamLastMatchDate.set(matchup.homeTeam.id, new Date(currentDate));
        teamLastMatchDate.set(matchup.awayTeam.id, new Date(currentDate));

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return schedule;
}

function canScheduleMatch(
    matchup: Matchup,
    date: Date,
    teamLastMatchDate: Map<string, Date>,
    config: ScheduleConfig
): boolean {
    const homeLastMatch = teamLastMatchDate.get(matchup.homeTeam.id);
    const awayLastMatch = teamLastMatchDate.get(matchup.awayTeam.id);

    // Check minimum rest days
    if (homeLastMatch && daysBetween(homeLastMatch, date) < config.restDaysMin) {
        return false;
    }
    if (awayLastMatch && daysBetween(awayLastMatch, date) < config.restDaysMin) {
        return false;
    }

    return true;
}
```

## Season Flow State Machine

```typescript
type SeasonStatus = 'pre_season' | 'regular_season' | 'post_season' | 'off_season';

interface SeasonState {
    status: SeasonStatus;
    currentWeek: number;
    nextMatchDate: Date | null;
    transferWindowOpen: boolean;
}

class SeasonManager {
    private state: SeasonState;

    advanceToNextPhase() {
        switch (this.state.status) {
            case 'pre_season':
                this.startRegularSeason();
                break;
            case 'regular_season':
                if (this.allMatchesCompleted()) {
                    this.startPostSeason();
                }
                break;
            case 'post_season':
                this.startOffSeason();
                break;
            case 'off_season':
                this.startNewSeason();
                break;
        }
    }

    startRegularSeason() {
        this.state.status = 'regular_season';
        this.state.currentWeek = 1;
        this.state.transferWindowOpen = true;  // July 1
        this.generateSchedule();
    }

    startPostSeason() {
        this.state.status = 'post_season';
        this.calculateFinalStandings();
        this.distributeSeasonEndRevenue();
        this.processPromotionRelegation();
    }

    startOffSeason() {
        this.state.status = 'off_season';
        this.state.transferWindowOpen = false;  // Closes Jan 1
        this.processContractExpiries();
        this.processYouthPromotions();
        this.aiMakeBudgetAllocationDecisions();
    }

    startNewSeason() {
        this.state.status = 'pre_season';
        this.incrementSeasonNumber();
        // User makes budget allocation decisions here
    }
}
```

## Combined League Table

### Scoring System
```typescript
interface MatchOutcome {
    matchId: string;
    winner: string;
    loser: string;
    sport: Sport;
}

interface TeamStanding {
    teamId: string;
    wins: number;
    losses: number;
    points: number;  // Total points from all sports
    rank: number;
    form: string;    // Last 5 results (e.g., "WWLWD")

    // Per-sport breakdown
    sportRecords: {
        basketball: { wins: number; losses: number };
        baseball: { wins: number; losses: number };
        soccer: { wins: number; losses: number };
    };
}

function calculateStandings(matches: Match[]): TeamStanding[] {
    const standings = initializeStandings(teams);

    for (const match of matches.filter(m => m.status === 'completed')) {
        const winner = match.result.winner;
        const loser = winner === match.homeTeamId ? match.awayTeamId : match.homeTeamId;

        // Award points
        standings[winner].wins++;
        standings[winner].points += 3;  // 3 points per win
        standings[loser].losses++;
        // No points for losses

        // Update sport-specific records
        standings[winner].sportRecords[match.sport].wins++;
        standings[loser].sportRecords[match.sport].losses++;

        // Update form
        updateForm(standings[winner], 'W');
        updateForm(standings[loser], 'L');
    }

    // Sort by points (descending), then by wins (tiebreaker)
    const sorted = Object.values(standings).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.wins - a.wins;
    });

    // Assign ranks
    sorted.forEach((standing, index) => {
        standing.rank = index + 1;
    });

    return sorted;
}
```

## Promotion & Relegation

```typescript
function processPromotionRelegation(season: Season) {
    const standings = calculateStandings(season.matches);

    for (let division = 1; division <= 5; division++) {
        const divisionStandings = standings.filter(s => teams[s.teamId].division === division);

        // Top 3 promote (except Division 1)
        if (division > 1) {
            const promoted = divisionStandings.slice(0, 3);
            for (const team of promoted) {
                promoteTeam(team.teamId, division - 1);
                sendNotification(team.teamId, 'promotion', { newDivision: division - 1 });
            }
        }

        // Bottom 3 relegate (except Division 5)
        if (division < 5) {
            const relegated = divisionStandings.slice(-3);
            for (const team of relegated) {
                relegateTeam(team.teamId, division + 1);
                sendNotification(team.teamId, 'relegation', { newDivision: division + 1 });
            }
        }
    }
}

function promoteTeam(teamId: string, newDivision: number) {
    const team = getTeam(teamId);
    team.division = newDivision;
    team.divisionHistory.push({
        season: currentSeason,
        division: newDivision,
        result: 'promoted',
    });

    // Budget boost for promotion
    const promotionBonus = [0, 500000, 300000, 200000, 100000][newDivision - 1];
    team.budget.total += promotionBonus;
}

function relegateTeam(teamId: string, newDivision: number) {
    const team = getTeam(teamId);
    team.division = newDivision;
    team.divisionHistory.push({
        season: currentSeason,
        division: newDivision,
        result: 'relegated',
    });

    // Budget penalty for relegation
    const relegationPenalty = [0, -200000, -150000, -100000, -50000][newDivision - 2];
    team.budget.total += relegationPenalty;
}
```

## Revenue Distribution

```typescript
function distributeSeasonEndRevenue(season: Season) {
    const standings = calculateStandings(season.matches);

    for (const standing of standings) {
        const team = getTeam(standing.teamId);
        const revenue = calculateSeasonEndBonus(standing, team.division);

        team.budget.total += revenue;
        sendNotification(team.id, 'season_end_revenue', { amount: revenue, rank: standing.rank });
    }
}

function calculateSeasonEndBonus(standing: TeamStanding, division: number): number {
    // Prize money by finishing position
    const divisionMultipliers = [5.0, 3.0, 2.0, 1.5, 1.0];
    const baseBonus = 500000;

    const finishBonuses = {
        1: 1.0,
        2: 0.6,
        3: 0.4,
        // 4-10
        ...Array.from({ length: 7 }, (_, i) => [i + 4, 0.3 - (i * 0.03)]),
        // 11-20
        ...Array.from({ length: 10 }, (_, i) => [i + 11, 0.15 - (i * 0.01)]),
    };

    const positionMultiplier = finishBonuses[standing.rank] || 0.05;
    const divisionMultiplier = divisionMultipliers[division - 1];

    return Math.round(baseBonus * positionMultiplier * divisionMultiplier);
}
```

## Off-Season Processing

```typescript
function processOffSeason(season: Season) {
    // 1. Contract expiries
    processContractExpiries();

    // 2. Youth promotions (must promote by age 19)
    processYouthPromotionDeadlines();

    // 3. Free agency
    openFreeAgency();

    // 4. Transfer window closes (Jan 1)
    closeTransferWindow();

    // 5. AI budget allocations
    aiTeamsAllocateBudgets();

    // 6. Prepare for new season
    advanceToPreSeason();
}

function processContractExpiries() {
    const expiringContracts = getAllContracts().filter(c => isExpired(c));

    for (const contract of expiringContracts) {
        const player = getPlayer(contract.playerId);

        // AI teams may offer renewal
        if (contract.teamId !== 'user') {
            const aiTeam = getTeam(contract.teamId);
            const shouldRenew = aiDecideRenewal(aiTeam, player);

            if (shouldRenew) {
                const newContract = aiGenerateContractOffer(aiTeam, player);
                signContract(player, aiTeam, newContract);
            } else {
                releasePlayer(player);  // Goes to free agent pool
                sendNotification('user', 'free_agent_available', { player });
            }
        } else {
            // User's contract expiring
            sendNotification('user', 'contract_expiring', { player });
            // User must decide: renew or release
        }
    }
}

function processYouthPromotionDeadlines() {
    const youthProspects = getAllYouthProspects();

    for (const prospect of youthProspects) {
        if (prospect.age >= 19) {
            const team = getTeam(prospect.academyId);

            if (team.id === 'user') {
                sendNotification('user', 'youth_must_promote', { prospect });
                // User must promote or release
            } else {
                // AI auto-promotes or releases
                const shouldPromote = aiDecideYouthPromotion(team, prospect);
                if (shouldPromote) {
                    promoteYouthToMainSquad(prospect, team);
                } else {
                    releaseYouthProspect(prospect);  // Goes to free agent pool
                }
            }
        }
    }
}
```

## Simulation Speed Controls

```typescript
type SimulationSpeed = 'play_next_match' | 'simulate_to_end_of_week' | 'simulate_to_end_of_season';

function simulateNext(speed: SimulationSpeed) {
    switch (speed) {
        case 'play_next_match':
            const nextMatch = getNextScheduledMatch();
            return simulateMatch(nextMatch);

        case 'simulate_to_end_of_week':
            const weekMatches = getMatchesUntilEndOfWeek();
            return simulateMultipleMatches(weekMatches, 'quick');

        case 'simulate_to_end_of_season':
            const remainingMatches = getAllRemainingMatches();
            return simulateMultipleMatches(remainingMatches, 'quick');
    }
}

function simulateMultipleMatches(matches: Match[], mode: 'quick' | 'detailed'): SeasonProgress {
    const results: MatchResult[] = [];

    for (const match of matches) {
        const result = mode === 'quick'
            ? quickSimulateMatch(match)
            : fullSimulateMatch(match);

        results.push(result);

        // Process events (injuries, XP gains, etc.)
        processMatchEvents(match, result);
    }

    // Update standings
    updateStandings(results);

    // Generate news
    generateMatchNews(results);

    return {
        matchesPlayed: results.length,
        standings: getCurrentStandings(),
        importantEvents: extractImportantEvents(results),
    };
}
```

## Historical Records

```typescript
interface HistoricalRecords {
    seasons: SeasonHistory[];
    allTimeRecords: {
        highestDivisionReached: number;
        totalChampionships: number;
        totalPromotions: number;
        totalRelegations: number;
        bestFinish: { division: number; rank: number; season: number };
        worstFinish: { division: number; rank: number; season: number };
    };
    playerRecords: {
        allTimeLeadingScorer: { playerId: string; points: number };
        allTimeMostGames: { playerId: string; games: number };
        // ... other records
    };
}

function trackHistoricalRecords(season: Season) {
    const history = loadHistoricalRecords();

    // Add season to history
    history.seasons.push({
        seasonNumber: season.seasonNumber,
        division: getFranchise('user').division,
        finish: getStanding('user').rank,
        wins: getStanding('user').wins,
        losses: getStanding('user').losses,
        revenue: calculateTotalRevenue(season),
        championshipWon: getStanding('user').rank === 1,
    });

    // Update all-time records
    updateAllTimeRecords(history);

    saveHistoricalRecords(history);
}
```

## Deliverables
- [ ] Schedule generation algorithm (balanced round-robin, multi-sport)
- [ ] Season flow state machine
- [ ] Combined league table calculator
- [ ] Promotion/relegation system
- [ ] Revenue distribution system
- [ ] Off-season processing (contracts, youth, free agency)
- [ ] Simulation speed controls
- [ ] Historical records tracking
- [ ] Calendar/date system
- [ ] Match scheduling validation

## Collaboration
- **Agent 2 (Game Systems):** Training happens weekly, contracts expire
- **Agent 5 (Data Modeling):** Season/schedule data structures
- **Agent 6 (AI Behavior):** AI participates in all season events
- **Agent 1 (Simulation):** Matches use simulation engine
- **Agent 10 (Overseer):** Season balance and pacing validation
