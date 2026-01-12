/**
 * New Game Screen (Onboarding)
 *
 * New game setup flow:
 * - Country selection
 * - City selection (determines starting division)
 * - Team name (auto-generated or custom)
 * - Team colors selection
 * - Difficulty selection
 * - Start game
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
} from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '../theme';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import {
  type CountryCode,
  COUNTRY_CONFIGS,
  getAvailableCountries,
  getCitiesByDivision,
  getCityDivision,
  getDivisionDescription,
  type CityData,
} from '../../data/countries';
import { generateTeamName } from '../../data/teamNameGenerator';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface NewGameConfig {
  teamName: string;
  primaryColor: string;
  secondaryColor: string;
  difficulty: Difficulty;
  country: CountryCode;
  city: string;
  cityRegion?: string;
  startingDivision: number;
}

interface NewGameScreenProps {
  onStartGame?: (config: NewGameConfig) => void;
  onLoadGame?: () => void;
  hasSavedGame?: boolean;
}

const colorOptions = [
  { name: 'Black', value: '#000000' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Navy', value: '#1E3A5F' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Gold', value: '#F59E0B' },
  { name: 'Gray', value: '#6B7280' },
];

const difficultyOptions: { key: Difficulty; label: string; description: string }[] = [
  { key: 'easy', label: 'Easy', description: 'More forgiving, perfect for learning' },
  { key: 'normal', label: 'Normal', description: 'Balanced challenge for most players' },
  { key: 'hard', label: 'Hard', description: 'For experienced managers only' },
];

/**
 * Get leaderboard multiplier for starting division
 * Lower divisions = higher multiplier (harder climb = more points)
 */
function getLeaderboardMultiplier(division: number): number {
  const multipliers: Record<number, number> = {
    1: 0.5,
    2: 0.6,
    3: 0.7,
    4: 0.8,
    5: 0.9,
    6: 1.0,
    7: 1.1,
    8: 1.2,
    9: 1.3,
    10: 1.5,
  };
  return multipliers[division] || 1.0;
}

/**
 * Format population for display
 */
function formatPopulation(pop: number): string {
  if (pop >= 1000000) {
    return `${(pop / 1000000).toFixed(1)}M`;
  }
  if (pop >= 1000) {
    return `${(pop / 1000).toFixed(0)}K`;
  }
  return pop.toString();
}

export function NewGameScreen({
  onStartGame,
  onLoadGame,
  hasSavedGame = false,
}: NewGameScreenProps) {
  const colors = useColors();

  // State
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>('US');
  const [selectedCity, setSelectedCity] = useState<CityData | null>(null);
  const [customTeamName, setCustomTeamName] = useState('');
  const [useCustomName, setUseCustomName] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [secondaryColor, setSecondaryColor] = useState('#FFFFFF');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [showCitySelector, setShowCitySelector] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [selectedDivisionFilter, setSelectedDivisionFilter] = useState<number | null>(null);

  // Computed values
  const countryConfig = COUNTRY_CONFIGS[selectedCountry];
  const citiesByDivision = useMemo(
    () => getCitiesByDivision(selectedCountry),
    [selectedCountry]
  );

  const startingDivision = selectedCity
    ? getCityDivision(selectedCountry, selectedCity.name)
    : 7;

  const leaderboardMultiplier = getLeaderboardMultiplier(startingDivision);

  const generatedTeamName = selectedCity
    ? generateTeamName(selectedCity.name, selectedCountry)
    : 'Select a City';

  const teamName = useCustomName && customTeamName.trim()
    ? customTeamName.trim()
    : generatedTeamName;

  const isValid = selectedCity !== null && teamName.length >= 2;

  // Filtered cities for selector
  const filteredCities = useMemo(() => {
    const allCities: Array<{ city: CityData; division: number }> = [];

    citiesByDivision.forEach((cities, division) => {
      if (selectedDivisionFilter !== null && division !== selectedDivisionFilter) {
        return;
      }
      cities.forEach(city => {
        if (
          citySearchQuery === '' ||
          city.name.toLowerCase().includes(citySearchQuery.toLowerCase()) ||
          (city.region && city.region.toLowerCase().includes(citySearchQuery.toLowerCase()))
        ) {
          allCities.push({ city, division });
        }
      });
    });

    return allCities;
  }, [citiesByDivision, citySearchQuery, selectedDivisionFilter]);

  // Handlers
  const handleCountrySelect = (code: CountryCode) => {
    setSelectedCountry(code);
    setSelectedCity(null); // Reset city when country changes
    setCitySearchQuery('');
  };

  const handleCitySelect = (city: CityData) => {
    setSelectedCity(city);
    setShowCitySelector(false);
    setCitySearchQuery('');
    setSelectedDivisionFilter(null);
  };

  const handleStartGame = () => {
    if (hasSavedGame) {
      setShowOverwriteConfirm(true);
    } else {
      startGame();
    }
  };

  const startGame = () => {
    if (!selectedCity) return;

    setShowOverwriteConfirm(false);
    onStartGame?.({
      teamName,
      primaryColor,
      secondaryColor,
      difficulty,
      country: selectedCountry,
      city: selectedCity.name,
      cityRegion: selectedCity.region,
      startingDivision,
    });
  };

  // Render functions
  const renderColorPicker = (
    label: string,
    selectedColor: string,
    onSelect: (color: string) => void,
    excludeColor?: string
  ) => (
    <View style={styles.colorSection}>
      <Text style={[styles.sectionLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.colorGrid}>
        {colorOptions
          .filter((c) => c.value !== excludeColor)
          .map((color) => (
            <TouchableOpacity
              key={color.value}
              style={[
                styles.colorButton,
                { backgroundColor: color.value },
                selectedColor === color.value && styles.colorButtonSelected,
              ]}
              onPress={() => onSelect(color.value)}
            >
              {selectedColor === color.value && (
                <Text style={styles.checkmark}>{'\u2713'}</Text>
              )}
            </TouchableOpacity>
          ))}
        <TouchableOpacity
          style={[
            styles.colorButton,
            { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: colors.border },
            selectedColor === '#FFFFFF' && styles.colorButtonSelected,
          ]}
          onPress={() => onSelect('#FFFFFF')}
        >
          {selectedColor === '#FFFFFF' && (
            <Text style={[styles.checkmark, { color: colors.text }]}>{'\u2713'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCityItem = ({ item }: { item: { city: CityData; division: number } }) => {
    const isSelected = selectedCity?.name === item.city.name;
    const multiplier = getLeaderboardMultiplier(item.division);

    return (
      <TouchableOpacity
        style={[
          styles.cityItem,
          { backgroundColor: isSelected ? colors.primary + '20' : colors.surface },
        ]}
        onPress={() => handleCitySelect(item.city)}
      >
        <View style={styles.cityInfo}>
          <Text style={[styles.cityName, { color: colors.text }]}>
            {item.city.name}
            {item.city.region && (
              <Text style={{ color: colors.textMuted }}>{`, ${item.city.region}`}</Text>
            )}
          </Text>
          <Text style={[styles.cityPop, { color: colors.textMuted }]}>
            Pop: {formatPopulation(item.city.population)}
          </Text>
        </View>
        <View style={styles.cityDivisionInfo}>
          <View style={[styles.divisionBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.divisionBadgeText}>Div {item.division}</Text>
          </View>
          <Text style={[styles.multiplierText, { color: colors.textMuted }]}>
            {multiplier}x pts
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Multiball</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Sports Franchise Manager
        </Text>
      </View>

      {/* Country Selection */}
      <View style={[styles.inputCard, { backgroundColor: colors.card }, shadows.sm]}>
        <Text style={[styles.sectionLabel, { color: colors.text }]}>Select Country</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.countryScroll}
        >
          {getAvailableCountries().map((code) => {
            const config = COUNTRY_CONFIGS[code];
            const isSelected = selectedCountry === code;
            return (
              <TouchableOpacity
                key={code}
                style={[
                  styles.countryButton,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => handleCountrySelect(code)}
              >
                <Text style={styles.countryFlag}>{config.flag}</Text>
                <Text
                  style={[
                    styles.countryName,
                    { color: isSelected ? '#000000' : colors.text },
                  ]}
                >
                  {config.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* City Selection */}
      <View style={[styles.inputCard, { backgroundColor: colors.card }, shadows.sm]}>
        <Text style={[styles.sectionLabel, { color: colors.text }]}>Select Your City</Text>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          City population determines your starting division
        </Text>

        <TouchableOpacity
          style={[
            styles.citySelector,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={() => setShowCitySelector(true)}
        >
          {selectedCity ? (
            <View style={styles.selectedCityDisplay}>
              <View>
                <Text style={[styles.selectedCityName, { color: colors.text }]}>
                  {selectedCity.name}
                  {selectedCity.region && `, ${selectedCity.region}`}
                </Text>
                <Text style={[styles.selectedCityDetails, { color: colors.textMuted }]}>
                  Division {startingDivision} • {leaderboardMultiplier}x leaderboard points
                </Text>
              </View>
              <View style={[styles.divisionBadgeLarge, { backgroundColor: colors.primary }]}>
                <Text style={styles.divisionBadgeLargeText}>{startingDivision}</Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.citySelectorPlaceholder, { color: colors.textMuted }]}>
              Tap to select a city...
            </Text>
          )}
        </TouchableOpacity>

        {selectedCity && (
          <View style={[styles.divisionInfo, { backgroundColor: colors.surface }]}>
            <Text style={[styles.divisionInfoText, { color: colors.textSecondary }]}>
              {getDivisionDescription(startingDivision)}
            </Text>
          </View>
        )}
      </View>

      {/* Team Preview */}
      <View style={[styles.previewCard, { backgroundColor: colors.card }, shadows.md]}>
        <View style={[styles.previewBanner, { backgroundColor: primaryColor }]}>
          <View style={[styles.previewAccent, { backgroundColor: secondaryColor }]} />
        </View>
        <Text
          style={[
            styles.previewName,
            { color: selectedCity ? colors.text : colors.textMuted },
          ]}
        >
          {teamName}
        </Text>
        {selectedCity && (
          <Text style={[styles.previewCity, { color: colors.textMuted }]}>
            {countryConfig.flag} {selectedCity.name}
            {selectedCity.region && `, ${selectedCity.region}`}
          </Text>
        )}
      </View>

      {/* Team Name */}
      <View style={[styles.inputCard, { backgroundColor: colors.card }, shadows.sm]}>
        <View style={styles.nameToggleRow}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Team Name</Text>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              { backgroundColor: useCustomName ? colors.primary : colors.surface },
            ]}
            onPress={() => setUseCustomName(!useCustomName)}
          >
            <Text
              style={[
                styles.toggleButtonText,
                { color: useCustomName ? '#000000' : colors.textMuted },
              ]}
            >
              {useCustomName ? 'Custom' : 'Auto'}
            </Text>
          </TouchableOpacity>
        </View>

        {useCustomName ? (
          <>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Enter custom team name..."
              placeholderTextColor={colors.textMuted}
              value={customTeamName}
              onChangeText={setCustomTeamName}
              maxLength={30}
              autoCapitalize="words"
            />
            <Text style={[styles.charCount, { color: colors.textMuted }]}>
              {customTeamName.length}/30
            </Text>
          </>
        ) : (
          <View style={[styles.generatedNameDisplay, { backgroundColor: colors.surface }]}>
            <Text style={[styles.generatedName, { color: colors.text }]}>
              {generatedTeamName}
            </Text>
            <Text style={[styles.generatedNameHint, { color: colors.textMuted }]}>
              Auto-generated based on city
            </Text>
          </View>
        )}
      </View>

      {/* Colors */}
      <View style={[styles.inputCard, { backgroundColor: colors.card }, shadows.sm]}>
        {renderColorPicker('Primary Color', primaryColor, setPrimaryColor, secondaryColor)}
        {renderColorPicker('Secondary Color', secondaryColor, setSecondaryColor, primaryColor)}
      </View>

      {/* Difficulty */}
      <View style={[styles.inputCard, { backgroundColor: colors.card }, shadows.sm]}>
        <Text style={[styles.sectionLabel, { color: colors.text }]}>Difficulty</Text>
        <View style={styles.difficultyOptions}>
          {difficultyOptions.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.difficultyButton,
                {
                  backgroundColor: difficulty === opt.key ? colors.primary : colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setDifficulty(opt.key)}
            >
              <Text
                style={[
                  styles.difficultyLabel,
                  { color: difficulty === opt.key ? '#000000' : colors.text },
                ]}
              >
                {opt.label}
              </Text>
              <Text
                style={[
                  styles.difficultyDesc,
                  { color: difficulty === opt.key ? '#00000099' : colors.textMuted },
                ]}
              >
                {opt.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.startButton,
            {
              backgroundColor: isValid ? colors.primary : colors.surface,
              opacity: isValid ? 1 : 0.5,
            },
          ]}
          onPress={handleStartGame}
          disabled={!isValid}
        >
          <Text
            style={[
              styles.startButtonText,
              { color: isValid ? '#000000' : colors.textMuted },
            ]}
          >
            Start New Game
          </Text>
        </TouchableOpacity>

        {hasSavedGame && (
          <TouchableOpacity
            style={[styles.loadButton, { borderColor: colors.border }]}
            onPress={onLoadGame}
          >
            <Text style={[styles.loadButtonText, { color: colors.text }]}>
              Continue Saved Game
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* City Selector Modal */}
      <Modal
        visible={showCitySelector}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCitySelector(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Select City in {countryConfig.name}
            </Text>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowCitySelector(false)}
            >
              <Text style={[styles.modalCloseText, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Search cities..."
              placeholderTextColor={colors.textMuted}
              value={citySearchQuery}
              onChangeText={setCitySearchQuery}
            />
          </View>

          {/* Division Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.divisionFilterScroll}
            contentContainerStyle={styles.divisionFilterContent}
          >
            <TouchableOpacity
              style={[
                styles.divisionFilterButton,
                {
                  backgroundColor: selectedDivisionFilter === null ? colors.primary : colors.surface,
                },
              ]}
              onPress={() => setSelectedDivisionFilter(null)}
            >
              <Text
                style={[
                  styles.divisionFilterText,
                  { color: selectedDivisionFilter === null ? '#000000' : colors.text },
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((div) => (
              <TouchableOpacity
                key={div}
                style={[
                  styles.divisionFilterButton,
                  {
                    backgroundColor: selectedDivisionFilter === div ? colors.primary : colors.surface,
                  },
                ]}
                onPress={() => setSelectedDivisionFilter(div)}
              >
                <Text
                  style={[
                    styles.divisionFilterText,
                    { color: selectedDivisionFilter === div ? '#000000' : colors.text },
                  ]}
                >
                  Div {div}
                </Text>
                <Text
                  style={[
                    styles.divisionFilterMultiplier,
                    { color: selectedDivisionFilter === div ? '#00000099' : colors.textMuted },
                  ]}
                >
                  {getLeaderboardMultiplier(div)}x
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* City List */}
          <FlatList
            data={filteredCities}
            keyExtractor={(item, index) => `${item.city.name}-${item.division}-${index}`}
            renderItem={renderCityItem}
            contentContainerStyle={styles.cityList}
            ItemSeparatorComponent={() => (
              <View style={[styles.citySeparator, { backgroundColor: colors.border }]} />
            )}
          />
        </View>
      </Modal>

      {/* Overwrite Confirmation */}
      <ConfirmationModal
        visible={showOverwriteConfirm}
        title="Overwrite Save?"
        message="Starting a new game will overwrite your existing saved game. This cannot be undone."
        confirmText="Start New"
        confirmStyle="destructive"
        cancelText="Cancel"
        onConfirm={startGame}
        onCancel={() => setShowOverwriteConfirm(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    marginTop: spacing.xs,
  },
  inputCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  sectionHint: {
    fontSize: 12,
    marginBottom: spacing.md,
    marginTop: -spacing.xs,
  },

  // Country Selection
  countryScroll: {
    gap: spacing.sm,
  },
  countryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 80,
  },
  countryFlag: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  countryName: {
    fontSize: 11,
    fontWeight: '500',
  },

  // City Selection
  citySelector: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 60,
    justifyContent: 'center',
  },
  citySelectorPlaceholder: {
    fontSize: 14,
  },
  selectedCityDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedCityName: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectedCityDetails: {
    fontSize: 12,
    marginTop: 2,
  },
  divisionBadgeLarge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divisionBadgeLargeText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  divisionInfo: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  divisionInfoText: {
    fontSize: 12,
    textAlign: 'center',
  },

  // Team Preview
  previewCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  previewBanner: {
    height: 80,
    justifyContent: 'flex-end',
  },
  previewAccent: {
    height: 8,
  },
  previewName: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  previewCity: {
    fontSize: 14,
    textAlign: 'center',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },

  // Team Name
  nameToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  toggleButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textInput: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  generatedNameDisplay: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  generatedName: {
    fontSize: 16,
    fontWeight: '600',
  },
  generatedNameHint: {
    fontSize: 12,
    marginTop: 2,
  },

  // Colors
  colorSection: {
    marginBottom: spacing.md,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorButtonSelected: {
    borderWidth: 3,
    borderColor: '#000000',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  // Difficulty
  difficultyOptions: {
    gap: spacing.sm,
  },
  difficultyButton: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  difficultyLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  difficultyDesc: {
    fontSize: 12,
    marginTop: 2,
  },

  // Actions
  actions: {
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  startButton: {
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  loadButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  loadButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Modal
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalClose: {
    padding: spacing.sm,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    padding: spacing.md,
  },
  searchInput: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  divisionFilterScroll: {
    maxHeight: 60,
  },
  divisionFilterContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  divisionFilterButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minWidth: 60,
  },
  divisionFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divisionFilterMultiplier: {
    fontSize: 10,
  },
  cityList: {
    padding: spacing.md,
  },
  cityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  cityInfo: {
    flex: 1,
  },
  cityName: {
    fontSize: 15,
    fontWeight: '500',
  },
  cityPop: {
    fontSize: 12,
    marginTop: 2,
  },
  cityDivisionInfo: {
    alignItems: 'flex-end',
  },
  divisionBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  divisionBadgeText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '600',
  },
  multiplierText: {
    fontSize: 10,
    marginTop: 2,
  },
  citySeparator: {
    height: 1,
    marginVertical: spacing.xs,
  },
});

export default NewGameScreen;
