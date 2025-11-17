# Agent 6: AI Team Behavior Designer

## Role
Create realistic, diverse AI team behaviors with distinct personalities that make the league feel alive and competitive.

## Context
Read and understand:
- `PROJECT_CONTEXT.md` - AI requirements and game systems
- Agent 2's game systems - AI teams use the same systems as user

## Primary Objectives
1. Design AI personality system with diverse team types
2. Implement realistic AI decision-making for all game systems
3. Create 20 distinct AI teams per division (100 total teams)
4. Make AI feel intelligent, not random or exploitable

## AI Personality System

### Personality Archetypes

```typescript
interface AIPersonality {
    name: string;
    description: string;

    // Trait sliders (0-100)
    traits: {
        youth_development_focus: number;  // 0 = ignore youth, 100 = prioritize
        spending_aggression: number;      // 0 = frugal, 100 = splashes cash
        defensive_mindset: number;        // 0 = offensive, 100 = defensive
        multi_sport_specialist: boolean;  // Focuses on multi-sport athletes
        risk_tolerance: number;           // 0 = conservative, 100 = risky
        loyalty_to_players: number;       // 0 = quick to sell, 100 = loyal
        tactical_flexibility: number;     // 0 = rigid tactics, 100 = adaptive
    };

    // Budget allocation preferences
    budgetPreferences: {
        coaching: number;      // 0-100%
        medical: number;
        youthAcademy: number;
        scouting: number;
        tryouts: number;
    };

    // Transfer behavior
    transferBehavior: {
        willingToSell: boolean;
        valuationMultiplier: number;  // 0.8-1.5x (how they value their players)
        targetPlayerTypes: string[];  // ["young", "athletic", "cheap", etc.]
    };
}
```

### Example Personalities

**1. "Youth Academy"**
```typescript
{
    name: "Youth Development FC",
    traits: {
        youth_development_focus: 90,
        spending_aggression: 30,
        defensive_mindset: 50,
        multi_sport_specialist: false,
        risk_tolerance: 60,
        loyalty_to_players: 40,  // Willing to sell developed youth
        tactical_flexibility: 70,
    },
    budgetPreferences: {
        coaching: 20,
        medical: 15,
        youthAcademy: 40,  // Heavy youth investment
        scouting: 20,
        tryouts: 5,
    },
    transferBehavior: {
        willingToSell: true,  // Sells developed players
        valuationMultiplier: 1.2,
        targetPlayerTypes: ["young", "high_potential"],
    }
}
```

**2. "Big Spender"**
```typescript
{
    name: "Money Bags United",
    traits: {
        youth_development_focus: 20,
        spending_aggression: 95,
        defensive_mindset: 40,
        multi_sport_specialist: false,
        risk_tolerance: 80,
        loyalty_to_players: 60,
        tactical_flexibility: 50,
    },
    budgetPreferences: {
        coaching: 25,
        medical: 25,
        youthAcademy: 10,
        scouting: 30,
        tryouts: 10,
    },
    transferBehavior: {
        willingToSell: false,  // Rarely sells
        valuationMultiplier: 1.5,  // Overvalues own players
        targetPlayerTypes: ["elite", "proven", "expensive"],
    }
}
```

**3. "Multi-Sport Specialists"**
```typescript
{
    name: "Omni-Athletes Club",
    traits: {
        youth_development_focus: 50,
        spending_aggression: 60,
        defensive_mindset: 50,
        multi_sport_specialist: true,
        risk_tolerance: 70,
        loyalty_to_players: 55,
        tactical_flexibility: 80,
    },
    budgetPreferences: {
        coaching: 25,
        medical: 30,  // Higher (multi-sport = more injuries)
        youthAcademy: 20,
        scouting: 20,
        tryouts: 5,
    },
    transferBehavior: {
        willingToSell: true,
        valuationMultiplier: 1.0,
        targetPlayerTypes: ["versatile", "high_stamina", "multi_sport_capable"],
    }
}
```

**4. "Defensive Wall"**
```typescript
{
    name: "The Fortress",
    traits: {
        youth_development_focus: 40,
        spending_aggression: 50,
        defensive_mindset: 90,
        multi_sport_specialist: false,
        risk_tolerance: 30,
        loyalty_to_players: 70,
        tactical_flexibility: 40,
    },
    budgetPreferences: {
        coaching: 30,  // Focus on defensive training
        medical: 20,
        youthAcademy: 20,
        scouting: 25,
        tryouts: 5,
    },
    transferBehavior: {
        willingToSell: false,
        valuationMultiplier: 1.1,
        targetPlayerTypes: ["defensive", "tall", "high_awareness"],
    }
}
```

**5. "Moneyball Analytics"**
```typescript
{
    name: "Data Driven FC",
    traits: {
        youth_development_focus: 60,
        spending_aggression: 40,
        defensive_mindset: 50,
        multi_sport_specialist: false,
        risk_tolerance: 50,
        loyalty_to_players: 30,  // Data-driven, not emotional
        tactical_flexibility: 90,
    },
    budgetPreferences: {
        coaching: 25,
        medical: 20,
        youthAcademy: 15,
        scouting: 35,  // Heavy scouting investment
        tryouts: 5,
    },
    transferBehavior: {
        willingToSell: true,
        valuationMultiplier: 0.9,  // Undervalues (finds value)
        targetPlayerTypes: ["undervalued", "young", "high_potential"],
    }
}
```

### Personality Distribution
- **Per Division (20 teams):**
  - Youth Development: 3 teams
  - Big Spender: 2 teams
  - Multi-Sport Specialist: 3 teams
  - Defensive Focused: 2 teams
  - Offensive Focused: 2 teams
  - Moneyball Analytics: 3 teams
  - Balanced/Generic: 5 teams

## AI Decision-Making Systems

### 1. Transfer Decisions

**Should AI Make Offer for Player?**
```typescript
function shouldMakeOffer(
    ai: AITeam,
    player: Player,
    scoutingReport: ScoutingReport
): boolean {
    // 1. Budget check
    if (ai.budget.available < estimateTransferFee(player)) return false;

    // 2. Roster need check
    if (!aiNeedsPlayer(ai, player)) return false;

    // 3. Personality alignment
    const personalityScore = evaluatePlayerFit(ai.personality, player);
    if (personalityScore < 60) return false;

    // 4. Division/ambition check
    if (ai.standing.rank < 5 && player.overall < 70) return false;  // Top teams want stars
    if (ai.standing.rank > 15 && player.contract.salary > ai.budget.available * 0.2) return false;  // Struggling teams can't afford

    return true;
}

function evaluatePlayerFit(personality: AIPersonality, player: Player): number {
    let score = 50;  // Base

    // Youth focus
    if (personality.traits.youth_development_focus > 70 && player.age < 22) {
        score += 20;
    } else if (personality.traits.youth_development_focus < 30 && player.age > 28) {
        score += 10;
    }

    // Multi-sport
    if (personality.traits.multi_sport_specialist) {
        const versatility = (player.overallRatings.basketball +
                            player.overallRatings.baseball +
                            player.overallRatings.soccer) / 3;
        if (versatility > 60) score += 15;
    }

    // Defensive mindset
    if (personality.traits.defensive_mindset > 70) {
        if (player.attributes.awareness > 75 && player.attributes.reactions > 75) {
            score += 15;
        }
    }

    return Math.min(score, 100);
}
```

**AI Transfer Offer Amount**
```typescript
function calculateOfferAmount(
    ai: AITeam,
    player: Player,
    marketValue: number
): number {
    let offerMultiplier = 1.0;

    // Personality adjustments
    if (ai.personality.traits.spending_aggression > 70) {
        offerMultiplier += 0.2;  // Overpay
    } else if (ai.personality.traits.spending_aggression < 30) {
        offerMultiplier -= 0.15;  // Lowball
    }

    // Desperation (relegation zone)
    if (ai.standing.rank > 17) {
        offerMultiplier += 0.3;  // Panic buying
    }

    // Division wealth
    const divisionMultipliers = [2.0, 1.5, 1.0, 0.7, 0.5];  // Div 1-5
    offerMultiplier *= divisionMultipliers[ai.division - 1];

    return Math.round(marketValue * offerMultiplier);
}
```

**AI Counter-Offer Logic**
```typescript
function shouldCounterOffer(
    ai: AITeam,
    userOffer: TransferOffer,
    player: Player
): { counter: boolean; amount?: number } {
    const playerValue = calculatePlayerValue(ai, player);
    const offerRatio = userOffer.transferFee / playerValue;

    // Loyalty factor
    const loyaltyBonus = ai.personality.traits.loyalty_to_players / 100;
    const acceptThreshold = 0.9 + (loyaltyBonus * 0.3);  // 0.9-1.2x value

    if (offerRatio >= acceptThreshold) {
        return { counter: false };  // Accept
    }

    if (offerRatio < 0.5) {
        return { counter: false };  // Too low, reject outright
    }

    // Counter-offer
    const counterAmount = Math.round(playerValue * acceptThreshold * 0.95);
    return { counter: true, amount: counterAmount };
}
```

### 2. Contract Negotiations

**AI Player Wage Demands**
```typescript
function calculateWageDemand(
    player: Player,
    team: AITeam,
    marketConditions: MarketConditions
): ContractOffer {
    const overall = calculateOverallRating(player);
    const baseWage = (overall / 100) * 500000;  // Max $500k for 100 overall

    // Age adjustment
    const ageFactor = player.age >= 25 && player.age <= 29 ? 1.2 : 1.0;

    // Demand (how many teams interested)
    const demandFactor = 1 + (marketConditions.interestedTeams / 10);

    // Contract length preference (younger players want shorter)
    const contractLength = player.age < 24 ? 2 : player.age < 28 ? 3 : 4;

    return {
        salary: Math.round(baseWage * ageFactor * demandFactor),
        contractLength,
        signingBonus: Math.round(baseWage * 0.2),
        performanceBonuses: generatePerformanceBonuses(player),
        releaseClause: player.age < 26 ? Math.round(baseWage * 5) : null,
    };
}
```

### 3. Tactical Decisions

**AI Lineup Selection**
```typescript
function selectLineup(ai: AITeam, sport: Sport): Player[] {
    const availablePlayers = ai.roster.filter(p => !p.injury);

    // Personality-based sorting
    if (ai.personality.traits.multi_sport_specialist) {
        // Prefer versatile players
        availablePlayers.sort((a, b) =>
            calculateVersatility(b) - calculateVersatility(a)
        );
    } else {
        // Prefer sport-specific ratings
        availablePlayers.sort((a, b) =>
            b.overallRatings[sport] - a.overallRatings[sport]
        );
    }

    return availablePlayers.slice(0, 15);  // Top 15 for basketball
}

function selectTactics(ai: AITeam, opponent: Team): TacticalSettings {
    const defensiveMindset = ai.personality.traits.defensive_mindset / 100;

    return {
        pace: defensiveMindset > 0.6 ? 'slow' : defensiveMindset < 0.4 ? 'fast' : 'standard',
        manDefensePct: Math.round(50 + (defensiveMindset * 30)),  // 50-80%
        scoringOptions: selectScoringOptions(ai.roster),
        reboundingStrategy: defensiveMindset > 0.7 ? 'prevent_transition' : 'standard',
        // Adapt to opponent
        timeoutStrategy: opponent.standing.rank < ai.standing.rank ? 'aggressive' : 'standard',
    };
}
```

### 4. Budget Allocation

**AI Budget Decisions (Between Seasons)**
```typescript
function allocateBudget(ai: AITeam): BudgetAllocation {
    const personality = ai.personality;
    const baseAllocation = personality.budgetPreferences;

    // Adjust based on season performance
    if (ai.lastSeasonRank > 17) {
        // Relegation fight - boost everything
        return {
            coaching: Math.min(baseAllocation.coaching + 5, 100),
            medical: Math.min(baseAllocation.medical + 5, 100),
            youthAcademy: Math.max(baseAllocation.youthAcademy - 5, 0),  // Cut youth
            scouting: Math.min(baseAllocation.scouting + 10, 100),
            freeAgentTryouts: Math.min(baseAllocation.tryouts + 5, 100),
        };
    }

    if (ai.lastSeasonRank <= 3) {
        // Promotion contenders - maintain success
        return baseAllocation;  // Don't change winning formula
    }

    // Mid-table - stick to personality
    return baseAllocation;
}
```

### 5. Training Focus

**AI Training Allocation**
```typescript
function determineTrainingFocus(ai: AITeam): TrainingFocus {
    const personality = ai.personality;

    // Base allocation
    let focus: TrainingFocus = {
        physical: 33,
        mental: 33,
        technical: 34,
    };

    // Defensive teams focus mental
    if (personality.traits.defensive_mindset > 70) {
        focus = { physical: 25, mental: 45, technical: 30 };
    }

    // Athletic/multi-sport teams focus physical
    if (personality.traits.multi_sport_specialist) {
        focus = { physical: 45, mental: 25, technical: 30 };
    }

    // Youth development teams focus technical
    if (personality.traits.youth_development_focus > 70) {
        focus = { physical: 30, mental: 25, technical: 45 };
    }

    return focus;
}
```

### 6. Scouting Behavior

**AI Scouting Strategy**
```typescript
function configureScoutingSettings(ai: AITeam): ScoutingSettings {
    const personality = ai.personality;

    // Depth vs Breadth
    let depthVsBreadth = 50;  // Default balanced
    if (personality.traits.risk_tolerance > 70) {
        depthVsBreadth = 30;  // Breadth - more risky finds
    } else if (personality.traits.spending_aggression > 70) {
        depthVsBreadth = 80;  // Depth - know exactly what they're buying
    }

    // Target types
    const targets: ScoutingTarget[] = [];

    if (personality.transferBehavior.targetPlayerTypes.includes("young")) {
        targets.push({
            targetType: 'general',
            filters: { ageMin: 18, ageMax: 23 },
        });
    }

    if (personality.transferBehavior.targetPlayerTypes.includes("elite")) {
        targets.push({
            targetType: 'team_player',
            filters: { attributeFilters: { /* high overall */ } },
        });
    }

    return {
        budgetAllocation: personality.budgetPreferences.scouting,
        depthVsBreadth,
        targets,
    };
}
```

## AI Team Generation

**Generate 20 Teams Per Division**
```typescript
function generateAITeams(division: number): AITeam[] {
    const teams: AITeam[] = [];
    const personalityDistribution = getPersonalityDistribution();

    for (let i = 0; i < 20; i++) {
        const personality = selectPersonality(personalityDistribution);
        const team = generateTeam(division, personality, i);
        teams.push(team);
    }

    return teams;
}

function generateTeam(
    division: number,
    personality: AIPersonality,
    index: number
): AITeam {
    const teamName = generateTeamName(personality);
    const colors = generateTeamColors();

    // Generate roster based on division and personality
    const roster = generateAIRoster(division, personality);

    // Budget based on division
    const divisionBudgets = [5000000, 3000000, 2000000, 1500000, 1000000];
    const budget = divisionBudgets[division - 1];

    return {
        id: `ai_team_${division}_${index}`,
        name: teamName,
        colors,
        division,
        budget: allocateInitialBudget(budget, personality),
        roster,
        personality,
        // ... other fields
    };
}
```

## Deliverables
- [ ] AI personality system (5+ distinct archetypes)
- [ ] Transfer decision-making algorithms
- [ ] Contract negotiation logic
- [ ] Tactical decision-making (lineup, tactics)
- [ ] Budget allocation logic
- [ ] Training focus logic
- [ ] Scouting behavior
- [ ] AI team generator (100 teams across 5 divisions)
- [ ] Personality distribution system
- [ ] AI behavior documentation

## Collaboration
- **Agent 2 (Game Systems):** AI uses same systems as user
- **Agent 5 (Data Modeling):** AI team data structures
- **Agent 7 (Season Manager):** AI participates in season flow
- **Agent 10 (Overseer):** Balance and fairness validation
