import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useProfileStore } from '../store/profileStore';
import SectionCard from '../components/SectionCard';
import Caricatures from '../assets/caricatures';

export default function HistoryScreen({ navigation }) {
  const {
    profilesList,
    loadHistory,
    fetchProfile,
    deleteProfile,
  } = useProfileStore();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'high' | 'medium' | 'recent'
  const [profileToDelete, setProfileToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const handleOpenProfile = async (profileId) => {
    try {
      await fetchProfile(profileId);
      navigation.navigate('ReviewProfile');
    } catch (err) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('Could not open profile: ' + err.message);
      }
    }
  };

  const handlePromptDelete = (profile) => {
    setProfileToDelete(profile);
  };

  const handleConfirmDelete = async () => {
    if (!profileToDelete) return;
    try {
      setIsDeleting(true);
      await deleteProfile(profileToDelete.profile_id);
      setProfileToDelete(null);
    } catch (e) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('Failed to delete profile: ' + e.message);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter & Search profiles
  const filteredProfiles = (profilesList || []).filter((item) => {
    // 1. Filter Tab
    if (activeFilter === 'high' && item.match_score < 70) return false;
    if (activeFilter === 'medium' && (item.match_score >= 70 || item.match_score < 40)) return false;
    if (activeFilter === 'recent') {
      const createdDate = new Date(item.created_at);
      const now = new Date();
      const diffDays = (now - createdDate) / (1000 * 60 * 60 * 24);
      if (diffDays > 3) return false;
    }

    // 2. Search Query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const jobMatch = (item.job_title || '').toLowerCase().includes(q);
    const idMatch = (item.profile_id || '').toLowerCase().includes(q);
    const modeMatch = (item.mode || '').toLowerCase().includes(q);
    return jobMatch || idMatch || modeMatch;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* Header Title with Total Count */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Saved Profiles ({profilesList.length})</Text>
            <Text style={styles.subtitle}>Manage and revisit past resume and job description analyses</Text>
          </View>
          <TouchableOpacity
            style={styles.newBtnTop}
            onPress={() => navigation.navigate('Upload')}
          >
            <Text style={styles.newBtnTopText}>+ New Analysis</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by role, profile ID, or mode..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <View style={styles.filtersRow}>
          {[
            { id: 'all', label: `All (${profilesList.length})` },
            { id: 'high', label: 'Match ≥ 70%' },
            { id: 'medium', label: 'Match 40–69%' },
            { id: 'recent', label: 'Recent (< 3 days)' },
          ].map((tab) => {
            const isSelected = activeFilter === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setActiveFilter(tab.id)}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Profiles List */}
        {profilesList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Image
              source={Caricatures.step1Resume || Caricatures.puzzleSkills}
              style={styles.emptyImg}
              resizeMode="contain"
            />
            <Text style={styles.emptyTitle}>No saved profiles found</Text>
            <Text style={styles.emptySubtitle}>
              Uploaded resumes and analysis records will appear here.
            </Text>
            <TouchableOpacity
              style={styles.newAnalysisBtn}
              onPress={() => navigation.navigate('Upload')}
            >
              <Text style={styles.newAnalysisBtnText}>+ Start New Analysis</Text>
            </TouchableOpacity>
          </View>
        ) : filteredProfiles.length === 0 ? (
          <View style={styles.noResultsBox}>
            <Text style={styles.noResultsTitle}>No profiles match your filters</Text>
            <Text style={styles.noResultsSub}>
              No saved profiles matched "{searchQuery || activeFilter}".
            </Text>
            <TouchableOpacity
              style={styles.resetSearchBtn}
              onPress={() => {
                setSearchQuery('');
                setActiveFilter('all');
              }}
            >
              <Text style={styles.resetSearchBtnText}>Reset Search & Filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredProfiles}
            keyExtractor={(item) => item.profile_id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FFC82C"
              />
            }
            renderItem={({ item }) => (
              <View style={styles.cardWrapper}>
                <SectionCard
                  title={item.job_title || 'Software Engineer'}
                  subtitle={`ID: ${item.profile_id} • ${new Date(item.created_at).toLocaleDateString()}`}
                  badge={`${Math.round(item.match_score)}% Match`}
                  badgeColor="#FFC82C"
                >
                  <View style={styles.cardActionsRow}>
                    <View style={styles.metaCol}>
                      <View style={styles.tagsInlineRow}>
                        <View style={styles.modePill}>
                          <Text style={styles.modeBadgeText}>
                            {item.mode?.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.skillsCountText}>
                          ⚡ {item.candidate_skills_count} candidate skills
                        </Text>
                      </View>
                    </View>

                    <View style={styles.btnRow}>
                      <TouchableOpacity
                        style={styles.openBtn}
                        onPress={() => handleOpenProfile(item.profile_id)}
                      >
                        <Text style={styles.openBtnText}>Open Analysis →</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handlePromptDelete(item)}
                      >
                        <Text style={styles.deleteBtnText}>🗑 Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </SectionCard>
              </View>
            )}
            contentContainerStyle={styles.listContent}
          />
        )}

        {/* Delete Confirmation Modal (Cross-platform reliable) */}
        <Modal
          visible={!!profileToDelete}
          transparent
          animationType="fade"
          onRequestClose={() => setProfileToDelete(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalIconCircle}>
                <Text style={{ fontSize: 28 }}>🗑️</Text>
              </View>
              <Text style={styles.modalTitle}>Delete Saved Profile?</Text>
              <Text style={styles.modalSub}>
                Are you sure you want to permanently remove the profile for{' '}
                <Text style={{ fontWeight: '800', color: '#111827' }}>
                  "{profileToDelete?.job_title || 'this role'}"
                </Text>
                ? This will remove all associated parsed skills and interview topics.
              </Text>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setProfileToDelete(null)}
                  disabled={isDeleting}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalConfirmDeleteBtn}
                  onPress={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalConfirmDeleteBtnText}>Delete Permanently</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  container: {
    flex: 1,
    padding: 24,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  newBtnTop: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFC82C',
  },
  newBtnTopText: {
    color: '#FFC82C',
    fontWeight: '800',
    fontSize: 13,
  },

  // Search Box
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    outlineStyle: 'none',
  },
  clearBtn: {
    padding: 4,
  },
  clearBtnText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '800',
  },

  // Filter Chips
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  filterChipTextActive: {
    color: '#FFC82C',
  },

  listContent: {
    paddingBottom: 32,
  },
  cardWrapper: {
    marginBottom: 12,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 12,
  },
  metaCol: {
    flex: 1,
    minWidth: 200,
  },
  tagsInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modePill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  skillsCountText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  openBtn: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
  },
  openBtnText: {
    color: '#FFC82C',
    fontWeight: '800',
    fontSize: 13,
  },
  deleteBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },

  // Empty / No Results
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 30,
  },
  emptyImg: {
    width: 140,
    height: 110,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  newAnalysisBtn: {
    backgroundColor: '#111827',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFC82C',
  },
  newAnalysisBtnText: {
    color: '#FFC82C',
    fontWeight: '800',
    fontSize: 14,
  },
  noResultsBox: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    marginTop: 20,
  },
  noResultsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  noResultsSub: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  resetSearchBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  resetSearchBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 26,
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  modalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 13.5,
    color: '#4B5563',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  modalConfirmDeleteBtn: {
    flex: 1.3,
    paddingVertical: 12,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmDeleteBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
