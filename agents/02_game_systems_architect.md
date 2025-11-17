# Agent 2: Game Systems Architect

## Role
You are responsible for designing and implementing all franchise management systems (training, contracts, transfers, scouting, youth academy, injuries, budget allocation, player progression, revenue, free agents).

## Context
Read and understand:
- `PROJECT_CONTEXT.md` - Complete specifications for all management systems
- Basketball simulation output (from Agent 1) - Understanding how attributes affect gameplay
- Data models (from Agent 5) - Data structures you'll work with

## Primary Objectives
Build the "franchise management layer" that sits on top of the simulation engine. Users will spend 80% of their time in these systems, 20% watching simulations.

## Systems to Implement

### 1. Training System

**Weekly Training Flow:**
```typescript
interface TrainingFocus {
    physical: number;    // 0-100 percentage
    mental: number;      // 0-100 percentage
    technical: number;   // 0-100 percentage
}

interface TrainingAllocation {
    teamWide: TrainingFocus;  // Default for all players
    perPlayer: Record<string, TrainingFocus>;  // Optional overrides
}
```

**Training Progression Algorithm:**
- Younger players improve faster (age 16-22: 1.5x multiplier, 23-26: 1.0x, 27+: 0.8x)
- Category potentials create soft caps (see PROJECT_CONTEXT.md)
- Coaching budget allocation affects improvement rate
- Playing time provides bonus XP (10% bonus per match played)

**Progression Formula (per week):**
```
base_improvement = training_allocation * coaching_quality * age_multiplier
distance_to_potential = category_potential - current_value
diminishing_factor = distance_to_potential / category_potential
final_improvement = base_improvement * diminishing_factor
if player_played_this_week:
    final_improvement *= 1.1
```

**Deliverables:**
- [ ] Training allocation UI data structures
- [ ] Weekly training progression calculator
- [ ] Age-based multipliers
- [ ] Soft cap (potential) system
- [ ] Playing time bonus tracker
- [ ] Team-wide vs per-player logic

### 2. Contract System (Football Manager-lite)

**Contract Structure:**
```typescript
interface Contract {
    playerId: string;
    salary: number;              // Annual salary
    signingBonus: number;        // One-time payment
    contractLength: number;      // Years (1-5)
    yearsSigned: number;         // Which year this contract started
    performanceBonuses: {
        pointsPerGame?: number;  // Bonus if PPG threshold met
        championships?: number;   // Bonus for winning championship
        playingTime?: number;     // Bonus for games played
    };
    releaseClause: number | null;  // Buyout amount
    salaryIncreases: number[];   // Annual raises (e.g., [5%, 5%, 10%])
    expiryDate: Date;
}
```

**Negotiation Logic:**
- AI players have "desired salary" based on attributes + age + demand
- Counter-offers (2-3 rounds max)
- User can offer: salary, length, bonuses, release clause
- AI evaluates total package value, not just salary
- Better players demand more, expiring contracts give leverage

**Player Valuation Formula:**
```
desired_salary = (overall_rating / 100) * market_rate * age_factor * demand_factor
market_rate = $50,000 base (adjustable by division)
age_factor = peak age (25-29) = 1.0, younger/older = 0.7-0.9
demand_factor = number_of_interested_teams / 5
```

**Deliverables:**
- [ ] Contract data structures
- [ ] Negotiation state machine (offer → counter → accept/reject)
- [ ] Player valuation algorithm
- [ ] Expiry tracking and notifications
- [ ] Salary cap compliance checks (total expenses ≤ budget)

### 3. Transfer System

**Transfer Window:** July 1 - January 1

**Transfer Offer Structure:**
```typescript
interface TransferOffer {
    offerId: string;
    offeringTeam: string;
    receivingTeam: string;
    playerId: string;
    transferFee: number;
    offerStatus: 'pending' | 'accepted' | 'rejected' | 'countered';
    counterOffer?: number;
    timestamp: Date;
}
```

**Transfer Logic:**
- User can bid on any player (AI or other AI teams)
- AI can bid on user's players
- AI teams trade with each other
- Bid + counter system (2-3 rounds)
- Transfer fees go to selling team's budget

**AI Transfer Behavior (coordinate with Agent 6):**
- Teams in relegation zone: more likely to sell
- Teams promoted: might sell to balance budget
- "Splashes Cash" personality: high bids
- "Develops Youth" personality: sells veterans, keeps youth

**Deliverables:**
- [ ] Transfer offer data structures
- [ ] Bid/counter negotiation flow
- [ ] Transfer window enforcement
- [ ] Revenue allocation (immediate or "available funds")
- [ ] AI transfer initiation logic
- [ ] Transfer history tracking

### 4. Scouting System

**Scouting Allocation:**
```typescript
interface ScoutingSettings {
    budgetAllocation: number;  // Percentage of total budget
    depthVsBreadth: number;    // 0 (breadth) to 100 (depth)
    targets: ScoutingTarget[];
}

interface ScoutingTarget {
    targetType: 'free_agent' | 'team_player' | 'general';
    filters?: {
        ageMin?: number;
        ageMax?: number;
        attributeFilters?: Record<string, { min: number, max: number }>;
        heightMin?: number;
        heightMax?: number;
        teams?: string[];  // Specific teams to scout
    };
}
```

**Scouting Output:**
```typescript
interface ScoutingReport {
    playerId: string;
    scoutedDate: Date;
    attributeRanges: Record<string, { min: number, max: number }>;
    overallRatings: {
        basketball: { min: number, max: number };
        baseball: { min: number, max: number };
        soccer: { min: number, max: number };
    };
    scoutingQuality: number;  // 0-100, affects range width
}
```

**Range Calculation:**
```
range_width = base_width * (1 - (depthVsBreadth / 100)) * (1 - (budget_quality / 100))
base_width = 20  // Starting range (e.g., 60-80 for a 70 attribute)

Depth slider:
- 0 (breadth): Wide ranges (±15), more players scouted
- 100 (depth): Narrow ranges (±3), fewer players scouted

Budget allocation:
- Higher budget: Narrower ranges, more simultaneous scouts
```

**Deliverables:**
- [ ] Scouting settings UI data structures
- [ ] Range calculation algorithm
- [ ] Weekly scouting results generator
- [ ] Target filtering system
- [ ] Budget impact on scouting capacity

### 5. Youth Academy System

**Academy Capacity Formula:**
```
base_capacity = 10 prospects
budget_tiers:
  $100k: 10 prospects, quality_multiplier = 0.5
  $150k: 15 prospects, quality_multiplier = 0.7
  $200k: 20 prospects, quality_multiplier = 1.0
  $250k: 25 prospects, quality_multiplier = 1.3
  $300k+: 30 prospects, quality_multiplier = 1.5
```

**Youth Prospect Generation:**
```typescript
interface YouthProspect {
    id: string;
    name: string;
    age: number;  // 15-18 when generated
    attributes: Record<string, number>;  // All 25 attributes
    potentials: {
        physical: number;    // Hidden from user
        mental: number;      // Hidden from user
        technical: number;   // Hidden from user
    };
    joinedAcademyDate: Date;
    mustPromoteBy: Date;  // 19th birthday
}
```

**Prospect Quality:**
```
attribute_range = 15-45 (youth prospects are raw)
potential_range = 50-95 (based on academy quality)
better_academy_budget → higher_potential_average
```

**Academy Training:**
- Default: Academy trains all prospects (quality based on budget)
- Optional: User can customize training per prospect
- Progression faster than main squad (youth development boost)

**Deliverables:**
- [ ] Academy capacity calculator
- [ ] Youth prospect generator
- [ ] Age tracking and promotion enforcement
- [ ] Academy training progression (default + custom)
- [ ] Promotion/rejection workflows

### 6. Injury System

**Injury Probability:**
```
injury_chance_per_match = base_rate * (1 - durability / 100)
base_rate = 5%
injury_chance_per_training = base_rate_training * (1 - durability / 100)
base_rate_training = 1%
```

**Injury Types & Recovery:**
```typescript
interface Injury {
    playerId: string;
    injuryType: 'minor' | 'moderate' | 'severe';
    injuryName: string;  // "Ankle Sprain", "Hamstring Strain", etc.
    occurredDate: Date;
    recoveryWeeks: number;
    returnDate: Date;
}

// Recovery times
minor: 1-2 weeks
moderate: 3-6 weeks
severe: 8-16 weeks

// Medical budget impact
higher_medical_budget → faster_recovery (10-30% reduction)
```

**Doctor Report:**
```typescript
interface DoctorReport {
    playerId: string;
    injuryName: string;
    severity: 'minor' | 'moderate' | 'severe';
    estimatedRecovery: string;  // "2-3 weeks"
    recommendedTreatment: string;
    canPlay: false;
}
```

**Deliverables:**
- [ ] Injury probability calculator
- [ ] Injury type generator (weighted by severity)
- [ ] Recovery time calculator
- [ ] Medical budget impact on recovery
- [ ] Doctor report generator
- [ ] Return-to-play tracking

### 7. Budget Allocation System

**Budget Categories:**
```typescript
interface BudgetAllocation {
    coaching: number;      // 0-100% (affects training progression)
    medical: number;       // 0-100% (affects injury recovery)
    youthAcademy: number;  // 0-100% (affects prospect quality/quantity)
    scouting: number;      // 0-100% (affects scouting capacity/quality)
    freeAgentTryouts: number;  // 0-100% (affects tryout frequency/quality)
}

// Constraint: total allocations + salaries ≤ total_budget
```

**UI Representation:**
- Radar chart with 5 axes
- Each axis shows percentage allocation
- Shows dollar amounts alongside percentages
- Only adjustable between seasons

**Deliverables:**
- [ ] Budget allocation data structures
- [ ] Validation (total ≤ 100%, expenses ≤ budget)
- [ ] Impact calculations for each category
- [ ] Season-locking mechanism

### 8. Player Progression System

**Category Potentials (Hidden):**
```typescript
interface HiddenPotentials {
    physical: number;    // 1-100
    mental: number;      // 1-100
    technical: number;   // 1-100
}
```

**Age-Based Regression:**
```
After peak ages, attributes decline:
- Physical: peak 22-30 (prob at 26), decline after
- Technical: peak 24-32 (prob at 28), decline after
- Mental: peak 26-34 (prob at 30), decline after

Decline rate: -1 to -3 points per year (faster for physical)
```

**Deliverables:**
- [ ] Potential generation (at player creation)
- [ ] Soft cap progression algorithm
- [ ] Age-based peak determination
- [ ] Regression calculator
- [ ] Career arc tracking

### 9. Revenue System

**Performance-Based Formula:**
```
weekly_revenue = base_revenue * division_multiplier * performance_multiplier

base_revenue = $50,000/week
division_multipliers:
  Division 5: 1.0x
  Division 4: 1.5x
  Division 3: 2.0x
  Division 2: 3.0x
  Division 1: 5.0x

performance_multiplier = (wins / total_games) * 1.5 + 0.5
// Range: 0.5x (0 wins) to 2.0x (all wins)

season_end_bonus = league_finish_position_payout
  1st: $500k
  2nd: $300k
  3rd: $200k
  4th-10th: $100k-$50k
  11th-20th: $25k-$10k
```

**Deliverables:**
- [ ] Weekly revenue calculator
- [ ] Division multipliers
- [ ] Performance tracking
- [ ] Season-end bonus distribution

### 10. Free Agent System

**Free Agent Pool:**
- Global pool shared by all teams
- Refreshes when players are cut or contracts expire
- User can hold tryouts (budget allocation determines frequency)

**Tryout System:**
```
tryout_budget_allocation → number_of_tryouts_per_month
$10k: 1 tryout/month, 3 candidates each
$25k: 2 tryouts/month, 5 candidates each
$50k+: weekly tryouts, 8 candidates each
```

**Deliverables:**
- [ ] Free agent pool management
- [ ] Pool refresh triggers
- [ ] Tryout frequency calculator
- [ ] Candidate quality based on tryout budget

## Integration Points

### With Simulation (Agent 1):
- Training affects attributes → affects simulation performance
- Injuries prevent players from competing
- Stamina/fatigue from multi-sport play

### With AI (Agent 6):
- AI teams use same contract/transfer systems
- AI makes offers, signs free agents
- AI responds to user's transfer bids

### With Season Manager (Agent 7):
- Training happens weekly
- Contracts expire at season end
- Transfer window timing
- Youth promotion deadlines

### With UI (Agent 3):
- All systems need user interfaces
- Dashboard displays key info
- News feed shows events

## Success Criteria
✅ All 10 systems implemented and functional
✅ Systems interact correctly (budget → coaching → training → attributes → simulation)
✅ Data models aligned with Agent 5's specifications
✅ Business logic thoroughly tested
✅ "Simple default, deep customization" philosophy maintained
✅ Performance acceptable (all calculations < 100ms)

## Collaboration
- **Agent 5 (Data Modeling):** Align on data structures
- **Agent 6 (AI Behavior):** AI teams use your systems
- **Agent 7 (Season Manager):** Timing and season flow
- **Agent 8 (Testing):** Unit tests for all formulas
- **Agent 10 (Overseer):** System coherence validation
