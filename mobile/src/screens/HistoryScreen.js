import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
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
      Alert.alert('Error', 'Could not open profile: ' + err.message);
    }
  };

  const handleDeleteProfile = (profileId, jobTitle) => {
    Alert.alert(
      'Delete Profile Record',
      `Are you sure you want to permanently delete the profile for "${jobTitle}" and its associated resume files?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProfile(profileId);
            } catch (e) {
              Alert.alert('Error', 'Failed to delete profile: ' + e.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Saved Profiles ({profilesList.length})</Text>
        </View>

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
        ) : (
          <FlatList
            data={profilesList}
            keyExtractor={(item) => item.profile_id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#4F46E5"
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
                      <Text style={styles.modeBadgeText}>
                        Mode: {item.mode?.toUpperCase()}
                      </Text>
                      <Text style={styles.skillsCountText}>
                        {item.candidate_skills_count} candidate skills
                      </Text>
                    </View>

                    <View style={styles.btnRow}>
                      <TouchableOpacity
                        style={styles.openBtn}
                        onPress={() => handleOpenProfile(item.profile_id)}
                      >
                        <Text style={styles.openBtnText}>Open</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteProfile(item.profile_id, item.job_title)}
                      >
                        <Text style={styles.deleteBtnText}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </SectionCard>
              </View>
            )}
            contentContainerStyle={styles.listContent}
          />
        )}
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
    padding: 20,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  listContent: {
    paddingBottom: 24,
  },
  cardWrapper: {
    marginBottom: 4,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  metaCol: {
    flex: 1,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  skillsCountText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  openBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  openBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  deleteBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  deleteBtnText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyImg: {
    width: 140,
    height: 110,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
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
  },
  newAnalysisBtnText: {
    color: '#FFC82C',
    fontWeight: '800',
    fontSize: 14,
  },
});
