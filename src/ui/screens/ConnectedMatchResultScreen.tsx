/**
 * Connected Match Result Screen
 *
 * Match result screen connected to GameContext for real match results.
 * Shows final score, quarter scores, and top performers from simulation.
 * Includes full box score view with all player stats.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';
import { useMatch } from '../hooks/useMatch';
import { useGame } from '../context/GameContext';

interface PlayerStat {
  id: string;
  name: string;
  points: number;
  rebounds: number;
  assists: number;
  minutes: number;
  fgMade: number;
  fgAttempts: number;
  fgPct: number;
  fg3Made: number;
  fg3Attempts: number;
  ftMade: number;
  ftAttempts: number;
  steals: number;
  blocks: number;
  turnovers: number;
  plusMinus: number;
  fouls: number;
}

interface ConnectedMatchResultScreenProps {
  matchId: string;
  onContinue?: () => void;
  onPlayerPress?: (playerId: string) => void;
}

/**
 * Format innings pitched in baseball notation (2.1 = 2 1/3 innings, 2.2 = 2 2/3 innings)
 * In baseball, the decimal represents thirds of an inning, not tenths
 * Raw values are stored as decimals: 1 out = 0.333, 2 outs = 0.667, 3 outs = 1.0
 */
function formatInningsPitched(ip: number): string {
  const whole = Math.floor(ip);
  const partial = ip - whole;

  // Use threshold-based conversion to handle floating point imprecision
  if (partial < 0.1) {
    return `${whole}.0`;
  } else if (partial < 0.4) {
    return `${whole}.1`;
  } else if (partial < 0.7) {
    return `${whole}.2`;
  } else {
    // 0.7+ means nearly a full inning, round up
    return `${whole + 1}.0`;
  }
}

export function ConnectedMatchResultScreen({
  matchId,
  onContinue,
  onPlayerPress,
}: ConnectedMatchResultScreenProps) {
  const colors = useColors();
  const { state } = useGame();
  const { match, matchData, isReady } = useMatch(matchId);
  const [showFullBoxScore, setShowFullBoxScore] = useState(false);
  const [showOpponentStats, setShowOpponentStats] = useState(false);

  // Get sport type
  const sport = match?.sport || 'basketball';

  // Extract data from match result
  const resultData = useMemo(() => {
    if (!match || !matchData || !match.result) return null;

    const { homeScore, awayScore, boxScore } = match.result;
    console.log('[ConnectedMatchResultScreen] Reading match.result - Score:', homeScore, '-', awayScore);

    // Extract quarter scores if available
    let quarterScores: [number, number][] = [];
    if (boxScore && typeof boxScore === 'object' && 'quarterScores' in boxScore) {
      quarterScores = boxScore.quarterScores as [number, number][];
    } else {
      // Generate approximate quarter scores if not available
      const homePerQ = Math.floor(homeScore / 4);
      const awayPerQ = Math.floor(awayScore / 4);
      // Build quarters one by one to correctly calculate Q4 remainder
      const q1Home = homePerQ + Math.floor(Math.random() * 6) - 3;
      const q1Away = awayPerQ + Math.floor(Math.random() * 6) - 3;
      const q2Home = homePerQ + Math.floor(Math.random() * 6) - 3;
      const q2Away = awayPerQ + Math.floor(Math.random() * 6) - 3;
      const q3Home = homePerQ + Math.floor(Math.random() * 6) - 3;
      const q3Away = awayPerQ + Math.floor(Math.random() * 6) - 3;
      const q4Home = homeScore - q1Home - q2Home - q3Home;
      const q4Away = awayScore - q1Away - q2Away - q3Away;
      quarterScores = [
        [q1Home, q1Away],
        [q2Home, q2Away],
        [q3Home, q3Away],
        [q4Home, q4Away],
      ];
    }

    // Extract all player stats from boxScore
    // BoxScore structure: { homePlayerStats: {name: stats}, awayPlayerStats: {name: stats}, minutesPlayed: {name: mins} }
    let allPlayerStats: PlayerStat[] = [];
    let opponentPlayerStats: PlayerStat[] = [];
    const isUserHome = match.homeTeamId === 'user';

    if (boxScore && typeof boxScore === 'object') {
      // Get stats for user's team
      const userStatsObj = isUserHome
        ? (boxScore as any).homePlayerStats
        : (boxScore as any).awayPlayerStats;
      // Get stats for opponent's team
      const opponentStatsObj = isUserHome
        ? (boxScore as any).awayPlayerStats
        : (boxScore as any).homePlayerStats;
      const minutesPlayedObj = (boxScore as any).minutesPlayed || {};

      // Get user roster for player IDs
      const userRoster = state.userTeam.rosterIds
        .map((id) => state.players[id])
        .filter(Boolean);

      // Get opponent team roster
      const opponentTeamId = isUserHome ? match.awayTeamId : match.homeTeamId;
      const opponentTeam = state.league.teams.find(t => t.id === opponentTeamId);
      const opponentRoster = opponentTeam?.rosterIds
        .map((id) => state.players[id])
        .filter(Boolean) || [];

      // Extract user team stats
      if (userStatsObj && typeof userStatsObj === 'object') {
        for (const player of userRoster) {
          if (player) {
            const stats = userStatsObj[player.name] as Record<string, number> | undefined;
            const minutes = minutesPlayedObj[player.name] || 0;

            if (stats) {
              allPlayerStats.push({
                id: player.id,
                name: player.name,
                points: stats.points || 0,
                rebounds: stats.rebounds || 0,
                assists: stats.assists || 0,
                minutes: Math.round(minutes),
                fgMade: stats.fgm || 0,
                fgAttempts: stats.fga || 0,
                fgPct: (stats.fga || 0) > 0 ? Math.round(((stats.fgm || 0) / (stats.fga || 1)) * 100) : 0,
                fg3Made: stats.fg3m || 0,
                fg3Attempts: stats.fg3a || 0,
                ftMade: stats.ftm || 0,
                ftAttempts: stats.fta || 0,
                steals: stats.steals || 0,
                blocks: stats.blocks || 0,
                turnovers: stats.turnovers || 0,
                plusMinus: stats.plusMinus || 0,
                fouls: stats.personalFouls || 0,
              });
            } else {
              // Player exists but no stats (didn't play or stats not tracked)
              allPlayerStats.push({
                id: player.id,
                name: player.name,
                points: 0,
                rebounds: 0,
                assists: 0,
                minutes: Math.round(minutes),
                fgMade: 0,
                fgAttempts: 0,
                fgPct: 0,
                fg3Made: 0,
                fg3Attempts: 0,
                ftMade: 0,
                ftAttempts: 0,
                steals: 0,
                blocks: 0,
                turnovers: 0,
                plusMinus: 0,
                fouls: 0,
              });
            }
          }
        }
      }

      // Extract opponent team stats
      if (opponentStatsObj && typeof opponentStatsObj === 'object') {
        for (const player of opponentRoster) {
          if (player) {
            const stats = opponentStatsObj[player.name] as Record<string, number> | undefined;
            const minutes = minutesPlayedObj[player.name] || 0;

            if (stats) {
              opponentPlayerStats.push({
                id: player.id,
                name: player.name,
                points: stats.points || 0,
                rebounds: stats.rebounds || 0,
                assists: stats.assists || 0,
                minutes: Math.round(minutes),
                fgMade: stats.fgm || 0,
                fgAttempts: stats.fga || 0,
                fgPct: (stats.fga || 0) > 0 ? Math.round(((stats.fgm || 0) / (stats.fga || 1)) * 100) : 0,
                fg3Made: stats.fg3m || 0,
                fg3Attempts: stats.fg3a || 0,
                ftMade: stats.ftm || 0,
                ftAttempts: stats.fta || 0,
                steals: stats.steals || 0,
                blocks: stats.blocks || 0,
                turnovers: stats.turnovers || 0,
                plusMinus: stats.plusMinus || 0,
                fouls: stats.personalFouls || 0,
              });
            } else {
              // Player exists but no stats (didn't play or stats not tracked)
              opponentPlayerStats.push({
                id: player.id,
                name: player.name,
                points: 0,
                rebounds: 0,
                assists: 0,
                minutes: Math.round(minutes),
                fgMade: 0,
                fgAttempts: 0,
                fgPct: 0,
                fg3Made: 0,
                fg3Attempts: 0,
                ftMade: 0,
                ftAttempts: 0,
                steals: 0,
                blocks: 0,
                turnovers: 0,
                plusMinus: 0,
                fouls: 0,
              });
            }
          }
        }
      }

      // Sort by minutes played (players who played most first)
      // Filter out players with 0 minutes (they didn't play)
      allPlayerStats = allPlayerStats
        .filter(p => p.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes);
      opponentPlayerStats = opponentPlayerStats
        .filter(p => p.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes);
    }

    // If no stats found at all, show roster with zeros
    if (allPlayerStats.length === 0) {
      const userRoster = state.userTeam.rosterIds
        .map((id) => state.players[id])
        .filter(Boolean);

      allPlayerStats = userRoster.map((player) => ({
        id: player?.id || 'unknown',
        name: player?.name || 'Unknown Player',
        points: 0,
        rebounds: 0,
        assists: 0,
        minutes: 0,
        fgMade: 0,
        fgAttempts: 0,
        fgPct: 0,
        fg3Made: 0,
        fg3Attempts: 0,
        ftMade: 0,
        ftAttempts: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        plusMinus: 0,
        fouls: 0,
      }));
    }

    // Top performers = top 3 by game score
    const topPerformers = [...allPlayerStats]
      .sort((a, b) => (b.points + b.rebounds / 2 + b.assists) - (a.points + a.rebounds / 2 + a.assists))
      .slice(0, 3);

    // Determine if user won (isUserHome already defined above)
    const userScore = isUserHome ? homeScore : awayScore;
    const opponentScore = isUserHome ? awayScore : homeScore;

    // Check for penalty shootout result (soccer only)
    const penaltyShootout = match.result.penaltyShootout;
    let isWin: boolean;

    if (penaltyShootout) {
      // Match went to penalties - determine winner from shootout
      const userPenaltyScore = isUserHome ? penaltyShootout.homeScore : penaltyShootout.awayScore;
      const opponentPenaltyScore = isUserHome ? penaltyShootout.awayScore : penaltyShootout.homeScore;
      isWin = userPenaltyScore > opponentPenaltyScore;
    } else {
      // Normal result
      isWin = userScore > opponentScore;
    }

    return {
      homeTeam: matchData.homeTeam.name,
      awayTeam: matchData.awayTeam.name,
      homeScore,
      awayScore,
      quarterScores,
      topPerformers,
      allPlayerStats,
      opponentPlayerStats,
      isWin,
      isUserHome,
      penaltyShootout,
    };
  }, [match, matchData, state.userTeam.rosterIds, state.players]);

  // Loading state
  if (!isReady || !matchData) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Loading result...
        </Text>
      </View>
    );
  }

  // Match not completed
  if (!match?.result) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Match not yet completed
        </Text>
        <TouchableOpacity
          style={[styles.backButton, { borderColor: colors.border }]}
          onPress={onContinue}
          activeOpacity={0.7}
        >
          <Text style={[styles.backButtonText, { color: colors.text }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!resultData) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Result data not available
        </Text>
      </View>
    );
  }

  const resultColor = resultData.isWin ? colors.success : colors.error;
  const resultText = resultData.isWin ? 'VICTORY' : 'DEFEAT';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Result Banner */}
      <View style={[styles.resultBanner, { backgroundColor: resultColor }]}>
        <Text style={styles.resultText}>{resultText}</Text>
      </View>

      {/* Final Score */}
      <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
        <Text style={[styles.cardTitle, { color: colors.textMuted }]}>FINAL SCORE</Text>

        {/* Team Names Row */}
        <View style={styles.teamNamesRow}>
          <View style={styles.teamNameColumn}>
            <View style={styles.teamNameContent}>
              <Text style={[styles.teamName, { color: colors.text }]}>{resultData.homeTeam}</Text>
              {sport === 'soccer' && (match?.result?.boxScore as any)?.redCards?.home > 0 && (
                <View style={[styles.redCardBadge, { backgroundColor: colors.error }]}>
                  <Text style={styles.redCardText}>
                    {(match?.result?.boxScore as any).redCards.home}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.teamNameColumn}>
            <View style={styles.teamNameContent}>
              <Text style={[styles.teamName, { color: colors.text }]}>{resultData.awayTeam}</Text>
              {sport === 'soccer' && (match?.result?.boxScore as any)?.redCards?.away > 0 && (
                <View style={[styles.redCardBadge, { backgroundColor: colors.error }]}>
                  <Text style={styles.redCardText}>
                    {(match?.result?.boxScore as any).redCards.away}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Scores Row - separate so they always align */}
        <View style={styles.scoresRow}>
          <View style={styles.scoreColumn}>
            <Text style={[styles.finalScore, { color: colors.text }]}>{resultData.homeScore}</Text>
          </View>
          <View style={styles.dashColumn}>
            <Text style={[styles.dash, { color: colors.textMuted }]}>-</Text>
          </View>
          <View style={styles.scoreColumn}>
            <Text style={[styles.finalScore, { color: colors.text }]}>{resultData.awayScore}</Text>
          </View>
        </View>

        {/* Goal Scorers - soccer only */}
        {sport === 'soccer' && (match?.result?.boxScore as any)?.events && (
          <View style={styles.scoreContainer}>
            <View style={styles.teamColumn}>
              <View style={styles.scorersList}>
                {(match?.result?.boxScore as any).events
                  .filter((e: any) => e.type === 'goal' && e.team === 'home')
                  .map((event: any, idx: number) => (
                    <Text key={idx} style={[styles.scorerText, { color: colors.textMuted }]}>
                      ⚽ {event.player?.name || 'Unknown'} {event.minute}'
                    </Text>
                  ))}
              </View>
            </View>
            <View style={{ width: 60 }} />
            <View style={styles.teamColumn}>
              <View style={styles.scorersList}>
                {(match?.result?.boxScore as any).events
                  .filter((e: any) => e.type === 'goal' && e.team === 'away')
                  .map((event: any, idx: number) => (
                    <Text key={idx} style={[styles.scorerText, { color: colors.textMuted }]}>
                      ⚽ {event.player?.name || 'Unknown'} {event.minute}'
                    </Text>
                  ))}
              </View>
            </View>
          </View>
        )}

        {/* Red Cards - soccer only */}
        {sport === 'soccer' && (match?.result?.boxScore as any)?.events?.some((e: any) => e.type === 'red_card') && (
          <View style={[styles.scoreContainer, { marginTop: spacing.sm }]}>
            <View style={styles.teamColumn}>
              <View style={styles.scorersList}>
                {(match?.result?.boxScore as any).events
                  .filter((e: any) => e.type === 'red_card' && e.team === 'home')
                  .map((event: any, idx: number) => {
                    const isSecondYellow = event.description?.includes('SECOND YELLOW');
                    return (
                      <Text key={idx} style={[styles.scorerText, { color: colors.error }]}>
                        {isSecondYellow ? '🟨🟨' : '🟥'} {event.player?.name || 'Unknown'} {event.minute}'
                      </Text>
                    );
                  })}
              </View>
            </View>
            <View style={{ width: 60 }} />
            <View style={styles.teamColumn}>
              <View style={styles.scorersList}>
                {(match?.result?.boxScore as any).events
                  .filter((e: any) => e.type === 'red_card' && e.team === 'away')
                  .map((event: any, idx: number) => {
                    const isSecondYellow = event.description?.includes('SECOND YELLOW');
                    return (
                      <Text key={idx} style={[styles.scorerText, { color: colors.error }]}>
                        {isSecondYellow ? '🟨🟨' : '🟥'} {event.player?.name || 'Unknown'} {event.minute}'
                      </Text>
                    );
                  })}
              </View>
            </View>
          </View>
        )}

        {/* Penalty Shootout Result - shown prominently if match went to penalties */}
        {sport === 'soccer' && resultData.penaltyShootout && (
          <View style={styles.penaltyResult}>
            <Text style={[styles.penaltyLabel, { color: colors.textMuted }]}>
              PENALTIES
            </Text>
            <View style={styles.penaltyScoreRow}>
              <Text style={[styles.penaltyScore, { color: colors.text }]}>
                {resultData.penaltyShootout.homeScore}
              </Text>
              <Text style={[styles.penaltyDash, { color: colors.textMuted }]}>-</Text>
              <Text style={[styles.penaltyScore, { color: colors.text }]}>
                {resultData.penaltyShootout.awayScore}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Basketball Quarter Scores */}
      {sport === 'basketball' && resultData.quarterScores.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
          <Text style={[styles.cardTitle, { color: colors.textMuted }]}>QUARTER SCORES</Text>

          <View style={styles.quarterTable}>
            <View style={styles.quarterRow}>
              <Text style={[styles.quarterHeaderTeam, { color: colors.textMuted }]}>Team</Text>
              {resultData.quarterScores.map((_, i) => (
                <Text key={i} style={[styles.quarterLabel, { color: colors.textMuted }]}>
                  Q{i + 1}
                </Text>
              ))}
              <Text style={[styles.quarterLabel, styles.quarterTotal, { color: colors.textMuted }]}>T</Text>
            </View>

            <View style={[styles.quarterRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Text style={[styles.quarterTeam, { color: colors.text }]} numberOfLines={1}>{resultData.homeTeam}</Text>
              {resultData.quarterScores.map(([home], i) => (
                <Text key={i} style={[styles.quarterScore, { color: colors.text }]}>
                  {home}
                </Text>
              ))}
              <Text style={[styles.quarterTotal, { color: colors.text }]}>{resultData.homeScore}</Text>
            </View>

            <View style={styles.quarterRow}>
              <Text style={[styles.quarterTeam, { color: colors.text }]} numberOfLines={1}>{resultData.awayTeam}</Text>
              {resultData.quarterScores.map(([, away], i) => (
                <Text key={i} style={[styles.quarterScore, { color: colors.text }]}>
                  {away}
                </Text>
              ))}
              <Text style={[styles.quarterTotal, { color: colors.text }]}>{resultData.awayScore}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Baseball Line Score */}
      {sport === 'baseball' && match?.result?.boxScore && (
        <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
          <Text style={[styles.cardTitle, { color: colors.textMuted }]}>LINE SCORE</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(() => {
              const boxScore = match.result.boxScore as any;
              // Use actual innings played based on runs-by-inning arrays
              const awayInnings = boxScore.awayRunsByInning || [];
              const homeInnings = boxScore.homeRunsByInning || [];
              const inningsPlayed = Math.max(awayInnings.length, homeInnings.length, 9);

              return (
                <View style={styles.lineScoreTable}>
                  {/* Inning headers */}
                  <View style={styles.lineScoreRow}>
                    <Text style={[styles.lineScoreTeamHeader, { color: colors.textMuted }]}>Team</Text>
                    {Array.from({ length: inningsPlayed }, (_, i) => (
                      <Text key={i} style={[styles.lineScoreInning, { color: colors.textMuted }]}>
                        {i + 1}
                      </Text>
                    ))}
                    <Text style={[styles.lineScoreSummary, { color: colors.textMuted }]}>R</Text>
                    <Text style={[styles.lineScoreSummary, { color: colors.textMuted }]}>H</Text>
                    <Text style={[styles.lineScoreSummary, { color: colors.textMuted }]}>E</Text>
                  </View>

                  {/* Away team */}
                  <View style={[styles.lineScoreRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <Text style={[styles.lineScoreTeam, { color: colors.text }]} numberOfLines={1}>{resultData.awayTeam}</Text>
                    {Array.from({ length: inningsPlayed }, (_, i) => (
                      <Text key={i} style={[styles.lineScoreInning, { color: colors.text }]}>
                        {awayInnings[i] !== undefined ? awayInnings[i] : '-'}
                      </Text>
                    ))}
                    <Text style={[styles.lineScoreSummary, styles.lineScoreSummaryBold, { color: colors.text }]}>{resultData.awayScore}</Text>
                    <Text style={[styles.lineScoreSummary, { color: colors.text }]}>{boxScore.awayHits || 0}</Text>
                    <Text style={[styles.lineScoreSummary, { color: colors.text }]}>{boxScore.awayErrors || 0}</Text>
                  </View>

                  {/* Home team */}
                  <View style={styles.lineScoreRow}>
                    <Text style={[styles.lineScoreTeam, { color: colors.text }]} numberOfLines={1}>{resultData.homeTeam}</Text>
                    {Array.from({ length: inningsPlayed }, (_, i) => (
                      <Text key={i} style={[styles.lineScoreInning, { color: colors.text }]}>
                        {homeInnings[i] !== undefined ? homeInnings[i] : (i === inningsPlayed - 1 && homeInnings.length < awayInnings.length ? 'X' : '-')}
                      </Text>
                    ))}
                    <Text style={[styles.lineScoreSummary, styles.lineScoreSummaryBold, { color: colors.text }]}>{resultData.homeScore}</Text>
                    <Text style={[styles.lineScoreSummary, { color: colors.text }]}>{boxScore.homeHits || 0}</Text>
                    <Text style={[styles.lineScoreSummary, { color: colors.text }]}>{boxScore.homeErrors || 0}</Text>
                  </View>
                </View>
              );
            })()}
          </ScrollView>

          {/* Game Summary - LOB, SB, etc */}
          {(() => {
            const boxScore = match.result.boxScore as any;
            const hasSummaryStats =
              (boxScore.homeLeftOnBase > 0 || boxScore.awayLeftOnBase > 0) ||
              (boxScore.homeStolenBases > 0 || boxScore.awayStolenBases > 0) ||
              (boxScore.homeWildPitches > 0 || boxScore.awayWildPitches > 0) ||
              (boxScore.homePassedBalls > 0 || boxScore.awayPassedBalls > 0);

            if (!hasSummaryStats) return null;

            return (
              <View style={[styles.boxScoreExtras, { borderTopColor: colors.border }]}>
                {(boxScore.homeLeftOnBase > 0 || boxScore.awayLeftOnBase > 0) && (
                  <Text style={[styles.boxScoreExtraLine, { color: colors.text }]}>
                    <Text style={{ fontWeight: '700' }}>LOB:</Text> {resultData.awayTeam} {boxScore.awayLeftOnBase || 0}, {resultData.homeTeam} {boxScore.homeLeftOnBase || 0}
                  </Text>
                )}
                {(boxScore.homeStolenBases > 0 || boxScore.awayStolenBases > 0) && (
                  <Text style={[styles.boxScoreExtraLine, { color: colors.text }]}>
                    <Text style={{ fontWeight: '700' }}>SB:</Text> {resultData.awayTeam} {boxScore.awayStolenBases || 0}, {resultData.homeTeam} {boxScore.homeStolenBases || 0}
                  </Text>
                )}
                {(boxScore.homeCaughtStealing > 0 || boxScore.awayCaughtStealing > 0) && (
                  <Text style={[styles.boxScoreExtraLine, { color: colors.text }]}>
                    <Text style={{ fontWeight: '700' }}>CS:</Text> {resultData.awayTeam} {boxScore.awayCaughtStealing || 0}, {resultData.homeTeam} {boxScore.homeCaughtStealing || 0}
                  </Text>
                )}
                {(boxScore.homeWildPitches > 0 || boxScore.awayWildPitches > 0) && (
                  <Text style={[styles.boxScoreExtraLine, { color: colors.text }]}>
                    <Text style={{ fontWeight: '700' }}>WP:</Text> {resultData.awayTeam} {boxScore.awayWildPitches || 0}, {resultData.homeTeam} {boxScore.homeWildPitches || 0}
                  </Text>
                )}
                {(boxScore.homePassedBalls > 0 || boxScore.awayPassedBalls > 0) && (
                  <Text style={[styles.boxScoreExtraLine, { color: colors.text }]}>
                    <Text style={{ fontWeight: '700' }}>PB:</Text> {resultData.awayTeam} {boxScore.awayPassedBalls || 0}, {resultData.homeTeam} {boxScore.homePassedBalls || 0}
                  </Text>
                )}
              </View>
            );
          })()}
        </View>
      )}

      {/* Soccer Match Stats */}
      {sport === 'soccer' && match?.result?.boxScore && (
        <>
          {/* Match Stats */}
          <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
            <Text style={[styles.cardTitle, { color: colors.textMuted }]}>MATCH STATS</Text>
            {/* Possession */}
            <View style={[styles.soccerStatsRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[styles.soccerStatValue, { color: colors.text }]}>{(match.result.boxScore as any).possession?.home || 50}%</Text>
              <Text style={[styles.soccerStatLabel, { color: colors.textMuted }]}>Possession</Text>
              <Text style={[styles.soccerStatValue, { color: colors.text }]}>{(match.result.boxScore as any).possession?.away || 50}%</Text>
            </View>
            {/* Shots */}
            <View style={[styles.soccerStatsRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[styles.soccerStatValue, { color: colors.text }]}>{(match.result.boxScore as any).shots?.home || 0}</Text>
              <Text style={[styles.soccerStatLabel, { color: colors.textMuted }]}>Shots</Text>
              <Text style={[styles.soccerStatValue, { color: colors.text }]}>{(match.result.boxScore as any).shots?.away || 0}</Text>
            </View>
            {/* Shots on Target */}
            <View style={[styles.soccerStatsRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[styles.soccerStatValue, { color: colors.text }]}>{(match.result.boxScore as any).shotsOnTarget?.home || 0}</Text>
              <Text style={[styles.soccerStatLabel, { color: colors.textMuted }]}>On Target</Text>
              <Text style={[styles.soccerStatValue, { color: colors.text }]}>{(match.result.boxScore as any).shotsOnTarget?.away || 0}</Text>
            </View>
            {/* Corners */}
            <View style={[styles.soccerStatsRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[styles.soccerStatValue, { color: colors.text }]}>{(match.result.boxScore as any).corners?.home || 0}</Text>
              <Text style={[styles.soccerStatLabel, { color: colors.textMuted }]}>Corners</Text>
              <Text style={[styles.soccerStatValue, { color: colors.text }]}>{(match.result.boxScore as any).corners?.away || 0}</Text>
            </View>
            {/* Fouls */}
            <View style={[styles.soccerStatsRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[styles.soccerStatValue, { color: colors.text }]}>{(match.result.boxScore as any).fouls?.home || 0}</Text>
              <Text style={[styles.soccerStatLabel, { color: colors.textMuted }]}>Fouls</Text>
              <Text style={[styles.soccerStatValue, { color: colors.text }]}>{(match.result.boxScore as any).fouls?.away || 0}</Text>
            </View>
            {/* Yellow Cards */}
            <View style={[styles.soccerStatsRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[styles.soccerStatValue, { color: colors.warning }]}>{(match.result.boxScore as any).yellowCards?.home || 0}</Text>
              <Text style={[styles.soccerStatLabel, { color: colors.textMuted }]}>Yellow Cards</Text>
              <Text style={[styles.soccerStatValue, { color: colors.warning }]}>{(match.result.boxScore as any).yellowCards?.away || 0}</Text>
            </View>
            {/* Red Cards - only show if any */}
            {((match.result.boxScore as any).redCards?.home > 0 || (match.result.boxScore as any).redCards?.away > 0) && (
              <View style={styles.soccerStatsRow}>
                <Text style={[styles.soccerStatValue, { color: colors.error }]}>{(match.result.boxScore as any).redCards?.home || 0}</Text>
                <Text style={[styles.soccerStatLabel, { color: colors.textMuted }]}>Red Cards</Text>
                <Text style={[styles.soccerStatValue, { color: colors.error }]}>{(match.result.boxScore as any).redCards?.away || 0}</Text>
              </View>
            )}
          </View>

          {/* Full Match Timeline */}
          {(match.result.boxScore as any).events && (match.result.boxScore as any).events.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
              <Text style={[styles.cardTitle, { color: colors.textMuted }]}>MATCH TIMELINE</Text>
              <ScrollView style={{ maxHeight: 400 }} nestedScrollEnabled>
                {(match.result.boxScore as any).events.map((event: any, index: number) => {
                  // Determine event icon/color
                  let eventColor = colors.text;
                  let eventIcon = '';
                  if (event.type === 'goal') {
                    eventColor = colors.success;
                    eventIcon = '\u26BD '; // Soccer ball
                  } else if (event.type === 'yellow_card') {
                    eventColor = colors.warning;
                    eventIcon = '\uD83D\uDFE8 '; // Yellow square
                  } else if (event.type === 'red_card') {
                    eventColor = colors.error;
                    eventIcon = '\uD83D\uDFE5 '; // Red square
                  } else if (event.type === 'substitution') {
                    eventColor = colors.info || colors.primary;
                    eventIcon = '\u21C4 '; // Arrows for substitution
                  } else if (event.type === 'penalty_scored') {
                    eventColor = colors.success;
                    eventIcon = '\u26BD '; // Soccer ball for penalty goal
                  } else if (event.type === 'penalty_saved' || event.type === 'penalty_missed') {
                    eventColor = colors.error;
                    eventIcon = '\u274C '; // X for missed/saved penalty
                  } else if (event.type === 'shot_saved') {
                    eventColor = colors.info || colors.primary;
                  } else if (event.type === 'half_time' || event.type === 'full_time') {
                    eventColor = colors.textMuted;
                  }

                  // Get team indicator - only for events that have a team
                  const hasTeam = event.team === 'home' || event.team === 'away';
                  const teamName = event.team === 'home' ? resultData.homeTeam : resultData.awayTeam;
                  // Get short team name (first 3 chars or abbreviation)
                  const teamAbbr = teamName.length > 3 ? teamName.substring(0, 3).toUpperCase() : teamName.toUpperCase();

                  return (
                    <View
                      key={index}
                      style={[
                        styles.timelineRow,
                        index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.timelineMinute, { color: colors.textMuted }]}>
                        {event.minute}'
                      </Text>
                      {hasTeam && (
                        <View style={[
                          styles.timelineTeamBadge,
                          { backgroundColor: event.team === 'home' ? colors.primary : colors.textMuted }
                        ]}>
                          <Text style={styles.timelineTeamText}>{teamAbbr}</Text>
                        </View>
                      )}
                      <Text style={[styles.timelineDescription, { color: eventColor }]}>
                        {eventIcon}{event.description}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </>
      )}

      {/* Top Performers - Basketball only for now */}
      {sport === 'basketball' && resultData.topPerformers.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
          <Text style={[styles.cardTitle, { color: colors.textMuted }]}>TOP PERFORMERS</Text>

          {resultData.topPerformers.map((player, index) => (
            <TouchableOpacity
              key={player.id}
              style={[
                styles.performerRow,
                index < resultData.topPerformers.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
              onPress={() => onPlayerPress?.(player.id)}
              activeOpacity={onPlayerPress ? 0.7 : 1}
            >
              <View style={styles.performerInfo}>
                <View style={[styles.rankBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <Text style={[styles.performerName, { color: onPlayerPress ? colors.primary : colors.text }]}>
                  {player.name}
                </Text>
              </View>

              <View style={styles.performerStats}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{player.points}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>PTS</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{player.rebounds}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>REB</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{player.assists}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>AST</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Full Box Score Toggle - Basketball and Baseball */}
      {(sport === 'basketball' || sport === 'baseball') && (
        <TouchableOpacity
          style={[styles.boxScoreToggle, { backgroundColor: colors.card }, shadows.sm]}
          onPress={() => setShowFullBoxScore(!showFullBoxScore)}
          activeOpacity={0.8}
        >
          <Text style={[styles.boxScoreToggleText, { color: colors.text }]}>
            {showFullBoxScore ? 'Hide Full Box Score' : 'Show Full Box Score'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Full Box Score - Basketball */}
      {sport === 'basketball' && showFullBoxScore && resultData.allPlayerStats.length > 0 && (
        <>
          {/* Team Toggle */}
          <View style={[styles.teamToggleContainer, { backgroundColor: colors.card }, shadows.sm]}>
            <TouchableOpacity
              style={[
                styles.teamToggleButton,
                !showOpponentStats && { backgroundColor: colors.primary },
              ]}
              onPress={() => setShowOpponentStats(false)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.teamToggleText,
                { color: showOpponentStats ? colors.text : '#fff' },
              ]}>
                {resultData.isUserHome ? resultData.homeTeam : resultData.awayTeam}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.teamToggleButton,
                showOpponentStats && { backgroundColor: colors.primary },
              ]}
              onPress={() => setShowOpponentStats(true)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.teamToggleText,
                { color: showOpponentStats ? '#fff' : colors.text },
              ]}>
                {resultData.isUserHome ? resultData.awayTeam : resultData.homeTeam}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
            <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
              {showOpponentStats
                ? (resultData.isUserHome ? resultData.awayTeam : resultData.homeTeam)
                : (resultData.isUserHome ? resultData.homeTeam : resultData.awayTeam)} BOX SCORE
            </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              {/* Header Row */}
              <View style={[styles.boxScoreHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.boxScorePlayerHeader, { color: colors.textMuted }]}>PLAYER</Text>
                <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>MIN</Text>
                <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>PTS</Text>
                <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>REB</Text>
                <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>AST</Text>
                <Text style={[styles.boxScoreStatHeaderWide, { color: colors.textMuted }]}>FG</Text>
                <Text style={[styles.boxScoreStatHeaderWide, { color: colors.textMuted }]}>3P</Text>
                <Text style={[styles.boxScoreStatHeaderWide, { color: colors.textMuted }]}>FT</Text>
                <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>STL</Text>
                <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>BLK</Text>
                <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>TO</Text>
                <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>PF</Text>
                <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>+/-</Text>
              </View>

              {/* Player Rows */}
              {(showOpponentStats ? resultData.opponentPlayerStats : resultData.allPlayerStats).map((player, index, arr) => (
                <TouchableOpacity
                  key={player.id}
                  style={[
                    styles.boxScoreRow,
                    index < arr.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    },
                  ]}
                  onPress={() => onPlayerPress?.(player.id)}
                  activeOpacity={onPlayerPress ? 0.7 : 1}
                >
                  <Text
                    style={[styles.boxScorePlayer, { color: onPlayerPress ? colors.primary : colors.text }]}
                    numberOfLines={1}
                  >
                    {player.name}
                  </Text>
                  <Text style={[styles.boxScoreStat, { color: colors.text }]}>{player.minutes}</Text>
                  <Text style={[styles.boxScoreStat, { color: colors.text, fontWeight: '700' }]}>{player.points}</Text>
                  <Text style={[styles.boxScoreStat, { color: colors.text }]}>{player.rebounds}</Text>
                  <Text style={[styles.boxScoreStat, { color: colors.text }]}>{player.assists}</Text>
                  <Text style={[styles.boxScoreStatWide, { color: colors.text }]}>
                    {player.fgMade}-{player.fgAttempts}
                  </Text>
                  <Text style={[styles.boxScoreStatWide, { color: colors.text }]}>
                    {player.fg3Made}-{player.fg3Attempts}
                  </Text>
                  <Text style={[styles.boxScoreStatWide, { color: colors.text }]}>
                    {player.ftMade}-{player.ftAttempts}
                  </Text>
                  <Text style={[styles.boxScoreStat, { color: colors.text }]}>{player.steals}</Text>
                  <Text style={[styles.boxScoreStat, { color: colors.text }]}>{player.blocks}</Text>
                  <Text style={[styles.boxScoreStat, { color: colors.text }]}>{player.turnovers}</Text>
                  <Text style={[styles.boxScoreStat, { color: player.fouls >= 6 ? colors.error : colors.text }]}>
                    {player.fouls}
                  </Text>
                  <Text style={[styles.boxScoreStat, { color: player.plusMinus >= 0 ? colors.success : colors.error }]}>
                    {player.plusMinus > 0 ? '+' : ''}{player.plusMinus}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          </View>
        </>
      )}

      {/* Full Box Score - Baseball */}
      {sport === 'baseball' && showFullBoxScore && match?.result?.boxScore && (
        <>
          {/* Team Toggle */}
          <View style={[styles.teamToggleContainer, { backgroundColor: colors.card }, shadows.sm]}>
            <TouchableOpacity
              style={[
                styles.teamToggleButton,
                !showOpponentStats && { backgroundColor: colors.primary },
              ]}
              onPress={() => setShowOpponentStats(false)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.teamToggleText,
                { color: showOpponentStats ? colors.text : '#fff' },
              ]}>
                {resultData.isUserHome ? resultData.homeTeam : resultData.awayTeam}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.teamToggleButton,
                showOpponentStats && { backgroundColor: colors.primary },
              ]}
              onPress={() => setShowOpponentStats(true)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.teamToggleText,
                { color: showOpponentStats ? '#fff' : colors.text },
              ]}>
                {resultData.isUserHome ? resultData.awayTeam : resultData.homeTeam}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Selected Team Batting */}
          <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
            <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
              {showOpponentStats
                ? (resultData.isUserHome ? resultData.awayTeam : resultData.homeTeam)
                : (resultData.isUserHome ? resultData.homeTeam : resultData.awayTeam)} BATTING
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View>
                {/* Header Row - simplified: AB, R, H, RBI, BB, BA */}
                <View style={[styles.boxScoreHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.boxScorePlayerHeader, { color: colors.textMuted }]}>BATTER</Text>
                  <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>AB</Text>
                  <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>R</Text>
                  <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>H</Text>
                  <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>RBI</Text>
                  <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>BB</Text>
                  <Text style={[styles.boxScoreStatHeaderWide, { color: colors.textMuted }]}>BA</Text>
                </View>

                {/* Batter Rows */}
                {Object.entries(
                  (() => {
                    const showHome = showOpponentStats ? !resultData.isUserHome : resultData.isUserHome;
                    return showHome
                      ? (match.result?.boxScore as any)?.homeBatting
                      : (match.result?.boxScore as any)?.awayBatting;
                  })() || {}
                ).map(([playerId, stats]: [string, any], index, arr) => {
                  // Get position from box score
                  const showHome = showOpponentStats ? !resultData.isUserHome : resultData.isUserHome;
                  const positions = showHome
                    ? (match.result?.boxScore as any)?.homePositions
                    : (match.result?.boxScore as any)?.awayPositions;
                  const position = positions?.[playerId] || '';

                  // For opponent players, look up name from opponent team
                  let playerName = state.players[playerId]?.name;
                  if (!playerName && showOpponentStats) {
                    const opponentTeamId = resultData.isUserHome ? match.awayTeamId : match.homeTeamId;
                    const opponentTeam = state.league.teams.find(t => t.id === opponentTeamId);
                    const opponentPlayer = opponentTeam?.rosterIds
                      .map(id => state.players[id])
                      .find(p => p?.id === playerId);
                    playerName = opponentPlayer?.name;
                  }
                  playerName = playerName || 'Unknown';
                  // Format: "SS J. Smith" or just "J. Smith" if no position
                  const displayName = position ? `${position} ${playerName}` : playerName;
                  return (
                    <TouchableOpacity
                      key={playerId}
                      style={[
                        styles.boxScoreRow,
                        index < arr.length - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        },
                      ]}
                      onPress={() => onPlayerPress?.(playerId)}
                      activeOpacity={onPlayerPress ? 0.7 : 1}
                    >
                      <Text style={[styles.boxScorePlayer, { color: onPlayerPress ? colors.primary : colors.text }]} numberOfLines={1}>
                        {displayName}
                      </Text>
                      <Text style={[styles.boxScoreStat, { color: colors.text }]}>{stats.atBats || 0}</Text>
                      <Text style={[styles.boxScoreStat, { color: colors.text }]}>{stats.runs || 0}</Text>
                      <Text style={[styles.boxScoreStat, { color: colors.text, fontWeight: '700' }]}>{stats.hits || 0}</Text>
                      <Text style={[styles.boxScoreStat, { color: colors.text }]}>{stats.rbi || 0}</Text>
                      <Text style={[styles.boxScoreStat, { color: colors.text }]}>{stats.walks || 0}</Text>
                      <Text style={[styles.boxScoreStatWide, { color: colors.text }]}>
                        {stats.atBats > 0 ? (stats.hits / stats.atBats).toFixed(3).slice(1) : '.000'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Batting Extras - plain text section */}
            {(() => {
              const showHome = showOpponentStats ? !resultData.isUserHome : resultData.isUserHome;
              const batting = showHome
                ? (match.result?.boxScore as any)?.homeBatting
                : (match.result?.boxScore as any)?.awayBatting;
              const errorsByFielder = showHome
                ? (match.result?.boxScore as any)?.homeErrorsByFielder
                : (match.result?.boxScore as any)?.awayErrorsByFielder;

              if (!batting) return null;

              // Helper to get player name
              const getPlayerName = (playerId: string): string => {
                let name = state.players[playerId]?.name;
                if (!name && showOpponentStats) {
                  const opponentTeamId = resultData.isUserHome ? match.awayTeamId : match.homeTeamId;
                  const opponentTeam = state.league.teams.find(t => t.id === opponentTeamId);
                  name = opponentTeam?.rosterIds
                    .map(id => state.players[id])
                    .find(p => p?.id === playerId)?.name;
                }
                return name || 'Unknown';
              };

              // Collect extra stats
              const doubles: string[] = [];
              const triples: string[] = [];
              const homeRuns: string[] = [];
              const rbis: string[] = [];
              const totalBasesData: Array<{ name: string; tb: number }> = [];
              const stolenBases: string[] = [];
              const caughtStealing: string[] = [];
              const gidp: string[] = [];
              const sacFlies: string[] = [];

              Object.entries(batting).forEach(([playerId, stats]: [string, any]) => {
                const name = getPlayerName(playerId);
                if (stats.doubles > 0) {
                  doubles.push(stats.doubles > 1 ? `${name} ${stats.doubles}` : name);
                }
                if (stats.triples > 0) {
                  triples.push(stats.triples > 1 ? `${name} ${stats.triples}` : name);
                }
                if (stats.homeRuns > 0) {
                  homeRuns.push(stats.homeRuns > 1 ? `${name} ${stats.homeRuns}` : name);
                }
                if (stats.rbi > 0) {
                  rbis.push(`${name} (${stats.rbi})`);
                }
                // Total bases: 1B=1, 2B=2, 3B=3, HR=4
                const singles = (stats.hits || 0) - (stats.doubles || 0) - (stats.triples || 0) - (stats.homeRuns || 0);
                const tb = singles + (stats.doubles || 0) * 2 + (stats.triples || 0) * 3 + (stats.homeRuns || 0) * 4;
                if (tb > 0) {
                  totalBasesData.push({ name, tb });
                }
                if (stats.stolenBases > 0) {
                  stolenBases.push(stats.stolenBases > 1 ? `${name} (${stats.stolenBases})` : name);
                }
                if (stats.caughtStealing > 0) {
                  caughtStealing.push(stats.caughtStealing > 1 ? `${name} (${stats.caughtStealing})` : name);
                }
                if (stats.gidp > 0) {
                  gidp.push(stats.gidp > 1 ? `${name} (${stats.gidp})` : name);
                }
                if (stats.sacrificeFlies > 0) {
                  sacFlies.push(stats.sacrificeFlies > 1 ? `${name} (${stats.sacrificeFlies})` : name);
                }
              });

              // Collect errors
              const errors: string[] = [];
              if (errorsByFielder) {
                Object.entries(errorsByFielder).forEach(([playerId, count]: [string, any]) => {
                  if (count > 0) {
                    const name = getPlayerName(playerId);
                    errors.push(count > 1 ? `${name} (${count})` : name);
                  }
                });
              }

              const hasExtras = doubles.length > 0 || triples.length > 0 || homeRuns.length > 0 ||
                rbis.length > 0 || stolenBases.length > 0 || caughtStealing.length > 0 ||
                gidp.length > 0 || sacFlies.length > 0 || errors.length > 0;

              if (!hasExtras) return null;

              return (
                <View style={[styles.boxScoreExtras, { borderTopColor: colors.border }]}>
                  {/* Batting */}
                  {doubles.length > 0 && (
                    <Text style={[styles.boxScoreExtraLine, { color: colors.text }]}>
                      <Text style={{ fontWeight: '700' }}>2B:</Text> {doubles.join(', ')}
                    </Text>
                  )}
                  {triples.length > 0 && (
                    <Text style={[styles.boxScoreExtraLine, { color: colors.text }]}>
                      <Text style={{ fontWeight: '700' }}>3B:</Text> {triples.join(', ')}
                    </Text>
                  )}
                  {homeRuns.length > 0 && (
                    <Text style={[styles.boxScoreExtraLine, { color: colors.text }]}>
                      <Text style={{ fontWeight: '700' }}>HR:</Text> {homeRuns.join(', ')}
                    </Text>
                  )}
                  {totalBasesData.length > 0 && (
                    <Text style={[styles.boxScoreExtraLine, { color: colors.text }]}>
                      <Text style={{ fontWeight: '700' }}>TB:</Text> {totalBasesData
                        .sort((a, b) => b.tb - a.tb)
                        .map(({ name, tb }) => `${name} ${tb}`)
                        .join('; ')}
                    </Text>
                  )}
                  {rbis.length > 0 && (
                    <Text style={[styles.boxScoreExtraLine, { color: colors.text }]}>
                      <Text style={{ fontWeight: '700' }}>RBI:</Text> {rbis.join(', ')}
                    </Text>
                  )}
                  {/* Baserunning */}
                  {stolenBases.length > 0 && (
                    <Text style={[styles.boxScoreExtraLine, { color: colors.text }]}>
                      <Text style={{ fontWeight: '700' }}>SB:</Text> {stolenBases.join(', ')}
                    </Text>
                  )}
                  {caughtStealing.length > 0 && (
                    <Text style={[styles.boxScoreExtraLine, { color: colors.text }]}>
                      <Text style={{ fontWeight: '700' }}>CS:</Text> {caughtStealing.join(', ')}
                    </Text>
                  )}
                  {sacFlies.length > 0 && (
                    <Text style={[styles.boxScoreExtraLine, { color: colors.text }]}>
                      <Text style={{ fontWeight: '700' }}>SF:</Text> {sacFlies.join(', ')}
                    </Text>
                  )}
                  {gidp.length > 0 && (
                    <Text style={[styles.boxScoreExtraLine, { color: colors.text }]}>
                      <Text style={{ fontWeight: '700' }}>GIDP:</Text> {gidp.join(', ')}
                    </Text>
                  )}
                  {/* Fielding */}
                  {errors.length > 0 && (
                    <Text style={[styles.boxScoreExtraLine, { color: colors.text }]}>
                      <Text style={{ fontWeight: '700' }}>E:</Text> {errors.join('; ')}
                    </Text>
                  )}
                </View>
              );
            })()}
          </View>

          {/* Selected Team Pitching */}
          <View style={[styles.card, { backgroundColor: colors.card }, shadows.md]}>
            <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
              {showOpponentStats
                ? (resultData.isUserHome ? resultData.awayTeam : resultData.homeTeam)
                : (resultData.isUserHome ? resultData.homeTeam : resultData.awayTeam)} PITCHING
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View>
                {/* Header Row - IP, H, R, ER, BB, SO, HR, ERA */}
                <View style={[styles.boxScoreHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.boxScorePlayerHeader, { color: colors.textMuted }]}>PITCHER</Text>
                  <Text style={[styles.boxScoreStatHeaderWide, { color: colors.textMuted }]}>IP</Text>
                  <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>H</Text>
                  <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>R</Text>
                  <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>ER</Text>
                  <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>BB</Text>
                  <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>SO</Text>
                  <Text style={[styles.boxScoreStatHeader, { color: colors.textMuted }]}>HR</Text>
                  <Text style={[styles.boxScoreStatHeaderWide, { color: colors.textMuted }]}>ERA</Text>
                </View>

                {/* Pitcher Rows */}
                {Object.entries(
                  (() => {
                    const showHome = showOpponentStats ? !resultData.isUserHome : resultData.isUserHome;
                    return showHome
                      ? (match.result.boxScore as any).homePitching
                      : (match.result.boxScore as any).awayPitching;
                  })() || {}
                ).map(([playerId, stats]: [string, any], index, arr) => {
                  // For opponent players, look up name from opponent team
                  let playerName = state.players[playerId]?.name;
                  if (!playerName && showOpponentStats) {
                    const opponentTeamId = resultData.isUserHome ? match.awayTeamId : match.homeTeamId;
                    const opponentTeam = state.league.teams.find(t => t.id === opponentTeamId);
                    const opponentPlayer = opponentTeam?.rosterIds
                      .map(id => state.players[id])
                      .find(p => p?.id === playerId);
                    playerName = opponentPlayer?.name;
                  }
                  playerName = playerName || 'Unknown';
                  // Show decision if any (W, L, S, H)
                  const decision = stats.decision ? ` (${stats.decision})` : '';
                  const displayName = `${playerName}${decision}`;
                  return (
                    <TouchableOpacity
                      key={playerId}
                      style={[
                        styles.boxScoreRow,
                        index < arr.length - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        },
                      ]}
                      onPress={() => onPlayerPress?.(playerId)}
                      activeOpacity={onPlayerPress ? 0.7 : 1}
                    >
                      <Text style={[styles.boxScorePlayer, { color: onPlayerPress ? colors.primary : colors.text }]} numberOfLines={1}>
                        {displayName}
                      </Text>
                      <Text style={[styles.boxScoreStatWide, { color: colors.text }]}>
                        {formatInningsPitched(stats.inningsPitched || 0)}
                      </Text>
                      <Text style={[styles.boxScoreStat, { color: colors.text }]}>{stats.hits || 0}</Text>
                      <Text style={[styles.boxScoreStat, { color: colors.text }]}>{stats.runs || 0}</Text>
                      <Text style={[styles.boxScoreStat, { color: colors.text }]}>{stats.earnedRuns || 0}</Text>
                      <Text style={[styles.boxScoreStat, { color: colors.text }]}>{stats.walks || 0}</Text>
                      <Text style={[styles.boxScoreStat, { color: colors.text, fontWeight: '700' }]}>{stats.strikeouts || 0}</Text>
                      <Text style={[styles.boxScoreStat, { color: colors.text }]}>{stats.homeRuns || 0}</Text>
                      <Text style={[styles.boxScoreStatWide, { color: colors.text }]}>
                        {stats.inningsPitched > 0
                          ? ((stats.earnedRuns || 0) * 9 / stats.inningsPitched).toFixed(2)
                          : '0.00'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Pitching Extras - plain text section */}
            {(() => {
              const showHome = showOpponentStats ? !resultData.isUserHome : resultData.isUserHome;
              const pitching = showHome
                ? (match.result?.boxScore as any)?.homePitching
                : (match.result?.boxScore as any)?.awayPitching;

              if (!pitching) return null;

              // Helper to get player name
              const getPlayerName = (playerId: string): string => {
                let name = state.players[playerId]?.name;
                if (!name && showOpponentStats) {
                  const opponentTeamId = resultData.isUserHome ? match.awayTeamId : match.homeTeamId;
                  const opponentTeam = state.league.teams.find(t => t.id === opponentTeamId);
                  name = opponentTeam?.rosterIds
                    .map(id => state.players[id])
                    .find(p => p?.id === playerId)?.name;
                }
                return name || 'Unknown';
              };

              // Collect pitching extras
              const wildPitches: string[] = [];
              const intentionalWalks: string[] = [];

              Object.entries(pitching).forEach(([playerId, stats]: [string, any]) => {
                const name = getPlayerName(playerId);
                if (stats.wildPitches > 0) {
                  wildPitches.push(stats.wildPitches > 1 ? `${name} (${stats.wildPitches})` : name);
                }
                if (stats.intentionalWalks > 0) {
                  intentionalWalks.push(stats.intentionalWalks > 1 ? `${name} (${stats.intentionalWalks})` : name);
                }
              });

              const hasExtras = wildPitches.length > 0 || intentionalWalks.length > 0;

              if (!hasExtras) return null;

              return (
                <View style={[styles.boxScoreExtras, { borderTopColor: colors.border }]}>
                  {wildPitches.length > 0 && (
                    <Text style={[styles.boxScoreExtraLine, { color: colors.text }]}>
                      <Text style={{ fontWeight: '700' }}>WP:</Text> {wildPitches.join(', ')}
                    </Text>
                  )}
                  {intentionalWalks.length > 0 && (
                    <Text style={[styles.boxScoreExtraLine, { color: colors.text }]}>
                      <Text style={{ fontWeight: '700' }}>IBB:</Text> {intentionalWalks.join(', ')}
                    </Text>
                  )}
                </View>
              );
            })()}
          </View>
        </>
      )}

      {/* Continue Button */}
      <TouchableOpacity
        style={[styles.continueButton, { backgroundColor: colors.primary }]}
        onPress={onContinue}
        activeOpacity={0.8}
      >
        <Text style={[styles.continueText, { color: colors.textInverse }]}>
          Continue
        </Text>
      </TouchableOpacity>
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
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
  },
  emptyText: {
    fontSize: 16,
    fontStyle: 'italic',
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
  resultBanner: {
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  resultText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
  },
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  teamNamesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  teamNameColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 44,
  },
  teamNameContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  scoresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreColumn: {
    flex: 1,
    alignItems: 'center',
  },
  teamColumn: {
    flex: 1,
    alignItems: 'center',
  },
  dashColumn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  teamNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  redCardBadge: {
    width: 16,
    height: 20,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redCardText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  finalScore: {
    fontSize: 48,
    fontWeight: '800',
  },
  scorersList: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  scorerText: {
    fontSize: 12,
    lineHeight: 18,
  },
  penaltyResult: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  penaltyLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  penaltyScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  penaltyScore: {
    fontSize: 24,
    fontWeight: '700',
  },
  penaltyDash: {
    fontSize: 20,
    fontWeight: '300',
  },
  dash: {
    fontSize: 32,
    fontWeight: '300',
    marginHorizontal: spacing.md,
  },
  quarterTable: {
    gap: 0,
    alignItems: 'center',
  },
  quarterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  quarterHeaderTeam: {
    width: 80,
    fontSize: 12,
    fontWeight: '600',
  },
  quarterLabel: {
    width: 36,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  quarterTeam: {
    width: 80,
    fontSize: 14,
    fontWeight: '500',
  },
  quarterScore: {
    width: 36,
    fontSize: 14,
    textAlign: 'center',
  },
  quarterTotal: {
    width: 44,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Baseball line score styles - monospace-like alignment
  lineScoreTable: {
    gap: 0,
  },
  lineScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  lineScoreTeamHeader: {
    width: 70,
    fontSize: 11,
    fontWeight: '600',
    paddingRight: spacing.sm,
  },
  lineScoreTeam: {
    width: 70,
    fontSize: 12,
    fontWeight: '500',
    paddingRight: spacing.sm,
  },
  lineScoreInning: {
    width: 22,
    fontSize: 12,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  lineScoreSummary: {
    width: 28,
    fontSize: 12,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginLeft: spacing.xs,
  },
  lineScoreSummaryBold: {
    fontWeight: '700',
  },
  performerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  performerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rankText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  performerName: {
    fontSize: 14,
    fontWeight: '500',
  },
  performerStats: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  continueButton: {
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
  },
  boxScoreToggle: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  boxScoreToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  boxScoreHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    marginBottom: spacing.xs,
  },
  boxScorePlayerHeader: {
    width: 120,
    fontSize: 10,
    fontWeight: '600',
  },
  boxScoreStatHeader: {
    width: 32,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  boxScoreStatHeaderWide: {
    width: 44,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  boxScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  boxScorePlayer: {
    width: 120,
    fontSize: 12,
    fontWeight: '500',
  },
  boxScoreStat: {
    width: 32,
    fontSize: 12,
    textAlign: 'center',
  },
  boxScoreStatWide: {
    width: 44,
    fontSize: 12,
    textAlign: 'center',
  },
  boxScoreSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  errorPlayerName: {
    fontSize: 13,
    flex: 1,
  },
  errorCount: {
    fontSize: 13,
    fontWeight: '700',
  },
  teamToggleContainer: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  teamToggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  teamToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  boxScoreExtras: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  boxScoreExtraLine: {
    fontSize: 12,
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
  // Soccer-specific styles
  soccerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  soccerStatValue: {
    width: 50,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  soccerStatLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Match timeline styles
  timelineRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  timelineMinute: {
    width: 36,
    fontSize: 12,
    fontWeight: '600',
  },
  timelineTeamBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: spacing.sm,
    minWidth: 32,
    alignItems: 'center',
  },
  timelineTeamText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timelineDescription: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});

export default ConnectedMatchResultScreen;
