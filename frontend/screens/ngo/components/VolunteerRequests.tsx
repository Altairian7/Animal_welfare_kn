import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Surface,
  Text,
  Card,
  Chip,
  Button,
  Avatar,
  Searchbar,
  ActivityIndicator,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import debounce from 'lodash.debounce';
import { useThemeContext } from '../../../theme';
import { ngoApi, APIError, NetworkError, AuthenticationError } from '../../../api/ngoApi';

interface Volunteer {
  id: string;
  application_id?: string;
  user_id?: string;
  name: string;
  email: string;
  phone?: string;
  status: 'pending' | 'approved' | 'rejected';
  specialization?: string;
  experience?: string;
  location?: string;
  availability?: string;
  submitted_at: string;
  skills?: string[];
  message?: string;
  avatar?: string;
}

interface VolunteerRequestsProps {
  ngoId: string;
  ngoData?: any;
  dashboardStats?: any;
  onRefresh?: () => void;
  refreshing?: boolean;
}

const VolunteerRequests: React.FC<VolunteerRequestsProps> = ({
  ngoId,
  ngoData,
  dashboardStats,
  onRefresh: parentOnRefresh,
  refreshing: parentRefreshing = false,
}) => {
  const { theme } = useThemeContext();
  
  // State
  const [animatedValue] = useState(new Animated.Value(0));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [volunteerData, setVolunteerData] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [processingApplications, setProcessingApplications] = useState<Set<string>>(new Set());

  // Fetch volunteers
  const fetchVolunteers = useCallback(async () => {
    if (!ngoId) {
      setError('NGO ID not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await ngoApi.getVolunteerRequests(ngoId);
      const volunteersData = Array.isArray(response) ? response : 
                            Array.isArray(response.applications) ? response.applications :
                            [];
      const transformedVolunteers: Volunteer[] = volunteersData.map((volunteer: any) => ({
        id: volunteer.id || volunteer.application_id,
        application_id: volunteer.application_id || volunteer.id,
        user_id: volunteer.user_id,
        name: volunteer.name || volunteer.user_name || `User ${volunteer.user_id}`,
        email: volunteer.email || volunteer.user_email || 'No email provided',
        phone: volunteer.phone || volunteer.contact_phone || '',
        status: volunteer.status || 'pending',
        specialization: volunteer.specialization || volunteer.skills || 'General',
        experience: volunteer.experience || volunteer.experience_level || 'Not specified',
        location: volunteer.location || volunteer.address || 'Location not provided',
        availability: volunteer.availability || volunteer.available_hours || 'Flexible',
        submitted_at: volunteer.submitted_at || volunteer.created_at || new Date().toISOString(),
        skills: volunteer.skills || [],
        message: volunteer.message || volunteer.notes || '',
        avatar: volunteer.avatar || `https://picsum.photos/100/100?random=${volunteer.user_id || volunteer.id}`,
      }));

      setVolunteerData(transformedVolunteers);
    } catch (err) {
      console.error('Failed to fetch volunteer requests:', err);
      
      if (err instanceof AuthenticationError) {
        setError('Your session has expired. Please login again.');
      } else if (err instanceof NetworkError) {
        setError('Network connection failed. Please check your internet.');
      } else if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError('Failed to load volunteer requests. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ngoId]);

  // Initial load
  useEffect(() => {
    fetchVolunteers();
  }, [fetchVolunteers]);

  // Animation
  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (parentOnRefresh) {
      parentOnRefresh();
    } else {
      await fetchVolunteers();
    }
  }, [parentOnRefresh, fetchVolunteers]);

  // Handle approve
  const handleApprove = useCallback(async (applicationId: string) => {
    if (!ngoId) return;

    setProcessingApplications(prev => new Set(prev).add(applicationId));

    try {
      await ngoApi.updateApplicationStatus(ngoId, applicationId, 'approved');
      
      // Update local state optimistically
      setVolunteerData(prev => prev.map(volunteer =>
        volunteer.application_id === applicationId || volunteer.id === applicationId
          ? { ...volunteer, status: 'approved' as const }
          : volunteer
      ));

      Alert.alert('Success', 'Volunteer application approved successfully');
      
      if (parentOnRefresh) {
        parentOnRefresh();
      }
    } catch (err) {
      console.error('Failed to approve volunteer:', err);
      Alert.alert('Error', 'Failed to approve volunteer application. Please try again.');
      
      // Revert optimistic update
      setVolunteerData(prev => prev.map(volunteer =>
        volunteer.application_id === applicationId || volunteer.id === applicationId
          ? { ...volunteer, status: 'pending' as const }
          : volunteer
      ));
    } finally {
      setProcessingApplications(prev => {
        const newSet = new Set(prev);
        newSet.delete(applicationId);
        return newSet;
      });
    }
  }, [ngoId, parentOnRefresh]);

  // Handle reject
  const handleReject = useCallback(async (applicationId: string) => {
    if (!ngoId) return;

    setProcessingApplications(prev => new Set(prev).add(applicationId));

    try {
      await ngoApi.updateApplicationStatus(ngoId, applicationId, 'rejected');
      
      // Update local state optimistically
      setVolunteerData(prev => prev.map(volunteer =>
        volunteer.application_id === applicationId || volunteer.id === applicationId
          ? { ...volunteer, status: 'rejected' as const }
          : volunteer
      ));

      Alert.alert('Success', 'Volunteer application rejected');
      
      if (parentOnRefresh) {
        parentOnRefresh();
      }
    } catch (err) {
      console.error('Failed to reject volunteer:', err);
      Alert.alert('Error', 'Failed to reject volunteer application. Please try again.');
      
      // Revert optimistic update
      setVolunteerData(prev => prev.map(volunteer =>
        volunteer.application_id === applicationId || volunteer.id === applicationId
          ? { ...volunteer, status: 'pending' as const }
          : volunteer
      ));
    } finally {
      setProcessingApplications(prev => {
        const newSet = new Set(prev);
        newSet.delete(applicationId);
        return newSet;
      });
    }
  }, [ngoId, parentOnRefresh]);

  // Debounced search handler
  const debouncedSetSearch = useMemo(() =>
    debounce((query: string) => setSearchQuery(query), 300),
    []
  );

  // Status color helper
  const getStatusColor = useCallback((status: Volunteer['status']) => {
    switch (status) {
      case 'pending':
        return '#F59E0B';
      case 'approved':
        return '#10B981';
      case 'rejected':
        return '#EF4444';
      default:
        return '#64748B';
    }
  }, []);

  // Status text helper
  const getStatusText = useCallback((status: Volunteer['status']) => {
    switch (status) {
      case 'pending':
        return 'PENDING';
      case 'approved':
        return 'APPROVED';
      case 'rejected':
        return 'REJECTED';
      default:
        return 'UNKNOWN';
    }
  }, []);

  // Filtered volunteers
  const filteredVolunteers = useMemo(() => volunteerData.filter(volunteer => {
    const matchesSearch = volunteer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      volunteer.specialization?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      volunteer.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      volunteer.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = selectedFilter === 'all' || volunteer.status === selectedFilter;

    return matchesSearch && matchesFilter;
  }), [volunteerData, searchQuery, selectedFilter]);

  // Render volunteer card
  const renderVolunteerCard = useCallback((volunteer: Volunteer, index: number) => {
    const isProcessing = processingApplications.has(volunteer.application_id || volunteer.id);

    return (
      <Animated.View
        key={volunteer.id}
        style={[
          styles(theme).volunteerCard,
          {
            opacity: animatedValue,
            transform: [{
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              })
            }]
          }
        ]}
      >
        <Card style={styles(theme).card}>
          <Card.Content style={styles(theme).cardContent}>
            <View style={styles(theme).volunteerHeader}>
              <View style={styles(theme).volunteerInfo}>
                <Avatar.Image
                  size={50}
                  source={{ uri: volunteer.avatar }}
                  style={styles(theme).avatar}
                />
                <View style={styles(theme).volunteerDetails}>
                  <Text style={styles(theme).volunteerName}>{volunteer.name}</Text>
                  <Text style={styles(theme).volunteerEmail}>{volunteer.email}</Text>
                  {volunteer.phone && (
                    <Text style={styles(theme).volunteerPhone}>{volunteer.phone}</Text>
                  )}
                </View>
              </View>
              <Chip
                style={[styles(theme).statusChip, { backgroundColor: getStatusColor(volunteer.status) }]}
                textStyle={[styles(theme).statusText, { color: '#FFFFFF' }]}
              >
                {getStatusText(volunteer.status)}
              </Chip>
            </View>

            <View style={styles(theme).divider} />

            <View style={styles(theme).volunteerSpecs}>
              {volunteer.specialization && (
                <View style={styles(theme).specItem}>
                  <Ionicons name="star" size={14} color={theme.colors.primary} />
                  <Text style={styles(theme).specText}>Specialization: {volunteer.specialization}</Text>
                </View>
              )}
              {volunteer.experience && (
                <View style={styles(theme).specItem}>
                  <Ionicons name="school" size={14} color={theme.colors.primary} />
                  <Text style={styles(theme).specText}>Experience: {volunteer.experience}</Text>
                </View>
              )}
              {volunteer.location && (
                <View style={styles(theme).specItem}>
                  <Ionicons name="location" size={14} color={theme.colors.primary} />
                  <Text style={styles(theme).specText}>Location: {volunteer.location}</Text>
                </View>
              )}
              {volunteer.availability && (
                <View style={styles(theme).specItem}>
                  <Ionicons name="time" size={14} color={theme.colors.primary} />
                  <Text style={styles(theme).specText}>Availability: {volunteer.availability}</Text>
                </View>
              )}
            </View>

            {volunteer.message && (
              <View style={styles(theme).messageSection}>
                <Text style={styles(theme).messageTitle}>Message:</Text>
                <Text style={styles(theme).messageText}>{volunteer.message}</Text>
              </View>
            )}

            <Text style={styles(theme).submittedText}>
              Submitted {new Date(volunteer.submitted_at).toLocaleDateString()}
            </Text>

            {volunteer.status === 'pending' && (
              <View style={styles(theme).actionButtons}>
                <Button
                  mode="contained"
                  onPress={() => handleApprove(volunteer.application_id || volunteer.id)}
                  style={styles(theme).approveButton}
                  loading={isProcessing}
                  disabled={isProcessing}
                  accessibilityLabel={`Approve ${volunteer.name}`}
                  accessibilityRole="button"
                >
                  Approve
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => handleReject(volunteer.application_id || volunteer.id)}
                  style={styles(theme).rejectButton}
                  loading={isProcessing}
                  disabled={isProcessing}
                  accessibilityLabel={`Reject ${volunteer.name}`}
                  accessibilityRole="button"
                >
                  Reject
                </Button>
              </View>
            )}
          </Card.Content>
        </Card>
      </Animated.View>
    );
  }, [animatedValue, getStatusColor, getStatusText, handleApprove, handleReject, processingApplications, theme]);

  // Loading state
  if (loading) {
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles(theme).loadingText}>Loading volunteer requests...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles(theme).errorContainer}>
        <Text style={styles(theme).errorText}>{error}</Text>
        <Button mode="contained" onPress={onRefresh}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <Surface style={styles(theme).container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing || parentRefreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >

        {/* Search and Filter */}
        <View style={styles(theme).searchSection}>
          <Searchbar
            placeholder="Search volunteers..."
            onChangeText={debouncedSetSearch}
            value={searchQuery}
            style={styles(theme).searchBar}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles(theme).filterContainer}>
              {['all', 'pending', 'approved', 'rejected'].map((filter) => (
                <Chip
                  key={filter}
                  selected={selectedFilter === filter}
                  onPress={() => setSelectedFilter(filter)}
                  style={[
                    styles(theme).filterChip,
                    selectedFilter === filter && styles(theme).filterChipActive
                  ]}
                  textStyle={[
                    styles(theme).filterText,
                    selectedFilter === filter && styles(theme).filterTextActive
                  ]}
                  accessibilityLabel={`Filter by ${filter}`}
                  accessibilityRole="button"
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Chip>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Volunteer Cards */}
        <View style={styles(theme).volunteersContainer}>
          {filteredVolunteers.length === 0 ? (
            <View style={styles(theme).emptyContainer}>
              <Text style={styles(theme).noResults}>
                {searchQuery ? 'No volunteers match your search.' : 'No volunteer requests found.'}
              </Text>
            </View>
          ) : (
            filteredVolunteers.map((volunteer, index) => renderVolunteerCard(volunteer, index))
          )}
        </View>

        {/* Summary */}
        <View style={styles(theme).summarySection}>
          <Card style={styles(theme).summaryCard}>
            <Card.Content>
              <Text style={styles(theme).summaryTitle}>Application Summary</Text>
              <View style={styles(theme).summaryStats}>
                <View style={styles(theme).summaryItem}>
                  <Text style={styles(theme).summaryValue}>
                    {dashboardStats?.pending_applications + dashboardStats?.accepted_applications + dashboardStats?.rejected_applications || volunteerData.length}
                  </Text>
                  <Text style={styles(theme).summaryLabel}>Total</Text>
                </View>
                <View style={styles(theme).summaryItem}>
                  <Text style={styles(theme).summaryValue}>
                    {dashboardStats?.pending_applications || volunteerData.filter(v => v.status === 'pending').length}
                  </Text>
                  <Text style={styles(theme).summaryLabel}>Pending</Text>
                </View>
                <View style={styles(theme).summaryItem}>
                  <Text style={styles(theme).summaryValue}>
                    {dashboardStats?.accepted_applications || volunteerData.filter(v => v.status === 'approved').length}
                  </Text>
                  <Text style={styles(theme).summaryLabel}>Approved</Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
    </Surface>
  );
};

const styles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
    backgroundColor: theme.colors.surface,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.colors.primary,
    lineHeight: 22,
  },
  searchSection: {
    padding: 24,
    paddingTop: 16,
  },
  searchBar: {
    marginBottom: 16,
    borderRadius: 16,
    elevation: 3,
    backgroundColor: theme.colors.surface,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    elevation: 1,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
  },
  filterText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  volunteersContainer: {
    paddingHorizontal: 24,
  },
  volunteerCard: {
    marginBottom: 16,
  },
  card: {
    elevation: 3,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
  },
  cardContent: {
    padding: 16,
  },
  volunteerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  volunteerInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatar: {
    marginRight: 12,
  },
  volunteerDetails: {
    flex: 1,
  },
  volunteerName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  volunteerEmail: {
    fontSize: 13,
    color: theme.colors.primary,
    marginBottom: 2,
  },
  volunteerPhone: {
    fontSize: 13,
    color: theme.colors.text,
    opacity: 0.7,
  },
  statusChip: {
    height: 32,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  divider: {
    marginVertical: 12,
    backgroundColor: theme.colors.outline || '#E5E5E5',
    height: 1,
  },
  volunteerSpecs: {
    marginBottom: 12,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  specText: {
    fontSize: 13,
    color: theme.colors.text,
    marginLeft: 6,
    opacity: 0.8,
  },
  messageSection: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
  },
  messageTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 18,
    opacity: 0.8,
  },
  submittedText: {
    fontSize: 12,
    color: theme.colors.primary,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  approveButton: {
    flex: 1,
    borderRadius: 12,
  },
  rejectButton: {
    flex: 1,
    borderRadius: 12,
    borderColor: theme.colors.error,
  },
  summarySection: {
    padding: 24,
    paddingTop: 16,
  },
  summaryCard: {
    borderRadius: 16,
    elevation: 3,
    backgroundColor: theme.colors.surface,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.colors.primary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: theme.colors.background,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noResults: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    opacity: 0.6,
  },
});

export default VolunteerRequests;
