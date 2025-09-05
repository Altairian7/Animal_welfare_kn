import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  Surface,
  Text,
  Card,
  Chip,
  Button,
  ActivityIndicator,
  Searchbar,
  Divider,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, format } from 'date-fns';
import { useThemeContext } from '../../../theme';
import { ngoApi, APIError, NetworkError, AuthenticationError } from '../../../api/ngoApi';

interface TimelineEvent {
  id: string;
  report_id: string;
  title: string;
  description: string;
  action_type: string;
  timestamp: string;
  status: string;
  location?: string;
  reporter_name?: string;
  volunteer_name?: string;
  notes?: string;
  animal_type?: string;
  event_data?: any;
}

interface ReportData {
  id: string;
  report_id: string;
  title: string;
  animal_type?: string;
  status: string;
  created_at: string;
  completed_at?: string;
  reporter_name?: string;
  location?: string;
  description?: string;
}

interface SolvedReportTimeline {
  report: ReportData;
  timeline: TimelineEvent[];
}

interface ReportTimelineProps {
  ngoId: string;
  ngoData?: any;
  dashboardStats?: any;
  onRefresh?: () => void;
  refreshing?: boolean;
}

// ✅ FIXED: Use flexible theme interface
interface FlexibleTheme {
  colors: {
    primary: string;
    secondary?: string;
    background: string;
    surface: string;
    text: string;
    error?: string;
    warning?: string;
    success?: string;
    outline?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

const ReportTimeline: React.FC<ReportTimelineProps> = ({
  ngoId,
  ngoData,
  dashboardStats,
  onRefresh: parentOnRefresh,
  refreshing: parentRefreshing = false
}) => {
  const { theme } = useThemeContext() as { theme: FlexibleTheme };
  
  // State
  const [animatedValue] = useState(new Animated.Value(0));
  const [solvedReports, setSolvedReports] = useState<SolvedReportTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());

  // ✅ ENHANCED: Fetch solved reports with comprehensive timeline
  const fetchSolvedReports = useCallback(async () => {
    if (!ngoId) {
      setError('NGO ID not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log(`🔄 Fetching solved reports for NGO: ${ngoId}`);

      // First, get all assigned reports
      const assignedResponse = await ngoApi.getAssignedReports(ngoId);
      const allReports = assignedResponse.reports || assignedResponse || [];
      
      // Filter for solved/completed reports
      const solvedReportsData = allReports.filter((report: any) => 
        report.status?.toLowerCase() === 'completed' || 
        report.status?.toLowerCase() === 'resolved' ||
        report.status?.toLowerCase() === 'closed'
      );

      console.log(`✅ Found ${solvedReportsData.length} solved reports`);

      // Fetch timeline for each solved report
      const reportTimelines: SolvedReportTimeline[] = [];
      
      for (const report of solvedReportsData) {
        try {
          console.log(`📋 Fetching timeline for report: ${report.report_id || report.id}`);
          
          const timelineResponse = await ngoApi.getReportTimeline(ngoId, report.report_id || report.id);
          const timeline = timelineResponse.timeline || [];

          // Transform and enrich timeline data
          const enrichedTimeline: TimelineEvent[] = timeline.map((event: any) => ({
            id: event.id || `${report.id}-${event.timestamp}-${Math.random()}`,
            report_id: report.report_id || report.id,
            title: event.title || getEventTitle(event.action_type, report),
            description: event.description || event.notes || getEventDescription(event.action_type, report),
            action_type: event.action_type || 'update',
            timestamp: event.timestamp || event.created_at,
            status: event.status || report.status,
            location: event.location || report.location,
            reporter_name: event.reporter_name || report.reporter_name,
            volunteer_name: event.volunteer_name,
            notes: event.notes,
            animal_type: event.animal_type || report.animal_type,
            event_data: event,
          }));

          // Add default timeline events if missing
          const hasCreatedEvent = enrichedTimeline.some(e => e.action_type === 'report_created');
          if (!hasCreatedEvent && report.created_at) {
            enrichedTimeline.unshift({
              id: `${report.id}-created`,
              report_id: report.report_id || report.id,
              title: 'Report Created',
              description: `${report.animal_type || 'Animal'} rescue report submitted`,
              action_type: 'report_created',
              timestamp: report.created_at,
              status: 'pending',
              location: report.location,
              reporter_name: report.reporter_name,
              animal_type: report.animal_type,
            });
          }

          const hasCompletedEvent = enrichedTimeline.some(e => 
            e.action_type === 'report_completed' || e.status === 'completed'
          );
          if (!hasCompletedEvent && report.completed_at) {
            enrichedTimeline.push({
              id: `${report.id}-completed`,
              report_id: report.report_id || report.id,
              title: 'Report Completed',
              description: `${report.animal_type || 'Animal'} successfully rescued and case resolved`,
              action_type: 'report_completed',
              timestamp: report.completed_at,
              status: 'completed',
              location: report.location,
              animal_type: report.animal_type,
            });
          }

          // Sort timeline by timestamp (oldest first for chronological order)
          enrichedTimeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

          reportTimelines.push({
            report: {
              id: report.id,
              report_id: report.report_id || report.id,
              title: report.title || `${report.animal_type || 'Animal'} Rescue Case`,
              animal_type: report.animal_type,
              status: report.status,
              created_at: report.created_at,
              completed_at: report.completed_at || report.updated_at,
              reporter_name: report.reporter_name,
              location: report.location,
              description: report.description,
            },
            timeline: enrichedTimeline,
          });

        } catch (timelineErr) {
          console.warn(`⚠️ Failed to fetch timeline for report ${report.id}:`, timelineErr);
          // Add basic report info even if timeline fails
          reportTimelines.push({
            report: {
              id: report.id,
              report_id: report.report_id || report.id,
              title: report.title || `${report.animal_type || 'Animal'} Rescue Case`,
              animal_type: report.animal_type,
              status: report.status,
              created_at: report.created_at,
              completed_at: report.completed_at,
              reporter_name: report.reporter_name,
              location: report.location,
              description: report.description,
            },
            timeline: [{
              id: `${report.id}-basic`,
              report_id: report.report_id || report.id,
              title: 'Report Completed',
              description: `${report.animal_type || 'Animal'} rescue case was resolved successfully`,
              action_type: 'report_completed',
              timestamp: report.completed_at || report.updated_at || report.created_at,
              status: report.status,
              location: report.location,
              reporter_name: report.reporter_name,
              animal_type: report.animal_type,
            }],
          });
        }
      }

      // Sort reports by completion date (newest first)
      reportTimelines.sort((a, b) => {
        const aTime = new Date(a.report.completed_at || a.report.created_at).getTime();
        const bTime = new Date(b.report.completed_at || b.report.created_at).getTime();
        return bTime - aTime;
      });

      setSolvedReports(reportTimelines);
      console.log(`✅ Successfully loaded ${reportTimelines.length} solved report timelines`);

    } catch (err: any) {
      console.error('❌ Failed to fetch solved reports:', err);
      
      if (err instanceof AuthenticationError) {
        setError('Your session has expired. Please login again.');
      } else if (err instanceof NetworkError) {
        setError('Network connection failed. Please check your internet.');
      } else if (err instanceof APIError) {
        setError(`API Error: ${err.message}`);
      } else {
        setError('Failed to load solved reports. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ngoId]);

  // Helper functions for timeline events
  const getEventTitle = (actionType: string, report: any): string => {
    switch (actionType?.toLowerCase()) {
      case 'report_created':
        return 'Report Created';
      case 'report_assigned':
        return 'Report Assigned to NGO';
      case 'volunteer_dispatched':
        return 'Volunteer Dispatched';
      case 'arrival_confirmed':
        return 'Volunteer Arrived at Location';
      case 'animal_secured':
        return 'Animal Secured';
      case 'transport_started':
        return 'Transport to Facility Started';
      case 'medical_assessment':
        return 'Medical Assessment Completed';
      case 'treatment_started':
        return 'Treatment Started';
      case 'report_completed':
        return 'Case Successfully Resolved';
      case 'status_updated':
        return 'Status Updated';
      default:
        return `${actionType?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Update`;
    }
  };

  const getEventDescription = (actionType: string, report: any): string => {
    switch (actionType?.toLowerCase()) {
      case 'report_created':
        return `New ${report.animal_type || 'animal'} rescue report submitted by ${report.reporter_name || 'citizen'}`;
      case 'report_assigned':
        return `Report assigned to NGO for immediate action`;
      case 'volunteer_dispatched':
        return `Volunteer team dispatched to rescue location`;
      case 'arrival_confirmed':
        return `Rescue team arrived at the reported location`;
      case 'animal_secured':
        return `${report.animal_type || 'Animal'} safely secured by rescue team`;
      case 'transport_started':
        return `Animal being transported to medical facility`;
      case 'medical_assessment':
        return `Veterinary team completed initial medical assessment`;
      case 'treatment_started':
        return `Medical treatment and care initiated`;
      case 'report_completed':
        return `${report.animal_type || 'Animal'} successfully rescued, treated, and case resolved`;
      default:
        return `Timeline event: ${actionType?.replace('_', ' ')}`;
    }
  };

  // Initial load
  useEffect(() => {
    fetchSolvedReports();
  }, [fetchSolvedReports]);

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
      await fetchSolvedReports();
    }
  }, [parentOnRefresh, fetchSolvedReports]);

  // Toggle report expansion
  const toggleReportExpansion = useCallback((reportId: string) => {
    setExpandedReports(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reportId)) {
        newSet.delete(reportId);
      } else {
        newSet.add(reportId);
      }
      return newSet;
    });
  }, []);

  // Status color helper
  const getStatusColor = useCallback((status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'resolved':
        return theme.colors.success || '#10B981';
      case 'in_progress':
      case 'active':
        return theme.colors.warning || '#F59E0B';
      case 'pending':
        return theme.colors.primary || '#3B82F6';
      default:
        return theme.colors.outline || '#64748B';
    }
  }, [theme]);

  // Action icon helper
  const getActionIcon = useCallback((actionType: string): keyof typeof Ionicons.glyphMap => {
    switch (actionType?.toLowerCase()) {
      case 'report_created':
        return 'document-text-outline';
      case 'report_assigned':
        return 'checkmark-circle-outline';
      case 'volunteer_dispatched':
        return 'car-outline';
      case 'arrival_confirmed':
        return 'location-outline';
      case 'animal_secured':
        return 'paw-outline';
      case 'transport_started':
        return 'car-sport-outline';
      case 'medical_assessment':
        return 'medical-outline';
      case 'treatment_started':
        return 'heart-outline';
      case 'report_completed':
        return 'checkmark-circle';
      default:
        return 'time-outline';
    }
  }, []);

  // Filtered data
  const filteredReports = useMemo(() => {
    return solvedReports.filter(reportTimeline => {
      const matchesSearch = !searchQuery ||
        reportTimeline.report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reportTimeline.report.animal_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reportTimeline.report.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reportTimeline.timeline.some(event => 
          event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
      return matchesSearch;
    });
  }, [solvedReports, searchQuery]);

  // Render timeline event
  const renderTimelineEvent = useCallback((event: TimelineEvent, index: number, totalEvents: number) => (
    <View key={event.id} style={styles(theme).timelineEventContainer}>
      <View style={styles(theme).timelineEventRow}>
        {/* Timeline dot and line */}
        <View style={styles(theme).timelineDot}>
          <View style={[
            styles(theme).dot, 
            { backgroundColor: getStatusColor(event.status) }
          ]}>
            <Ionicons 
              name={getActionIcon(event.action_type)} 
              size={10} 
              color="white" 
            />
          </View>
          {index < totalEvents - 1 && (
            <View style={[
              styles(theme).timelineLine, 
              { backgroundColor: getStatusColor(event.status) + '30' }
            ]} />
          )}
        </View>

        {/* Event content */}
        <Card style={styles(theme).eventCard}>
          <Card.Content style={styles(theme).eventContent}>
            <View style={styles(theme).eventHeader}>
              <Text style={styles(theme).eventTitle}>{event.title}</Text>
              <Text style={styles(theme).eventTime}>
                {format(new Date(event.timestamp), 'MMM dd, HH:mm')}
              </Text>
            </View>
            
            <Text style={styles(theme).eventDescription}>{event.description}</Text>
            
            {/* Event details */}
            <View style={styles(theme).eventDetails}>
              {event.location && (
                <View style={styles(theme).eventDetailRow}>
                  <Ionicons name="location" size={12} color={theme.colors.primary} />
                  <Text style={styles(theme).eventDetailText}>{event.location}</Text>
                </View>
              )}
              {event.volunteer_name && (
                <View style={styles(theme).eventDetailRow}>
                  <Ionicons name="person" size={12} color={theme.colors.primary} />
                  <Text style={styles(theme).eventDetailText}>Volunteer: {event.volunteer_name}</Text>
                </View>
              )}
              {event.notes && (
                <View style={styles(theme).eventDetailRow}>
                  <Ionicons name="chatbox" size={12} color={theme.colors.primary} />
                  <Text style={styles(theme).eventDetailText}>{event.notes}</Text>
                </View>
              )}
            </View>
          </Card.Content>
        </Card>
      </View>
    </View>
  ), [theme, getStatusColor, getActionIcon]);

  // Render report timeline
  const renderReportTimeline = useCallback((reportTimeline: SolvedReportTimeline) => {
    const isExpanded = expandedReports.has(reportTimeline.report.id);
    const completionTime = reportTimeline.report.completed_at || reportTimeline.report.created_at;
    const duration = completionTime ? formatDistanceToNow(new Date(reportTimeline.report.created_at), { addSuffix: false }) : 'Unknown duration';

    return (
      <Animated.View
        key={reportTimeline.report.id}
        style={[
          styles(theme).reportContainer,
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
        {/* Report Header */}
        <TouchableOpacity
          onPress={() => toggleReportExpansion(reportTimeline.report.id)}
          style={styles(theme).reportHeader}
        >
          <Card style={styles(theme).reportHeaderCard}>
            <Card.Content style={styles(theme).reportHeaderContent}>
              <View style={styles(theme).reportHeaderTop}>
                <Text style={styles(theme).reportTitle}>{reportTimeline.report.title}</Text>
                <Chip
                  mode="flat"
                  style={[styles(theme).statusChip, { backgroundColor: getStatusColor(reportTimeline.report.status) + '20' }]}
                  textStyle={[styles(theme).statusText, { color: getStatusColor(reportTimeline.report.status) }]}
                >
                  {reportTimeline.report.status?.toUpperCase()}
                </Chip>
              </View>
              
              <View style={styles(theme).reportHeaderBottom}>
                <View style={styles(theme).reportMetadata}>
                  {reportTimeline.report.animal_type && (
                    <Text style={styles(theme).reportMeta}>🐾 {reportTimeline.report.animal_type}</Text>
                  )}
                  <Text style={styles(theme).reportMeta}>⏱️ Resolved in {duration}</Text>
                  {reportTimeline.report.reporter_name && (
                    <Text style={styles(theme).reportMeta}>👤 {reportTimeline.report.reporter_name}</Text>
                  )}
                </View>
                
                <Ionicons 
                  name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                  size={20} 
                  color={theme.colors.primary} 
                />
              </View>
            </Card.Content>
          </Card>
        </TouchableOpacity>

        {/* Timeline Events (Expanded) */}
        {isExpanded && (
          <View style={styles(theme).timelineContainer}>
            {reportTimeline.timeline.map((event, index) => 
              renderTimelineEvent(event, index, reportTimeline.timeline.length)
            )}
          </View>
        )}
      </Animated.View>
    );
  }, [animatedValue, expandedReports, toggleReportExpansion, getStatusColor, renderTimelineEvent, theme]);

  // Loading state
  if (loading) {
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles(theme).loadingText}>Loading solved reports...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles(theme).errorContainer}>
        <Text style={styles(theme).errorText}>{error}</Text>
        <Button mode="contained" onPress={onRefresh} style={styles(theme).retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  // Empty state
  if (filteredReports.length === 0) {
    return (
      <Surface style={styles(theme).container}>
        <View style={styles(theme).searchSection}>
          <Searchbar
            placeholder="Search solved reports..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles(theme).searchBar}
          />
        </View>
        
        <View style={styles(theme).emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={64} color={theme.colors.primary} />
          <Text style={styles(theme).emptyTitle}>No Solved Reports</Text>
          <Text style={styles(theme).emptyText}>
            {searchQuery ? 'No reports match your search.' : 'No completed rescue cases found yet.'}
          </Text>
          <Button mode="contained" onPress={onRefresh} style={styles(theme).emptyButton}>
            Refresh
          </Button>
        </View>
      </Surface>
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
        {/* Header */}
        <View style={styles(theme).header}>
          <Text style={styles(theme).headerTitle}>Solved Reports Timeline</Text>
          <Text style={styles(theme).headerSubtitle}>
            {filteredReports.length} completed rescue case{filteredReports.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Search */}
        <View style={styles(theme).searchSection}>
          <Searchbar
            placeholder="Search solved reports..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles(theme).searchBar}
          />
        </View>

        {/* Reports List */}
        <View style={styles(theme).reportsListContainer}>
          {filteredReports.map(renderReportTimeline)}
        </View>

        {/* Summary */}
        <View style={styles(theme).summarySection}>
          <Card style={styles(theme).summaryCard}>
            <Card.Content>
              <Text style={styles(theme).summaryTitle}>Success Summary</Text>
              <Divider style={{ marginVertical: 12 }} />
              <View style={styles(theme).summaryStats}>
                <View style={styles(theme).summaryItem}>
                  <Text style={styles(theme).summaryValue}>{solvedReports.length}</Text>
                  <Text style={styles(theme).summaryLabel}>Cases Solved</Text>
                </View>
                <View style={styles(theme).summaryItem}>
                  <Text style={styles(theme).summaryValue}>
                    {solvedReports.reduce((acc, report) => acc + report.timeline.length, 0)}
                  </Text>
                  <Text style={styles(theme).summaryLabel}>Total Events</Text>
                </View>
                <View style={styles(theme).summaryItem}>
                  <Text style={styles(theme).summaryValue}>100%</Text>
                  <Text style={styles(theme).summaryLabel}>Success Rate</Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
    </Surface>
  );
};

const styles = (theme: FlexibleTheme) => StyleSheet.create({
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
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.colors.primary,
  },
  searchSection: {
    padding: 16,
  },
  searchBar: {
    borderRadius: 12,
    elevation: 2,
  },
  reportsListContainer: {
    paddingHorizontal: 16,
  },
  reportContainer: {
    marginBottom: 20,
  },
  reportHeader: {
    marginBottom: 0,
  },
  reportHeaderCard: {
    borderRadius: 12,
    elevation: 3,
  },
  reportHeaderContent: {
    padding: 16,
  },
  reportHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
    marginRight: 12,
  },
  statusChip: {
    borderRadius: 16,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  reportHeaderBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportMetadata: {
    flex: 1,
  },
  reportMeta: {
    fontSize: 13,
    color: theme.colors.text,
    marginBottom: 2,
    opacity: 0.7,
  },
  timelineContainer: {
    paddingLeft: 16,
    paddingTop: 8,
  },
  timelineEventContainer: {
    marginBottom: 12,
  },
  timelineEventRow: {
    flexDirection: 'row',
  },
  timelineDot: {
    alignItems: 'center',
    marginRight: 12,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    height: 40,
    marginTop: 4,
  },
  eventCard: {
    flex: 1,
    elevation: 1,
    borderRadius: 8,
  },
  eventContent: {
    padding: 12,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  eventTime: {
    fontSize: 11,
    color: theme.colors.primary,
  },
  eventDescription: {
    fontSize: 13,
    color: theme.colors.text,
    opacity: 0.8,
    marginBottom: 8,
  },
  eventDetails: {
    gap: 4,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventDetailText: {
    fontSize: 12,
    color: theme.colors.text,
    marginLeft: 6,
    opacity: 0.7,
  },
  summarySection: {
    padding: 16,
    paddingTop: 8,
  },
  summaryCard: {
    borderRadius: 12,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
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
    color: theme.colors.primary,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.colors.text,
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
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
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    opacity: 0.6,
    marginBottom: 24,
  },
  emptyButton: {
    marginTop: 16,
  },
});

export default ReportTimeline;
