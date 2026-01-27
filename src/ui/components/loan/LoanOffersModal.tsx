/**
 * Loan Offers Modal
 *
 * Modal for viewing and managing loan offers for a specific player.
 * Can be accessed from Player Detail screen or Roster screen.
 *
 * Features:
 * - View current loan status (if on loan)
 * - See pending incoming offers (if owner)
 * - List/unlist player for loan
 * - Quick accept/reject actions
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { useColors, spacing, borderRadius } from '../../theme';
import { ConfirmationModal } from '../common/ConfirmationModal';
import type { LoanTerms } from '../../../data/types';

export interface LoanOfferDisplay {
  id: string;
  fromTeam: string;
  terms: LoanTerms;
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  expiresIn: number;
}

export interface ActiveLoanInfo {
  id: string;
  otherTeam: string;
  terms: LoanTerms;
  weeksRemaining: number;
  isLoanedIn: boolean;
  canRecall: boolean;
  appearances: { basketball: number; baseball: number; soccer: number };
}

interface LoanOffersModalProps {
  visible: boolean;
  playerName: string;
  playerId: string;
  isUserOwned: boolean;
  isListedForLoan: boolean;
  activeLoan: ActiveLoanInfo | null;
  incomingOffers: LoanOfferDisplay[];
  onClose: () => void;
  onListForLoan: () => void;
  onUnlistFromLoan: () => void;
  onAcceptOffer: (offerId: string) => void;
  onRejectOffer: (offerId: string) => void;
  onRecallLoan: () => void;
  onNavigateToLoanMarket?: () => void;
}

export function LoanOffersModal({
  visible,
  playerName,
  playerId: _playerId,
  isUserOwned,
  isListedForLoan,
  activeLoan,
  incomingOffers,
  onClose,
  onListForLoan,
  onUnlistFromLoan,
  onAcceptOffer,
  onRejectOffer,
  onRecallLoan,
  onNavigateToLoanMarket,
}: LoanOffersModalProps) {
  const colors = useColors();
  const [confirmAction, setConfirmAction] = useState<{
    type: 'accept' | 'reject' | 'recall' | 'list' | 'unlist';
    offerId?: string;
  } | null>(null);

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`;
    return `$${price.toFixed(0)}`;
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;

    switch (confirmAction.type) {
      case 'accept':
        if (confirmAction.offerId) onAcceptOffer(confirmAction.offerId);
        break;
      case 'reject':
        if (confirmAction.offerId) onRejectOffer(confirmAction.offerId);
        break;
      case 'recall':
        onRecallLoan();
        break;
      case 'list':
        onListForLoan();
        break;
      case 'unlist':
        onUnlistFromLoan();
        break;
    }
    setConfirmAction(null);
  };

  const getConfirmMessage = () => {
    if (!confirmAction) return '';

    switch (confirmAction.type) {
      case 'accept':
        return `Accept this loan offer for ${playerName}?`;
      case 'reject':
        return `Reject this loan offer for ${playerName}?`;
      case 'recall':
        return `Recall ${playerName} from loan? ${activeLoan?.terms.recallClause ? `Recall fee: ${formatPrice(activeLoan.terms.recallClause.recallFee)}` : ''}`;
      case 'list':
        return `List ${playerName} as available for loan?`;
      case 'unlist':
        return `Remove ${playerName} from the loan list?`;
      default:
        return '';
    }
  };

  const renderLoanTermsSummary = (terms: LoanTerms) => {
    const duration = terms.duration.type === 'fixed' ? `${terms.duration.weeks} weeks` : 'End of Season';
    return (
      <View style={styles.termsSummary}>
        <View style={styles.termsRow}>
          <Text style={[styles.termsLabel, { color: colors.textMuted }]}>Duration:</Text>
          <Text style={[styles.termsValue, { color: colors.text }]}>{duration}</Text>
        </View>
        <View style={styles.termsRow}>
          <Text style={[styles.termsLabel, { color: colors.textMuted }]}>Loan Fee:</Text>
          <Text style={[styles.termsValue, { color: colors.success }]}>{formatPrice(terms.loanFee)}</Text>
        </View>
        <View style={styles.termsRow}>
          <Text style={[styles.termsLabel, { color: colors.textMuted }]}>Wage Split:</Text>
          <Text style={[styles.termsValue, { color: colors.text }]}>{terms.wageContribution}% / {100 - terms.wageContribution}%</Text>
        </View>
        {terms.buyOption && (
          <View style={styles.termsRow}>
            <Text style={[styles.termsLabel, { color: colors.textMuted }]}>Buy Option:</Text>
            <Text style={[styles.termsValue, { color: colors.primary }]}>
              {formatPrice(terms.buyOption.price)} {terms.buyOption.mandatory ? '(Mandatory)' : ''}
            </Text>
          </View>
        )}
        {terms.recallClause && (
          <View style={styles.termsRow}>
            <Text style={[styles.termsLabel, { color: colors.textMuted }]}>Recall:</Text>
            <Text style={[styles.termsValue, { color: colors.warning }]}>
              After {terms.recallClause.minWeeksBeforeRecall}wk ({formatPrice(terms.recallClause.recallFee)} fee)
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderOfferCard = (offer: LoanOfferDisplay) => (
    <View
      key={offer.id}
      style={[styles.offerCard, { backgroundColor: colors.surface }]}
    >
      <View style={styles.offerHeader}>
        <Text style={[styles.offerTeam, { color: colors.text }]}>
          {offer.fromTeam}
        </Text>
        <View
          style={[
            styles.expiresBadge,
            { backgroundColor: offer.expiresIn <= 1 ? colors.error + '20' : colors.surface },
          ]}
        >
          <Text
            style={[
              styles.expiresText,
              { color: offer.expiresIn <= 1 ? colors.error : colors.textMuted },
            ]}
          >
            {offer.expiresIn}d left
          </Text>
        </View>
      </View>

      {renderLoanTermsSummary(offer.terms)}

      <View style={styles.offerActions}>
        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: colors.success }]}
          onPress={() => setConfirmAction({ type: 'accept', offerId: offer.id })}
        >
          <Text style={styles.buttonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rejectButton, { borderColor: colors.error }]}
          onPress={() => setConfirmAction({ type: 'reject', offerId: offer.id })}
        >
          <Text style={[styles.rejectText, { color: colors.error }]}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.content, { backgroundColor: colors.card }]}>
                <View style={styles.header}>
                  <Text style={[styles.title, { color: colors.text }]}>
                    Loan Status
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                    {playerName}
                  </Text>
                </View>

                <ScrollView
                  style={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Active Loan Section */}
                  {activeLoan && (
                    <View style={styles.section}>
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        {activeLoan.isLoanedIn ? 'On Loan From' : 'Loaned To'}
                      </Text>
                      <View style={[styles.activeLoanCard, { backgroundColor: colors.surface }]}>
                        <View style={styles.loanHeader}>
                          <Text style={[styles.loanTeam, { color: colors.primary }]}>
                            {activeLoan.otherTeam}
                          </Text>
                          <View style={[styles.weeksLeftBadge, { backgroundColor: colors.primary + '20' }]}>
                            <Text style={[styles.weeksLeftText, { color: colors.primary }]}>
                              {activeLoan.weeksRemaining} wks left
                            </Text>
                          </View>
                        </View>

                        {renderLoanTermsSummary(activeLoan.terms)}

                        <View style={styles.appearancesRow}>
                          <Text style={[styles.appearancesLabel, { color: colors.textMuted }]}>
                            Appearances:
                          </Text>
                          <Text style={[styles.appearancesValue, { color: colors.text }]}>
                            B: {activeLoan.appearances.basketball} | BB: {activeLoan.appearances.baseball} | S: {activeLoan.appearances.soccer}
                          </Text>
                        </View>

                        {!activeLoan.isLoanedIn && activeLoan.canRecall && (
                          <TouchableOpacity
                            style={[styles.recallButton, { backgroundColor: colors.warning }]}
                            onPress={() => setConfirmAction({ type: 'recall' })}
                          >
                            <Text style={styles.buttonText}>Recall Player</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Incoming Offers Section (only if user owns and not on loan) */}
                  {isUserOwned && !activeLoan && incomingOffers.length > 0 && (
                    <View style={styles.section}>
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        Incoming Offers ({incomingOffers.length})
                      </Text>
                      {incomingOffers.map(renderOfferCard)}
                    </View>
                  )}

                  {/* No Offers State */}
                  {isUserOwned && !activeLoan && incomingOffers.length === 0 && (
                    <View style={styles.emptySection}>
                      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                        No incoming loan offers
                      </Text>
                      {!isListedForLoan && (
                        <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                          List this player for loan to attract offers
                        </Text>
                      )}
                    </View>
                  )}
                </ScrollView>

                {/* Actions Footer */}
                <View style={[styles.footer, { borderTopColor: colors.border }]}>
                  {isUserOwned && !activeLoan && (
                    <>
                      {isListedForLoan ? (
                        <TouchableOpacity
                          style={[styles.secondaryButton, { borderColor: colors.error }]}
                          onPress={() => setConfirmAction({ type: 'unlist' })}
                        >
                          <Text style={[styles.secondaryButtonText, { color: colors.error }]}>
                            Remove from Loan List
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                          onPress={() => setConfirmAction({ type: 'list' })}
                        >
                          <Text style={styles.primaryButtonText}>
                            List for Loan
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}

                  {onNavigateToLoanMarket && (
                    <TouchableOpacity
                      style={[styles.linkButton]}
                      onPress={() => {
                        onClose();
                        onNavigateToLoanMarket();
                      }}
                    >
                      <Text style={[styles.linkButtonText, { color: colors.primary }]}>
                        Go to Loan Market
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.closeButton, { backgroundColor: colors.surface }]}
                    onPress={onClose}
                  >
                    <Text style={[styles.closeButtonText, { color: colors.text }]}>
                      Close
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={confirmAction !== null}
        title={
          confirmAction?.type === 'accept'
            ? 'Accept Loan Offer?'
            : confirmAction?.type === 'reject'
              ? 'Reject Loan Offer?'
              : confirmAction?.type === 'recall'
                ? 'Recall Player?'
                : confirmAction?.type === 'list'
                  ? 'List for Loan?'
                  : 'Remove from Loan List?'
        }
        message={getConfirmMessage()}
        confirmText={
          confirmAction?.type === 'accept'
            ? 'Accept'
            : confirmAction?.type === 'reject'
              ? 'Reject'
              : confirmAction?.type === 'recall'
                ? 'Recall'
                : confirmAction?.type === 'list'
                  ? 'List'
                  : 'Remove'
        }
        confirmStyle={
          confirmAction?.type === 'reject' || confirmAction?.type === 'unlist'
            ? 'destructive'
            : 'default'
        }
        cancelText="Cancel"
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  scrollContent: {
    padding: spacing.md,
    maxHeight: 400,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  activeLoanCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  loanTeam: {
    fontSize: 16,
    fontWeight: '600',
  },
  weeksLeftBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  weeksLeftText: {
    fontSize: 12,
    fontWeight: '600',
  },
  termsSummary: {
    gap: spacing.xs,
  },
  termsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  termsLabel: {
    fontSize: 12,
  },
  termsValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  appearancesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  appearancesLabel: {
    fontSize: 11,
  },
  appearancesValue: {
    fontSize: 11,
    fontWeight: '600',
  },
  recallButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  offerCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  offerTeam: {
    fontSize: 14,
    fontWeight: '600',
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
  offerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  acceptButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  rejectButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
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
  emptySection: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  primaryButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  linkButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LoanOffersModal;
