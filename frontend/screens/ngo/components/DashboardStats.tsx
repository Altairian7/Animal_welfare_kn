import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  RefreshControl,
} from "react-native";
import {
  Surface,
  Text,
  Card,
  ProgressBar,
  Chip,
  Button,
  ActivityIndicator,
} from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { useThemeContext } from "../../../theme";
import {
  ngoApi,
  APIError,
  NetworkError,
  AuthenticationError,
} from "../../../api/ngoApi";

interface DashboardStatsData {
  total_reports: number;
  active_reports: number;
  completed_reports: number;
  pending_reports: number;
  total_volunteers: number;
  active_volunteers: number;
  new_volunteers: number;
  success_rate: number;
  pending_applications: number;
  accepted_applications: number;
  rejected_applications: number;
}

interface DashboardStatsProps {
  ngoId: string;
  ngoData?: any;
  dashboardStats?: DashboardStatsData;
  onRefresh?: () => void;
  refreshing?: boolean;
}

const DashboardStats: React.FC<DashboardStatsProps> = ({
  ngoId,
  ngoData,
  dashboardStats: parentStats,
  onRefresh: parentOnRefresh,
  refreshing: parentRefreshing = false,
}) => {
  const { theme } = useThemeContext();

  // State
  const [animatedValue] = useState(new Animated.Value(0));
  const [stats, setStats] = useState<DashboardStatsData | null>(
    parentStats || null
  );
  const [loading, setLoading] = useState(!parentStats);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!ngoId) {
      setError("NGO ID not available");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await ngoApi.getDashboardStats(ngoId);

      const statsData: DashboardStatsData = {
        total_reports: response.total_reports ?? 0,
        active_reports: response.in_progress ?? 0,
        // Map “resolved”    → “completed_reports”
        completed_reports: response.resolved ?? 0,
        // Derive pending_reports if back end exposes “pending_reports”, otherwise compute:
        pending_reports:
          response.pending_reports ??
          response.total_reports -
            (response.resolved ?? 0) -
            (response.in_progress ?? 0),
        total_volunteers: response.total_volunteers || 0,
        active_volunteers: response.active_volunteers || 0,
        new_volunteers: response.new_volunteers || 0,
        success_rate: response.success_rate || 0,
        pending_applications: response.pending_applications || 0,
        accepted_applications: response.accepted_applications || 0,
        rejected_applications: response.rejected_applications || 0,
      };

      setStats(statsData);
    } catch (err) {
      console.error("Failed to fetch dashboard stats:", err);

      if (err instanceof AuthenticationError) {
        setError("Your session has expired. Please login again.");
      } else if (err instanceof NetworkError) {
        setError("Network connection failed. Please check your internet.");
      } else if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("Failed to load dashboard stats. Please try again.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ngoId]);

  // Initial load
  useEffect(() => {
    if (parentStats) {
      setStats(parentStats);
      setLoading(false);
    } else {
      fetchStats();
    }
  }, [parentStats, fetchStats]);

  // Animation
  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (parentOnRefresh) {
      parentOnRefresh();
    } else {
      await fetchStats();
    }
  }, [parentOnRefresh, fetchStats]);

  // Render metric card
  const renderMetricCard = useCallback(
    (
      title: string,
      value: string | number,
      subtitle: string,
      icon: keyof typeof Ionicons.glyphMap,
      color: string,
      delay: number = 0
    ) => (
      <Animated.View
        style={[
          styles(theme).metricCard,
          {
            opacity: animatedValue,
            transform: [
              {
                translateY: animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Card style={styles(theme).card}>
          <Card.Content style={styles(theme).cardContent}>
            <View style={styles(theme).metricHeader}>
              <View
                style={[
                  styles(theme).iconContainer,
                  { backgroundColor: color + "20" },
                ]}
              >
                <Ionicons name={icon} size={24} color={color} />
              </View>
              <View style={styles(theme).metricInfo}>
                <Text style={styles(theme).metricValue}>{value}</Text>
                <Text style={styles(theme).metricTitle}>{title}</Text>
                <Text style={styles(theme).metricSubtitle}>{subtitle}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </Animated.View>
    ),
    [animatedValue, theme]
  );

  // Render detailed card
  const renderDetailedCard = useCallback(
    (title: string, children: React.ReactNode, delay: number = 0) => (
      <Animated.View
        style={[
          styles(theme).detailedCard,
          {
            opacity: animatedValue,
            transform: [
              {
                translateY: animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Card style={styles(theme).card}>
          <Card.Content style={styles(theme).cardContent}>
            <View style={styles(theme).cardHeader}>
              <Text style={styles(theme).detailedTitle}>{title}</Text>
            </View>
            <View style={styles(theme).detailedStats}>{children}</View>
          </Card.Content>
        </Card>
      </Animated.View>
    ),
    [animatedValue, theme]
  );

  // Render stat row
  const renderStatRow = useCallback(
    (
      label: string,
      value: number,
      total: number,
      color: string,
      subtext?: string
    ) => (
      <View style={styles(theme).statRow}>
        <View style={styles(theme).statInfo}>
          <Text style={styles(theme).statLabel}>{label}</Text>
          {subtext && <Text style={styles(theme).statSubtext}>{subtext}</Text>}
        </View>
        <View style={styles(theme).statValues}>
          <Text style={styles(theme).statValue}>{value}</Text>
          <Text style={styles(theme).statPercentage}>
            {total > 0 ? Math.round((value / total) * 100) : 0}%
          </Text>
        </View>
        <View
          style={[styles(theme).statIndicator, { backgroundColor: color }]}
        />
      </View>
    ),
    [theme]
  );

  // Loading state
  if (loading) {
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles(theme).loadingText}>
          Loading dashboard stats...
        </Text>
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

  if (!stats) {
    return (
      <View style={styles(theme).errorContainer}>
        <Text style={styles(theme).errorText}>No statistics available</Text>
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
          <RefreshControl
            refreshing={refreshing || parentRefreshing}
            onRefresh={onRefresh}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Key Metrics Grid */}
        <View style={styles(theme).statsGrid}>
          {renderMetricCard(
            "Total Reports",
            (stats.total_reports ?? 0).toString(),
            "All time reports filed",
            "document-text",
            "#F59E0B",
            0
          )}
          {renderMetricCard(
            "Active Reports",
            (stats.active_reports ?? 0).toString(),
            "Currently assigned",
            "time",
            "#F59E0B",
            100
          )}
          {renderMetricCard(
            "Success Rate",
            `${stats.success_rate ?? 0}%`,
            "Completed successfully",
            "checkmark-circle",
            "#10B981",
            200
          )}
          {renderMetricCard(
            "Our Volunteers",
            (stats.total_volunteers ?? 0).toString(),
            "Active members",
            "people",
            "#3B82F6",
            300
          )}
        </View>
        {/* Detailed Analytics */}
        <View style={styles(theme).detailedSection}>
          <Text style={styles(theme).sectionTitle}>Detailed Analytics</Text>

          <View style={styles(theme).detailedGrid}>
            {/* Reports Breakdown */}
            {renderDetailedCard(
              "Reports Overview",
              <>
                {renderStatRow(
                  "Completed Reports",
                  stats.completed_reports,
                  stats.total_reports || 1,
                  "#10B981",
                  "Successfully resolved"
                )}
                {renderStatRow(
                  "Active Reports",
                  stats.active_reports,
                  stats.total_reports || 1,
                  "#F59E0B",
                  "Currently in progress"
                )}
                {renderStatRow(
                  "Pending Reports",
                  stats.pending_reports,
                  stats.total_reports || 1,
                  "#3B82F6",
                  "Awaiting action"
                )}
              </>,
              0
            )}

            {/* Volunteer Statistics */}
            {renderDetailedCard(
              "Volunteer Overview",
              <>
                {renderStatRow(
                  "Active Volunteers",
                  stats.active_volunteers,
                  stats.total_volunteers || 1,
                  "#10B981",
                  "Currently working"
                )}
                {renderStatRow(
                  "New Volunteers",
                  stats.new_volunteers,
                  stats.total_volunteers || 1,
                  "#3B82F6",
                  "Recent joiners"
                )}
                {renderStatRow(
                  "Pending Applications",
                  stats.pending_applications,
                  stats.pending_applications +
                    stats.accepted_applications +
                    stats.rejected_applications || 1,
                  "#F59E0B",
                  "Awaiting review"
                )}
              </>,
              100
            )}

            {/* Application Status */}
            {renderDetailedCard(
              "Application Status",
              <>
                {renderStatRow(
                  "Accepted Applications",
                  stats.accepted_applications,
                  stats.pending_applications +
                    stats.accepted_applications +
                    stats.rejected_applications || 1,
                  "#10B981",
                  "Approved volunteers"
                )}
                {renderStatRow(
                  "Pending Applications",
                  stats.pending_applications,
                  stats.pending_applications +
                    stats.accepted_applications +
                    stats.rejected_applications || 1,
                  "#F59E0B",
                  "Under review"
                )}
                {renderStatRow(
                  "Rejected Applications",
                  stats.rejected_applications,
                  stats.pending_applications +
                    stats.accepted_applications +
                    stats.rejected_applications || 1,
                  "#EF4444",
                  "Not approved"
                )}
              </>,
              200
            )}
          </View>
        </View>

        {/* Progress Section */}
        <View style={styles(theme).progressSection}>
          <Card style={styles(theme).progressCard}>
            <Card.Content>
              <Text style={styles(theme).progressTitle}>
                Report Completion Progress
              </Text>

              <View style={styles(theme).progressItem}>
                <View style={styles(theme).progressHeader}>
                  <Text style={styles(theme).progressLabel}>
                    Completed Reports
                  </Text>
                  <Text style={styles(theme).progressValue}>
                    {stats.completed_reports}/{stats.total_reports}
                  </Text>
                </View>
                <ProgressBar
                  progress={
                    stats.total_reports > 0
                      ? stats.completed_reports / stats.total_reports
                      : 0
                  }
                  color={theme.colors.primary}
                  style={styles(theme).progressBar}
                />
              </View>

              <View style={styles(theme).progressItem}>
                <View style={styles(theme).progressHeader}>
                  <Text style={styles(theme).progressLabel}>
                    Active Reports
                  </Text>
                  <Text style={styles(theme).progressValue}>
                    {stats.active_reports}
                  </Text>
                </View>
                <ProgressBar
                  progress={
                    stats.total_reports > 0
                      ? stats.active_reports / stats.total_reports
                      : 0
                  }
                  color="#F59E0B"
                  style={styles(theme).progressBar}
                />
              </View>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
    </Surface>
  );
};

const styles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 16,
      paddingVertical: 20,
      justifyContent: "space-between", // Changed from "space-around"
    },
    
    metricCard: {
      width: "48%", // Ensures exactly 2 cards per row with space between
      marginBottom: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      elevation: 4,
    },
    
    card: {
      elevation: 3,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
    },
    
    cardContent: {
      padding: 16,
    },
    
    metricHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    
    metricInfo: {
      flex: 1,
    },
    
    metricValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    
    metricTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    
    metricSubtitle: {
      fontSize: 14,
      color: theme.colors.primary,
    },
    
    detailedSection: {
      padding: 24,
      paddingTop: 16,
    },
    
    sectionTitle: {
      fontSize: 22,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 20,
    },
    
    detailedGrid: {
      gap: 18,
    },
    
    detailedCard: {
      marginBottom: 20,
    },
    
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    
    detailedTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
    },
    
    detailedStats: {
      gap: 16,
    },
    
    statRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    
    statInfo: {
      flex: 2,
    },
    
    statLabel: {
      fontSize: 15,
      fontWeight: "500",
      color: theme.colors.text,
      marginBottom: 2,
    },
    
    statSubtext: {
      fontSize: 12,
      color: theme.colors.primary,
      opacity: 0.7,
    },
    
    statValues: {
      flex: 1,
      alignItems: "flex-end",
    },
    
    statValue: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    
    statPercentage: {
      fontSize: 12,
      color: theme.colors.primary,
    },
    
    statIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginLeft: 12,
    },
    
    progressSection: {
      padding: 24,
      paddingTop: 16,
    },
    
    progressCard: {
      borderRadius: 16,
      elevation: 3,
      backgroundColor: theme.colors.surface,
    },
    
    progressTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 20,
    },
    
    progressItem: {
      marginBottom: 16,
    },
    
    progressHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    
    progressLabel: {
      fontSize: 15,
      color: theme.colors.text,
    },
    
    progressValue: {
      fontSize: 15,
      fontWeight: "500",
      color: theme.colors.text,
    },
    
    progressBar: {
      height: 8,
      borderRadius: 4,
    },
    
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
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
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
      backgroundColor: theme.colors.background,
    },
    
    errorText: {
      fontSize: 16,
      color: theme.colors.text,
      textAlign: "center",
      marginBottom: 24,
    },
  });

export default DashboardStats;