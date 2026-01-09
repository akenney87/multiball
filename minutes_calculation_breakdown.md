# Minutes Target Calculation - Step by Step Breakdown

## Lakers Roster Example

### Player Ratings:
1. LeBron James: 92
2. Anthony Davis: 90
3. Austin Reaves: 80
4. D'Angelo Russell: 78
5. Rui Hachimura: 76
6. Jarred Vanderbilt: 70
7. Taurean Prince: 68
8. Jaxson Hayes: 66
9. Max Christie: 64
10. Cam Reddish: 62

---

## Step 1: Find Minimum Overall
```
minOverall = 62 (Cam Reddish)
```

---

## Step 2: Calculate Weights
Formula: `weight = (overall - minOverall + 1) ^ 1.6`

```
LeBron James:        (92 - 62 + 1)^1.6 = 31^1.6 = 194.57
Anthony Davis:       (90 - 62 + 1)^1.6 = 29^1.6 = 172.85
Austin Reaves:       (80 - 62 + 1)^1.6 = 19^1.6 =  82.66
D'Angelo Russell:    (78 - 62 + 1)^1.6 = 17^1.6 =  68.12
Rui Hachimura:       (76 - 62 + 1)^1.6 = 15^1.6 =  55.90
Jarred Vanderbilt:   (70 - 62 + 1)^1.6 =  9^1.6 =  23.71
Taurean Prince:      (68 - 62 + 1)^1.6 =  7^1.6 =  15.90
Jaxson Hayes:        (66 - 62 + 1)^1.6 =  5^1.6 =   9.52
Max Christie:        (64 - 62 + 1)^1.6 =  3^1.6 =   4.66
Cam Reddish:         (62 - 62 + 1)^1.6 =  1^1.6 =   1.00

Total Weight = 628.89
```

---

## Step 3: Calculate Initial Minutes
Formula: `minutes = (weight / totalWeight) * 240`

```
LeBron James:        (194.57 / 628.89) * 240 = 74.25 minutes
Anthony Davis:       (172.85 / 628.89) * 240 = 65.96 minutes
Austin Reaves:       ( 82.66 / 628.89) * 240 = 31.54 minutes
D'Angelo Russell:    ( 68.12 / 628.89) * 240 = 26.00 minutes
Rui Hachimura:       ( 55.90 / 628.89) * 240 = 21.33 minutes
Jarred Vanderbilt:   ( 23.71 / 628.89) * 240 =  9.05 minutes
Taurean Prince:      ( 15.90 / 628.89) * 240 =  6.07 minutes
Jaxson Hayes:        (  9.52 / 628.89) * 240 =  3.63 minutes
Max Christie:        (  4.66 / 628.89) * 240 =  1.78 minutes
Cam Reddish:         (  1.00 / 628.89) * 240 =  0.38 minutes

Total = 240.0 minutes ✓
```

---

## Step 4: Apply 42-Minute Ceiling (First Pass)

```
LeBron James:        74.25 → 42.0  (excess: 32.25)
Anthony Davis:       65.96 → 42.0  (excess: 23.96)
Austin Reaves:       31.54 → 31.54 (no change)
D'Angelo Russell:    26.00 → 26.00 (no change)
Rui Hachimura:       21.33 → 21.33 (no change)
Jarred Vanderbilt:    9.05 →  9.05 (no change)
Taurean Prince:       6.07 →  6.07 (no change)
Jaxson Hayes:         3.63 →  3.63 (no change)
Max Christie:         1.78 →  1.78 (no change)
Cam Reddish:          0.38 →  0.38 (no change)

Total Excess = 32.25 + 23.96 = 56.21 minutes
```

---

## Step 5: Redistribute Excess Proportionally

**Eligible players** (those under 42 minutes):
- Austin Reaves to Cam Reddish (everyone except LeBron & AD)

**Eligible total weight:** 82.66 + 68.12 + 55.90 + 23.71 + 15.90 + 9.52 + 4.66 + 1.00 = **261.47**

**Redistribution formula:** `additionalMinutes = excess * (playerWeight / eligibleWeight)`

```
Austin Reaves:       31.54 + (56.21 * 82.66/261.47) = 31.54 + 17.77 = 49.31
D'Angelo Russell:    26.00 + (56.21 * 68.12/261.47) = 26.00 + 14.64 = 40.64
Rui Hachimura:       21.33 + (56.21 * 55.90/261.47) = 21.33 + 12.01 = 33.34
Jarred Vanderbilt:    9.05 + (56.21 * 23.71/261.47) =  9.05 +  5.10 = 14.15
Taurean Prince:       6.07 + (56.21 * 15.90/261.47) =  6.07 +  3.42 =  9.49
Jaxson Hayes:         3.63 + (56.21 *  9.52/261.47) =  3.63 +  2.05 =  5.68
Max Christie:         1.78 + (56.21 *  4.66/261.47) =  1.78 +  1.00 =  2.78
Cam Reddish:          0.38 + (56.21 *  1.00/261.47) =  0.38 +  0.21 =  0.59
```

**⚠️ PROBLEM:** Austin Reaves now has 49.31 minutes (exceeds 42 ceiling!)

---

## Step 6: Apply 42-Minute Ceiling (Second Pass)

My current implementation:
```
LeBron James:        42.0  (no change)
Anthony Davis:       42.0  (no change)
Austin Reaves:       49.31 → 42.0  (loses 7.31 minutes!)
D'Angelo Russell:    40.64 (no change)
Rui Hachimura:       33.34 (no change)
Jarred Vanderbilt:   14.15 (no change)
Taurean Prince:       9.49 (no change)
Jaxson Hayes:         5.68 (no change)
Max Christie:         2.78 (no change)
Cam Reddish:          0.59 (no change)

Total = 42 + 42 + 42 + 40.64 + 33.34 + 14.15 + 9.49 + 5.68 + 2.78 + 0.59 = 232.67 minutes
```

**⚠️ PROBLEM:** We're only using 232.67 out of 240 minutes (losing 7.33 minutes!)

---

## The Issue

When Austin Reaves gets capped at 42 after redistribution, those 7.31 excess minutes are **lost** instead of being redistributed again.

## Possible Solutions:

### Option 1: Iterative Redistribution (Most Fair)
1. Cap at 42, collect excess
2. Redistribute to eligible players
3. If any player exceeds 42, cap them and collect new excess
4. Repeat until no player exceeds 42
5. Final total will be ≤240 (some minutes may be permanently lost)

### Option 2: Accept Lost Minutes (Current Implementation)
- Cap once at 42
- Redistribute once
- Cap again at 42
- Accept that total < 240

### Option 3: No Second Cap (Violates 42 ceiling)
- Don't apply ceiling after redistribution
- Austin Reaves gets 49.31 minutes (violates the 42-minute rule!)

---

## What Should We Do?

**Which approach do you want?**

The fairest seems to be **Option 1** (iterative redistribution), where we keep redistributing excess minutes until everyone is under 42, even if it means the total is less than 240.
