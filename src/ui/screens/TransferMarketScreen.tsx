/**
 * Transfer Market Screen
 *
 * Browse and sign players from other teams:
 * - Available players list
 * - Filter by position/age/rating
 * - Make offer flow
 * - View incoming offers
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';
import { PlayerCard, PlayerCardData } from '../components/roster/PlayerCard';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

type TabType = 'shortlist' | 'transferList' | 'offers' | 'myoffers';

export interface TransferTarget extends PlayerCardData {
  team: string;
  askingPrice: number;
  status: 'available' | 'negotiating' | 'sold';
  isFreeAgent?: boolean;
}

export interface IncomingOffer {
  id: string;
  player: PlayerCardData;
  fromTeam: string;
  offerAmount: number;
  status: 'pending' | 'accepted' | 'rejected';
  expiresIn: number; // days
}

export interface OutgoingOffer {
  id: string;
  player: PlayerCardData;
  toTeam: string;
  offerAmount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired';
  counterAmount?: number; // If status is 'countered'
}

/** Player on the transfer list (user's own player) */
export interface TransferListPlayer extends PlayerCardData {
  askingPrice: number;
}

interface TransferMarketScreenProps {
  userBudget?: number;
  /** Shortlisted players (players user is interested in buying) */
  shortlistedPlayers?: TransferTarget[];
  /** Transfer listed players (user's players available for sale) */
  transferListedPlayers?: TransferListPlayer[];
  /** Incoming offers to display (falls back to mock data) */
  offers?: IncomingOffer[];
  /** User's outgoing offers */
  outgoingOffers?: OutgoingOffer[];
  onMakeOffer?: (player: TransferTarget, amount: number) => void;
  onAcceptOffer?: (offer: IncomingOffer) => void;
  onRejectOffer?: (offer: IncomingOffer) => void;
  onAcceptCounter?: (offer: OutgoingOffer) => void;
  onWithdrawOffer?: (offer: OutgoingOffer) => void;
  onRemoveFromShortlist?: (playerId: string) => void;
  onRemoveFromTransferList?: (playerId: string) => void;
  /** Navigate to player detail screen */
  onPlayerPress?: (playerId: string) => void;
}

// Mock transfer targets
const mockTargets: TransferTarget[] = [
  { id: 't1', name: 'Marcus Thompson', overall: 78, age: 24, salary: 1800000, team: 'Warriors', askingPrice: 3500000, status: 'available' },
  { id: 't2', name: 'DeShawn Carter', overall: 75, age: 26, salary: 1500000, team: 'Thunder', askingPrice: 2800000, status: 'available' },
  { id: 't3', name: 'Anthony Mitchell', overall: 82, age: 28, salary: 2200000, team: 'Rockets', askingPrice: 5000000, status: 'negotiating' },
  { id: 't4', name: 'Jaylen Walker', overall: 71, age: 22, salary: 1000000, team: 'Blazers', askingPrice: 2000000, status: 'available' },
  { id: 't5', name: 'David Chen', overall: 76, age: 27, salary: 1600000, team: 'Panthers', askingPrice: 3200000, status: 'available' },
  { id: 't6', name: 'Chris Jordan', overall: 69, age: 23, salary: 800000, team: 'Eagles', askingPrice: 1500000, status: 'available' },
];

// Mock incoming offers
const mockOffers: IncomingOffer[] = [
  { id: 'o1', player: { id: 'p1', name: 'Robert Wilson', overall: 68, age: 23, salary: 800000 }, fromTeam: 'Thunder', offerAmount: 2500000, status: 'pending', expiresIn: 3 },
  { id: 'o2', player: { id: 'p2', name: 'William Taylor', overall: 65, age: 22, salary: 600000, isInjured: true }, fromTeam: 'Rockets', offerAmount: 1800000, status: 'pending', expiresIn: 1 },
];

export function TransferMarketScreen({
  userBudget = 5000000,
  shortlistedPlayers,
  transferListedPlayers,
  offers,
  outgoingOffers,
  onMakeOffer,
  onAcceptOffer,
  onRejectOffer,
  onAcceptCounter,
  onWithdrawOffer,
  onRemoveFromShortlist,
  onRemoveFromTransferList,
  onPlayerPress,
}: TransferMarketScreenProps) {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<TabType>('shortlist');
  const [selectedTarget, setSelectedTarget] = useState<TransferTarget | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<IncomingOffer | null>(null);
  const [selectedOutgoingOffer, setSelectedOutgoingOffer] = useState<OutgoingOffer | null>(null);
  const [offerAction, setOfferAction] = useState<'accept' | 'reject' | 'accept_counter' | 'withdraw' | null>(null);

  // Use provided data or fall back to mocks
  const displayShortlistedPlayers = shortlistedPlayers || mockTargets;
  const displayTransferListedPlayers = transferListedPlayers || [];
  const displayOffers = offers || mockOffers;
  const displayOutgoingOffers = outgoingOffers || [];

  const pendingOffers = displayOffers.filter((o) => o.status === 'pending');
  const activeOutgoingOffers = displayOutgoingOffers.filter(
    (o) => o.status === 'pending' || o.status === 'countered'
  );

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
    return `$${(price / 1000).toFixed(0)}K`;
  };

  const handleMakeOffer = () => {
    if (selectedTarget) {
      onMakeOffer?.(selectedTarget, selectedTarget.askingPrice);
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
  };

  const getStatusColor = (status: OutgoingOffer['status']) => {
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

  const getStatusText = (status: OutgoingOffer['status']) => {
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

  const renderTargetCard = ({ item }: { item: TransferTarget }) => (
    <TouchableOpacity
      style={[styles.targetCard, { backgroundColor: colors.card }, shadows.sm]}
      onPress={() => setSelectedTarget(item)}
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
        {item.isFreeAgent ? (
          <View style={styles.targetStat}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Expected Salary</Text>
            <Text style={[styles.statValue, { color: colors.success }]}>
              {formatPrice(item.askingPrice)}/yr
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.targetStat}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Salary</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatPrice(item.salary || 0)}
              </Text>
            </View>
            <View style={styles.targetStat}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Transfer Fee</Text>
              <Text style={[styles.statValue, { color: colors.success }]}>
                {formatPrice(item.askingPrice)}
              </Text>
            </View>
          </>
        )}
        {item.status === 'negotiating' && (
          <View style={[styles.statusBadge, { backgroundColor: colors.warning + '20' }]}>
            <Text style={[styles.statusText, { color: colors.warning }]}>
              Negotiating
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.removeButton, { backgroundColor: colors.error + '20' }]}
          onPress={() => onRemoveFromShortlist?.(item.id)}
        >
          <Text style={[styles.removeButtonText, { color: colors.error }]}>Remove</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderTransferListCard = ({ item }: { item: TransferListPlayer }) => (
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
            Listed for transfer
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
            {formatPrice(item.salary || 0)}
          </Text>
        </View>
        <View style={styles.targetStat}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Asking Price</Text>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {formatPrice(item.askingPrice)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.removeButton, { backgroundColor: colors.error + '20' }]}
          onPress={() => onRemoveFromTransferList?.(item.id)}
        >
          <Text style={[styles.removeButtonText, { color: colors.error }]}>Unlist</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOfferCard = ({ item }: { item: IncomingOffer }) => (
    <View style={[styles.offerCard, { backgroundColor: colors.card }, shadows.sm]}>
      <View style={styles.offerHeader}>
        <Text style={[styles.offerFrom, { color: colors.textMuted }]}>
          Offer from {item.fromTeam}
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
      <View style={[styles.offerFooter, { borderTopColor: colors.border }]}>
        <View style={styles.offerAmount}>
          <Text style={[styles.amountLabel, { color: colors.textMuted }]}>
            Offer Amount
          </Text>
          <Text style={[styles.amountValue, { color: colors.success }]}>
            {formatPrice(item.offerAmount)}
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

  const renderOutgoingOfferCard = ({ item }: { item: OutgoingOffer }) => (
    <View style={[styles.offerCard, { backgroundColor: colors.card }, shadows.sm]}>
      <View style={styles.offerHeader}>
        <Text style={[styles.offerFrom, { color: colors.textMuted }]}>
          Offer to {item.toTeam}
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
      <View style={[styles.offerFooter, { borderTopColor: colors.border }]}>
        <View style={styles.offerAmount}>
          <Text style={[styles.amountLabel, { color: colors.textMuted }]}>
            Your Offer
          </Text>
          <Text style={[styles.amountValue, { color: colors.text }]}>
            {formatPrice(item.offerAmount)}
          </Text>
          {item.status === 'countered' && item.counterAmount !== undefined && (
            <>
              <Text style={[styles.amountLabel, { color: colors.textMuted, marginTop: spacing.xs }]}>
                Counter Offer
              </Text>
              <Text style={[styles.amountValue, { color: colors.primary }]}>
                {formatPrice(item.counterAmount)}
              </Text>
            </>
          )}
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
          <View style={styles.offerActions}>
            <TouchableOpacity
              style={[styles.rejectButton, { borderColor: colors.textMuted }]}
              onPress={() => {
                setSelectedOutgoingOffer(item);
                setOfferAction('withdraw');
              }}
            >
              <Text style={[styles.rejectText, { color: colors.textMuted }]}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Budget Bar */}
      <View style={[styles.budgetBar, { backgroundColor: colors.card }]}>
        <Text style={[styles.budgetLabel, { color: colors.textMuted }]}>
          Transfer Budget
        </Text>
        <Text style={[styles.budgetValue, { color: colors.success }]}>
          {formatPrice(userBudget)}
        </Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shortlist' && styles.activeTab]}
          onPress={() => setActiveTab('shortlist')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'shortlist' ? colors.primary : colors.textMuted },
            ]}
          >
            Shortlist
          </Text>
          {displayShortlistedPlayers.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{displayShortlistedPlayers.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'transferList' && styles.activeTab]}
          onPress={() => setActiveTab('transferList')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'transferList' ? colors.primary : colors.textMuted },
            ]}
          >
            Transfer List
          </Text>
          {displayTransferListedPlayers.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.warning }]}>
              <Text style={styles.badgeText}>{displayTransferListedPlayers.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'myoffers' && styles.activeTab]}
          onPress={() => setActiveTab('myoffers')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'myoffers' ? colors.primary : colors.textMuted },
            ]}
          >
            My Offers
          </Text>
          {activeOutgoingOffers.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{activeOutgoingOffers.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'offers' && styles.activeTab]}
          onPress={() => setActiveTab('offers')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'offers' ? colors.primary : colors.textMuted },
            ]}
          >
            Incoming
          </Text>
          {pendingOffers.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.error }]}>
              <Text style={styles.badgeText}>{pendingOffers.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeTab === 'shortlist' && (
        <FlatList
          data={displayShortlistedPlayers}
          renderItem={renderTargetCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No players shortlisted
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                Browse Player Search and add players to your shortlist
              </Text>
            </View>
          }
        />
      )}

      {activeTab === 'transferList' && (
        <FlatList
          data={displayTransferListedPlayers}
          renderItem={renderTransferListCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No players listed for transfer
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                Add players from your roster to make them available for transfer
              </Text>
            </View>
          }
        />
      )}

      {activeTab === 'myoffers' && (
        <FlatList
          data={displayOutgoingOffers}
          renderItem={renderOutgoingOfferCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No pending offers
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                Browse players and make offers to see them here
              </Text>
            </View>
          }
        />
      )}

      {activeTab === 'offers' && (
        <FlatList
          data={pendingOffers}
          renderItem={renderOfferCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No incoming offers
              </Text>
            </View>
          }
        />
      )}

      {/* Make Offer Modal - different text for free agents vs transfers */}
      <ConfirmationModal
        visible={selectedTarget !== null}
        title={selectedTarget?.isFreeAgent ? 'Sign Free Agent' : 'Make Transfer Offer'}
        message={
          selectedTarget?.isFreeAgent
            ? `Offer ${selectedTarget?.name} a contract with ${formatPrice(selectedTarget?.askingPrice || 0)}/year salary?`
            : `Make a transfer offer of ${selectedTarget ? formatPrice(selectedTarget.askingPrice) : ''} for ${selectedTarget?.name}?`
        }
        confirmText={selectedTarget?.isFreeAgent ? 'Offer Contract' : 'Make Offer'}
        cancelText="Cancel"
        onConfirm={handleMakeOffer}
        onCancel={() => setSelectedTarget(null)}
      />

      {/* Accept/Reject Offer Modal */}
      <ConfirmationModal
        visible={selectedOffer !== null}
        title={offerAction === 'accept' ? 'Accept Offer?' : 'Reject Offer?'}
        message={
          offerAction === 'accept'
            ? `Accept ${selectedOffer ? formatPrice(selectedOffer.offerAmount) : ''} for ${selectedOffer?.player.name}?`
            : `Reject the offer for ${selectedOffer?.player.name}?`
        }
        confirmText={offerAction === 'accept' ? 'Accept' : 'Reject'}
        confirmStyle={offerAction === 'reject' ? 'destructive' : 'default'}
        cancelText="Cancel"
        onConfirm={handleOfferAction}
        onCancel={() => {
          setSelectedOffer(null);
          setOfferAction(null);
        }}
      />

      {/* Counter/Withdraw Outgoing Offer Modal */}
      <ConfirmationModal
        visible={selectedOutgoingOffer !== null}
        title={
          offerAction === 'accept_counter'
            ? 'Accept Counter Offer?'
            : 'Withdraw Offer?'
        }
        message={
          offerAction === 'accept_counter'
            ? `Accept the counter offer of ${selectedOutgoingOffer?.counterAmount ? formatPrice(selectedOutgoingOffer.counterAmount) : ''} for ${selectedOutgoingOffer?.player.name}?`
            : `Withdraw your offer for ${selectedOutgoingOffer?.player.name}?`
        }
        confirmText={offerAction === 'accept_counter' ? 'Accept' : 'Withdraw'}
        confirmStyle={offerAction === 'withdraw' ? 'destructive' : 'default'}
        cancelText="Cancel"
        onConfirm={handleOfferAction}
        onCancel={() => {
          setSelectedOutgoingOffer(null);
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
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  filterButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
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
  statusBadge: {
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
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
  buttonText: {
    color: '#FFFFFF',
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
});

export default TransferMarketScreen;
