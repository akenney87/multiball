# Agent 9: Multi-Sport Attribute Mapper

## Role
Design action-specific attribute weight tables for baseball and soccer, ensuring the 25-attribute system translates meaningfully across all sports while maintaining realism.

## Context
Read and understand:
- `PROJECT_CONTEXT.md` - The 25 attributes and multi-sport philosophy
- `basketball-sim/src/constants.py` - Basketball attribute weights (reference)
- Real-world baseball and soccer mechanics

## Primary Objectives
1. Map 25 attributes to baseball actions (pitching, hitting, fielding, base running, catching)
2. Map 25 attributes to soccer actions (shooting, passing, dribbling, tackling, heading, goalkeeping)
3. Create attribute weight tables for each action (like basketball's WEIGHTS_3PT_SHOOTING)
4. Design overall sport rating calculations
5. Ensure realistic cross-sport attribute effectiveness

## The 25 Attributes (Reminder)

**Physical (12):**
grip_strength, arm_strength, core_strength, agility, acceleration, top_speed, jumping, reactions, stamina, balance, height, durability

**Mental (7):**
awareness, creativity, determination, bravery, consistency, composure, patience

**Technical (6):**
hand_eye_coordination, throw_accuracy, form_technique, finesse, deception, teamwork

## Baseball Attribute Mapping

### Baseball Actions & Weights

**1. Pitching (Starter/Reliever)**
```typescript
const WEIGHTS_PITCHING_VELOCITY = {
    // Physical dominance
    arm_strength: 0.35,
    core_strength: 0.15,
    balance: 0.10,
    stamina: 0.08,  // Important for starters

    // Technical
    form_technique: 0.15,
    throw_accuracy: 0.10,

    // Mental
    composure: 0.05,
    consistency: 0.02,
};

const WEIGHTS_PITCHING_CONTROL = {
    // Technical precision
    throw_accuracy: 0.30,
    form_technique: 0.20,
    finesse: 0.15,

    // Mental
    composure: 0.15,
    consistency: 0.10,

    // Physical
    arm_strength: 0.05,
    balance: 0.05,
};

const WEIGHTS_PITCHING_BREAKING_BALLS = {
    // Deception and finesse
    deception: 0.25,
    finesse: 0.20,
    form_technique: 0.15,
    creativity: 0.10,

    // Technical
    throw_accuracy: 0.15,
    hand_eye_coordination: 0.10,

    // Mental
    composure: 0.05,
};

const WEIGHTS_PITCHING_STAMINA = {
    stamina: 0.50,
    durability: 0.20,
    core_strength: 0.15,
    determination: 0.10,
    consistency: 0.05,
};
```

**2. Hitting (Contact/Power)**
```typescript
const WEIGHTS_HITTING_CONTACT = {
    // Hand-eye coordination is king
    hand_eye_coordination: 0.30,
    reactions: 0.20,
    form_technique: 0.15,

    // Mental
    awareness: 0.10,  // Pitch recognition
    patience: 0.10,   // Waiting for right pitch
    composure: 0.08,

    // Physical
    balance: 0.07,
};

const WEIGHTS_HITTING_POWER = {
    // Strength dominates
    arm_strength: 0.25,
    core_strength: 0.25,
    grip_strength: 0.15,

    // Technique
    form_technique: 0.15,
    hand_eye_coordination: 0.10,

    // Physical
    balance: 0.07,
    height: 0.03,  // Slight advantage
};

const WEIGHTS_HITTING_PLATE_DISCIPLINE = {
    // Mental game
    patience: 0.30,
    awareness: 0.25,
    composure: 0.20,

    // Vision
    hand_eye_coordination: 0.15,
    reactions: 0.10,
};
```

**3. Fielding (Infield/Outfield)**
```typescript
const WEIGHTS_FIELDING_INFIELD = {
    // Quick reactions and hands
    reactions: 0.25,
    hand_eye_coordination: 0.20,
    agility: 0.15,
    awareness: 0.12,  // Positioning

    // Throwing
    throw_accuracy: 0.12,
    arm_strength: 0.10,

    // Physical
    balance: 0.06,
};

const WEIGHTS_FIELDING_OUTFIELD = {
    // Speed and jumping (for catches at wall)
    top_speed: 0.20,
    acceleration: 0.15,
    jumping: 0.15,  // Robbing home runs!
    awareness: 0.15,  // Reading fly balls

    // Catching
    hand_eye_coordination: 0.15,
    reactions: 0.10,

    // Throwing
    arm_strength: 0.07,  // Strong throws from outfield
    throw_accuracy: 0.03,
};

const WEIGHTS_FIELDING_CATCHING = {
    // Catcher-specific
    hand_eye_coordination: 0.25,
    reactions: 0.20,
    awareness: 0.15,  // Game calling

    // Physical demands
    durability: 0.10,
    stamina: 0.08,

    // Blocking/framing
    balance: 0.10,
    composure: 0.07,
    throw_accuracy: 0.05,  // Throwing out runners
};
```

**4. Base Running**
```typescript
const WEIGHTS_BASE_RUNNING_SPEED = {
    top_speed: 0.40,
    acceleration: 0.30,
    agility: 0.15,
    stamina: 0.10,
    determination: 0.05,
};

const WEIGHTS_BASE_RUNNING_STEALING = {
    // Timing and explosiveness
    reactions: 0.25,
    acceleration: 0.25,
    top_speed: 0.20,
    awareness: 0.15,  // Reading pitcher
    bravery: 0.08,
    agility: 0.07,
};
```

### Overall Baseball Rating
```typescript
function calculateBaseballOverall(player: Player): number {
    // Position-neutral calculation
    const hitting = (
        calculateComposite(player, WEIGHTS_HITTING_CONTACT) * 0.4 +
        calculateComposite(player, WEIGHTS_HITTING_POWER) * 0.3 +
        calculateComposite(player, WEIGHTS_HITTING_PLATE_DISCIPLINE) * 0.3
    );

    const fielding = (
        calculateComposite(player, WEIGHTS_FIELDING_INFIELD) * 0.5 +
        calculateComposite(player, WEIGHTS_FIELDING_OUTFIELD) * 0.5
    );

    const baseRunning = calculateComposite(player, WEIGHTS_BASE_RUNNING_SPEED);

    const pitching = (
        calculateComposite(player, WEIGHTS_PITCHING_VELOCITY) * 0.3 +
        calculateComposite(player, WEIGHTS_PITCHING_CONTROL) * 0.4 +
        calculateComposite(player, WEIGHTS_PITCHING_BREAKING_BALLS) * 0.3
    );

    // Weight position player skills higher (most players aren't pitchers)
    return Math.round(
        hitting * 0.35 +
        fielding * 0.30 +
        baseRunning * 0.15 +
        pitching * 0.20
    );
}
```

## Soccer Attribute Mapping

### Soccer Actions & Weights

**1. Shooting**
```typescript
const WEIGHTS_SOCCER_SHOOTING_POWER = {
    // Leg strength (use arm_strength as proxy)
    arm_strength: 0.25,  // Represents leg strength
    core_strength: 0.20,
    balance: 0.15,

    // Technique
    form_technique: 0.20,
    throw_accuracy: 0.12,  // Represents shot accuracy

    // Mental
    composure: 0.05,
    determination: 0.03,
};

const WEIGHTS_SOCCER_SHOOTING_FINESSE = {
    // Technique and touch
    finesse: 0.30,
    form_technique: 0.25,
    throw_accuracy: 0.20,

    // Mental
    composure: 0.15,
    creativity: 0.05,

    // Physical
    balance: 0.05,
};
```

**2. Passing**
```typescript
const WEIGHTS_SOCCER_PASSING_SHORT = {
    // Accuracy and vision
    throw_accuracy: 0.30,  // Represents passing accuracy
    awareness: 0.20,
    teamwork: 0.15,

    // Technical
    form_technique: 0.15,
    hand_eye_coordination: 0.10,  // Represents foot-eye coordination

    // Mental
    composure: 0.07,
    patience: 0.03,
};

const WEIGHTS_SOCCER_PASSING_LONG = {
    // Power and accuracy
    arm_strength: 0.20,  // Leg power for long balls
    throw_accuracy: 0.25,
    form_technique: 0.20,

    // Vision
    awareness: 0.20,
    creativity: 0.10,

    // Technical
    balance: 0.05,
};
```

**3. Dribbling**
```typescript
const WEIGHTS_SOCCER_DRIBBLING = {
    // Agility and ball control
    agility: 0.25,
    hand_eye_coordination: 0.20,  // Represents close control
    balance: 0.15,
    finesse: 0.15,

    // Speed
    acceleration: 0.10,
    top_speed: 0.05,

    // Mental
    creativity: 0.05,
    composure: 0.05,
};
```

**4. Defending (Tackling/Positioning)**
```typescript
const WEIGHTS_SOCCER_TACKLING = {
    // Physical challenges
    core_strength: 0.20,
    agility: 0.20,
    reactions: 0.15,
    balance: 0.12,

    // Mental
    awareness: 0.15,
    determination: 0.10,
    bravery: 0.08,
};

const WEIGHTS_SOCCER_DEFENSIVE_POSITIONING = {
    // Mental game dominates
    awareness: 0.35,
    patience: 0.15,
    teamwork: 0.15,

    // Physical
    reactions: 0.15,
    acceleration: 0.10,
    stamina: 0.10,
};
```

**5. Heading**
```typescript
const WEIGHTS_SOCCER_HEADING = {
    // Aerial dominance
    jumping: 0.35,
    height: 0.25,
    awareness: 0.15,  // Timing

    // Power
    core_strength: 0.10,
    bravery: 0.08,
    reactions: 0.07,
};
```

**6. Goalkeeping**
```typescript
const WEIGHTS_GOALKEEPING_SHOT_STOPPING = {
    // Reactions and reach
    reactions: 0.30,
    height: 0.20,
    agility: 0.15,
    jumping: 0.12,

    // Mental
    awareness: 0.12,
    composure: 0.06,
    bravery: 0.05,
};

const WEIGHTS_GOALKEEPING_POSITIONING = {
    // Mental game
    awareness: 0.40,
    patience: 0.20,
    composure: 0.15,

    // Physical
    reactions: 0.15,
    height: 0.10,
};

const WEIGHTS_GOALKEEPING_HANDLING = {
    // Safe hands
    hand_eye_coordination: 0.35,
    grip_strength: 0.25,
    composure: 0.15,
    consistency: 0.15,
    reactions: 0.10,
};
```

**7. Physical (Stamina/Strength)**
```typescript
const WEIGHTS_SOCCER_STAMINA = {
    stamina: 0.50,
    durability: 0.20,
    determination: 0.15,
    core_strength: 0.10,
    consistency: 0.05,
};
```

### Overall Soccer Rating
```typescript
function calculateSoccerOverall(player: Player): number {
    // Position-neutral calculation
    const shooting = (
        calculateComposite(player, WEIGHTS_SOCCER_SHOOTING_POWER) * 0.5 +
        calculateComposite(player, WEIGHTS_SOCCER_SHOOTING_FINESSE) * 0.5
    );

    const passing = (
        calculateComposite(player, WEIGHTS_SOCCER_PASSING_SHORT) * 0.6 +
        calculateComposite(player, WEIGHTS_SOCCER_PASSING_LONG) * 0.4
    );

    const dribbling = calculateComposite(player, WEIGHTS_SOCCER_DRIBBLING);

    const defending = (
        calculateComposite(player, WEIGHTS_SOCCER_TACKLING) * 0.6 +
        calculateComposite(player, WEIGHTS_SOCCER_DEFENSIVE_POSITIONING) * 0.4
    );

    const physical = calculateComposite(player, WEIGHTS_SOCCER_STAMINA);

    const goalkeeping = (
        calculateComposite(player, WEIGHTS_GOALKEEPING_SHOT_STOPPING) * 0.4 +
        calculateComposite(player, WEIGHTS_GOALKEEPING_POSITIONING) * 0.3 +
        calculateComposite(player, WEIGHTS_GOALKEEPING_HANDLING) * 0.3
    );

    // Weight outfield skills higher (most players aren't goalkeepers)
    return Math.round(
        shooting * 0.20 +
        passing * 0.20 +
        dribbling * 0.15 +
        defending * 0.15 +
        physical * 0.20 +
        goalkeeping * 0.10
    );
}
```

## Cross-Sport Attribute Effectiveness

### Example Athletes

**High Jumping Athlete (95 jumping)**
- Basketball: Elite dunker, excellent rebounder
- Baseball: Elite outfielder (rob home runs), poor pitcher
- Soccer: Elite header, good goalkeeper reach

**High Throw Accuracy (95 throw_accuracy)**
- Basketball: Elite 3PT shooter, excellent passer
- Baseball: Elite pitcher control, accurate throws from field
- Soccer: Elite passer, accurate shot placement

**High Stamina (95 stamina)**
- Basketball: Plays heavy minutes without fatigue
- Baseball: Elite starting pitcher (complete games), good base runner
- Soccer: Box-to-box midfielder, never tires

**High Agility (95 agility)**
- Basketball: Elite defender, excellent ball handler
- Baseball: Elite infielder, good base stealer
- Soccer: Elite dribbler, excellent defender

## Validation Examples

**Victor Wembanyama Type (7'4", athletic)**
```typescript
const wemby = {
    height: 98,
    jumping: 85,
    agility: 70,
    awareness: 88,
    // ... other attributes
};

// Basketball: Elite (shot blocking, rebounding, interior defense)
calculateBasketballOverall(wemby);  // ~88

// Soccer: Good goalkeeper (height + reach), poor dribbler
calculateSoccerOverall(wemby);  // ~65

// Baseball: Good outfielder (reach), poor base runner (not agile)
calculateBaseballOverall(wemby);  // ~58
```

**Bo Jackson Type (Elite athlete, power, speed)**
```typescript
const boJackson = {
    top_speed: 96,
    arm_strength: 94,
    core_strength: 92,
    hand_eye_coordination: 88,
    // ... other attributes
};

// Baseball: Elite (power hitter, strong arm, fast)
calculateBaseballOverall(boJackson);  // ~92

// Basketball: Good (athletic, but not skilled)
calculateBasketballOverall(boJackson);  // ~72

// Soccer: Good (physical dominance)
calculateSoccerOverall(boJackson);  // ~74
```

## Deliverables
- [ ] Complete baseball attribute weight tables (pitching, hitting, fielding, base running)
- [ ] Complete soccer attribute weight tables (shooting, passing, dribbling, defending, heading, goalkeeping)
- [ ] Overall sport rating formulas (baseball, soccer)
- [ ] Cross-sport validation examples
- [ ] Documentation explaining each weight choice
- [ ] Rationale for attribute interpretation across sports

## Collaboration
- **Agent 1 (Translation):** Provide weight constants for simulators
- **Agent 10 (Overseer):** Validate realism and cross-sport effectiveness
