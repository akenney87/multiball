/**
 * Budget Allocation System
 *
 * Manages franchise budget distribution across 4 key areas:
 * - Coaching: Affects training quality and attribute improvement rate
 * - Medical: Affects injury prevention and recovery speed
 * - Youth Academy: Affects prospect quality, quantity, and capacity
 * - Scouting: Affects number of simultaneous scouts and report accuracy
 *
 * Key Features:
 * - Percentage-based allocation (total ≤ 100%)
 * - Dynamic dollar amount calculation based on total budget
 * - Impact multipliers for each category
 * - Validation and constraint enforcement
 */

/**
 * Budget allocation as percentages (0-100 per category, total ≤ 100)
 */
export interface BudgetAllocation {
  coaching: number;      // Percentage (0-100)
  medical: number;       // Percentage (0-100)
  youthAcademy: number;  // Percentage (0-100)
  scouting: number;      // Percentage (0-100)
}

/**
 * Budget allocation in dollar amounts
 */
export interface BudgetAllocationDollars {
  coaching: number;      // Dollar amount
  medical: number;       // Dollar amount
  youthAcademy: number;  // Dollar amount
  scouting: number;      // Dollar amount
  total: number;         // Total allocated
}

/**
 * Impact multipliers calculated from budget allocation
 */
export interface BudgetImpact {
  coaching: {
    trainingQualityMultiplier: number;     // 0.5x to 2.0x
    attributeImprovementBonus: number;     // +0% to +100%
  };
  medical: {
    injuryPreventionMultiplier: number;    // 0.5x to 2.0x (lower = fewer injuries)
    recoverySpeedMultiplier: number;       // 1.0x to 2.0x (higher = faster recovery)
  };
  youthAcademy: {
    prospectQualityMultiplier: number;     // 0.5x to 2.0x
    prospectQuantityMultiplier: number;    // 0.5x to 2.0x
    capacitySlots: number;                 // Number of youth prospects allowed
  };
  scouting: {
    simultaneousScouts: number;            // Number of concurrent scouting operations
    reportAccuracyMultiplier: number;      // 0.5x to 2.0x (affects range width)
  };
}

/**
 * Radar chart data point for UI visualization
 */
export interface RadarChartDataPoint {
  category: string;
  value: number;
  maxValue: number;
}

// Constants
export const DEFAULT_BUDGET_ALLOCATION: BudgetAllocation = {
  coaching: 25,
  medical: 25,
  youthAcademy: 25,
  scouting: 25,
};

export const MIN_ALLOCATION: BudgetAllocation = {
  coaching: 0,
  medical: 0,
  youthAcademy: 0,
  scouting: 0,
};

export const MAX_ALLOCATION_PER_CATEGORY = 100;
export const MAX_TOTAL_ALLOCATION = 100;

// Youth Academy capacity constants
export const YOUTH_ACADEMY_BASE_COST = 100000;      // $100k minimum
export const YOUTH_ACADEMY_BASE_CAPACITY = 5;       // 5 slots at minimum
export const YOUTH_ACADEMY_COST_PER_TIER = 50000;  // $50k per tier
export const YOUTH_ACADEMY_SLOTS_PER_TIER = 3;     // 3 slots per tier

// Scouting constants
export const SCOUTING_COST_PER_SCOUT = 50000;      // $50k per simultaneous scout

/**
 * Validates a budget allocation
 * @param allocation - The budget allocation to validate
 * @returns Validation result with error messages if invalid
 */
export function validateBudgetAllocation(allocation: BudgetAllocation): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check each category is within 0-100%
  if (allocation.coaching < 0 || allocation.coaching > MAX_ALLOCATION_PER_CATEGORY) {
    errors.push(`Coaching allocation must be between 0% and ${MAX_ALLOCATION_PER_CATEGORY}%`);
  }
  if (allocation.medical < 0 || allocation.medical > MAX_ALLOCATION_PER_CATEGORY) {
    errors.push(`Medical allocation must be between 0% and ${MAX_ALLOCATION_PER_CATEGORY}%`);
  }
  if (allocation.youthAcademy < 0 || allocation.youthAcademy > MAX_ALLOCATION_PER_CATEGORY) {
    errors.push(`Youth Academy allocation must be between 0% and ${MAX_ALLOCATION_PER_CATEGORY}%`);
  }
  if (allocation.scouting < 0 || allocation.scouting > MAX_ALLOCATION_PER_CATEGORY) {
    errors.push(`Scouting allocation must be between 0% and ${MAX_ALLOCATION_PER_CATEGORY}%`);
  }

  // Check total doesn't exceed 100%
  const total = allocation.coaching + allocation.medical + allocation.youthAcademy + allocation.scouting;
  if (total > MAX_TOTAL_ALLOCATION) {
    errors.push(`Total allocation (${total.toFixed(1)}%) exceeds maximum of ${MAX_TOTAL_ALLOCATION}%`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Converts percentage allocations to dollar amounts
 * @param allocation - The percentage-based allocation
 * @param totalBudget - Total available budget in dollars
 * @returns Dollar amounts for each category
 */
export function calculateBudgetDollars(
  allocation: BudgetAllocation,
  totalBudget: number
): BudgetAllocationDollars {
  return {
    coaching: (allocation.coaching / 100) * totalBudget,
    medical: (allocation.medical / 100) * totalBudget,
    youthAcademy: (allocation.youthAcademy / 100) * totalBudget,
    scouting: (allocation.scouting / 100) * totalBudget,
    total: ((allocation.coaching + allocation.medical + allocation.youthAcademy + allocation.scouting) / 100) * totalBudget,
  };
}

/**
 * Calculates budget impact multipliers for all systems
 *
 * Impact scales:
 * - 0%: 0.5x multiplier (poor quality)
 * - 25%: 1.0x multiplier (standard quality)
 * - 50%: 1.5x multiplier (good quality)
 * - 75%: 1.75x multiplier (great quality)
 * - 100%: 2.0x multiplier (elite quality)
 *
 * @param allocation - The budget allocation percentages
 * @param totalBudget - Total available budget in dollars
 * @returns Impact multipliers for each system
 */
export function calculateBudgetImpact(
  allocation: BudgetAllocation,
  totalBudget: number
): BudgetImpact {
  const dollars = calculateBudgetDollars(allocation, totalBudget);

  // Coaching impact: affects training quality
  const coachingMultiplier = 0.5 + (allocation.coaching / 100) * 1.5;
  const attributeImprovementBonus = (allocation.coaching / 100) * 100;

  // Medical impact: affects injury prevention and recovery
  const injuryPreventionMultiplier = 2.0 - (allocation.medical / 100) * 1.5; // Lower = better
  const recoverySpeedMultiplier = 1.0 + (allocation.medical / 100) * 1.0;

  // Youth Academy impact: affects prospect quality, quantity, and capacity
  const youthAcademyMultiplier = 0.5 + (allocation.youthAcademy / 100) * 1.5;

  // Capacity calculation: $100k base = 5 slots, each +$50k adds 3 slots
  const baseCapacity = YOUTH_ACADEMY_BASE_CAPACITY;
  const additionalCapacity = Math.floor((dollars.youthAcademy - YOUTH_ACADEMY_BASE_COST) / YOUTH_ACADEMY_COST_PER_TIER) * YOUTH_ACADEMY_SLOTS_PER_TIER;
  const capacitySlots = Math.max(baseCapacity, baseCapacity + additionalCapacity);

  // Scouting impact: affects number of simultaneous scouts and accuracy
  const scoutingMultiplier = 0.5 + (allocation.scouting / 100) * 1.5;

  // Simultaneous scouts: 1 scout per $50k (minimum 1)
  const simultaneousScouts = Math.max(1, Math.floor(dollars.scouting / SCOUTING_COST_PER_SCOUT));

  return {
    coaching: {
      trainingQualityMultiplier: coachingMultiplier,
      attributeImprovementBonus: attributeImprovementBonus,
    },
    medical: {
      injuryPreventionMultiplier: injuryPreventionMultiplier,
      recoverySpeedMultiplier: recoverySpeedMultiplier,
    },
    youthAcademy: {
      prospectQualityMultiplier: youthAcademyMultiplier,
      prospectQuantityMultiplier: youthAcademyMultiplier,
      capacitySlots: capacitySlots,
    },
    scouting: {
      simultaneousScouts: simultaneousScouts,
      reportAccuracyMultiplier: scoutingMultiplier,
    },
  };
}

/**
 * Gets the remaining budget percentage available for allocation
 * @param allocation - Current budget allocation
 * @returns Remaining percentage available (0-100)
 */
export function getRemainingBudget(allocation: BudgetAllocation): number {
  const total = allocation.coaching + allocation.medical + allocation.youthAcademy + allocation.scouting;
  return Math.max(0, MAX_TOTAL_ALLOCATION - total);
}

/**
 * Creates radar chart data for UI visualization
 * @param allocation - Budget allocation to visualize
 * @returns Radar chart data points
 */
export function createRadarChartData(allocation: BudgetAllocation): RadarChartDataPoint[] {
  return [
    { category: 'Coaching', value: allocation.coaching, maxValue: MAX_ALLOCATION_PER_CATEGORY },
    { category: 'Medical', value: allocation.medical, maxValue: MAX_ALLOCATION_PER_CATEGORY },
    { category: 'Youth Academy', value: allocation.youthAcademy, maxValue: MAX_ALLOCATION_PER_CATEGORY },
    { category: 'Scouting', value: allocation.scouting, maxValue: MAX_ALLOCATION_PER_CATEGORY },
  ];
}

// ============================================================================
// OPERATIONS BUDGET UTILITIES (for UI budget screen)
// ============================================================================

/**
 * Operations budget allocation (used by UI Budget Screen)
 */
export interface OperationsBudgetAllocation {
  training: number;
  scouting: number;
  facilities: number;
  youthDevelopment: number;
}

/**
 * Category impact showing before/after values
 */
export interface CategoryImpact {
  current: number;
  after: number;
  change: number;
}

/**
 * Complete signing impact breakdown
 */
export interface SigningImpact {
  currentPool: number;
  newPool: number;
  poolChange: number;
  categoryImpacts: {
    training: CategoryImpact;
    scouting: CategoryImpact;
    facilities: CategoryImpact;
    youthDevelopment: CategoryImpact;
  };
}

/**
 * Calculates the operations pool (total budget minus salaries)
 * @param totalBudget - Total season budget
 * @param salaryCommitment - Total player salary commitment
 * @returns Operations pool amount (minimum 0)
 */
export function calculateOperationsPool(totalBudget: number, salaryCommitment: number): number {
  return Math.max(0, totalBudget - salaryCommitment);
}

/**
 * Calculates dollar amount for a budget category
 * @param operationsPool - Total operations pool in dollars
 * @param categoryPercentage - Category percentage (0-100)
 * @returns Dollar amount for the category
 */
export function calculateCategoryDollarAmount(
  operationsPool: number,
  categoryPercentage: number
): number {
  return (categoryPercentage / 100) * operationsPool;
}

/**
 * Calculates the impact of signing a player on all budget categories
 * @param totalBudget - Total season budget
 * @param currentSalaryCommitment - Current total salary commitment
 * @param newSalary - New player's annual salary
 * @param operationsBudget - Current operations budget allocation (percentages)
 * @returns Complete breakdown of signing impact
 */
export function calculateSigningImpact(
  totalBudget: number,
  currentSalaryCommitment: number,
  newSalary: number,
  operationsBudget: OperationsBudgetAllocation
): SigningImpact {
  const currentPool = calculateOperationsPool(totalBudget, currentSalaryCommitment);
  const newPool = calculateOperationsPool(totalBudget, currentSalaryCommitment + newSalary);
  const poolChange = newPool - currentPool;

  const createCategoryImpact = (percentage: number): CategoryImpact => {
    const current = calculateCategoryDollarAmount(currentPool, percentage);
    const after = calculateCategoryDollarAmount(newPool, percentage);
    return {
      current,
      after,
      change: after - current,
    };
  };

  return {
    currentPool,
    newPool,
    poolChange,
    categoryImpacts: {
      training: createCategoryImpact(operationsBudget.training),
      scouting: createCategoryImpact(operationsBudget.scouting),
      facilities: createCategoryImpact(operationsBudget.facilities),
      youthDevelopment: createCategoryImpact(operationsBudget.youthDevelopment),
    },
  };
}

/**
 * Formats a dollar amount for display
 * @param amount - Dollar amount
 * @returns Formatted string (e.g., "$1.5M" or "$500K")
 */
export function formatBudgetAmount(amount: number): string {
  if (Math.abs(amount) >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}
