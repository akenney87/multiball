# Phase 2: Management Systems - Formula Definitions

**Last Updated:** 2025-11-20
**Status:** Initial Draft

This document defines all formulas needed for Phase 2 management systems. These formulas are designed to be simple, tunable, and based on attribute-driven mechanics.

---

## 1. Training Progression Formula

**Purpose:** Calculate how much players improve each week from training

**System:** Training System

### Base XP Gain Per Week

```
weeklyXP = baseXP × trainingQualityMultiplier × ageMultiplier × playingTimeBonus
```

**Parameters:**
- `baseXP` = 10 points (base improvement per week)
- `trainingQualityMultiplier` = 0.5x to 2.0x (from budget allocation)
- `ageMultiplier` = Age-based multiplier (younger players improve faster)
- `playingTimeBonus` = +0% to +50% (based on minutes played)

### Age Multiplier

```
ageMultiplier =
  if age < 23: 1.5x (young, rapid improvement)
  if 23 ≤ age < 28: 1.0x (prime, standard improvement)
  if 28 ≤ age < 32: 0.7x (veteran, slower improvement)
  if age ≥ 32: 0.5x (aging, minimal improvement)
```

**Rationale:** Young players develop faster, veterans improve slower

### Playing Time Bonus

```
playingTimeBonus = min(0.5, minutesPlayed / 1000)
```

- Playing 1000+ minutes in a week = +50% bonus XP
- Playing 500 minutes = +25% bonus XP
- No playing time = +0% bonus

**Rationale:** Game experience accelerates learning

### Attribute Improvement (Soft Caps)

```
XP required to improve attribute = currentValue × 10

Example:
- Improving from 50 → 51: Requires 500 XP
- Improving from 80 → 81: Requires 800 XP
```

**Soft Cap System:**
```
If attribute ≥ potential:
  XP required = currentValue × 20 (2x harder)

If attribute ≥ (potential + 10):
  XP required = currentValue × 50 (5x harder, effectively capped)
```

**Rationale:**
- Linear cost prevents runaway growth
- Soft caps based on hidden potential create realistic career arcs
- Players can slightly exceed potential but with diminishing returns

### Category Potentials

Each player has hidden potentials for each category:
- Physical Potential (e.g., 85)
- Mental Potential (e.g., 75)
- Technical Potential (e.g., 70)

Attributes within a category share the potential:
- Physical attributes (12 total) capped by Physical Potential
- Mental attributes (7 total) capped by Mental Potential
- Technical attributes (6 total) capped by Technical Potential

**Example Training Week:**

```
Player: Age 25, Durability 60, Physical Potential 80
Budget: 50% coaching allocation = 1.25x quality multiplier
Playing time: 500 minutes = +25% bonus

weeklyXP = 10 × 1.25 × 1.0 × 1.25 = 15.625 XP earned

Durability is currently 60 (below potential 80):
  XP needed: 60 × 10 = 600 XP
  Progress: 15.625 / 600 = 2.6% toward next point

After ~38 weeks (600 / 15.625), Durability increases from 60 → 61
```

---

## 2. Player Valuation Formula

**Purpose:** Calculate market value for contracts and transfers

**System:** Contract System, Transfer System

### Base Valuation

```
baseValue = (overallRating / 100) × 1,000,000
```

**Parameters:**
- `overallRating` = Weighted average of all 25 attributes (sport-specific weights)
- Base: Rating 50 = $500k, Rating 75 = $750k, Rating 100 = $1M

### Age Multiplier

```
ageMultiplier =
  if age < 23: 1.5x (young, high potential value)
  if 23 ≤ age < 28: 2.0x (prime, peak market value)
  if 28 ≤ age < 32: 1.5x (veteran, declining value)
  if age ≥ 32: 1.0x (aging, minimal value)
```

**Rationale:** Prime-age players command premium, youth has potential value

### Potential Modifier

```
potentialModifier = 1.0 + (averagePotential - overallRating) / 100

where averagePotential = (physicalPot + mentalPot + technicalPot) / 3
```

**Example:**
- Player rating 60 with average potential 80: modifier = 1.0 + (80-60)/100 = 1.2x
- Player rating 85 with average potential 75: modifier = 1.0 + (75-85)/100 = 0.9x

**Rationale:** High-potential players worth more, over-developed players worth less

### Multi-Sport Bonus

```
multiSportBonus = 1.0 + (numberOfSportsAbove50 × 0.2)
```

- Good at 1 sport: 1.0x (no bonus)
- Good at 2 sports: 1.2x (+20%)
- Good at 3 sports: 1.4x (+40%)

**Rationale:** Versatile athletes are more valuable

### Final Market Value

```
marketValue = baseValue × ageMultiplier × potentialModifier × multiSportBonus
```

### Contract Salary

```
annualSalary = marketValue × 0.20
```

- Market value $1M → Annual salary $200k
- Market value $500k → Annual salary $100k

**Rationale:** Salaries are ~20% of market value (standard sport economics)

**Example Valuations:**

```
Player A: Rating 75, Age 26 (prime), Avg Potential 80, 2 sports
  baseValue = 0.75 × 1,000,000 = $750,000
  ageMultiplier = 2.0x (prime)
  potentialModifier = 1.0 + (80-75)/100 = 1.05x
  multiSportBonus = 1.2x (2 sports)

  marketValue = $750k × 2.0 × 1.05 × 1.2 = $1,890,000
  annualSalary = $1.89M × 0.20 = $378,000/year

Player B: Rating 60, Age 35 (aging), Avg Potential 70, 1 sport
  baseValue = 0.60 × 1,000,000 = $600,000
  ageMultiplier = 1.0x (aging)
  potentialModifier = 1.0 + (70-60)/100 = 1.1x
  multiSportBonus = 1.0x (1 sport)

  marketValue = $600k × 1.0 × 1.1 × 1.0 = $660,000
  annualSalary = $660k × 0.20 = $132,000/year
```

---

## 3. Scouting Range Formula

**Purpose:** Determine attribute range accuracy based on budget and depth setting

**System:** Scouting System

### Scouting Settings

Users can adjust:
- **Depth Slider:** 0.0 (breadth) to 1.0 (depth)
  - 0.0 = Scout many players, wide ranges (less accurate)
  - 0.5 = Balanced
  - 1.0 = Scout fewer players, narrow ranges (more accurate)

- **Budget Allocation:** Affects accuracy multiplier

### Base Range Width

```
baseRangeWidth = 20 points (±10 from true value)
```

### Accuracy Multiplier

```
accuracyMultiplier = scoutingBudgetMultiplier × depthMultiplier

where:
  scoutingBudgetMultiplier = 0.5x to 2.0x (from budget allocation)
  depthMultiplier = 0.5 + (depthSlider × 1.0)
    - depthSlider 0.0 → 0.5x multiplier (wide ranges)
    - depthSlider 0.5 → 1.0x multiplier (balanced)
    - depthSlider 1.0 → 1.5x multiplier (narrow ranges)
```

### Final Range Width

```
rangeWidth = baseRangeWidth / accuracyMultiplier
```

**Clamped to:** Minimum 2 points, Maximum 30 points

### Number of Players Scouted

```
playersScoutedPerWeek = simultaneousScouts / (depthSlider + 0.5)

where simultaneousScouts = budget allocation / $50k
```

**Example:**
- Budget: $250k = 5 scouts
- Depth 0.0 (breadth): 5 / 0.5 = 10 players/week (wide ranges)
- Depth 0.5 (balanced): 5 / 1.0 = 5 players/week (medium ranges)
- Depth 1.0 (depth): 5 / 1.5 = 3.33 players/week (narrow ranges)

**Rationale:** User controls breadth vs depth tradeoff

**Example Scouting Results:**

```
Player: True Agility = 75

Scenario A: Poor budget (0.5x), Breadth focus (0.5x)
  accuracyMultiplier = 0.5 × 0.5 = 0.25x
  rangeWidth = 20 / 0.25 = 80 points (clamped to 30)
  Reported: "Agility: 45-105" (clamped: 45-100)

Scenario B: Good budget (1.5x), Balanced (1.0x)
  accuracyMultiplier = 1.5 × 1.0 = 1.5x
  rangeWidth = 20 / 1.5 = 13.3 points
  Reported: "Agility: 68-82" (±6.65 from 75)

Scenario C: Elite budget (2.0x), Depth focus (1.5x)
  accuracyMultiplier = 2.0 × 1.5 = 3.0x
  rangeWidth = 20 / 3.0 = 6.67 points
  Reported: "Agility: 72-79" (±3.33 from 75)
```

---

## 4. Player Progression (Age-Based Regression)

**Purpose:** Handle attribute decline as players age past their peak

**System:** Player Progression System

### Peak Ages

Each category has its own peak age:
- **Physical:** Peak at 26 (decline starts at 30)
- **Technical:** Peak at 28 (decline starts at 32)
- **Mental:** Peak at 30 (decline starts at 34)

### Regression Formula

```
if age > (peakAge + 4):
  yearsOverPeak = age - (peakAge + 4)

  regressionChance = 0.05 + (yearsOverPeak × 0.05)
  regressionAmount = 1-3 points (random, weighted toward 1)

  Each week, roll regressionChance:
    If random < regressionChance:
      Decrease attribute by regressionAmount
```

**Example:**
```
Player: Age 34, Physical Peak 26
  yearsOverPeak = 34 - 30 = 4
  regressionChance = 0.05 + (4 × 0.05) = 0.25 (25% chance per week)

  Each week: 25% chance of losing 1-3 points from physical attributes
```

**Rationale:**
- Gradual, probabilistic decline (not sudden cliff)
- Older players decline faster
- Different categories peak at different ages
- Creates realistic career arcs (27-year-old > 35-year-old)

---

## 5. Youth Academy Formulas

**Purpose:** Generate youth prospects and determine academy capacity

**System:** Youth Academy System

### Capacity Formula

```
capacity = baseCapacity + (additionalTiers × slotsPerTier)

where:
  baseCapacity = 5 slots (minimum)
  additionalTiers = floor((budgetAmount - 100000) / 50000)
  slotsPerTier = 3

Example:
  $100k budget: 5 slots
  $150k budget: 5 + (1 × 3) = 8 slots
  $250k budget: 5 + (3 × 3) = 14 slots
```

### Prospect Quality

```
prospectAttributeRange =
  baseRange × prospectQualityMultiplier

where:
  baseRange = [20, 40] (poor academy)
  prospectQualityMultiplier = 0.5x to 2.0x (from budget)

Examples:
  Poor budget (0.5x): Attributes [10, 20]
  Standard budget (1.0x): Attributes [20, 40]
  Elite budget (2.0x): Attributes [40, 80]
```

### Prospect Quantity

```
prospectsPerYear = baseQuantity × prospectQuantityMultiplier

where:
  baseQuantity = 3 prospects/year
  prospectQuantityMultiplier = 0.5x to 2.0x (from budget)

Examples:
  Poor budget: 1-2 prospects/year
  Standard budget: 3 prospects/year
  Elite budget: 6 prospects/year
```

### Prospect Age

```
prospectAge = random(15, 18)
```

**Rationale:** Youth prospects are 15-18 years old, must be promoted/released before 19

---

## 6. Transfer System Formulas

**Purpose:** Calculate transfer fees and AI behavior

**System:** Transfer System

### Transfer Fee

```
transferFee = marketValue × transferMultiplier × urgencyMultiplier

where:
  marketValue = from Player Valuation Formula
  transferMultiplier = 1.5x to 3.0x (seller sets asking price)
  urgencyMultiplier =
    if buyer desperate: 1.2x
    if neutral: 1.0x
    if reluctant: 0.8x
```

**Example:**
```
Player market value: $1M
Seller asking: 2.0x multiplier = $2M
Buyer desperate: 1.2x urgency = $2.4M final offer
```

### AI Transfer Logic

```
AI will accept transfer if:
  offerAmount ≥ (marketValue × minAcceptableMultiplier)

where minAcceptableMultiplier depends on:
  - Team personality (0.8x to 2.0x)
  - League position (desperate teams = lower multiplier)
  - Contract situation (expiring soon = lower multiplier)
```

---

## Formula Tuning Parameters

All formulas include tunable parameters for balancing:

| Formula | Tuning Parameters | Easy to Adjust |
|---------|------------------|----------------|
| Training Progression | baseXP, age breakpoints, soft cap multipliers | ✅ Yes |
| Player Valuation | salary percentage, age multipliers | ✅ Yes |
| Scouting Range | base range width, min/max clamps | ✅ Yes |
| Regression | regression chance, regression amount | ✅ Yes |
| Youth Academy | base capacity, cost per tier | ✅ Yes |
| Transfer System | transfer multipliers | ✅ Yes |

---

## Formula Validation

All formulas will be tested with:
- Edge cases (age 0, age 100, rating 0, rating 100)
- Realistic scenarios (typical player careers)
- Balance testing (ensure progression feels right)
- Integration testing (formulas working together)

---

## Next Steps

1. Implement Training System using formula #1
2. Implement Contract System using formula #2
3. Implement Scouting System using formula #3
4. Implement Player Progression using formula #4
5. Test and tune formulas based on gameplay feel
