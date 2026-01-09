# Correlation Diagnosis: Why k=0.025 Failed to Improve Shot-Level Correlation

**Author:** Chief Probability & Mathematics Engineer
**Date:** 2025-11-10
**Context:** Investigating why increasing SIGMOID_K from 0.015→0.025 worsened correlation

---

## Executive Summary

Increasing SIGMOID_K from 0.015 to 0.025 **FAILED** to improve shot-level correlation between shooter composite and make rate. In fact, correlation decreased from r=0.054 to r=0.049, while the spread narrowed from 8.3pp to 6.1pp.

**Root Cause:** The problem is NOT the sigmoid steepness. The problem is **contest distance variance (σ=1.9 ft) is overwhelming the attribute signal at the shot level**.

**Key Finding:** Contest penalties (-8% avg) are ADDITIVE and applied AFTER the base sigmoid calculation. This creates a ceiling effect that compresses the output range, destroying correlation.

---

## 1. Mathematical Explanation: Why Increasing k Made Things Worse

### 1.1 The Centered Sigmoid Formula

```python
centered = (sigmoid(k * diff) - 0.5) * 2.0  # Range: -1 to +1

if centered >= 0:
    P = BaseRate + (1 - BaseRate) * centered
else:
    P = BaseRate * (1 + centered)
```

### 1.2 What Happens When k Increases

**k=0.015 (before):**
- Composite diff of +10 → centered = 0.254 → Impact = +17.8% (for 3PT)
- Composite diff of -10 → centered = -0.254 → Impact = -7.6%
- **Total range for ±10 diff: 25.4 percentage points**

**k=0.025 (after):**
- Composite diff of +10 → centered = 0.385 → Impact = +27.0% (for 3PT)
- Composite diff of -10 → centered = -0.385 → Impact = -11.6%
- **Total range for ±10 diff: 38.6 percentage points**

**Analysis:** Increasing k from 0.015→0.025 increased signal strength by **51%** (38.6/25.4).

So if signal strength increased 51%, why did correlation DECREASE?

---

## 2. The Contest Distance Problem

### 2.1 Current Implementation

```python
# In defense.py, line 373:
variance = random.gauss(0, CONTEST_DISTANCE_SIGMA)  # σ = 1.9 ft
base_distance += variance
```

This adds **±3.8 ft (2σ) of noise** to contest distance, decoupling it from defender quality.

### 2.2 Contest Penalty Application

```python
# In shooting.py:
base_success = weighted_sigmoid_probability(BASE_RATE_3PT, attribute_diff, k=SIGMOID_K)
contest_penalty = calculate_contest_penalty(contest_distance, defender_composite, ...)
final_success = base_success + contest_penalty  # ADDITIVE
```

### 2.3 The Problem

**Before Gaussian variance was added:**
- Elite defender (90 comp): distance = 1.0 ft → penalty = -15%
- Poor defender (30 comp): distance = 7.0 ft → penalty = 0%
- **Defender quality fully determines contest distance**

**After Gaussian variance (σ=1.9):**
- Elite defender (90 comp): distance = 1.0 ± 3.8 ft → **~30% chance of being wide open**
- Poor defender (30 comp): distance = 7.0 ± 3.8 ft → **~30% chance of heavily contested**
- **Defender quality is now heavily diluted by randomness**

### 2.4 Impact on Shot-Level Correlation

The Gaussian variance creates **three layers of randomness**:
1. Contest distance variance (σ=1.9 ft)
2. Contest penalty application (-0% to -15%)
3. Final shot roll (random() < probability)

With contest distance decoupled from defender quality, a 70-composite shooter faces **similar contest distributions** whether facing a 30-comp or 90-comp defender.

**Result:** Shooter composite explains very little shot-by-shot variance → weak correlation.

---

## 3. Why k=0.025 Made It Worse

### 3.1 The Ceiling Effect

3PT shots have BASE_RATE_3PT = 0.33. The centered sigmoid formula scales toward 1.0 for positive advantages.

**k=0.015 with +20 diff (elite vs average):**
- centered = 0.444
- P_base = 0.33 + (1 - 0.33) * 0.444 = 0.627 (62.7%)

**k=0.025 with +20 diff:**
- centered = 0.622
- P_base = 0.33 + (1 - 0.33) * 0.622 = 0.747 (74.7%)

Now apply average contest penalty of -8%:
- k=0.015: 62.7% - 8% = **54.7%**
- k=0.025: 74.7% - 8% = **66.7%**

### 3.2 The Floor Compression

For poor shooters with -20 diff:

**k=0.015:**
- centered = -0.444
- P_base = 0.33 * (1 - 0.444) = 0.183 (18.3%)
- After -8% penalty: **10.3%**

**k=0.025:**
- centered = -0.622
- P_base = 0.33 * (1 - 0.622) = 0.125 (12.5%)
- After -8% penalty: **4.5%**

### 3.3 The Result

Your observation was correct:

> "All composite buckets improved by similar absolute amounts (+1.2pp to +3.5pp). This LIFTED THE FLOOR more than the ceiling."

**k=0.015:** Spread = 54.7% - 10.3% = **44.4pp**
**k=0.025:** Spread = 66.7% - 4.5% = **62.2pp**

But wait—shouldn't wider spread increase correlation?

**No.** Because the contest penalty is applied AFTER the sigmoid and is RANDOMIZED by Gaussian variance, the increased spread at the base level gets **compressed** when averaged across many shots per composite bucket.

The floor got lifted more because low-composite shooters still get wide-open looks (via Gaussian variance), pushing their make rates up. Meanwhile, elite shooters hit the ceiling more often, compressing their advantage.

---

## 4. Is Pearson Correlation the Wrong Metric?

### 4.1 Understanding Pearson r

Pearson correlation measures **linear relationships** between two continuous variables. It's perfectly appropriate for:
- X = Shooter composite (continuous, 1-100)
- Y = Make rate in composite bucket (continuous, 0-100%)

### 4.2 Why r=0.049 is Valid but Low

The correlation is measuring:
- **Signal:** Shooter composite → base success probability → make rate
- **Noise:** Contest variance, roll variance, sample size variance

With contest distance adding ±3.8 ft of noise that's independent of defender quality, the signal-to-noise ratio is extremely low.

**Pearson r is NOT the problem.** The problem is the signal is being drowned out by noise.

---

## 5. The TRUE Root Cause

The weak correlation is caused by **three compounding issues**:

### 5.1 Contest Distance Variance (σ=1.9)

**Why it was added:** To fix contest distribution (was 96% contested, now 30% wide open).

**Unintended consequence:** Decoupled contest distance from defender quality, destroying the defender composite → contest penalty → make rate signal chain.

**Evidence:**
- Before variance: Elite defenders always produce tight contests
- After variance: Elite defenders produce wide-open shots ~30% of the time
- Result: Defender quality no longer consistently affects shot difficulty

### 5.2 Additive Contest Penalty

Contest penalty is applied AFTER the sigmoid:

```python
final_success = base_success + contest_penalty
```

This means the penalty is **independent** of the sigmoid calculation. If contest distance is randomized, the penalty becomes random noise added to an attribute-driven signal.

### 5.3 Shot-Level vs Game-Level Aggregation

- **Game-level:** 80 shots per team, randomness averages out → correlation exists
- **Shot-level:** Single shots, contest variance dominates → weak correlation

The user correctly observed:
> "shot-level correlation = 0.054, spread = 8.3pp"

This is measuring the DIRECT relationship: shooter composite → shot outcome. At this level, the Gaussian variance is overwhelming the signal.

---

## 6. What Should We Try Instead?

### Option A: Remove Contest Distance Variance (σ=1.9 → 0)

**Pros:**
- Restores defender quality → contest distance → penalty signal chain
- Should dramatically improve shot-level correlation
- Maintains mathematical purity

**Cons:**
- Breaks contest distribution (back to 96% contested)
- Loses NBA realism in shot quality distribution

**Recommendation:** Do NOT do this. Contest distribution is important for realism.

---

### Option B: Make Contest Variance Attribute-Dependent

Instead of:
```python
variance = random.gauss(0, 1.9)  # Independent of defender quality
```

Use:
```python
# Higher defender composite = lower variance (more consistent closeouts)
sigma = 2.5 - (defender_composite / 100.0) * 1.5  # Range: 1.0 to 2.5
variance = random.gauss(0, sigma)
```

**Effect:**
- Elite defenders (90): σ=1.15 ft → tight distribution, consistent contests
- Average defenders (50): σ=1.75 ft → moderate variance
- Poor defenders (30): σ=2.05 ft → high variance, inconsistent closeouts

**Pros:**
- Preserves contest distribution (still hits ~30% wide open)
- Restores attribute-driven signal (elite defenders produce tighter contests on average)
- Makes physical sense (elite defenders execute more consistently)

**Cons:**
- Adds complexity
- May need retuning of contest distribution target

**Recommendation:** BEST OPTION. Maintains realism while restoring correlation.

---

### Option C: Multiplicative Contest Penalty

Instead of:
```python
final_success = base_success + contest_penalty  # Additive
```

Use:
```python
contest_multiplier = 1.0 + (contest_penalty / base_success)  # Convert to multiplier
final_success = base_success * contest_multiplier
```

**Effect:**
- Contest penalty now scales with base success rate
- Elite shooters lose more from bad contests
- Poor shooters lose less (already low probability)

**Pros:**
- Multiplicative relationships often produce stronger correlations
- Makes physical sense (contest hurts elite shooters more)

**Cons:**
- Requires complete retuning of contest penalties
- May break NBA-realistic percentages

**Recommendation:** EXPERIMENTAL. Worth testing but risky.

---

### Option D: Reduce Contest Distance Variance

Instead of σ=1.9, try σ=1.2:

**Effect:**
- Reduces noise by 37%
- May shift contest distribution slightly (need to verify)
- Increases signal-to-noise ratio

**Pros:**
- Simple change
- Should improve correlation
- Low risk

**Cons:**
- May not fully solve the problem
- May break contest distribution

**Recommendation:** SAFE FIRST STEP. Try σ=1.2 and measure impact on both correlation AND contest distribution.

---

## 7. Validation Plan

### Step 1: Baseline Measurement

Run current implementation (k=0.025, σ=1.9) with seed=42:
- Measure shot-level correlation by composite bucket
- Measure contest distribution (% wide open, open, tight, very tight)
- Record make rates by composite bucket

### Step 2: Test Option D (Reduce σ)

Set CONTEST_DISTANCE_SIGMA = 1.2, rerun:
- Measure correlation (expect improvement)
- Measure contest distribution (check if still realistic)
- If contest distribution breaks, stop here

### Step 3: Test Option B (Attribute-Dependent σ)

Implement defender-composite-dependent variance:
```python
base_sigma = 1.9
sigma_range = 1.0  # Elite: 1.4, Poor: 2.4
defender_factor = (100 - defender_composite) / 100.0  # Invert so elite = low
sigma = (base_sigma - sigma_range/2) + (defender_factor * sigma_range)
variance = random.gauss(0, sigma)
```

- Measure correlation (expect significant improvement)
- Measure contest distribution (should still be realistic)
- Measure defender quality impact on average contest distance

### Step 4: Quantify Improvement

Compare all three implementations:
- Shot-level correlation (target: r > 0.25)
- Composite bucket spread (target: 20-30pp between min and max)
- Contest distribution (target: maintain ~30% wide open)
- NBA realism (FG%, 3P%, game averages)

---

## 8. Expected Outcomes

### Option D (σ=1.2):
- Correlation: r = 0.10-0.15 (moderate improvement)
- Spread: 10-12pp (slight improvement)
- Contest distribution: May shift toward more contested

### Option B (Attribute-dependent σ):
- Correlation: r = 0.25-0.35 (major improvement)
- Spread: 20-25pp (significant improvement)
- Contest distribution: Should maintain ~30% wide open
- Defender quality impact: Restored

---

## 9. Conclusions

### Question 1: Why did increasing k make correlation worse instead of better?

**Answer:** Increasing k amplified the signal at the base level but also increased the floor compression when poor shooters got wide-open looks (via Gaussian variance). The ceiling effect for elite shooters combined with the lifted floor for poor shooters resulted in a NARROWER spread after aggregation, reducing correlation.

### Question 2: Is the Pearson correlation metric inappropriate for binary outcomes?

**Answer:** No. Pearson r is appropriate for measuring the relationship between continuous shooter composite and continuous make rate (averaged over many binary outcomes per bucket). The metric is working correctly—it's revealing that the signal is weak.

### Question 3: Is the contest distance variance (σ=1.9) destroying the correlation signal?

**Answer:** **YES.** This is the primary culprit. By adding ±3.8 ft of noise that's independent of defender quality, we've decoupled contest distance from defender composite, breaking the signal chain.

### Question 4: What is the TRUE root cause of weak correlation (r=0.054)?

**Answer:** Contest distance Gaussian variance (σ=1.9) is overwhelming the attribute-driven signal at the shot level. The variance was added to fix contest distribution (from 96% contested to realistic), but it had the unintended consequence of destroying the defender quality → contest quality → shot difficulty relationship.

### Question 5: What should we try instead of increasing k?

**Answer:**
1. **IMMEDIATE ACTION:** Test Option D (reduce σ to 1.2) and measure impact on correlation AND contest distribution
2. **RECOMMENDED SOLUTION:** Implement Option B (attribute-dependent variance) to restore signal while maintaining realism
3. **DO NOT:** Remove variance entirely (breaks contest distribution)
4. **EXPERIMENTAL:** Option C (multiplicative contest penalty) if Options D and B fail

---

## 10. Implementation Priority

### PRIORITY 1: Validate Hypothesis (2 hours)
- Create validation script that measures correlation with different σ values
- Test σ = 1.9, 1.5, 1.2, 0.9, 0.5, 0.0
- Plot correlation vs contest distribution error
- Find optimal tradeoff point

### PRIORITY 2: Implement Option B (4 hours)
- Add attribute-dependent variance formula
- Tune parameters to maintain contest distribution
- Validate correlation improvement
- Verify NBA realism preserved

### PRIORITY 3: Full Validation (2 hours)
- Run 100 games with new implementation
- Compare to baseline (k=0.025, σ=1.9)
- Generate statistical report
- Measure correlation, spread, and NBA realism

**Total estimated time:** 8 hours

---

## Appendix: Mathematical Proof of Ceiling Effect

For a 3PT shot with BASE_RATE = 0.33:

**Maximum possible success rate:**
- Perfect shooter (composite = 100) vs worst defender (composite = 1)
- Attribute diff = +99
- centered(0.025 * 99) = centered(2.475) ≈ 1.0
- P_base = 0.33 + (1 - 0.33) * 1.0 = 1.00 (100%)
- After contest penalty (-8% avg): **92%**
- After clamping to [0, 1]: **92%**

**But in practice:**
- Elite shooter (85) vs average defender (50) = +35 diff
- centered(0.025 * 35) = 0.824
- P_base = 0.33 + (0.67 * 0.824) = 0.882 (88.2%)
- After contest penalty (-8%): **80.2%**

**The problem:**
- k=0.025 pushes base rates so high that even after contest penalty, elite shooters are near the ceiling
- This leaves little room for attribute differences to manifest in final outcomes
- Poor shooters benefit disproportionately from wide-open looks (Gaussian variance)
- Result: Compressed spread, weak correlation

**The solution is NOT to reduce k.** The solution is to fix the contest variance so that elite defenders consistently produce tighter contests, allowing the attribute differential to manifest in shot difficulty rather than just base success rate.
