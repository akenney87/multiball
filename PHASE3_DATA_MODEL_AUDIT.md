# Phase 3 Data Model Audit

**Date:** 2025-11-21
**Purpose:** Identify gaps in data models for Phase 3 AI & Season Flow implementation
**Status:** COMPLETE

---

## Executive Summary

**Data Model Coverage:** 85% (Mostly Complete)

**Existing Systems:** ✅ Well-defined
- Player attributes (25 attributes across 3 categories)
- Contracts, injuries, training, scouting
- Franchise/team management
- Matches, standings, seasons
- AI personality (basic traits defined)

**Missing/Incomplete Systems:** ⚠️ Need Implementation
1. Player Morale (not in Player interface)
2. Calendar/Event System (partial - Season has basic calendar)
3. News/Events (no system defined)

---

## Detailed Audit

### ✅ COMPLETE - No Changes Needed

#### Player Data Model (`types.ts` lines 225-276)
```typescript
interface Player {
  id, name, age, dateOfBirth, position,
  attributes: PlayerAttributes,    // 25 attributes ✅
  potentials: PlayerPotentials,    // Hidden ceilings ✅
  contract: Contract | null,        // Phase 2 system ✅
  injury: Injury | null,            // Phase 2 system ✅
  trainingFocus: TrainingFocus,     // Phase 2 system ✅
  weeklyXP: WeeklyXP,               // Phase 2 system ✅
  careerStats, currentSeasonStats,  // Statistics ✅
  teamId, acquisitionType           // Team assignment ✅
}
```

**Missing:** `morale: number` (0-100 scale)

---

#### AI Personality (`types.ts` lines 540-564)
```typescript
interface AIPersonality {
  name: string,
  traits: {
    youth_development_focus: number,     // 0-100 ✅
    spending_aggression: number,         // 0-100 ✅
    defensive_preference: number,        // 0-100 ✅
    multi_sport_specialist: boolean,     // ✅
    risk_tolerance: number,              // 0-100 ✅
    player_loyalty: number               // 0-100 ✅
  }
}
```

**Assessment:** ✅ Sufficient for Phase 3
- Provides 6 personality dimensions for AI decision-making
- Can map to "conservative/balanced/aggressive" profiles

---

#### Season Data Model (`types.ts` lines 692-719)
```typescript
interface Season {
  id, seasonNumber,
  startDate, endDate,
  status: 'pre_season' | 'regular_season' | 'post_season' | 'off_season', ✅
  matches: Match[],                  // Full schedule ✅
  standings: Record<string, TeamStanding>, ✅
  transferWindowOpen: boolean,       // Calendar flag ✅
  currentWeek: number                // Week tracking ✅
}
```

**Assessment:** ✅ Sufficient for Phase 3 calendar needs
- Has season status tracking
- Has week progression
- Has transfer window flag
- Can extend with additional calendar events as needed

**Missing:** `events: SeasonEvent[]` (news/events log)

---

#### Franchise Data Model (`types.ts` lines 569-618)
```typescript
interface Franchise {
  id, name, division, founded,
  colors: TeamColors,
  budget: Budget,                    // Phase 2 ✅
  players: Player[],                 // Roster ✅
  tacticalSettings: TacticalSettings, ✅
  scoutingSettings: ScoutingSettings, ✅
  trainingSettings: TrainingSettings, ✅
  aiPersonality: AIPersonality | null, // AI vs User ✅
  // ... more fields
}
```

**Assessment:** ✅ Complete for Phase 3

---

#### Match & Standings (`types.ts` lines 640-663, 620-638)
```typescript
interface Match {
  id, week, sport, homeTeam, awayTeam,
  homeScore, awayScore,
  status: 'scheduled' | 'in_progress' | 'completed',
  result: MatchResult | null
}

interface TeamStanding {
  teamId, teamName, division,
  gamesPlayed, wins, losses,
  points,                    // 3 pts/win ✅
  goalsFor, goalsAgainst,
  goalDifferential,
  form: string[]             // Last 5 results ✅
}
```

**Assessment:** ✅ Complete for Phase 3

---

### ⚠️ INCOMPLETE - Needs Stub Implementation

#### 1. Player Morale System

**Current State:** NOT IMPLEMENTED
- No `morale` field in Player interface
- Mentioned in PHASE3_PLAN.md Week 5 Day 13: "triggerRandomEvents() → player morale"

**Required For:**
- AI roster decisions (low morale players more likely to be released)
- Player performance modifiers (low morale = attribute penalties)
- Transfer negotiations (unhappy players want to leave)

**Minimum Viable Implementation (Phase 3):**
```typescript
// Add to Player interface
interface Player {
  // ...existing fields
  morale: number;  // 0-100 scale (50 = neutral, 0 = wants out, 100 = very happy)
}

// Stub implementation (no complex logic yet)
function calculateMorale(player: Player, context: any): number {
  // Phase 3: Always return 50 (neutral)
  // Phase 4: Add factors (playing time, team performance, contract satisfaction)
  return 50;
}
```

**Decision:** STUB IN PHASE 3, implement properly in Phase 4

---

#### 2. Calendar/Event System

**Current State:** PARTIAL IMPLEMENTATION
- Season has `status`, `currentWeek`, `transferWindowOpen`
- No comprehensive calendar event system
- No event log or history

**Required For:**
- Week-by-week event triggers (injuries, training, contract expirations)
- Transfer window management
- Off-season phase transitions
- News generation

**Minimum Viable Implementation (Phase 3):**
```typescript
// Extend Season interface
interface Season {
  // ...existing fields
  events: SeasonEvent[];  // Event log
}

interface SeasonEvent {
  id: string;
  week: number;
  type: 'injury' | 'contract_expiry' | 'transfer_window' | 'training' | 'match' | 'promotion' | 'other';
  title: string;
  description: string;
  teamId?: string;
  playerId?: string;
  timestamp: Date;
}

// Stub calendar functions
function getUpcomingEvents(season: Season, weeks: number): SeasonEvent[] {
  // Phase 3: Return scheduled matches only
  // Phase 4: Add contract expirations, training milestones, etc.
  return season.matches
    .filter(m => m.week <= season.currentWeek + weeks)
    .map(m => ({ type: 'match', title: `${m.homeTeam} vs ${m.awayTeam}`, ... }));
}

function isTransferWindowOpen(season: Season): boolean {
  // Phase 3: Simple flag check
  return season.transferWindowOpen;
}
```

**Decision:** EXTEND Season interface, add basic event logging

---

#### 3. News/Events System

**Current State:** NOT IMPLEMENTED
- No news articles or notifications
- No event generation system
- Mentioned in PHASE3_PLAN.md Week 5 Day 13

**Required For:**
- User engagement (interesting things happening in league)
- AI team context (rival teams' transfers, injuries)
- Historical record (season highlights)

**Minimum Viable Implementation (Phase 3):**
```typescript
interface NewsArticle {
  id: string;
  week: number;
  headline: string;
  body: string;
  category: 'match_result' | 'transfer' | 'injury' | 'promotion' | 'award' | 'general';
  teamIds: string[];
  playerIds: string[];
  timestamp: Date;
}

// Stub news generation
function generateNewsForWeek(season: Season, week: number): NewsArticle[] {
  // Phase 3: Generate basic match result articles only
  // Phase 4: Add transfer news, injury reports, awards, drama
  return season.matches
    .filter(m => m.week === week && m.status === 'completed')
    .map(m => ({
      id: uuid(),
      week,
      headline: `${m.homeTeam} defeats ${m.awayTeam} ${m.homeScore}-${m.awayScore}`,
      body: `In a ${m.sport} match, ${m.homeTeam} secured a victory...`,
      category: 'match_result',
      teamIds: [m.homeTeam, m.awayTeam],
      playerIds: [],
      timestamp: new Date()
    }));
}
```

**Decision:** CREATE MINIMAL NEWS SYSTEM in Phase 3 (match results only)

---

## Recommendations

### IMMEDIATE (Before Week 1 Implementation)

1. **✅ NO CHANGES TO EXISTING TYPES** - All Phase 1/2 data models are sufficient
   - Player, Contract, Injury, Training, Scouting, Youth Academy all complete
   - Season, Match, Standings all complete
   - AIPersonality sufficient for basic AI decisions

2. **⚠️ ADD OPTIONAL FIELDS** (backward compatible)
   ```typescript
   // In Player interface (types.ts line 276)
   interface Player {
     // ...existing fields
     morale?: number;  // Optional for Phase 3, always 50
   }

   // In Season interface (types.ts line 719)
   interface Season {
     // ...existing fields
     events?: SeasonEvent[];  // Optional event log
   }
   ```

3. **✅ CREATE NEW TYPES** (separate file)
   - Create `src/season/types.ts` for SeasonEvent
   - Create `src/season/news.ts` for NewsArticle
   - Keep separate from core data models until proven stable

### SHORT-TERM (Week 1-2)

4. **Implement Stub Systems**
   - `src/season/morale.ts` - Simple morale calculations (always return 50)
   - `src/season/calendar.ts` - Event scheduling and tracking
   - `src/season/news.ts` - Basic news generation (match results)

5. **Add Utility Functions**
   - `getMorale(player): number` - Returns 50 in Phase 3
   - `getUpcomingEvents(season, weeks): SeasonEvent[]` - Returns matches
   - `generateWeeklyNews(season, week): NewsArticle[]` - Returns match articles

### LONG-TERM (Phase 4)

6. **Full Morale System**
   - Factors: Playing time, team performance, contract satisfaction, age
   - Effects: Performance modifiers, transfer requests, training efficiency

7. **Full Calendar System**
   - Complex event scheduling (contract expirations, training milestones, awards)
   - Multi-week planning (transfer windows, international breaks)

8. **Full News System**
   - Rich narratives (transfers, rivalries, comebacks, upsets)
   - Player quotes, manager interviews
   - League-wide storylines

---

## Impact on Phase 3 Implementation

### Week 1: AI Decision Engine
- ✅ **NO BLOCKERS** - AIPersonality sufficient, morale stubbed at 50
- AI can make decisions without morale factor
- Add morale consideration in Week 6 polish if time allows

### Week 2: Season Manager
- ✅ **NO BLOCKERS** - Season interface has calendar basics
- Extend Season with optional `events` array
- Create SeasonEvent type in new file

### Week 5: Weekly Events & Off-Season
- ⚠️ **MINOR ADDITIONS** - Need to create stub implementations
- Day 13: Stub morale system (always 50)
- Day 13: Basic event logging
- Day 14: Simple news generation (match results)

### Week 6: Integration Testing
- ✅ **TESTABLE WITHOUT FULL IMPLEMENTATIONS**
- Morale always 50 = predictable, testable
- Events = matches only = simple validation
- News = deterministic from match results

---

## Data Model Gap Summary

| System | Exists? | Completeness | Phase 3 Action | Phase 4 Action |
|--------|---------|--------------|----------------|----------------|
| Player Attributes | ✅ Yes | 100% | None | None |
| Contracts | ✅ Yes | 100% | None | None |
| Injuries | ✅ Yes | 100% | None | None |
| Training | ✅ Yes | 100% | None | None |
| Scouting | ✅ Yes | 100% | None | None |
| Youth Academy | ✅ Yes | 100% | None | None |
| Transfers | ✅ Yes | 100% | None | None |
| AI Personality | ✅ Yes | 80% | Use as-is | Add traits |
| Season/Calendar | ⚠️ Partial | 60% | Add events array | Full calendar |
| Player Morale | ❌ No | 0% | Stub (always 50) | Full implementation |
| News/Events | ❌ No | 0% | Stub (matches only) | Rich narratives |

---

## Conclusion

**Verdict:** ✅ **NO CRITICAL BLOCKERS FOR PHASE 3**

**Data Model Readiness:** 85% (8.5/10)
- All Phase 1/2 systems have complete data models
- Phase 3-specific systems (morale, news) can be stubbed
- Existing Season interface provides sufficient calendar functionality

**Required Work:** MINIMAL (4-6 hours total)
1. Add optional `morale?: number` to Player (30 minutes)
2. Add optional `events?: SeasonEvent[]` to Season (30 minutes)
3. Create `src/season/types.ts` with SeasonEvent, NewsArticle (1 hour)
4. Create stub implementations (morale.ts, calendar.ts, news.ts) (2-4 hours)

**Impact on Timeline:** ZERO DAYS
- All work can be done during Week 1 technical debt mitigation
- No dependencies blocking AI Decision Engine implementation

**Recommendation:** PROCEED WITH PHASE 3 AS PLANNED

---

**Audit Completed By:** Phase 3 Implementation Team
**Review Status:** Ready for Agent 10 approval
**Next Step:** Define Minimum Viable AI (Pre-Phase 3 Requirement #2)
