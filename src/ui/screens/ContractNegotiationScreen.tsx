/**
 * Contract Negotiation Screen (FM-Style)
 *
 * Football Manager-inspired contract negotiation interface:
 * - View player demands and expectations
 * - Customize contract offer (wage, length, bonuses, clauses)
 * - Multi-round negotiation with counter-offers
 * - Squad role selection
 * - Visual feedback on player satisfaction
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';
import type {
  ContractNegotiation,
  ContractOffer,
  SquadRole,
  ContractClauseType,
  Player,
} from '../../data/types';
import {
  formatSalary,
  getSquadRoleDisplayName,
  getClauseDescription,
  calculateSigningCost,
  calculateTotalContractValue,
} from '../../systems/contractSystem';
import {
  calculateSigningImpact,
  OperationsBudgetAllocation,
} from '../../systems/budgetAllocation';
import { SigningImpactPreview } from '../components/budget';

// =============================================================================
// TYPES
// =============================================================================

interface BudgetInfo {
  totalBudget: number;
  salaryCommitment: number;
  operationsBudget: OperationsBudgetAllocation;
}

interface ContractNegotiationScreenProps {
  negotiation: ContractNegotiation;
  player: Player;
  userBudget: number;
  budgetInfo?: BudgetInfo;
  onSubmitOffer: (offer: ContractOffer) => void;
  onAcceptCounter: () => void;
  onCancel: () => void;
  onCompleteSigning: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SQUAD_ROLES: SquadRole[] = [
  'star_player',
  'important_player',
  'rotation_player',
  'squad_player',
  'youth_prospect',
  'backup',
];

const AVAILABLE_CLAUSES: ContractClauseType[] = [
  'optional_extension',
  'player_extension_option',
  'highest_paid',
  'relegation_termination',
];

// =============================================================================
// COMPONENT
// =============================================================================

export function ContractNegotiationScreen({
  negotiation,
  player,
  userBudget,
  budgetInfo,
  onSubmitOffer,
  onAcceptCounter,
  onCancel,
  onCompleteSigning,
}: ContractNegotiationScreenProps) {
  const colors = useColors();

  // Editable offer state
  const [salary, setSalary] = useState(negotiation.currentOffer.salary);
  const [contractLength, setContractLength] = useState(negotiation.currentOffer.contractLength);
  const [signingBonus, setSigningBonus] = useState(negotiation.currentOffer.signingBonus);
  const [agentFee, setAgentFee] = useState(negotiation.currentOffer.agentFee);
  const [squadRole, setSquadRole] = useState(negotiation.currentOffer.squadRole);
  const [hasReleaseClause, setHasReleaseClause] = useState((negotiation.currentOffer.releaseClause || 0) > 0);
  const [releaseClause, setReleaseClause] = useState(negotiation.currentOffer.releaseClause || 0);
  const [yearlyWageRise, setYearlyWageRise] = useState(negotiation.currentOffer.yearlyWageRise);
  const [loyaltyBonus, setLoyaltyBonus] = useState(negotiation.currentOffer.loyaltyBonus);
  const [selectedClauses, setSelectedClauses] = useState<ContractClauseType[]>(
    negotiation.currentOffer.clauses.map(c => c.type)
  );

  // Calculate costs
  const currentOffer: ContractOffer = useMemo(() => ({
    salary,
    contractLength,
    signingBonus,
    agentFee,
    squadRole,
    releaseClause: hasReleaseClause && releaseClause > 0 ? releaseClause : null,
    yearlyWageRise,
    loyaltyBonus,
    performanceBonuses: {},
    clauses: selectedClauses.map(type => ({
      type,
      value: getDefaultClauseValue(type),
      description: getClauseDescription(type, getDefaultClauseValue(type)),
    })),
  }), [salary, contractLength, signingBonus, agentFee, squadRole, hasReleaseClause, releaseClause, yearlyWageRise, loyaltyBonus, selectedClauses]);

  const upfrontCost = calculateSigningCost(currentOffer);
  const totalValue = calculateTotalContractValue(currentOffer);
  const canAfford = upfrontCost <= userBudget;

  // Calculate signing impact on budget
  const signingImpact = useMemo(() => {
    if (!budgetInfo) return null;
    return calculateSigningImpact(
      budgetInfo.totalBudget,
      budgetInfo.salaryCommitment,
      salary,
      budgetInfo.operationsBudget
    );
  }, [budgetInfo, salary]);

  const demands = negotiation.playerDemands;
  const hasCounter = !!negotiation.counterOffer;
  const isAccepted = negotiation.status === 'accepted';
  const isRejected = negotiation.status === 'rejected';

  // Get satisfaction indicator color
  const getSatisfactionColor = (value: number, min: number, ideal: number) => {
    if (value >= ideal) return colors.success;
    if (value >= min) return colors.warning;
    return colors.error;
  };

  const handleSubmitOffer = () => {
    if (canAfford) {
      onSubmitOffer(currentOffer);
    }
  };

  const toggleClause = (clause: ContractClauseType) => {
    if (selectedClauses.includes(clause)) {
      setSelectedClauses(selectedClauses.filter(c => c !== clause));
    } else {
      setSelectedClauses([...selectedClauses, clause]);
    }
  };

  // Update from counter offer
  const applyCounterOffer = () => {
    if (negotiation.counterOffer) {
      setSalary(negotiation.counterOffer.salary);
      setContractLength(negotiation.counterOffer.contractLength);
      setSigningBonus(negotiation.counterOffer.signingBonus);
      setAgentFee(negotiation.counterOffer.agentFee);
      setSquadRole(negotiation.counterOffer.squadRole);
      setHasReleaseClause((negotiation.counterOffer.releaseClause || 0) > 0);
      setReleaseClause(negotiation.counterOffer.releaseClause || 0);
      setYearlyWageRise(negotiation.counterOffer.yearlyWageRise);
      setLoyaltyBonus(negotiation.counterOffer.loyaltyBonus);
      setSelectedClauses(negotiation.counterOffer.clauses.map(c => c.type));
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.playerName, { color: colors.text }]}>{player.name}</Text>
        <Text style={[styles.playerInfo, { color: colors.textMuted }]}>
          Age {player.age} • Round {negotiation.currentRound}/{negotiation.maxRounds}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: isAccepted ? colors.success : isRejected ? colors.error : colors.primary }]}>
          <Text style={styles.statusText}>
            {isAccepted ? 'ACCEPTED' : isRejected ? 'REJECTED' : 'NEGOTIATING'}
          </Text>
        </View>
      </View>

      {/* Player Demands */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Player Expectations</Text>
        <View style={styles.demandRow}>
          <Text style={[styles.demandLabel, { color: colors.textMuted }]}>Salary Range</Text>
          <Text style={[styles.demandValue, { color: colors.text }]}>
            {formatSalary(demands.minSalary)} - {formatSalary(demands.idealSalary)}
          </Text>
        </View>
        <View style={styles.demandRow}>
          <Text style={[styles.demandLabel, { color: colors.textMuted }]}>Contract Length</Text>
          <Text style={[styles.demandValue, { color: colors.text }]}>
            {demands.minContractLength}-{demands.maxContractLength} years
          </Text>
        </View>
        <View style={styles.demandRow}>
          <Text style={[styles.demandLabel, { color: colors.textMuted }]}>Desired Role</Text>
          <Text style={[styles.demandValue, { color: colors.text }]}>
            {getSquadRoleDisplayName(demands.desiredRole)}
          </Text>
        </View>
        <View style={styles.demandRow}>
          <Text style={[styles.demandLabel, { color: colors.textMuted }]}>Flexibility</Text>
          <Text style={[styles.demandValue, { color: colors.text }]}>
            {demands.flexibility >= 30 ? 'High' : demands.flexibility >= 15 ? 'Medium' : 'Low'}
          </Text>
        </View>
      </View>

      {/* Counter Offer */}
      {hasCounter && !isAccepted && !isRejected && (
        <View style={[styles.section, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
          <Text style={[styles.sectionTitle, { color: colors.warning }]}>Player Counter-Offer</Text>
          <View style={styles.demandRow}>
            <Text style={[styles.demandLabel, { color: colors.textMuted }]}>Salary</Text>
            <Text style={[styles.demandValue, { color: colors.warning }]}>
              {formatSalary(negotiation.counterOffer!.salary)}
            </Text>
          </View>
          <View style={styles.demandRow}>
            <Text style={[styles.demandLabel, { color: colors.textMuted }]}>Length</Text>
            <Text style={[styles.demandValue, { color: colors.text }]}>
              {negotiation.counterOffer!.contractLength} years
            </Text>
          </View>
          <View style={styles.demandRow}>
            <Text style={[styles.demandLabel, { color: colors.textMuted }]}>Signing Bonus</Text>
            <Text style={[styles.demandValue, { color: colors.text }]}>
              {formatSalary(negotiation.counterOffer!.signingBonus)}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.acceptCounterButton, { backgroundColor: colors.warning }]}
            onPress={applyCounterOffer}
          >
            <Text style={styles.buttonText}>Apply Counter Terms</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Latest Response */}
      {negotiation.history.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Latest Response</Text>
          <Text style={[styles.responseMessage, { color: colors.text }]}>
            {negotiation.history[negotiation.history.length - 1]?.responseMessage || 'Awaiting response...'}
          </Text>
        </View>
      )}

      {/* Your Offer */}
      {!isAccepted && !isRejected && (
        <>
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Offer</Text>

            {/* Salary */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                Annual Salary
                <Text style={{ color: getSatisfactionColor(salary, demands.minSalary, demands.idealSalary) }}>
                  {salary >= demands.idealSalary ? ' ✓' : salary >= demands.minSalary ? ' ~' : ' ✗'}
                </Text>
              </Text>
              <View style={[styles.textInputWrapper, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.currencyPrefix, { color: colors.textMuted }]}>$</Text>
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  value={salary > 0 ? salary.toString() : ''}
                  onChangeText={(text) => {
                    const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
                    setSalary(isNaN(num) ? 10000 : Math.max(10000, num));
                  }}
                  keyboardType="numeric"
                  placeholder="10000"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={[styles.salaryHint, { color: colors.textMuted }]}>/year</Text>
              </View>
            </View>

            {/* Contract Length */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Contract Length</Text>
              <View style={styles.optionRow}>
                {[1, 2, 3, 4, 5].map((years) => (
                  <TouchableOpacity
                    key={years}
                    style={[
                      styles.optionButton,
                      { backgroundColor: contractLength === years ? colors.primary : colors.surface },
                    ]}
                    onPress={() => setContractLength(years)}
                  >
                    <Text style={[styles.optionText, { color: contractLength === years ? '#FFF' : colors.text }]}>
                      {years}y
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Squad Role */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Promised Role</Text>
              <View style={styles.roleGrid}>
                {SQUAD_ROLES.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleButton,
                      {
                        backgroundColor: squadRole === role ? colors.primary : colors.surface,
                        borderColor: role === demands.desiredRole ? colors.warning : 'transparent',
                        borderWidth: role === demands.desiredRole ? 2 : 0,
                      },
                    ]}
                    onPress={() => setSquadRole(role)}
                  >
                    <Text
                      style={[styles.roleText, { color: squadRole === role ? '#FFF' : colors.text }]}
                      numberOfLines={1}
                    >
                      {getSquadRoleDisplayName(role)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Signing Bonus */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Signing Bonus</Text>
              <View style={[styles.textInputWrapper, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.currencyPrefix, { color: colors.textMuted }]}>$</Text>
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  value={signingBonus > 0 ? signingBonus.toString() : ''}
                  onChangeText={(text) => {
                    const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
                    setSigningBonus(isNaN(num) ? 0 : num);
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Agent Fee */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Agent Fee</Text>
              <View style={[styles.textInputWrapper, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.currencyPrefix, { color: colors.textMuted }]}>$</Text>
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  value={agentFee > 0 ? agentFee.toString() : ''}
                  onChangeText={(text) => {
                    const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
                    setAgentFee(isNaN(num) ? 0 : num);
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Release Clause (Optional) */}
            <View style={styles.inputGroup}>
              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    {
                      borderColor: colors.primary,
                      backgroundColor: hasReleaseClause ? colors.primary : 'transparent',
                    },
                  ]}
                  onPress={() => setHasReleaseClause(!hasReleaseClause)}
                >
                  {hasReleaseClause && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
                <Text style={[styles.inputLabel, { color: colors.textMuted, marginBottom: 0 }]}>
                  Include Release Clause
                </Text>
              </View>
              {hasReleaseClause && (
                <View style={[styles.textInputWrapper, { borderColor: colors.border, backgroundColor: colors.surface, marginTop: spacing.sm }]}>
                  <Text style={[styles.currencyPrefix, { color: colors.textMuted }]}>$</Text>
                  <TextInput
                    style={[styles.textInput, { color: colors.text }]}
                    value={releaseClause > 0 ? releaseClause.toString() : ''}
                    onChangeText={(text) => {
                      const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
                      setReleaseClause(isNaN(num) ? 0 : num);
                    }}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              )}
            </View>

            {/* Yearly Wage Rise */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Yearly Wage Rise</Text>
              <View style={styles.optionRow}>
                {[0, 3, 5, 7, 10].map((pct) => (
                  <TouchableOpacity
                    key={pct}
                    style={[
                      styles.optionButton,
                      { backgroundColor: yearlyWageRise === pct ? colors.primary : colors.surface },
                    ]}
                    onPress={() => setYearlyWageRise(pct)}
                  >
                    <Text style={[styles.optionText, { color: yearlyWageRise === pct ? '#FFF' : colors.text }]}>
                      {pct}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Contract Clauses */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Contract Clauses</Text>
            {AVAILABLE_CLAUSES.map((clause) => {
              const isRequired = demands.requiredClauses.includes(clause);
              const isSelected = selectedClauses.includes(clause);
              return (
                <TouchableOpacity
                  key={clause}
                  style={[
                    styles.clauseRow,
                    {
                      backgroundColor: isSelected ? colors.primary + '20' : colors.surface,
                      borderColor: isRequired ? colors.warning : 'transparent',
                      borderWidth: isRequired ? 1 : 0,
                    },
                  ]}
                  onPress={() => toggleClause(clause)}
                >
                  <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: isSelected ? colors.primary : 'transparent' }]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.clauseInfo}>
                    <Text style={[styles.clauseName, { color: colors.text }]}>
                      {getClauseDescription(clause, getDefaultClauseValue(clause))}
                    </Text>
                    {isRequired && (
                      <Text style={[styles.clauseRequired, { color: colors.warning }]}>Required by player</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* Cost Summary */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Cost Summary</Text>
        <View style={styles.costRow}>
          <Text style={[styles.costLabel, { color: colors.textMuted }]}>First Year Salary</Text>
          <Text style={[styles.costValue, { color: colors.text }]}>{formatSalary(salary)}</Text>
        </View>
        <View style={styles.costRow}>
          <Text style={[styles.costLabel, { color: colors.textMuted }]}>Signing Bonus</Text>
          <Text style={[styles.costValue, { color: colors.text }]}>{formatSalary(signingBonus)}</Text>
        </View>
        <View style={styles.costRow}>
          <Text style={[styles.costLabel, { color: colors.textMuted }]}>Agent Fee</Text>
          <Text style={[styles.costValue, { color: colors.text }]}>{formatSalary(agentFee)}</Text>
        </View>
        <View style={[styles.costRow, styles.totalRow]}>
          <Text style={[styles.costLabel, { color: colors.text, fontWeight: '700' }]}>Upfront Cost</Text>
          <Text style={[styles.costValue, { color: canAfford ? colors.success : colors.error, fontWeight: '700' }]}>
            {formatSalary(upfrontCost)}
          </Text>
        </View>
        <View style={styles.costRow}>
          <Text style={[styles.costLabel, { color: colors.textMuted }]}>Total Contract Value</Text>
          <Text style={[styles.costValue, { color: colors.text }]}>{formatSalary(totalValue)}</Text>
        </View>
        <View style={styles.costRow}>
          <Text style={[styles.costLabel, { color: colors.textMuted }]}>Your Budget</Text>
          <Text style={[styles.costValue, { color: colors.success }]}>{formatSalary(userBudget)}</Text>
        </View>
      </View>

      {/* Budget Impact Preview */}
      {signingImpact && (
        <View style={styles.section}>
          <SigningImpactPreview
            impact={signingImpact}
            playerName={player.name}
            salary={salary}
          />
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        {isAccepted ? (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.success }]}
            onPress={onCompleteSigning}
          >
            <Text style={styles.buttonText}>Complete Signing</Text>
          </TouchableOpacity>
        ) : isRejected ? (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.error }]}
            onPress={onCancel}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        ) : (
          <>
            {hasCounter && (
              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: colors.success }]}
                onPress={onAcceptCounter}
              >
                <Text style={styles.buttonText}>Accept Counter</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: canAfford ? colors.primary : colors.surface },
              ]}
              onPress={handleSubmitOffer}
              disabled={!canAfford}
            >
              <Text style={[styles.buttonText, { color: canAfford ? '#FFF' : colors.textMuted }]}>
                {hasCounter ? 'Counter Offer' : 'Submit Offer'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.error }]}
              onPress={onCancel}
            >
              <Text style={[styles.cancelText, { color: colors.error }]}>Walk Away</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function getDefaultClauseValue(type: ContractClauseType): number {
  switch (type) {
    case 'optional_extension':
      return 1;
    case 'player_extension_option':
      return 1;
    default:
      return 0;
  }
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  playerName: {
    fontSize: 24,
    fontWeight: '700',
  },
  playerInfo: {
    fontSize: 14,
    marginTop: spacing.xs,
  },
  statusBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  demandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  demandLabel: {
    fontSize: 14,
  },
  demandValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  responseMessage: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adjustButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  adjustText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  textInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: spacing.sm,
  },
  salaryHint: {
    fontSize: 14,
    marginLeft: spacing.xs,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  roleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clauseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkmark: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  clauseInfo: {
    flex: 1,
  },
  clauseName: {
    fontSize: 14,
  },
  clauseRequired: {
    fontSize: 10,
    marginTop: 2,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  costLabel: {
    fontSize: 14,
  },
  costValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  primaryButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  secondaryButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  acceptCounterButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ContractNegotiationScreen;
