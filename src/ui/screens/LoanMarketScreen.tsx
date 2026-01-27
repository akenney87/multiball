/**
 * Loan Market Screen
 *
 * Browse and manage player loans:
 * - Browse loan-listed players from other teams
 * - List your players for loan
 * - View incoming loan offers
 * - Manage outgoing loan offers
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';
import { PlayerCard, PlayerCardData } from '../components/roster/PlayerCard';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import type { LoanTerms } from '../../data/types';

type TabType = 'loanIn' | 'loanOut' | 'myOffers' | 'incoming' | 'active';

export interface LoanTarget extends PlayerCardData {
  team: string;
  teamId: string;
  recommendedLoanFee: number;
  weeklySalary: number;
}

export interface LoanListPlayer extends PlayerCardData {
  weeklySalary: number;
}

export interface IncomingLoanOffer {
  id: string;
  player: PlayerCardData;
  fromTeam: string;
  terms: LoanTerms;
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  expiresIn: number;
}

export interface OutgoingLoanOffer {
  id: string;
  player: PlayerCardData;
  toTeam: string;
  terms: LoanTerms;
  status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired';
  counterTerms?: LoanTerms;
}

export interface ActiveLoanDisplay {
  id: string;
  player: PlayerCardData;
  otherTeam: string;
  terms: LoanTerms;
  weeksRemaining: number;
  isLoanedIn: boolean;
  canRecall: boolean;
  canExerciseBuyOption: boolean;
  appearances: { basketball: number; baseball: number; soccer: number };
}

interface LoanMarketScreenProps {
  userBudget?: number;
  loanTargets?: LoanTarget[];
  loanListedPlayers?: LoanListPlayer[];
  incomingOffers?: IncomingLoanOffer[];
  outgoingOffers?: OutgoingLoanOffer[];
  activeLoans?: ActiveLoanDisplay[];
  onMakeLoanOffer?: (player: LoanTarget, terms: LoanTerms) => void;
  onAcceptOffer?: (offer: IncomingLoanOffer) => void;
  onRejectOffer?: (offer: IncomingLoanOffer) => void;
  onCounterOffer?: (offer: IncomingLoanOffer, counterTerms: LoanTerms) => void;
  onAcceptCounter?: (offer: OutgoingLoanOffer) => void;
  onWithdrawOffer?: (offer: OutgoingLoanOffer) => void;
  onRemoveFromLoanList?: (playerId: string) => void;
  onRecallLoan?: (loanId: string) => void;
  onExerciseBuyOption?: (loanId: string) => void;
  onPlayerPress?: (playerId: string) => void;
  currentWeek?: number;
}

const LOAN_DURATION_OPTIONS = [
  { label: '8 Weeks', value: 8 },
  { label: '16 Weeks', value: 16 },
  { label: '24 Weeks', value: 24 },
  { label: 'Full Season', value: 40 },
];

export function LoanMarketScreen({
  userBudget = 5000000,
  loanTargets = [],
  loanListedPlayers = [],
  incomingOffers = [],
  outgoingOffers = [],
  activeLoans = [],
  onMakeLoanOffer,
  onAcceptOffer,
  onRejectOffer,
  onCounterOffer,
  onAcceptCounter,
  onWithdrawOffer,
  onRemoveFromLoanList,
  onRecallLoan,
  onExerciseBuyOption,
  onPlayerPress,
  currentWeek = 1,
}: LoanMarketScreenProps) {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<TabType>('loanIn');
  const [selectedTarget, setSelectedTarget] = useState<LoanTarget | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<IncomingLoanOffer | null>(null);
  const [selectedOutgoingOffer, setSelectedOutgoingOffer] = useState<OutgoingLoanOffer | null>(null);
  const [selectedActiveLoan, setSelectedActiveLoan] = useState<ActiveLoanDisplay | null>(null);
  const [offerAction, setOfferAction] = useState<'accept' | 'reject' | 'accept_counter' | 'withdraw' | 'recall' | 'buy_option' | null>(null);
  const [counterInputVisible, setCounterInputVisible] = useState(false);

  // Loan offer configuration state
  const [loanDuration, setLoanDuration] = useState(16);
  const [wageContribution, setWageContribution] = useState(50);
  const [loanFee, setLoanFee] = useState(0);
  const [includeBuyOption, setIncludeBuyOption] = useState(false);
  const [buyOptionPrice, setBuyOptionPrice] = useState(0);
  const [buyOptionMandatory, setBuyOptionMandatory] = useState(false);

  // Counter offer state
  const [counterDuration, setCounterDuration] = useState(16);
  const [counterWageContribution, setCounterWageContribution] = useState(50);
  const [counterLoanFee, setCounterLoanFee] = useState(0);

  const pendingIncoming = incomingOffers.filter((o) => o.status === 'pending' || o.status === 'countered');
  const activeOutgoing = outgoingOffers.filter((o) => o.status === 'pending' || o.status === 'countered');

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`;
    return `$${price.toFixed(0)}`;
  };

  const formatWeeklySalary = (salary: number) => {
    return `$${(salary / 1000).toFixed(0)}K/wk`;
  };

  const openOfferModal = (target: LoanTarget) => {
    setSelectedTarget(target);
    setLoanDuration(16);
    setWageContribution(50);
    setLoanFee(target.recommendedLoanFee);
    setBuyOptionPrice(target.recommendedLoanFee * 10);
    setIncludeBuyOption(false);
    setBuyOptionMandatory(false);
  };

  const handleMakeLoanOffer = () => {
    if (selectedTarget) {
      const terms: LoanTerms = {
        loanFee,
        wageContribution,
        duration: { type: 'fixed', weeks: loanDuration },
        startWeek: currentWeek,
        endWeek: currentWeek + loanDuration,
      };

      if (includeBuyOption) {
        terms.buyOption = {
          price: buyOptionPrice,
          mandatory: buyOptionMandatory,
        };
      }

      onMakeLoanOffer?.(selectedTarget, terms);
      setSelectedTarget(null);
    }
  };

  const handleOfferAction = () => {
    if (selectedOffer) {
      if (offerAction === 'accept') {
        onAcceptOffer?.(selectedOffer);
      } else if (offerAction === 'reject') {
        onRejectOffer?.(selectedOffer);
      }
      setSelectedOffer(null);
      setOfferAction(null);
    }
    if (selectedOutgoingOffer) {
      if (offerAction === 'accept_counter') {
        onAcceptCounter?.(selectedOutgoingOffer);
      } else if (offerAction === 'withdraw') {
        onWithdrawOffer?.(selectedOutgoingOffer);
      }
      setSelectedOutgoingOffer(null);
      setOfferAction(null);
    }
    if (selectedActiveLoan) {
      if (offerAction === 'recall') {
        onRecallLoan?.(selectedActiveLoan.id);
      } else if (offerAction === 'buy_option') {
        onExerciseBuyOption?.(selectedActiveLoan.id);
      }
      setSelectedActiveLoan(null);
      setOfferAction(null);
    }
  };

  const openCounterModal = (offer: IncomingLoanOffer) => {
    setSelectedOffer(offer);
    setCounterDuration(offer.terms.duration.type === 'fixed' ? offer.terms.duration.weeks : 40);
    setCounterWageContribution(offer.terms.wageContribution);
    setCounterLoanFee(Math.round(offer.terms.loanFee * 1.2));
    setCounterInputVisible(true);
  };

  const handleSubmitCounter = () => {
    if (selectedOffer) {
      const counterTerms: LoanTerms = {
        ...selectedOffer.terms,
        loanFee: counterLoanFee,
        wageContribution: counterWageContribution,
        duration: { type: 'fixed', weeks: counterDuration },
        endWeek: selectedOffer.terms.startWeek + counterDuration,
      };
      onCounterOffer?.(selectedOffer, counterTerms);
      setCounterInputVisible(false);
      setSelectedOffer(null);
    }
  };

  const getStatusColor = (status: OutgoingLoanOffer['status']) => {
    switch (status) {
      case 'pending':
        return colors.warning;
      case 'accepted':
        return colors.success;
      case 'rejected':
        return colors.error;
      case 'countered':
        return colors.primary;
      case 'expired':
        return colors.textMuted;
      default:
        return colors.textMuted;
    }
  };

  const getStatusText = (status: OutgoingLoanOffer['status']) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'accepted':
        return 'Accepted';
      case 'rejected':
        return 'Rejected';
      case 'countered':
        return 'Counter Offer';
      case 'expired':
        return 'Expired';
      default:
        return status;
    }
  };

  const renderLoanTermsSummary = (terms: LoanTerms) => {
    const duration = terms.duration.type === 'fixed' ? `${terms.duration.weeks} weeks` : 'End of Season';
    return (
      <View style={styles.termsSummary}>
        <Text style={[styles.termsText, { color: colors.textMuted }]}>
          {duration} | Fee: {formatPrice(terms.loanFee)} | Wage: {terms.wageContribution}% yours
        </Text>
        {terms.buyOption && (
          <Text style={[styles.termsText, { color: colors.primary }]}>
            Buy Option: {formatPrice(terms.buyOption.price)} {terms.buyOption.mandatory ? '(Mandatory)' : '(Optional)'}
          </Text>
        )}
      </View>
    );
  };

  const renderTargetCard = ({ item }: { item: LoanTarget }) => (
    <TouchableOpacity
      style={[styles.targetCard, { backgroundColor: colors.card }, shadows.sm]}
      onPress={() => openOfferModal(item)}
      activeOpacity={0.7}
    >
      <View style={styles.targetHeader}>
        <View style={[styles.positionBadge, { backgroundColor: colors.surface }]}>
          <Text style={[styles.positionText, { color: colors.text }]}>
            {item.overall}
          </Text>
        </View>
        <TouchableOpacity style={styles.targetInfo} onPress={() => onPlayerPress?.(item.id)}>
          <Text style={[styles.targetName, { color: colors.primary }]}>
            {item.name}
          </Text>
          <Text style={[styles.targetTeam, { color: colors.textMuted }]}>
            {item.team}
          </Text>
        </TouchableOpacity>
        <View style={styles.targetRating}>
          <Text style={[styles.ratingValue, { color: colors.primary }]}>
            {item.overall}
          </Text>
          <Text style={[styles.ratingLabel, { color: colors.textMuted }]}>OVR</Text>
        </View>
      </View>
      <View style={[styles.targetFooter, { borderTopColor: colors.border }]}>
        <View style={styles.targetStat}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Age</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{item.age}</Text>
        </View>
        <View style={styles.targetStat}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Salary</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatWeeklySalary(item.weeklySalary)}
          </Text>
        </View>
        <View style={styles.targetStat}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Est. Fee</Text>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {formatPrice(item.recommendedLoanFee)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderLoanListCard = ({ item }: { item: LoanListPlayer }) => (
    <View style={[styles.targetCard, { backgroundColor: colors.card }, shadows.sm]}>
      <View style={styles.targetHeader}>
        <View style={[styles.positionBadge, { backgroundColor: colors.surface }]}>
          <Text style={[styles.positionText, { color: colors.text }]}>
            {item.overall}
          </Text>
        </View>
        <TouchableOpacity style={styles.targetInfo} onPress={() => onPlayerPress?.(item.id)}>
          <Text style={[styles.targetName, { color: colors.primary }]}>
            {item.name}
          </Text>
          <Text style={[styles.targetTeam, { color: colors.success }]}>
            Available for loan
          </Text>
        </TouchableOpacity>
        <View style={styles.targetRating}>
          <Text style={[styles.ratingValue, { color: colors.primary }]}>
            {item.overall}
          </Text>
          <Text style={[styles.ratingLabel, { color: colors.textMuted }]}>OVR</Text>
        </View>
      </View>
      <View style={[styles.targetFooter, { borderTopColor: colors.border }]}>
        <View style={styles.targetStat}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Age</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{item.age}</Text>
        </View>
        <View style={styles.targetStat}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Salary</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatWeeklySalary(item.weeklySalary)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.removeButton, { backgroundColor: colors.error + '20' }]}
          onPress={() => onRemoveFromLoanList?.(item.id)}
        >
          <Text style={[styles.removeButtonText, { color: colors.error }]}>Unlist</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderIncomingOfferCard = ({ item }: { item: IncomingLoanOffer }) => (
    <View style={[styles.offerCard, { backgroundColor: colors.card }, shadows.sm]}>
      <View style={styles.offerHeader}>
        <Text style={[styles.offerFrom, { color: colors.textMuted }]}>
          Loan request from {item.fromTeam}
        </Text>
        <View
          style={[
            styles.expiresBadge,
            { backgroundColor: item.expiresIn <= 1 ? colors.error + '20' : colors.surface },
          ]}
        >
          <Text
            style={[
              styles.expiresText,
              { color: item.expiresIn <= 1 ? colors.error : colors.textMuted },
            ]}
          >
            {item.expiresIn}d left
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => onPlayerPress?.(item.player.id)}>
        <PlayerCard player={item.player} showSalary />
      </TouchableOpacity>
      {renderLoanTermsSummary(item.terms)}
      <View style={[styles.offerFooter, { borderTopColor: colors.border }]}>
        <View style={styles.offerAmount}>
          <Text style={[styles.amountLabel, { color: colors.textMuted }]}>
            Loan Fee
          </Text>
          <Text style={[styles.amountValue, { color: colors.success }]}>
            {formatPrice(item.terms.loanFee)}
          </Text>
        </View>
        <View style={styles.offerActions}>
          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: colors.success }]}
            onPress={() => {
              setSelectedOffer(item);
              setOfferAction('accept');
            }}
          >
            <Text style={styles.buttonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.counterButton, { backgroundColor: colors.primary }]}
            onPress={() => openCounterModal(item)}
          >
            <Text style={styles.buttonText}>Counter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rejectButton, { borderColor: colors.error }]}
            onPress={() => {
              setSelectedOffer(item);
              setOfferAction('reject');
            }}
          >
            <Text style={[styles.rejectText, { color: colors.error }]}>Reject</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderOutgoingOfferCard = ({ item }: { item: OutgoingLoanOffer }) => (
    <View style={[styles.offerCard, { backgroundColor: colors.card }, shadows.sm]}>
      <View style={styles.offerHeader}>
        <Text style={[styles.offerFrom, { color: colors.textMuted }]}>
          Loan offer to {item.toTeam}
        </Text>
        <View
          style={[
            styles.expiresBadge,
            { backgroundColor: getStatusColor(item.status) + '20' },
          ]}
        >
          <Text
            style={[
              styles.expiresText,
              { color: getStatusColor(item.status) },
            ]}
          >
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => onPlayerPress?.(item.player.id)}>
        <PlayerCard player={item.player} showSalary />
      </TouchableOpacity>
      {renderLoanTermsSummary(item.terms)}
      {item.status === 'countered' && item.counterTerms && (
        <View style={[styles.counterTermsBox, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.counterTermsLabel, { color: colors.primary }]}>Counter Terms:</Text>
          {renderLoanTermsSummary(item.counterTerms)}
        </View>
      )}
      <View style={[styles.offerFooter, { borderTopColor: colors.border }]}>
        <View style={styles.offerAmount}>
          <Text style={[styles.amountLabel, { color: colors.textMuted }]}>
            Your Offer
          </Text>
          <Text style={[styles.amountValue, { color: colors.text }]}>
            {formatPrice(item.terms.loanFee)}
          </Text>
        </View>
        {item.status === 'countered' && (
          <View style={styles.offerActions}>
            <TouchableOpacity
              style={[styles.acceptButton, { backgroundColor: colors.success }]}
              onPress={() => {
                setSelectedOutgoingOffer(item);
                setOfferAction('accept_counter');
              }}
            >
              <Text style={styles.buttonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectButton, { borderColor: colors.error }]}
              onPress={() => {
                setSelectedOutgoingOffer(item);
                setOfferAction('withdraw');
              }}
            >
              <Text style={[styles.rejectText, { color: colors.error }]}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}
        {item.status === 'pending' && (
          <TouchableOpacity
            style={[styles.rejectButton, { borderColor: colors.textMuted }]}
            onPress={() => {
              setSelectedOutgoingOffer(item);
              setOfferAction('withdraw');
            }}
          >
            <Text style={[styles.rejectText, { color: colors.textMuted }]}>Withdraw</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderActiveLoanCard = ({ item }: { item: ActiveLoanDisplay }) => (
    <View style={[styles.offerCard, { backgroundColor: colors.card }, shadows.sm]}>
      <View style={styles.offerHeader}>
        <Text style={[styles.offerFrom, { color: colors.textMuted }]}>
          {item.isLoanedIn ? `Loaned from ${item.otherTeam}` : `Loaned to ${item.otherTeam}`}
        </Text>
        <View style={[styles.expiresBadge, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[styles.expiresText, { color: colors.primary }]}>
            {item.weeksRemaining} wks left
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => onPlayerPress?.(item.player.id)}>
        <PlayerCard player={item.player} showSalary />
      </TouchableOpacity>
      {renderLoanTermsSummary(item.terms)}
      <View style={styles.appearancesRow}>
        <Text style={[styles.appearancesLabel, { color: colors.textMuted }]}>Appearances:</Text>
        <Text style={[styles.appearancesText, { color: colors.text }]}>
          BBall: {item.appearances.basketball} | Baseball: {item.appearances.baseball} | Soccer: {item.appearances.soccer}
        </Text>
      </View>
      <View style={[styles.offerFooter, { borderTopColor: colors.border }]}>
        <View style={styles.offerActions}>
          {!item.isLoanedIn && item.canRecall && (
            <TouchableOpacity
              style={[styles.counterButton, { backgroundColor: colors.warning }]}
              onPress={() => {
                setSelectedActiveLoan(item);
                setOfferAction('recall');
              }}
            >
              <Text style={styles.buttonText}>Recall</Text>
            </TouchableOpacity>
          )}
          {item.isLoanedIn && item.canExerciseBuyOption && item.terms.buyOption && (
            <TouchableOpacity
              style={[
                styles.acceptButton,
                {
                  backgroundColor: userBudget >= item.terms.buyOption.price
                    ? colors.success
                    : colors.textMuted,
                },
              ]}
              onPress={() => {
                if (userBudget >= item.terms.buyOption.price) {
                  setSelectedActiveLoan(item);
                  setOfferAction('buy_option');
                }
              }}
              disabled={userBudget < item.terms.buyOption.price}
            >
              <Text style={styles.buttonText}>
                Buy ({formatPrice(item.terms.buyOption.price)})
                {userBudget < item.terms.buyOption.price ? ' - No Funds' : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Budget Bar */}
      <View style={[styles.budgetBar, { backgroundColor: colors.card }]}>
        <Text style={[styles.budgetLabel, { color: colors.textMuted }]}>
          Available Budget
        </Text>
        <Text style={[styles.budgetValue, { color: colors.success }]}>
          {formatPrice(userBudget)}
        </Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'loanIn' && styles.activeTab]}
          onPress={() => setActiveTab('loanIn')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'loanIn' ? colors.primary : colors.textMuted },
            ]}
          >
            Loan In
          </Text>
          {loanTargets.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{loanTargets.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'loanOut' && styles.activeTab]}
          onPress={() => setActiveTab('loanOut')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'loanOut' ? colors.primary : colors.textMuted },
            ]}
          >
            Loan Out
          </Text>
          {loanListedPlayers.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.warning }]}>
              <Text style={styles.badgeText}>{loanListedPlayers.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'myOffers' && styles.activeTab]}
          onPress={() => setActiveTab('myOffers')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'myOffers' ? colors.primary : colors.textMuted },
            ]}
          >
            My Offers
          </Text>
          {activeOutgoing.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{activeOutgoing.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'incoming' && styles.activeTab]}
          onPress={() => setActiveTab('incoming')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'incoming' ? colors.primary : colors.textMuted },
            ]}
          >
            Incoming
          </Text>
          {pendingIncoming.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.error }]}>
              <Text style={styles.badgeText}>{pendingIncoming.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'active' ? colors.primary : colors.textMuted },
            ]}
          >
            Active
          </Text>
          {activeLoans.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.success }]}>
              <Text style={styles.badgeText}>{activeLoans.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'loanIn' && (
        <FlatList
          data={loanTargets}
          renderItem={renderTargetCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No players available for loan
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                Check back later as teams list players
              </Text>
            </View>
          }
        />
      )}

      {activeTab === 'loanOut' && (
        <FlatList
          data={loanListedPlayers}
          renderItem={renderLoanListCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No players listed for loan
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                List players from your roster to receive loan offers
              </Text>
            </View>
          }
        />
      )}

      {activeTab === 'myOffers' && (
        <FlatList
          data={outgoingOffers}
          renderItem={renderOutgoingOfferCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No outgoing loan offers
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                Browse the loan market to make offers
              </Text>
            </View>
          }
        />
      )}

      {activeTab === 'incoming' && (
        <FlatList
          data={pendingIncoming}
          renderItem={renderIncomingOfferCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No incoming loan offers
              </Text>
            </View>
          }
        />
      )}

      {activeTab === 'active' && (
        <FlatList
          data={activeLoans}
          renderItem={renderActiveLoanCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No active loans
              </Text>
            </View>
          }
        />
      )}

      {/* Make Loan Offer Modal */}
      <Modal
        visible={selectedTarget !== null && !counterInputVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Loan Offer for {selectedTarget?.name}
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              From {selectedTarget?.team}
            </Text>

            <ScrollView style={styles.modalScroll}>
              {/* Duration */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Loan Duration</Text>
                <View style={styles.durationOptions}>
                  {LOAN_DURATION_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.durationOption,
                        { borderColor: loanDuration === opt.value ? colors.primary : colors.border },
                        loanDuration === opt.value && { backgroundColor: colors.primary + '20' },
                      ]}
                      onPress={() => setLoanDuration(opt.value)}
                    >
                      <Text
                        style={[
                          styles.durationOptionText,
                          { color: loanDuration === opt.value ? colors.primary : colors.text },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Loan Fee */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Loan Fee
                </Text>
                <View style={styles.inputRow}>
                  <TouchableOpacity
                    style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                    onPress={() => setLoanFee(Math.max(0, loanFee - 50000))}
                  >
                    <Text style={[styles.adjustButtonText, { color: colors.text }]}>-</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.valueInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                    value={formatPrice(loanFee)}
                    onChangeText={(text) => {
                      const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
                      if (!isNaN(num)) setLoanFee(num);
                    }}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                    onPress={() => setLoanFee(loanFee + 50000)}
                  >
                    <Text style={[styles.adjustButtonText, { color: colors.text }]}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.sliderHint, { color: colors.textMuted }]}>
                  Recommended: {formatPrice(selectedTarget?.recommendedLoanFee || 0)}
                </Text>
              </View>

              {/* Wage Contribution */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Wage Contribution (You pay)
                </Text>
                <View style={styles.inputRow}>
                  <TouchableOpacity
                    style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                    onPress={() => setWageContribution(Math.max(0, wageContribution - 10))}
                  >
                    <Text style={[styles.adjustButtonText, { color: colors.text }]}>-</Text>
                  </TouchableOpacity>
                  <View style={[styles.percentInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.percentText, { color: colors.text }]}>{wageContribution}%</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                    onPress={() => setWageContribution(Math.min(100, wageContribution + 10))}
                  >
                    <Text style={[styles.adjustButtonText, { color: colors.text }]}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.sliderHint, { color: colors.textMuted }]}>
                  Weekly cost: {formatPrice((selectedTarget?.weeklySalary || 0) * (wageContribution / 100))}
                </Text>
              </View>

              {/* Buy Option Toggle */}
              <View style={styles.formSection}>
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => setIncludeBuyOption(!includeBuyOption)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: colors.border },
                      includeBuyOption && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  >
                    {includeBuyOption && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>
                    Include Buy Option
                  </Text>
                </TouchableOpacity>
              </View>

              {includeBuyOption && (
                <>
                  {/* Buy Option Price */}
                  <View style={styles.formSection}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>
                      Buy Option Price
                    </Text>
                    <View style={styles.inputRow}>
                      <TouchableOpacity
                        style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                        onPress={() => setBuyOptionPrice(Math.max(100000, buyOptionPrice - 100000))}
                      >
                        <Text style={[styles.adjustButtonText, { color: colors.text }]}>-</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.valueInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                        value={formatPrice(buyOptionPrice)}
                        onChangeText={(text) => {
                          const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
                          if (!isNaN(num)) setBuyOptionPrice(num);
                        }}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                        onPress={() => setBuyOptionPrice(buyOptionPrice + 100000)}
                      >
                        <Text style={[styles.adjustButtonText, { color: colors.text }]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Mandatory Toggle */}
                  <View style={styles.formSection}>
                    <TouchableOpacity
                      style={styles.toggleRow}
                      onPress={() => setBuyOptionMandatory(!buyOptionMandatory)}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          { borderColor: colors.border },
                          buyOptionMandatory && { backgroundColor: colors.warning, borderColor: colors.warning },
                        ]}
                      >
                        {buyOptionMandatory && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={[styles.toggleLabel, { color: colors.text }]}>
                        Mandatory Buy Option
                      </Text>
                    </TouchableOpacity>
                    <Text style={[styles.toggleHint, { color: colors.textMuted }]}>
                      If mandatory, you must purchase at end of loan
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { borderColor: colors.border }]}
                onPress={() => setSelectedTarget(null)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, { backgroundColor: colors.primary }]}
                onPress={handleMakeLoanOffer}
              >
                <Text style={styles.modalSubmitText}>Make Offer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Counter Offer Modal */}
      <Modal
        visible={counterInputVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Counter Offer for {selectedOffer?.player.name}
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              Their offer: {formatPrice(selectedOffer?.terms.loanFee || 0)} loan fee
            </Text>

            <ScrollView style={styles.modalScroll}>
              {/* Duration */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Loan Duration</Text>
                <View style={styles.durationOptions}>
                  {LOAN_DURATION_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.durationOption,
                        { borderColor: counterDuration === opt.value ? colors.primary : colors.border },
                        counterDuration === opt.value && { backgroundColor: colors.primary + '20' },
                      ]}
                      onPress={() => setCounterDuration(opt.value)}
                    >
                      <Text
                        style={[
                          styles.durationOptionText,
                          { color: counterDuration === opt.value ? colors.primary : colors.text },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Counter Loan Fee */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Loan Fee
                </Text>
                <View style={styles.inputRow}>
                  <TouchableOpacity
                    style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                    onPress={() => setCounterLoanFee(Math.max(0, counterLoanFee - 50000))}
                  >
                    <Text style={[styles.adjustButtonText, { color: colors.text }]}>-</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.valueInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                    value={formatPrice(counterLoanFee)}
                    onChangeText={(text) => {
                      const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
                      if (!isNaN(num)) setCounterLoanFee(num);
                    }}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                    onPress={() => setCounterLoanFee(counterLoanFee + 50000)}
                  >
                    <Text style={[styles.adjustButtonText, { color: colors.text }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Counter Wage Contribution */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Wage Contribution (They pay)
                </Text>
                <View style={styles.inputRow}>
                  <TouchableOpacity
                    style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                    onPress={() => setCounterWageContribution(Math.max(0, counterWageContribution - 10))}
                  >
                    <Text style={[styles.adjustButtonText, { color: colors.text }]}>-</Text>
                  </TouchableOpacity>
                  <View style={[styles.percentInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.percentText, { color: colors.text }]}>{counterWageContribution}%</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.adjustButton, { backgroundColor: colors.surface }]}
                    onPress={() => setCounterWageContribution(Math.min(100, counterWageContribution + 10))}
                  >
                    <Text style={[styles.adjustButtonText, { color: colors.text }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setCounterInputVisible(false);
                  setSelectedOffer(null);
                }}
              >
                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, { backgroundColor: colors.primary }]}
                onPress={handleSubmitCounter}
              >
                <Text style={styles.modalSubmitText}>Submit Counter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Action Confirmation Modal */}
      <ConfirmationModal
        visible={(selectedOffer !== null || selectedOutgoingOffer !== null || selectedActiveLoan !== null) && !counterInputVisible && offerAction !== null}
        title={
          offerAction === 'accept'
            ? 'Accept Loan Offer?'
            : offerAction === 'reject'
              ? 'Reject Loan Offer?'
              : offerAction === 'accept_counter'
                ? 'Accept Counter Offer?'
                : offerAction === 'withdraw'
                  ? 'Withdraw Offer?'
                  : offerAction === 'recall'
                    ? 'Recall Player?'
                    : 'Exercise Buy Option?'
        }
        message={
          offerAction === 'accept'
            ? `Accept loan offer of ${selectedOffer ? formatPrice(selectedOffer.terms.loanFee) : ''} for ${selectedOffer?.player.name}?`
            : offerAction === 'reject'
              ? `Reject the loan offer for ${selectedOffer?.player.name}?`
              : offerAction === 'accept_counter'
                ? `Accept counter offer for ${selectedOutgoingOffer?.player.name}?`
                : offerAction === 'withdraw'
                  ? `Withdraw your loan offer for ${selectedOutgoingOffer?.player.name}?`
                  : offerAction === 'recall'
                    ? `Recall ${selectedActiveLoan?.player.name} from loan? ${selectedActiveLoan?.terms.recallClause ? `Recall fee: ${formatPrice(selectedActiveLoan.terms.recallClause.recallFee)}` : ''}`
                    : `Exercise buy option for ${selectedActiveLoan?.player.name}? Price: ${selectedActiveLoan?.terms.buyOption ? formatPrice(selectedActiveLoan.terms.buyOption.price) : ''}`
        }
        confirmText={
          offerAction === 'accept' || offerAction === 'accept_counter'
            ? 'Accept'
            : offerAction === 'reject'
              ? 'Reject'
              : offerAction === 'recall'
                ? 'Recall'
                : offerAction === 'buy_option'
                  ? 'Buy'
                  : 'Withdraw'
        }
        confirmStyle={offerAction === 'reject' || offerAction === 'withdraw' ? 'destructive' : 'default'}
        cancelText="Cancel"
        onConfirm={handleOfferAction}
        onCancel={() => {
          setSelectedOffer(null);
          setSelectedOutgoingOffer(null);
          setSelectedActiveLoan(null);
          setOfferAction(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  budgetBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  budgetLabel: {
    fontSize: 14,
  },
  budgetValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: 2,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  targetCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  targetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  positionBadge: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  positionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  targetInfo: {
    flex: 1,
  },
  targetName: {
    fontSize: 16,
    fontWeight: '600',
  },
  targetTeam: {
    fontSize: 12,
    marginTop: 2,
  },
  targetRating: {
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  ratingLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  targetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.md,
  },
  targetStat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  removeButton: {
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  offerCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  offerFrom: {
    fontSize: 12,
  },
  expiresBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  expiresText: {
    fontSize: 10,
    fontWeight: '600',
  },
  termsSummary: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: borderRadius.sm,
  },
  termsText: {
    fontSize: 11,
  },
  counterTermsBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  counterTermsLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  appearancesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  appearancesLabel: {
    fontSize: 11,
  },
  appearancesText: {
    fontSize: 11,
    fontWeight: '600',
  },
  offerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  offerAmount: {},
  amountLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  offerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  acceptButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  rejectButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  counterButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  buttonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  emptySubtext: {
    fontSize: 12,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  modalScroll: {
    maxHeight: 400,
  },
  formSection: {
    marginBottom: spacing.lg,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  durationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  durationOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  durationOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  adjustButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButtonText: {
    fontSize: 20,
    fontWeight: '600',
  },
  valueInput: {
    flex: 1,
    height: 40,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  percentInput: {
    flex: 1,
    height: 40,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sliderHint: {
    fontSize: 11,
    marginTop: spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleHint: {
    fontSize: 11,
    marginTop: spacing.xs,
    marginLeft: 30,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LoanMarketScreen;
