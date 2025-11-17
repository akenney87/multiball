# Data Structure Diagram

Visual representation of Multiball's data model relationships.

## Entity Relationship Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          GameSave                               │
│  (Root container for all game state)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐       ┌──────────────┐                       │
│  │  Franchise   │       │  AI Teams    │                       │
│  │   (User)     │       │  (19 teams)  │                       │
│  └──────┬───────┘       └──────┬───────┘                       │
│         │                      │                                │
│         └──────────┬───────────┘                                │
│                    │                                            │
│         ┌──────────▼──────────┐                                 │
│         │   rosterIds: []     │                                 │
│         │   youthIds: []      │                                 │
│         └──────────┬──────────┘                                 │
│                    │                                            │
│         ┌──────────▼──────────┐                                 │
│         │      Players        │──┐                              │
│         │   (1,000 total)     │  │                              │
│         └─────────────────────┘  │                              │
│                                  │                              │
│         ┌────────────────────────┴──────────────┐               │
│         │                                       │               │
│    ┌────▼─────┐  ┌──────────┐  ┌──────────┐   │               │
│    │ Contract │  │  Injury  │  │  Stats   │   │               │
│    └──────────┘  └──────────┘  └──────────┘   │               │
│                                                │               │
│         ┌──────────────────────────────────────┘               │
│         │                                                      │
│    ┌────▼──────────┐                                           │
│    │ Youth Academy │                                           │
│    │  (Prospects)  │                                           │
│    └───────────────┘                                           │
│                                                                 │
│    ┌──────────────┐     ┌─────────────┐     ┌──────────┐      │
│    │   Season     │────▶│   Matches   │────▶│  Result  │      │
│    └──────────────┘     └─────────────┘     └──────────┘      │
│                                                                 │
│    ┌──────────────┐     ┌─────────────┐                        │
│    │  Transfers   │     │ Negotiations│                        │
│    └──────────────┘     └─────────────┘                        │
│                                                                 │
│    ┌──────────────┐     ┌─────────────┐                        │
│    │  Scouting    │     │    News     │                        │
│    └──────────────┘     └─────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Player Data Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                            Player                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Basic Info:                                                     │
│  ├─ id: string (UUID)                                           │
│  ├─ name: string                                                │
│  ├─ age: number                                                 │
│  ├─ dateOfBirth: Date                                           │
│  └─ position: 'PG' | 'SG' | 'SF' | 'PF' | 'C'                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              Attributes (25 total)                     │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │                                                        │     │
│  │  Physical (12):                                        │     │
│  │  ├─ grip_strength      ├─ reactions                   │     │
│  │  ├─ arm_strength       ├─ stamina                     │     │
│  │  ├─ core_strength      ├─ balance                     │     │
│  │  ├─ agility            ├─ height (normalized)         │     │
│  │  ├─ acceleration       └─ durability                  │     │
│  │  ├─ top_speed                                          │     │
│  │  └─ jumping                                            │     │
│  │                                                        │     │
│  │  Mental (7):                                           │     │
│  │  ├─ awareness          ├─ consistency                 │     │
│  │  ├─ creativity         ├─ composure                   │     │
│  │  ├─ determination      └─ patience                    │     │
│  │  └─ bravery                                            │     │
│  │                                                        │     │
│  │  Technical (6):                                        │     │
│  │  ├─ hand_eye_coordination                             │     │
│  │  ├─ throw_accuracy                                    │     │
│  │  ├─ form_technique                                    │     │
│  │  ├─ finesse                                            │     │
│  │  ├─ deception                                          │     │
│  │  └─ teamwork                                           │     │
│  │                                                        │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │           Potentials (HIDDEN from user)                │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │  physical: 1-100                                       │     │
│  │  mental: 1-100                                         │     │
│  │  technical: 1-100                                      │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                  Peak Ages                             │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │  physical: 22-30 (peak: 26)                            │     │
│  │  technical: 24-32 (peak: 28)                           │     │
│  │  mental: 26-34 (peak: 30)                              │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                 Training Focus                         │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │  physical: 0-100%                                      │     │
│  │  mental: 0-100%      } Must sum to 100                 │     │
│  │  technical: 0-100%                                     │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │            Contract (nullable)                         │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │  salary: number                                        │     │
│  │  contractLength: 1-5 years                             │     │
│  │  signingBonus: number                                  │     │
│  │  performanceBonuses: { ... }                           │     │
│  │  releaseClause: number | null                          │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              Injury (nullable)                         │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │  injuryType: 'minor' | 'moderate' | 'severe'           │     │
│  │  recoveryWeeks: number                                 │     │
│  │  returnDate: Date                                      │     │
│  │  doctorReport: string                                  │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                Career Stats                            │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │  gamesPlayed: { basketball, baseball, soccer }         │     │
│  │  totalPoints: { basketball, baseball, soccer }         │     │
│  │  basketball: { FG, 3PT, FT, REB, AST, STL, BLK, TO }   │     │
│  │  baseball: { ... } (future)                            │     │
│  │  soccer: { ... } (future)                              │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  Team Assignment:                                               │
│  └─ teamId: 'user' | UUID | 'free_agent' | 'youth_academy'     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Franchise Data Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                          Franchise                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Basic Info:                                                     │
│  ├─ id: 'user' | UUID                                           │
│  ├─ name: string                                                │
│  ├─ colors: { primary, secondary }                              │
│  ├─ division: 1 | 2 | 3 | 4 | 5                                 │
│  └─ divisionHistory: [ { season, division, finish } ]           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                    Budget                              │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │  total: $1,000,000 (starting)                          │     │
│  │                                                        │     │
│  │  allocated:                                            │     │
│  │  ├─ salaries: $0                                       │     │
│  │  ├─ coaching: $100,000                                 │     │
│  │  ├─ medical: $50,000                                   │     │
│  │  ├─ youthAcademy: $100,000                             │     │
│  │  ├─ scouting: $50,000                                  │     │
│  │  └─ freeAgentTryouts: $20,000                          │     │
│  │                                                        │     │
│  │  available: $680,000                                   │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              Roster & Youth                            │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │  rosterIds: [ player IDs ] (50 at start)               │     │
│  │  youthAcademyIds: [ prospect IDs ]                     │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │           Tactical Settings (Basketball)               │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │  pace: 'fast' | 'standard' | 'slow'                    │     │
│  │  manDefensePct: 0-100                                  │     │
│  │  scoringOptions: [id1, id2, id3]                       │     │
│  │  minutesAllotment: { playerId: minutes } (sum: 240)    │     │
│  │  reboundingStrategy: 'crash_glass' | 'standard' | ...  │     │
│  │  closers: [player IDs]                                 │     │
│  │  timeoutStrategy: 'aggressive' | 'standard' | ...      │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              Training Settings                         │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │  teamWide: { physical: 33, mental: 33, technical: 34 } │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │             Scouting Settings                          │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │  budgetAllocation: 5% (of total budget)                │     │
│  │  depthVsBreadth: 0-100 slider                          │     │
│  │  targets: [ ScoutingTarget[] ]                         │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │          AI Personality (null for user)                │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │  name: 'Develops Youth' | 'Splashes Cash' | ...        │     │
│  │  traits:                                               │     │
│  │  ├─ youth_development_focus: 0-100                     │     │
│  │  ├─ spending_aggression: 0-100                         │     │
│  │  ├─ defensive_preference: 0-100                        │     │
│  │  ├─ multi_sport_specialist: boolean                    │     │
│  │  ├─ risk_tolerance: 0-100                              │     │
│  │  └─ player_loyalty: 0-100                              │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Season Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                           Season                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Basic Info:                                                     │
│  ├─ id: UUID                                                    │
│  ├─ seasonNumber: 1, 2, 3, ...                                  │
│  ├─ startDate / endDate                                         │
│  ├─ status: 'pre_season' | 'regular_season' | 'post_season' |   │
│  │           'off_season'                                       │
│  ├─ currentWeek: 0-52                                           │
│  └─ transferWindowOpen: boolean (July 1 - January 1)            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │               Matches (57 total)                       │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │                                                        │     │
│  │  19 opponents × 3 sports = 57 matches                  │     │
│  │                                                        │     │
│  │  Each match:                                           │     │
│  │  ├─ id: UUID                                           │     │
│  │  ├─ homeTeamId / awayTeamId                            │     │
│  │  ├─ sport: 'basketball' | 'baseball' | 'soccer'        │     │
│  │  ├─ scheduledDate: Date                                │     │
│  │  ├─ status: 'scheduled' | 'in_progress' | 'completed'  │     │
│  │  └─ result: MatchResult | null                         │     │
│  │      ├─ homeScore / awayScore                          │     │
│  │      ├─ winner: teamId                                 │     │
│  │      ├─ boxScore: { ... }                              │     │
│  │      └─ playByPlay: string[]                           │     │
│  │                                                        │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │            Standings (20 teams)                        │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │                                                        │     │
│  │  { teamId: TeamStanding }                              │     │
│  │                                                        │     │
│  │  TeamStanding:                                         │     │
│  │  ├─ teamId: string                                     │     │
│  │  ├─ wins: number                                       │     │
│  │  ├─ losses: number                                     │     │
│  │  ├─ points: number (combined across all sports)        │     │
│  │  └─ rank: 1-20                                         │     │
│  │                                                        │     │
│  │  Top 3 → Promoted                                      │     │
│  │  Bottom 3 → Relegated                                  │     │
│  │                                                        │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow: Game Simulation

```
┌─────────────────────────────────────────────────────────────────┐
│                    Simulation Data Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Pre-Simulation                                               │
│     ┌────────────┐                                               │
│     │ TypeScript │                                               │
│     │  Player    │──┐                                            │
│     └────────────┘  │                                            │
│                     │ Convert                                    │
│     ┌────────────┐  │ attributes                                 │
│     │ Tactical   │  │                                            │
│     │ Settings   │──┼───────────────────────────┐                │
│     └────────────┘  │                           │                │
│                     │                           ▼                │
│                     │                    ┌──────────────┐        │
│                     │                    │    Python    │        │
│                     └───────────────────▶│  Simulation  │        │
│                                          │    Input     │        │
│                                          └──────┬───────┘        │
│                                                 │                │
│  2. Simulation (basketball-sim)                 │                │
│                                                 │                │
│                                          ┌──────▼───────┐        │
│                                          │  Basketball  │        │
│                                          │  Simulator   │        │
│                                          │              │        │
│                                          │  25 attrs    │        │
│                                          │  Weighted    │        │
│                                          │  Sigmoid     │        │
│                                          └──────┬───────┘        │
│                                                 │                │
│  3. Post-Simulation                             │                │
│                                                 │                │
│                                          ┌──────▼───────┐        │
│                                          │   Python     │        │
│                                          │   Output     │        │
│     ┌────────────┐                       │   (Result)   │        │
│     │ TypeScript │                       └──────┬───────┘        │
│     │ MatchResult│◀──────────────────────────────┘                │
│     └─────┬──────┘         Convert                               │
│           │                                                       │
│           │                                                       │
│     ┌─────▼──────┐                                                │
│     │  Update    │                                                │
│     │  Season    │                                                │
│     │  Standings │                                                │
│     └─────┬──────┘                                                │
│           │                                                       │
│     ┌─────▼──────┐                                                │
│     │  Update    │                                                │
│     │  Player    │                                                │
│     │  Stats     │                                                │
│     └─────┬──────┘                                                │
│           │                                                       │
│     ┌─────▼──────┐                                                │
│     │   Save     │                                                │
│     │   Game     │                                                │
│     └────────────┘                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Storage Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                      Storage Architecture                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Application Layer                                               │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                   Game State                           │     │
│  │            (GameSave TypeScript object)                │     │
│  └───────────────────────┬────────────────────────────────┘     │
│                          │                                       │
│                          │ gameStorage.saveGame()                │
│                          │                                       │
│  Storage Layer           ▼                                       │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                 GameStorage                            │     │
│  │                                                        │     │
│  │  ┌──────────────┐    ┌──────────────┐                 │     │
│  │  │   Cache      │    │ Serializer   │                 │     │
│  │  │   (5s TTL)   │    │ (JSON +      │                 │     │
│  │  │              │    │  Date conv)  │                 │     │
│  │  └──────────────┘    └──────────────┘                 │     │
│  │                                                        │     │
│  │  ┌──────────────┐    ┌──────────────┐                 │     │
│  │  │  Validator   │    │  Metadata    │                 │     │
│  │  │              │    │  Extractor   │                 │     │
│  │  └──────────────┘    └──────────────┘                 │     │
│  │                                                        │     │
│  └───────────────────────┬────────────────────────────────┘     │
│                          │                                       │
│                          │ AsyncStorage.setItem()                │
│                          │                                       │
│  Platform Layer          ▼                                       │
│  ┌────────────────────────────────────────────────────────┐     │
│  │               React Native AsyncStorage                │     │
│  │                                                        │     │
│  │  Keys:                                                 │     │
│  │  ├─ @multiball:game_save (full save)                   │     │
│  │  ├─ @multiball:save_metadata (lightweight)             │     │
│  │  ├─ @multiball:settings                                │     │
│  │  └─ @multiball:tutorial                                │     │
│  │                                                        │     │
│  └───────────────────────┬────────────────────────────────┘     │
│                          │                                       │
│  Device Storage          ▼                                       │
│  ┌────────────────────────────────────────────────────────┐     │
│  │            iOS: NSUserDefaults                         │     │
│  │            Android: SharedPreferences                  │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  Future: Cloud Save                                              │
│  ┌────────────────────────────────────────────────────────┐     │
│  │           CloudSaveManager (stub)                      │     │
│  │                                                        │     │
│  │  - Upload/download                                     │     │
│  │  - Conflict resolution                                 │     │
│  │  - Cross-platform sync                                 │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Type System Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                     Type System Layers                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Primitives & Constants                                │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  - ALL_ATTRIBUTES                                      │     │
│  │  - BASKETBALL_POSITIONS                                │     │
│  │  - SPORTS                                              │     │
│  │  - DIVISIONS                                           │     │
│  └────────────────────────────────────────────────────────┘     │
│                          │                                       │
│                          │ used by                               │
│                          ▼                                       │
│  Layer 2: Attribute Types                                       │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  - PhysicalAttributes                                  │     │
│  │  - MentalAttributes                                    │     │
│  │  - TechnicalAttributes                                 │     │
│  │  - PlayerAttributes (union of all 3)                   │     │
│  └────────────────────────────────────────────────────────┘     │
│                          │                                       │
│                          │ used by                               │
│                          ▼                                       │
│  Layer 3: Entity Types                                          │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  - Player                                              │     │
│  │  - Contract                                            │     │
│  │  - Injury                                              │     │
│  │  - YouthProspect                                       │     │
│  └────────────────────────────────────────────────────────┘     │
│                          │                                       │
│                          │ used by                               │
│                          ▼                                       │
│  Layer 4: Aggregate Types                                       │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  - Franchise                                           │     │
│  │  - Season                                              │     │
│  │  - Match                                               │     │
│  └────────────────────────────────────────────────────────┘     │
│                          │                                       │
│                          │ used by                               │
│                          ▼                                       │
│  Layer 5: Root Type                                             │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  - GameSave (contains everything)                      │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  Cross-Cutting:                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  - Type Guards (isFreeAgent, isUserPlayer, etc.)       │     │
│  │  - Validators (validatePlayer, validateGameSave, etc.) │     │
│  │  - Factories (createPlayer, createGameSave, etc.)      │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Reference: Key Relationships

```
GameSave
├── franchise (Franchise) - User's team
│   ├── rosterIds (string[]) ──┐
│   ├── youthAcademyIds ────────┼──┐
│   ├── budget                  │  │
│   ├── tacticalSettings        │  │
│   └── trainingSettings        │  │
│                               │  │
├── aiTeams (Franchise[]) - 19 AI teams
│   └── [same structure as franchise]
│                               │  │
├── players (Player[]) ◄────────┘  │
│   ├── attributes (25)            │
│   ├── potentials (hidden)        │
│   ├── contract (Contract | null) │
│   ├── injury (Injury | null)     │
│   └── stats (CareerStats)        │
│                                  │
├── youthProspects ◄───────────────┘
│   └── [similar to Player but 15-18 years old]
│
├── season (Season)
│   ├── matches (Match[]) - 57 total
│   │   └── result (MatchResult | null)
│   └── standings (Record<teamId, TeamStanding>)
│
├── transferOffers (TransferOffer[])
├── contractNegotiations (ContractNegotiation[])
├── scoutingReports (ScoutingReport[])
├── scoutingTargets (ScoutingTarget[])
├── newsItems (NewsItem[])
└── seasonHistory (SeasonHistory[])
```

---

This diagram provides a visual reference for understanding how all the data structures relate to each other in the Multiball data model.
