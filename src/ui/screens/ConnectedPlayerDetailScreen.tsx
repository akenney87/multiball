/**
 * Connected Player Detail Screen
 *
 * Player detail screen connected to GameContext for real player data.
 * Shows all 26 attributes, contract info, and actions.
 * Features tabbed interface: Profile | Stats | Skills | Training
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';
import { ConfirmationModal, SegmentControl } from '../components/common';
import { CareerStatsCard, SkillsBreakdownCard, TrainingSuggestionsCard } from '../components/player';
import { TrainingFocusCard } from '../components/training';
import { useGame } from '../context/GameContext';
import { DEFAULT_TRAINING_FOCUS } from '../../systems/trainingSystem';
import { calculateAllOveralls } from '../../utils/overallRating';
import { getVisibleAttributesForUnscouted } from '../utils/scoutingUtils';
import type { ScoutReport } from '../../systems/scoutingSystem';

// Tab types
type PlayerDetailTab = 'profile' | 'stats' | 'skills' | 'training';

interface ConnectedPlayerDetailScreenProps {
  playerId: string;
  onRelease?: () => void;
  onBack?: () => void;
  onNavigateToNegotiation?: () => void;
}

// Attribute categories for display
const attributeCategories = {
  physical: [
    'grip_strength', 'arm_strength', 'core_strength', 'agility',
    'acceleration', 'top_speed', 'jumping', 'reactions',
    'stamina', 'balance', 'height', 'durability',
  ],
  mental: [
    'awareness', 'creativity', 'determination', 'bravery',
    'consistency', 'composure', 'patience', 'teamwork',
  ],
  technical: [
    'hand_eye_coordination', 'throw_accuracy', 'form_technique',
    'finesse', 'deception', 'footwork',
  ],
};

export function ConnectedPlayerDetailScreen({
  playerId,
  onRelease,
  onBack,
  onNavigateToNegotiation,
}: ConnectedPlayerDetailScreenProps) {
  const colors = useColors();
  const { state, getPlayer, releasePlayer, makeTransferOffer, addScoutingTarget, removeScoutingTarget, startNegotiation, setTrainingFocus, addToShortlist, removeFromShortlist, addToTransferList, removeFromTransferList } = useGame();

  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const [showTransferOfferModal, setShowTransferOfferModal] = useState(false);
  const [showTransferListModal, setShowTransferListModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [askingPriceInput, setAskingPriceInput] = useState('');
  const [selectedTab, setSelectedTab] = useState<PlayerDetailTab>('profile');

  // Get player data
  const player = useMemo(() => getPlayer(playerId), [getPlayer, playerId]);

  // Calculate all overalls (composite + sport-specific)
  const overalls = useMemo(
    () => (player ? calculateAllOveralls(player) : { overall: 0, basketball: 0, baseball: 0, soccer: 0 }),
    [player]
  );

  // Check if player is scouted (user team players are always scouted)
  const isScouted = useMemo(() => {
    if (state.userTeam.rosterIds.includes(playerId)) return true;
    return (state.scoutedPlayerIds || []).includes(playerId);
  }, [playerId, state.userTeam.rosterIds, state.scoutedPlayerIds]);

  // Get scout report for this player (if any)
  const scoutReport = useMemo((): ScoutReport | null => {
    const reports = state.scoutingReports || [];
    return reports.find((r) => r.playerId === playerId) || null;
  }, [playerId, state.scoutingReports]);

  // Get scouting depth from report (100 = fully scouted, 0 = not scouted)
  const scoutingDepth = useMemo(() => {
    if (state.userTeam.rosterIds.includes(playerId)) return 100; // Own team always 100%
    if (scoutReport) return scoutReport.scoutingDepth ?? 50;
    return 0; // No scout report
  }, [playerId, state.userTeam.rosterIds, scoutReport]);

  // Get visible attributes for unscouted players
  const visibleAttributes = useMemo(
    () => (isScouted ? [] : getVisibleAttributesForUnscouted(playerId)),
    [playerId, isScouted]
  );

  // Check if player is on user's team
  const isOnUserTeam = useMemo(
    () => state.userTeam.rosterIds.includes(playerId),
    [playerId, state.userTeam.rosterIds]
  );

  // Check if player is a free agent
  const isFreeAgent = useMemo(
    () => player?.teamId === 'free_agent',
    [player?.teamId]
  );

  // Check if there's already a pending offer for this player
  const existingOffer = useMemo(() => {
    return state.market.outgoingOffers.find(
      (offer) => offer.playerId === playerId && offer.status === 'pending'
    );
  }, [playerId, state.market.outgoingOffers]);

  // Check if player is a scouting target
  const isScoutingTarget = useMemo(
    () => (state.scoutingTargetIds || []).includes(playerId),
    [playerId, state.scoutingTargetIds]
  );

  // Check if player is on the shortlist
  const isShortlisted = useMemo(
    () => (state.userTeam.shortlistedPlayerIds || []).includes(playerId),
    [playerId, state.userTeam.shortlistedPlayerIds]
  );

  // Check if player is on the transfer list
  const isOnTransferList = useMemo(
    () => (state.userTeam.transferListPlayerIds || []).includes(playerId),
    [playerId, state.userTeam.transferListPlayerIds]
  );

  // Check if there's an ongoing negotiation for this player
  const existingNegotiation = useMemo(
    () => state.market.activeNegotiation?.playerId === playerId ? state.market.activeNegotiation : null,
    [playerId, state.market.activeNegotiation]
  );

  // Calculate performance multiplier based on awards and stats
  // This allows proven players to exceed the salary cap on transfer value
  const performanceMultiplier = useMemo(() => {
    if (!player) return 1.0;

    let multiplier = 1.0;

    // Awards add significant value - these are proven accomplishments
    const awards = player.awards;
    if (awards) {
      multiplier += awards.playerOfTheWeek * 0.05;              // +5% per weekly award
      multiplier += awards.playerOfTheMonth * 0.15;             // +15% per monthly award
      multiplier += awards.basketballPlayerOfTheYear * 0.50;    // +50% per Basketball POY
      multiplier += awards.baseballPlayerOfTheYear * 0.50;      // +50% per Baseball POY
      multiplier += awards.soccerPlayerOfTheYear * 0.50;        // +50% per Soccer POY
      multiplier += awards.rookieOfTheYear * 0.30;              // +30% for ROY
      multiplier += awards.championships * 0.35;                // +35% per championship
    }

    // Games played adds confidence in value (player is proven, not just potential)
    const gamesPlayed = player.careerStats?.gamesPlayed || { basketball: 0, baseball: 0, soccer: 0 };
    const totalGames = gamesPlayed.basketball + gamesPlayed.baseball + gamesPlayed.soccer;
    if (totalGames >= 100) {
      multiplier += 0.30; // Veteran bonus
    } else if (totalGames >= 50) {
      multiplier += 0.15; // Experienced bonus
    } else if (totalGames >= 20) {
      multiplier += 0.05; // Some experience
    }

    // Cap the multiplier at 3x to prevent runaway values
    return Math.min(3.0, multiplier);
  }, [player]);

  // Estimate player transfer value based on overall, age, salary, and performance
  // Philosophy: Transfer value should reflect acquisition cost, not arbitrary inflation
  // A free agent costing $40k in fees shouldn't have a $900k transfer value
  // BUT proven performers (awards, games played) can exceed this cap
  const estimatedTransferValue = useMemo(() => {
    if (!player) return 0;
    const rating = overalls.overall;
    const age = player.age;
    const salary = player.contract?.salary || 0;

    // Base value tiers - grounded in realistic acquisition costs
    // These represent what you'd pay to acquire a similar unproven player
    let baseValue: number;
    if (rating < 45) {
      baseValue = 10000; // Barely roster-worthy
    } else if (rating < 50) {
      baseValue = 10000 + (rating - 45) * 3000; // $10k - $25k
    } else if (rating < 55) {
      baseValue = 25000 + (rating - 50) * 5000; // $25k - $50k (end of bench)
    } else if (rating < 60) {
      baseValue = 50000 + (rating - 55) * 10000; // $50k - $100k (rotation)
    } else if (rating < 65) {
      baseValue = 100000 + (rating - 60) * 20000; // $100k - $200k (contributor)
    } else if (rating < 70) {
      baseValue = 200000 + (rating - 65) * 40000; // $200k - $400k (starter)
    } else if (rating < 75) {
      baseValue = 400000 + (rating - 70) * 80000; // $400k - $800k (very good)
    } else if (rating < 80) {
      baseValue = 800000 + (rating - 75) * 140000; // $800k - $1.5M (star)
    } else if (rating < 85) {
      baseValue = 1500000 + (rating - 80) * 300000; // $1.5M - $3M (superstar)
    } else {
      baseValue = 3000000 + (rating - 85) * 500000; // $3M+ (elite)
    }

    // Age factor - young players have upside, old players are depreciating assets
    let ageFactor: number;
    if (age < 22) {
      ageFactor = 1.25; // Potential premium
    } else if (age < 25) {
      ageFactor = 1.1; // Young
    } else if (age < 28) {
      ageFactor = 1.0; // Prime
    } else if (age < 30) {
      ageFactor = 0.6; // Declining
    } else if (age < 32) {
      ageFactor = 0.3; // Past prime
    } else {
      ageFactor = 0.15; // Near retirement
    }

    // Calculate base transfer value
    let transferValue = baseValue * ageFactor;

    // Cap transfer value relative to salary for unproven players
    // This prevents the free agent flip exploit
    // Philosophy: If you can sign someone for $40k in fees, you shouldn't flip them for $200k
    if (salary > 0) {
      // Multiplier scales with rating - unproven players are worth less
      let maxMultiple: number;
      if (rating >= 80) {
        maxMultiple = 2.0; // Elite proven talent
      } else if (rating >= 75) {
        maxMultiple = 1.5; // Star player
      } else if (rating >= 70) {
        maxMultiple = 1.0; // Very good
      } else if (rating >= 65) {
        maxMultiple = 0.5; // Good starter
      } else {
        maxMultiple = 0.25; // Unproven - transfer value ~= signing cost
      }
      transferValue = Math.min(transferValue, salary * maxMultiple);
    }

    // Apply performance multiplier (awards, games played boost value)
    transferValue *= performanceMultiplier;

    // Round to nearest $10k, minimum $10k
    return Math.max(10000, Math.round(transferValue / 10000) * 10000);
  }, [player, overalls.overall, performanceMultiplier]);

  // Handle extending contract (start renewal negotiation)
  const handleExtendContract = useCallback(() => {
    startNegotiation(playerId, 'renewal');
    // Navigate to negotiation screen
    onNavigateToNegotiation?.();
  }, [playerId, startNegotiation, onNavigateToNegotiation]);

  // Handle signing a free agent (starts proper contract negotiation)
  const handleSignFreeAgent = useCallback(() => {
    // Start a new_signing negotiation for the free agent
    startNegotiation(playerId, 'new_signing');
    // Navigate to negotiation screen
    onNavigateToNegotiation?.();
  }, [playerId, startNegotiation, onNavigateToNegotiation]);

  // Handle making a transfer offer (for players on other teams)
  const handleMakeTransferOffer = useCallback(() => {
    const amount = parseInt(offerAmount.replace(/[^0-9]/g, ''), 10);
    if (amount > 0) {
      makeTransferOffer(playerId, amount);
      setShowTransferOfferModal(false);
      setOfferAmount('');
    }
  }, [playerId, offerAmount, makeTransferOffer]);

  // Handle adding to transfer list with asking price
  const handleAddToTransferList = useCallback(() => {
    const amount = parseInt(askingPriceInput.replace(/[^0-9]/g, ''), 10);
    if (amount > 0) {
      addToTransferList(playerId, amount);
      setShowTransferListModal(false);
      setAskingPriceInput('');
    }
  }, [playerId, askingPriceInput, addToTransferList]);

  // Format currency for display
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    return `$${(amount / 1000).toFixed(0)}K`;
  };

  const formatSalary = (salary: number) => {
    if (salary >= 1000000) {
      return `$${(salary / 1000000).toFixed(1)}M`;
    }
    return `$${(salary / 1000).toFixed(0)}K`;
  };

  const formatHeight = (inches: number) => {
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'${remainingInches}"`;
  };

  const formatAttributeName = (name: string) => {
    return name
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getAttributeColor = (value: number) => {
    if (value >= 85) return colors.success;
    if (value >= 70) return '#22C55E';
    if (value >= 55) return colors.warning;
    return colors.error;
  };

  // Get delta color (green for positive, red for negative)
  const getDeltaColor = (delta: number) => {
    if (delta > 0) return colors.success;
    if (delta < 0) return colors.error;
    return colors.textMuted;
  };

  // Format delta for display
  const formatDelta = (delta: number) => {
    if (delta > 0) return `+${delta}`;
    if (delta < 0) return `${delta}`;
    return '';
  };

  // Calculate contract years remaining
  const yearsRemaining = useMemo(() => {
    if (!player?.contract?.expiryDate) return 0;
    const expiry = new Date(player.contract.expiryDate);
    const now = new Date();
    const years = Math.ceil((expiry.getTime() - now.getTime()) / (365 * 24 * 60 * 60 * 1000));
    return Math.max(0, years);
  }, [player?.contract?.expiryDate]);

  // Count total awards
  const totalAwards = useMemo(() => {
    if (!player?.awards) return 0;
    const a = player.awards;
    return (
      a.playerOfTheWeek +
      a.playerOfTheMonth +
      a.basketballPlayerOfTheYear +
      a.baseballPlayerOfTheYear +
      a.soccerPlayerOfTheYear +
      a.rookieOfTheYear +
      a.championships
    );
  }, [player?.awards]);

  // Check if player has any major awards (POY, ROY, Championships)
  const hasMajorAwards = useMemo(() => {
    if (!player?.awards) return false;
    const a = player.awards;
    return (
      a.basketballPlayerOfTheYear > 0 ||
      a.baseballPlayerOfTheYear > 0 ||
      a.soccerPlayerOfTheYear > 0 ||
      a.rookieOfTheYear > 0 ||
      a.championships > 0
    );
  }, [player?.awards]);

  const handleRelease = useCallback(() => {
    // Store playerId before any state changes
    const playerIdToRelease = playerId;

    // 1. Close confirmation modal first
    setShowReleaseConfirm(false);

    // 2. After confirmation closes, close player detail modal
    setTimeout(() => {
      onRelease?.();

      // 3. After modals are closed, release the player
      setTimeout(() => {
        releasePlayer(playerIdToRelease);
      }, 100);
    }, 50);
  }, [onRelease, playerId, releasePlayer]);

  const renderAttributeCategory = (
    title: string,
    attrs: string[],
    categoryColor: string
  ) => {
    if (!player) return null;

    // Determine visibility for each attribute based on scouting
    const getAttributeVisibility = (attr: string): 'exact' | 'range' | 'hidden' => {
      if (isOnUserTeam || scoutingDepth >= 100) return 'exact';
      if (scoutReport) {
        // Check if this attribute has a range in the scout report
        const range = scoutReport.attributeRanges.find((r) => r.attributeName === attr);
        if (range) return 'range';
      }
      // For partial scouting or no report, check visible attributes
      if (visibleAttributes.includes(attr)) return 'exact';
      return 'hidden';
    };

    // Count visible attributes
    const visibleCount = attrs.filter((a) => getAttributeVisibility(a) !== 'hidden').length;

    return (
      <View style={[styles.categoryCard, { backgroundColor: colors.card }, shadows.sm]}>
        <View style={[styles.categoryHeader, { borderBottomColor: colors.border }]}>
          <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
          <Text style={[styles.categoryTitle, { color: colors.text }]}>{title}</Text>
          {!isOnUserTeam && scoutingDepth < 100 && (
            <Text style={[styles.unscoutedLabel, { color: colors.textMuted }]}>
              {visibleCount > 0
                ? `${visibleCount}/${attrs.length} known`
                : 'Not scouted'}
            </Text>
          )}
        </View>
        <View style={styles.attributesGrid}>
          {attrs.map((attr) => {
            const value = player.attributes[attr as keyof typeof player.attributes] || 50;
            const visibility = getAttributeVisibility(attr);
            const range = scoutReport?.attributeRanges.find((r) => r.attributeName === attr);

            // Calculate delta from season start if available
            const startValue = player.seasonStartAttributes?.[attr as keyof typeof player.seasonStartAttributes];
            const delta = startValue !== undefined ? value - startValue : 0;

            return (
              <View key={attr} style={styles.attributeItem}>
                <Text style={[styles.attributeName, { color: visibility !== 'hidden' ? colors.textSecondary : colors.textMuted }]}>
                  {formatAttributeName(attr)}
                </Text>
                <View style={styles.attributeValueContainer}>
                  {visibility === 'exact' ? (
                    <>
                      <View
                        style={[
                          styles.attributeBar,
                          { backgroundColor: colors.border },
                        ]}
                      >
                        <View
                          style={[
                            styles.attributeBarFill,
                            {
                              width: `${value}%`,
                              backgroundColor: getAttributeColor(value),
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.attributeValueWithDelta}>
                        <Text style={[styles.attributeValue, { color: colors.text }]}>
                          {value}
                        </Text>
                        {delta !== 0 && (
                          <Text style={[styles.attributeDelta, { color: getDeltaColor(delta) }]}>
                            {formatDelta(delta)}
                          </Text>
                        )}
                      </View>
                    </>
                  ) : visibility === 'range' && range ? (
                    <>
                      <View
                        style={[
                          styles.attributeBar,
                          { backgroundColor: colors.border },
                        ]}
                      >
                        {/* Show a range bar from min to max */}
                        <View
                          style={[
                            styles.attributeBarRange,
                            {
                              left: `${range.min}%`,
                              width: `${range.max - range.min}%`,
                              backgroundColor: colors.warning,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.attributeRangeValue, { color: colors.warning }]}>
                        {range.min}-{range.max}
                      </Text>
                    </>
                  ) : (
                    <>
                      <View
                        style={[
                          styles.attributeBar,
                          { backgroundColor: colors.border },
                        ]}
                      >
                        <View
                          style={[
                            styles.attributeBarFill,
                            {
                              width: '100%',
                              backgroundColor: colors.border,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.attributeValue, { color: colors.textMuted }]}>
                        ?
                      </Text>
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // Loading state
  if (!state.initialized) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Player not found
  if (!player) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textMuted }]}>
          Player not found
        </Text>
        <TouchableOpacity
          style={[styles.backButton, { borderColor: colors.border }]}
          onPress={onBack}
        >
          <Text style={[styles.backButtonText, { color: colors.text }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Header Card */}
      <View style={[styles.headerCard, { backgroundColor: colors.card }, shadows.md]}>
        <View style={styles.headerTop}>
          <View style={styles.headerInfo}>
            <Text style={[styles.playerName, { color: colors.text }]}>
              {player.name}
            </Text>
            <Text style={[styles.playerPosition, { color: colors.textSecondary }]}>
              Age {player.age} • {player.nationality}
            </Text>
            <Text style={[styles.playerBio, { color: colors.textSecondary }]}>
              {formatHeight(player.height)} • {player.weight} lbs
            </Text>
            {/* Market Value */}
            <Text style={[styles.marketValue, { color: colors.success }]}>
              Market Value: {formatCurrency(estimatedTransferValue)}
            </Text>
            {/* Show projected height/weight for developing players */}
            {player.youthDevelopment && (
              <Text style={[styles.projectedBio, { color: colors.textMuted }]}>
                Projected: {formatHeight(player.youthDevelopment.projectedAdultHeight)} • {Math.round((player.youthDevelopment.targetAdultBMI * player.youthDevelopment.projectedAdultHeight * player.youthDevelopment.projectedAdultHeight) / 703)} lbs
              </Text>
            )}
            {player.injury && (
              <View style={[styles.injuryBadge, { backgroundColor: colors.error }]}>
                <Text style={styles.injuryText}>
                  INJURED ({player.injury.recoveryWeeks}w)
                </Text>
              </View>
            )}
            {/* Match Fitness Indicator */}
            {isOnUserTeam && !player.injury && (
              <Text
                style={[
                  styles.fitnessText,
                  {
                    color:
                      player.matchFitness >= 75
                        ? colors.success
                        : player.matchFitness >= 50
                        ? colors.warning
                        : colors.error,
                  },
                ]}
              >
                {Math.round(player.matchFitness)}% Match Fitness
              </Text>
            )}
            {/* Awards Summary Badge */}
            {totalAwards > 0 && (
              <View
                style={[
                  styles.awardsSummaryBadge,
                  {
                    backgroundColor: hasMajorAwards ? colors.warning + '20' : colors.primary + '20',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.awardsSummaryText,
                    { color: hasMajorAwards ? colors.warning : colors.primary },
                  ]}
                >
                  {totalAwards} Award{totalAwards !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
            {/* Scouting Status Badge */}
            {!isOnUserTeam && (
              <View
                style={[
                  styles.scoutingStatusBadge,
                  {
                    backgroundColor:
                      scoutingDepth >= 100
                        ? colors.success + '20'
                        : scoutingDepth > 0
                        ? colors.warning + '20'
                        : colors.textMuted + '20',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.scoutingStatusText,
                    {
                      color:
                        scoutingDepth >= 100
                          ? colors.success
                          : scoutingDepth > 0
                          ? colors.warning
                          : colors.textMuted,
                    },
                  ]}
                >
                  {scoutingDepth >= 100
                    ? 'Full Report'
                    : scoutingDepth > 0
                    ? `${scoutingDepth}% Scouted`
                    : 'Not Scouted'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.overallContainer}>
            {/* Show exact overall for own team or fully scouted, range otherwise */}
            {isOnUserTeam || scoutingDepth >= 100 ? (
              <Text style={[styles.overallValue, { color: colors.primary }]}>
                {overalls.overall}
              </Text>
            ) : scoutReport ? (
              <Text style={[styles.overallRangeValue, { color: colors.primary }]}>
                {scoutReport.estimatedOverallMin}-{scoutReport.estimatedOverallMax}
              </Text>
            ) : (
              <Text style={[styles.overallValue, { color: colors.textMuted }]}>?</Text>
            )}
            <Text style={[styles.overallLabel, { color: colors.textMuted }]}>OVR</Text>
            {/* Sport-specific overalls */}
            {(isOnUserTeam || scoutingDepth >= 100) && (
              <View style={styles.sportOverallsRow}>
                <View style={styles.sportOverallItem}>
                  <Text style={[styles.sportOverallValue, { color: colors.text }]}>{overalls.basketball}</Text>
                  <Text style={[styles.sportOverallLabel, { color: colors.textMuted }]}>BBall</Text>
                </View>
                <View style={styles.sportOverallItem}>
                  <Text style={[styles.sportOverallValue, { color: colors.text }]}>{overalls.baseball}</Text>
                  <Text style={[styles.sportOverallLabel, { color: colors.textMuted }]}>Base</Text>
                </View>
                <View style={styles.sportOverallItem}>
                  <Text style={[styles.sportOverallValue, { color: colors.text }]}>{overalls.soccer}</Text>
                  <Text style={[styles.sportOverallLabel, { color: colors.textMuted }]}>Soccer</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Contract Info */}
        {player.contract && (
          <View style={[styles.contractInfo, { borderTopColor: colors.border }]}>
            <View style={styles.contractItem}>
              <Text style={[styles.contractLabel, { color: colors.textMuted }]}>Salary</Text>
              <Text style={[styles.contractValue, { color: colors.text }]}>
                {formatSalary(player.contract.salary)}/yr
              </Text>
            </View>
            <View style={styles.contractItem}>
              <Text style={[styles.contractLabel, { color: colors.textMuted }]}>Contract</Text>
              <Text style={[styles.contractValue, { color: colors.text }]}>
                {yearsRemaining} year{yearsRemaining !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabContainer, { backgroundColor: colors.card }, shadows.sm]}>
        <SegmentControl
          segments={[
            { key: 'profile' as PlayerDetailTab, label: 'Profile' },
            { key: 'stats' as PlayerDetailTab, label: 'Stats' },
            { key: 'skills' as PlayerDetailTab, label: 'Skills' },
            { key: 'training' as PlayerDetailTab, label: 'Training' },
          ]}
          selectedKey={selectedTab}
          onChange={setSelectedTab}
          size="compact"
        />
      </View>

      {/* Tab Content */}
      {selectedTab === 'profile' && (
        <>
          {renderAttributeCategory('Physical', attributeCategories.physical, '#3B82F6')}
          {renderAttributeCategory('Mental', attributeCategories.mental, '#8B5CF6')}
          {renderAttributeCategory('Technical', attributeCategories.technical, '#10B981')}
        </>
      )}

      {selectedTab === 'stats' && (
        <>
          <CareerStatsCard player={player} hidden={!isScouted && !isOnUserTeam} />

          {/* Awards Card */}
          {player.awards && totalAwards > 0 && (
            <View style={[styles.awardsCard, { backgroundColor: colors.card }, shadows.sm]}>
              <View style={[styles.awardsHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.awardsTitle, { color: colors.text }]}>Awards & Achievements</Text>
              </View>
              <View style={styles.awardsGrid}>
                {player.awards.championships > 0 && (
                  <View style={styles.awardItem}>
                    <View style={[styles.awardIconContainer, { backgroundColor: colors.warning + '20' }]}>
                      <Text style={styles.awardIcon}>🏆</Text>
                    </View>
                    <View style={styles.awardInfo}>
                      <Text style={[styles.awardName, { color: colors.text }]}>Championships</Text>
                      <Text style={[styles.awardCount, { color: colors.warning }]}>
                        {player.awards.championships}x
                      </Text>
                    </View>
                  </View>
                )}
                {player.awards.basketballPlayerOfTheYear > 0 && (
                  <View style={styles.awardItem}>
                    <View style={[styles.awardIconContainer, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={styles.awardIcon}>🏀</Text>
                    </View>
                    <View style={styles.awardInfo}>
                      <Text style={[styles.awardName, { color: colors.text }]}>Basketball POY</Text>
                      <Text style={[styles.awardCount, { color: colors.primary }]}>
                        {player.awards.basketballPlayerOfTheYear}x
                      </Text>
                    </View>
                  </View>
                )}
                {player.awards.baseballPlayerOfTheYear > 0 && (
                  <View style={styles.awardItem}>
                    <View style={[styles.awardIconContainer, { backgroundColor: colors.success + '20' }]}>
                      <Text style={styles.awardIcon}>⚾</Text>
                    </View>
                    <View style={styles.awardInfo}>
                      <Text style={[styles.awardName, { color: colors.text }]}>Baseball POY</Text>
                      <Text style={[styles.awardCount, { color: colors.success }]}>
                        {player.awards.baseballPlayerOfTheYear}x
                      </Text>
                    </View>
                  </View>
                )}
                {player.awards.soccerPlayerOfTheYear > 0 && (
                  <View style={styles.awardItem}>
                    <View style={[styles.awardIconContainer, { backgroundColor: colors.info + '20' }]}>
                      <Text style={styles.awardIcon}>⚽</Text>
                    </View>
                    <View style={styles.awardInfo}>
                      <Text style={[styles.awardName, { color: colors.text }]}>Soccer POY</Text>
                      <Text style={[styles.awardCount, { color: colors.info }]}>
                        {player.awards.soccerPlayerOfTheYear}x
                      </Text>
                    </View>
                  </View>
                )}
                {player.awards.rookieOfTheYear > 0 && (
                  <View style={styles.awardItem}>
                    <View style={[styles.awardIconContainer, { backgroundColor: '#F472B6' + '20' }]}>
                      <Text style={styles.awardIcon}>⭐</Text>
                    </View>
                    <View style={styles.awardInfo}>
                      <Text style={[styles.awardName, { color: colors.text }]}>Rookie of the Year</Text>
                      <Text style={[styles.awardCount, { color: '#F472B6' }]}>
                        {player.awards.rookieOfTheYear}x
                      </Text>
                    </View>
                  </View>
                )}
                {player.awards.playerOfTheMonth > 0 && (
                  <View style={styles.awardItem}>
                    <View style={[styles.awardIconContainer, { backgroundColor: colors.textMuted + '20' }]}>
                      <Text style={styles.awardIcon}>📅</Text>
                    </View>
                    <View style={styles.awardInfo}>
                      <Text style={[styles.awardName, { color: colors.text }]}>Player of the Month</Text>
                      <Text style={[styles.awardCount, { color: colors.textSecondary }]}>
                        {player.awards.playerOfTheMonth}x
                      </Text>
                    </View>
                  </View>
                )}
                {player.awards.playerOfTheWeek > 0 && (
                  <View style={styles.awardItem}>
                    <View style={[styles.awardIconContainer, { backgroundColor: colors.textMuted + '20' }]}>
                      <Text style={styles.awardIcon}>📆</Text>
                    </View>
                    <View style={styles.awardInfo}>
                      <Text style={[styles.awardName, { color: colors.text }]}>Player of the Week</Text>
                      <Text style={[styles.awardCount, { color: colors.textSecondary }]}>
                        {player.awards.playerOfTheWeek}x
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}
        </>
      )}

      {selectedTab === 'skills' && (
        <SkillsBreakdownCard player={player} hidden={!isScouted && !isOnUserTeam} />
      )}

      {selectedTab === 'training' && (
        isOnUserTeam ? (
          <>
            <TrainingFocusCard
              player={player}
              teamFocus={state.userTeam.trainingFocus ?? DEFAULT_TRAINING_FOCUS}
              onFocusChange={(focus) => setTrainingFocus(focus, player.id)}
              onResetToTeam={() => setTrainingFocus(null as any, player.id)}
              budgetMultiplier={
                state.userTeam.operationsBudget
                  ? (state.userTeam.operationsBudget.training / 25) * 2
                  : 1.0
              }
            />
            <View style={{ height: spacing.md }} />
            <TrainingSuggestionsCard player={player} />
          </>
        ) : (
          <TrainingSuggestionsCard player={player} hidden={!isScouted} />
        )
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {isOnUserTeam ? (
          // Actions for players on user's team
          <>
            {/* Extend Contract Button - show if player has contract */}
            {player.contract && (
              existingNegotiation ? (
                <TouchableOpacity
                  style={[styles.negotiationPendingCard, { backgroundColor: colors.card, borderColor: colors.info }]}
                  onPress={onNavigateToNegotiation}
                >
                  <Text style={[styles.negotiationPendingTitle, { color: colors.info }]}>
                    Negotiation In Progress
                  </Text>
                  <Text style={[styles.negotiationPendingNote, { color: colors.textMuted }]}>
                    Tap to continue negotiation
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.extendContractButton, { backgroundColor: colors.primary }]}
                  onPress={handleExtendContract}
                >
                  <Text style={styles.extendContractText}>Extend Contract</Text>
                </TouchableOpacity>
              )
            )}

            {/* Transfer List Button */}
            {isOnTransferList ? (
              <TouchableOpacity
                style={[styles.transferListButton, { borderColor: colors.warning, backgroundColor: colors.warning + '15' }]}
                onPress={() => removeFromTransferList(playerId)}
              >
                <Text style={[styles.transferListText, { color: colors.warning }]}>
                  Listed for Transfer (Tap to Remove)
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.transferListButton, { borderColor: colors.textMuted }]}
                onPress={() => {
                  setAskingPriceInput(estimatedTransferValue.toString());
                  setShowTransferListModal(true);
                }}
              >
                <Text style={[styles.transferListText, { color: colors.text }]}>
                  Add to Transfer List
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.releaseButton, { borderColor: colors.error }]}
              onPress={() => setShowReleaseConfirm(true)}
            >
              <Text style={[styles.releaseText, { color: colors.error }]}>
                Release Player
              </Text>
            </TouchableOpacity>
          </>
        ) : isFreeAgent ? (
          // Actions for free agents - use contract negotiation
          <>
            {existingNegotiation ? (
              <TouchableOpacity
                style={[styles.negotiationPendingCard, { backgroundColor: colors.card, borderColor: colors.info }]}
                onPress={onNavigateToNegotiation}
              >
                <Text style={[styles.negotiationPendingTitle, { color: colors.info }]}>
                  Negotiation In Progress
                </Text>
                <Text style={[styles.negotiationPendingNote, { color: colors.textMuted }]}>
                  Tap to continue negotiation
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.makeOfferButton, { backgroundColor: colors.primary }]}
                onPress={handleSignFreeAgent}
              >
                <Text style={styles.makeOfferText}>Start Contract Negotiation</Text>
              </TouchableOpacity>
            )}

            {/* Scouting Target Button */}
            {!isScouted && (
              isScoutingTarget ? (
                <TouchableOpacity
                  style={[styles.scoutingTargetButton, { borderColor: colors.success, backgroundColor: colors.success + '15' }]}
                  onPress={() => removeScoutingTarget(playerId)}
                >
                  <Text style={[styles.scoutingTargetText, { color: colors.success }]}>
                    Scouting Target (Tap to Remove)
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.scoutingTargetButton, { borderColor: colors.textMuted }]}
                  onPress={() => addScoutingTarget(playerId)}
                >
                  <Text style={[styles.scoutingTargetText, { color: colors.text }]}>
                    Add to Scouting Targets
                  </Text>
                </TouchableOpacity>
              )
            )}

            {isScouted && (
              <View style={[styles.scoutedBadge, { backgroundColor: colors.success + '15' }]}>
                <Text style={[styles.scoutedText, { color: colors.success }]}>
                  Fully Scouted
                </Text>
              </View>
            )}
          </>
        ) : (
          // Actions for players on other teams - transfer offers
          <>
            {existingOffer ? (
              <View style={[styles.offerPendingCard, { backgroundColor: colors.card, borderColor: colors.warning }]}>
                <Text style={[styles.offerPendingTitle, { color: colors.warning }]}>
                  Transfer Offer Pending
                </Text>
                <Text style={[styles.offerPendingAmount, { color: colors.text }]}>
                  {formatCurrency(existingOffer.transferFee)}
                </Text>
                <Text style={[styles.offerPendingNote, { color: colors.textMuted }]}>
                  Waiting for response from their team...
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.makeOfferButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setOfferAmount(estimatedTransferValue.toString());
                  setShowTransferOfferModal(true);
                }}
              >
                <Text style={styles.makeOfferText}>Make Transfer Offer</Text>
              </TouchableOpacity>
            )}

            {/* Shortlist Button */}
            {isShortlisted ? (
              <TouchableOpacity
                style={[styles.shortlistButton, { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}
                onPress={() => removeFromShortlist(playerId)}
              >
                <Text style={[styles.shortlistText, { color: colors.primary }]}>
                  On Shortlist (Tap to Remove)
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.shortlistButton, { borderColor: colors.textMuted }]}
                onPress={() => addToShortlist(playerId)}
              >
                <Text style={[styles.shortlistText, { color: colors.text }]}>
                  Add to Shortlist
                </Text>
              </TouchableOpacity>
            )}

            {/* Scouting Target Button */}
            {!isScouted && (
              isScoutingTarget ? (
                <TouchableOpacity
                  style={[styles.scoutingTargetButton, { borderColor: colors.success, backgroundColor: colors.success + '15' }]}
                  onPress={() => removeScoutingTarget(playerId)}
                >
                  <Text style={[styles.scoutingTargetText, { color: colors.success }]}>
                    Scouting Target (Tap to Remove)
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.scoutingTargetButton, { borderColor: colors.textMuted }]}
                  onPress={() => addScoutingTarget(playerId)}
                >
                  <Text style={[styles.scoutingTargetText, { color: colors.text }]}>
                    Add to Scouting Targets
                  </Text>
                </TouchableOpacity>
              )
            )}

            {isScouted && (
              <View style={[styles.scoutedBadge, { backgroundColor: colors.success + '15' }]}>
                <Text style={[styles.scoutedText, { color: colors.success }]}>
                  Fully Scouted
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Release Confirmation */}
      <ConfirmationModal
        visible={showReleaseConfirm}
        title="Release Player?"
        message={`Are you sure you want to release ${player.name}? This action cannot be undone.`}
        confirmText="Release"
        cancelText="Cancel"
        onConfirm={handleRelease}
        onCancel={() => setShowReleaseConfirm(false)}
      />

      {/* Transfer Offer Modal (for players on other teams, NOT free agents) */}
      <Modal
        visible={showTransferOfferModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowTransferOfferModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.offerModalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.offerModalTitle, { color: colors.text }]}>
              Make Transfer Offer
            </Text>
            <Text style={[styles.offerModalPlayer, { color: colors.textSecondary }]}>
              {player.name}
            </Text>

            <View style={styles.offerModalInfo}>
              <Text style={[styles.offerModalLabel, { color: colors.textMuted }]}>
                Estimated Value
              </Text>
              <Text style={[styles.offerModalValue, { color: colors.text }]}>
                {formatCurrency(estimatedTransferValue)}
              </Text>
            </View>

            <View style={styles.offerInputContainer}>
              <Text style={[styles.offerInputLabel, { color: colors.textMuted }]}>
                Your Offer
              </Text>
              <View style={[styles.offerInputWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.offerInputPrefix, { color: colors.textMuted }]}>$</Text>
                <TextInput
                  style={[styles.offerInput, { color: colors.text }]}
                  value={offerAmount}
                  onChangeText={setOfferAmount}
                  keyboardType="numeric"
                  placeholder="Enter amount"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Quick amount buttons */}
            <View style={styles.quickAmounts}>
              {[0.8, 1.0, 1.2, 1.5].map((multiplier) => (
                <TouchableOpacity
                  key={multiplier}
                  style={[styles.quickAmountButton, { borderColor: colors.border }]}
                  onPress={() => setOfferAmount(Math.round(estimatedTransferValue * multiplier).toString())}
                >
                  <Text style={[styles.quickAmountText, { color: colors.text }]}>
                    {formatCurrency(Math.round(estimatedTransferValue * multiplier))}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.offerModalActions}>
              <TouchableOpacity
                style={[styles.offerModalCancel, { borderColor: colors.border }]}
                onPress={() => setShowTransferOfferModal(false)}
              >
                <Text style={[styles.offerModalCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.offerModalSubmit, { backgroundColor: colors.primary }]}
                onPress={handleMakeTransferOffer}
              >
                <Text style={styles.offerModalSubmitText}>Submit Offer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transfer List Modal (for setting asking price) */}
      <Modal
        visible={showTransferListModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowTransferListModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.offerModalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.offerModalTitle, { color: colors.text }]}>
              List for Transfer
            </Text>
            <Text style={[styles.offerModalPlayer, { color: colors.textSecondary }]}>
              {player.name}
            </Text>

            <View style={styles.offerModalInfo}>
              <Text style={[styles.offerModalLabel, { color: colors.textMuted }]}>
                Market Value
              </Text>
              <Text style={[styles.offerModalValue, { color: colors.text }]}>
                {formatCurrency(estimatedTransferValue)}
              </Text>
            </View>

            <View style={styles.offerInputContainer}>
              <Text style={[styles.offerInputLabel, { color: colors.textMuted }]}>
                Asking Price
              </Text>
              <View style={[styles.offerInputWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.offerInputPrefix, { color: colors.textMuted }]}>$</Text>
                <TextInput
                  style={[styles.offerInput, { color: colors.text }]}
                  value={askingPriceInput}
                  onChangeText={setAskingPriceInput}
                  keyboardType="numeric"
                  placeholder="Enter asking price"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Quick amount buttons */}
            <View style={styles.quickAmounts}>
              {[0.8, 1.0, 1.2, 1.5].map((multiplier) => (
                <TouchableOpacity
                  key={multiplier}
                  style={[styles.quickAmountButton, { borderColor: colors.border }]}
                  onPress={() => setAskingPriceInput(Math.round(estimatedTransferValue * multiplier).toString())}
                >
                  <Text style={[styles.quickAmountText, { color: colors.text }]}>
                    {formatCurrency(Math.round(estimatedTransferValue * multiplier))}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.offerModalActions}>
              <TouchableOpacity
                style={[styles.offerModalCancel, { borderColor: colors.border }]}
                onPress={() => setShowTransferListModal(false)}
              >
                <Text style={[styles.offerModalCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.offerModalSubmit, { backgroundColor: colors.warning }]}
                onPress={handleAddToTransferList}
              >
                <Text style={styles.offerModalSubmitText}>List Player</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  errorText: {
    fontSize: 16,
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.lg,
  },
  headerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  playerPosition: {
    fontSize: 14,
    marginBottom: 4,
  },
  playerBio: {
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  projectedBio: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  marketValue: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  injuryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  injuryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  fitnessText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  scoutingStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  scoutingStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  overallRangeValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  overallContainer: {
    alignItems: 'center',
  },
  overallValue: {
    fontSize: 48,
    fontWeight: '800',
  },
  overallLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  sportOverallsRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  sportOverallItem: {
    alignItems: 'center',
  },
  sportOverallValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  sportOverallLabel: {
    fontSize: 9,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  contractInfo: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
  },
  contractItem: {
    flex: 1,
    alignItems: 'center',
  },
  contractLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  contractValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContainer: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  categoryCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  unscoutedLabel: {
    fontSize: 11,
    marginLeft: 'auto',
    fontStyle: 'italic',
  },
  attributesGrid: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  attributeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attributeName: {
    fontSize: 12,
    flex: 1,
  },
  attributeValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.5,
  },
  attributeBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.sm,
  },
  attributeBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  attributeBarRange: {
    position: 'absolute',
    height: '100%',
    borderRadius: 3,
  },
  attributeRangeValue: {
    fontSize: 11,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
  attributeValue: {
    fontSize: 12,
    fontWeight: '600',
    width: 24,
    textAlign: 'right',
  },
  attributeValueWithDelta: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 50,
    justifyContent: 'flex-end',
  },
  attributeDelta: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  releaseButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  releaseText: {
    fontSize: 14,
    fontWeight: '600',
  },
  makeOfferButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  makeOfferText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  offerPendingCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  offerPendingTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  offerPendingAmount: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  offerPendingNote: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  offerModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  offerModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  offerModalPlayer: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  offerModalInfo: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  offerModalLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  offerModalValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  offerInputContainer: {
    marginBottom: spacing.md,
  },
  offerInputLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  offerInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  offerInputPrefix: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  offerInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: spacing.md,
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickAmountButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  quickAmountText: {
    fontSize: 12,
    fontWeight: '500',
  },
  offerModalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  offerModalCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  offerModalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  offerModalSubmit: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  offerModalSubmitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  scoutingTargetButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  scoutingTargetText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scoutedBadge: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  scoutedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  extendContractButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  extendContractText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  negotiationPendingCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  negotiationPendingTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  negotiationPendingNote: {
    fontSize: 12,
  },
  shortlistButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  shortlistText: {
    fontSize: 14,
    fontWeight: '600',
  },
  transferListButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  transferListText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Awards styles
  awardsSummaryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  awardsSummaryText: {
    fontSize: 10,
    fontWeight: '600',
  },
  awardsCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  awardsHeader: {
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  awardsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  awardsGrid: {
    padding: spacing.md,
    gap: spacing.md,
  },
  awardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  awardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  awardIcon: {
    fontSize: 20,
  },
  awardInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  awardName: {
    fontSize: 14,
    fontWeight: '500',
  },
  awardCount: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ConnectedPlayerDetailScreen;
