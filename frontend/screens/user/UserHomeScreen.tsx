// UserHomeScreen.tsx - Complete version with tracking reports fix

import React, { useState, useEffect, useCallback, useMemo } from "react";

import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  FlatList,
  Alert,
  Modal,
  TouchableOpacity,
  Dimensions,
} from "react-native";

import {
  Text,
  Chip,
  Surface,
  Badge,
  Button,
  IconButton,
} from "react-native-paper";

import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useThemeContext } from "../../theme";

import {
  useFocusEffect,
  useNavigation,
  useRoute,
  RouteProp,
  NavigationProp,
} from "@react-navigation/native";

import NetInfo from "@react-native-community/netinfo";

// ✅ Redux imports
import { useSelector, useDispatch } from "react-redux";
import {
  setTrackingReports,
  setLoading,
  addAcceptedReport,
} from "../../core/redux/slices/reportSlice";

// API imports
import { reportsApi } from "../../api/reportsApi";
import { notificationApi } from "../../api/notificationApi";
import { useCachedProfile } from "../../hooks/useCachedData";

// Components
import StrayRescueCard from "./StrayRescueCard";
import MiniRescueCard from "./MiniRescueCard";
import TrackingReportMiniCard from "./TrackingReportMiniCard";
import LeafletMap from "./LeafletMap";
import AdBanner from "./AdBanner";

const screenWidth = Dimensions.get("window").width;
const radiusOptions = [
  "1 km",
  "2 km",
  "5 km",
  "10 km",
  "15 km",
  "25 km",
  "50 km",
  "100 km",
];

// ✅ Type definitions for route params
type RouteParams = {
  newRescue?: any;
};

type RootStackParamList = {
  UserHomeScreen: RouteParams;
  NotificationScreen: { notifications: any[] };
  ReportDetails: { reportId: string };
};

export default function UserHomeScreen() {
  const { theme } = useThemeContext();
  const themedStyles = styles(theme);

  // ✅ Fixed navigation and route typing
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "UserHomeScreen">>();

  // ✅ Redux state and dispatch
  const dispatch = useDispatch();
  const user = useSelector((state: any) => state.auth.user);
  const userId = user?.appwrite_user_id || user?.$id;
  const acceptedReports = useSelector(
    (state: any) => state.reports.acceptedReports
  );
  const trackingReportsFromRedux = useSelector(
    (state: any) => state.reports.trackingReports
  );
  const reportsLoading = useSelector((state: any) => state.reports.loading);

  // ✅ UPDATED: Add allOriginalReports to store all fetched reports before filtering
  const [state, setState] = useState({
    radius: "1 km",
    userLocation: null as { latitude: number; longitude: number } | null,
    address: "Getting location...",
    refreshing: false,
    mapRefreshing: false,
    isOffline: false,
    rescueCases: [] as any[],
    allOriginalReports: [] as any[], // ✅ NEW: Store ALL original reports before filtering
    notifications: [] as any[],
    loading: false,
    loadingNotifications: false,
    selectedRescue: null as any,
    showModal: false,
  });

  // Use persistent/timed cached profile
  const userProfile = useCachedProfile();

  const updateState = useCallback((updates: Partial<typeof state>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // ✅ Function to get time-based greeting
  const getGreeting = useCallback(() => {
    const currentHour = new Date().getHours();
    if (currentHour >= 5 && currentHour < 12) {
      return "Good Morning";
    } else if (currentHour >= 12 && currentHour < 17) {
      return "Good Afternoon";
    } else if (currentHour >= 17 && currentHour < 21) {
      return "Good Evening";
    } else {
      return "Good Night";
    }
  }, []);

  // ✅ FIXED: Fetch tracking reports using allOriginalReports
  const fetchTrackingReports = useCallback(async () => {
    if (!userId) return;

    console.log("📊 Fetching tracking reports for user:", userId);
    console.log("📊 Accepted reports:", acceptedReports);
    console.log("📊 All original reports:", state.allOriginalReports.length);

    if (acceptedReports.length === 0) {
      console.log("No accepted reports found");
      dispatch(setTrackingReports([]));
      return;
    }

    try {
      dispatch(setLoading(true));

      // ✅ FIXED: Use allOriginalReports instead of rescueCases to find original data
      const trackingReports = acceptedReports
        .map((reportId) => {
          // Find the original report data from ALL original reports (not filtered rescueCases)
          const originalReport = state.allOriginalReports.find(
            (rescue) => rescue.id === reportId || rescue.report_id === reportId
          );

          if (originalReport) {
            console.log(
              `✅ Found original data for report ${reportId}:`,
              originalReport.title
            );
            // Use original report data but update status for tracking
            return {
              ...originalReport, // ✅ Keep ALL original data (image, title, severity, etc.)
              status: "in_progress", // ✅ Update status for tracking display
              accepted_at: new Date().toISOString(), // ✅ Add tracking timestamp
              report_id: originalReport.id || originalReport.report_id,
              id: originalReport.id || originalReport.report_id,
            };
          } else {
            console.log(
              `⚠️ No original data found for report ${reportId}, using fallback`
            );
            // Fallback if original data not found
            return {
              id: reportId,
              report_id: reportId,
              title: `Report ${reportId.slice(-8)}`,
              status: "in_progress",
              species: "Animal",
              severity: "Medium",
              created_at: new Date().toISOString(),
              accepted_at: new Date().toISOString(),
            };
          }
        })
        .filter(Boolean); // Remove any null/undefined entries

      console.log(
        "✅ Final tracking reports with original data:",
        trackingReports
      );
      dispatch(setTrackingReports(trackingReports));
    } catch (error: any) {
      console.error("❌ Error creating tracking reports:", error);
      dispatch(setTrackingReports([]));
    } finally {
      dispatch(setLoading(false));
    }
  }, [userId, acceptedReports, dispatch, state.allOriginalReports]); // ✅ Use allOriginalReports

  // ✅ Enhanced notification fetching
  const fetchNotifications = useCallback(async () => {
    try {
      updateState({ loadingNotifications: true });
      console.log("🔔 Fetching notifications...");
      const notifications = await notificationApi.getNotificationHistory();
      console.log("✅ Fetched notifications:", notifications.length || 0);
      updateState({ notifications: notifications || [] });
    } catch (error: any) {
      console.error("❌ Error fetching notifications:", error);
      if (error.message?.includes("Authentication")) {
        console.warn(
          "Authentication failed for notifications - user may need to re-login"
        );
      }
      updateState({ notifications: [] });
    } finally {
      updateState({ loadingNotifications: false });
    }
  }, [updateState]);

  // ✅ Navigate to Notification Screen - Fixed typing
  const handleNotificationPress = useCallback(() => {
    console.log("📱 Navigating to Notification Screen");
    navigation.navigate("NotificationScreen", {
      notifications: state.notifications,
    });
  }, [navigation, state.notifications]);

  // ✅ Handle tracking card press - Fixed to use existing screen
  const handleTrackingCardPress = useCallback(
    (report: any) => {
      console.log("🎯 Tracking card pressed:", report);
      // ✅ Show alert instead of navigating to non-existent screen
      Alert.alert(
        "Track Report",
        `Report: ${report.title || "Unknown"}\nStatus: ${
          report.status?.toUpperCase() || "TRACKING"
        }\nSpecies: ${report.species || "Animal"}\nSeverity: ${
          report.severity || "Medium"
        }\n\nTracking ID: ${(report.id || report.report_id)?.slice(-8)}`,
        [
          { text: "OK", style: "default" },
          {
            text: "View Details",
            onPress: () => {
              // Open modal with full report details
              updateState({ selectedRescue: report, showModal: true });
            },
          },
        ]
      );
    },
    [updateState]
  );

  // ✅ UPDATED: Handle report status update and close modal
  const handleReportStatusUpdate = useCallback(
    (reportId: string, newStatus: string) => {
      console.log("🔄 Report status updated:", reportId, newStatus);

      // Update the rescue case in the local state
      setState((prevState) => ({
        ...prevState,
        rescueCases: prevState.rescueCases.map((rescue) =>
          rescue.id === reportId || rescue.report_id === reportId
            ? { ...rescue, status: newStatus }
            : rescue
        ),
        allOriginalReports: prevState.allOriginalReports.map(
          (
            rescue // ✅ Also update allOriginalReports
          ) =>
            rescue.id === reportId || rescue.report_id === reportId
              ? { ...rescue, status: newStatus }
              : rescue
        ),
        selectedRescue:
          prevState.selectedRescue?.id === reportId ||
          prevState.selectedRescue?.report_id === reportId
            ? { ...prevState.selectedRescue, status: newStatus }
            : prevState.selectedRescue,
      }));

      // ✅ NEW: Close modal when report is accepted
      if (newStatus === "in_progress" || newStatus === "accepted") {
        console.log("🔄 Report accepted, closing modal...");
        setState((prevState) => ({
          ...prevState,
          showModal: false, // Close the modal
          selectedRescue: null,
        }));
      }

      // If the status is "accepted" or "in_progress", trigger tracking reports refresh
      if (newStatus === "accepted" || newStatus === "in_progress") {
        console.log("🔄 Report accepted, refreshing tracking reports...");
        setTimeout(() => {
          fetchTrackingReports();
        }, 500); // Small delay to ensure state is updated
      }
    },
    [fetchTrackingReports]
  );

  // ✅ UPDATED: Filtered rescue cases - exclude accepted reports
  const filteredRescueCases = useMemo(() => {
    if (!state.userLocation) {
      // Filter out accepted reports even without location
      return state.rescueCases.filter(
        (rescue) => !acceptedReports.includes(rescue.id || rescue.report_id)
      );
    }

    const radiusKm = parseFloat(state.radius.split(" ")[0]);

    return state.rescueCases
      .filter((rescue) => {
        // ✅ Filter out reports that user has already accepted
        const reportId = rescue.id || rescue.report_id;
        if (acceptedReports.includes(reportId)) {
          console.log(`🚫 Filtering out accepted report: ${reportId}`);
          return false; // Remove from emergency cases
        }

        const lat = rescue.latitude;
        const lng = rescue.longitude;
        if (!lat || !lng) return false;

        const R = 6371;
        const dLat = ((lat - state.userLocation!.latitude) * Math.PI) / 180;
        const dLon = ((lng - state.userLocation!.longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((state.userLocation!.latitude * Math.PI) / 180) *
            Math.cos((lat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance <= radiusKm;
      })
      .sort((a, b) => {
        const urgencyOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        const aUrgency =
          urgencyOrder[a.severity as keyof typeof urgencyOrder] ?? 4;
        const bUrgency =
          urgencyOrder[b.severity as keyof typeof urgencyOrder] ?? 4;
        return aUrgency !== bUrgency ? aUrgency - bUrgency : 0;
      });
  }, [state.userLocation, state.radius, state.rescueCases, acceptedReports]);

  const fetchLocationAndAddress = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        const userLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        updateState({ userLocation });

        const geo = await Location.reverseGeocodeAsync(userLocation);
        if (geo && geo.length > 0) {
          const g = geo[0];
          const address = [g.name, g.street, g.district, g.city]
            .filter(Boolean)
            .join(", ");
          updateState({ address });
        }
      } else {
        updateState({ address: "Location Permission Denied" });
      }
    } catch (error) {
      updateState({ address: "Location Error" });
    }
  }, [updateState]);

  // ✅ UPDATED: Store both rescueCases and allOriginalReports
  const fetchNearbyReports = useCallback(async () => {
    if (!state.userLocation) return;

    try {
      updateState({ loading: true });
      const radiusKm = parseFloat(state.radius.split(" ")[0]);
      const reports = await reportsApi.getNearbyReports(
        state.userLocation.latitude,
        state.userLocation.longitude,
        radiusKm
      );
      console.log(`📍 Fetched ${reports?.length || 0} nearby reports`);

      // ✅ FIXED: Store both filtered and ALL original reports
      updateState({
        rescueCases: reports || [],
        allOriginalReports: reports || [], // ✅ Keep ALL original data for tracking
      });
    } catch (error) {
      console.error("Error fetching nearby reports:", error);
      updateState({
        rescueCases: [],
        allOriginalReports: [], // ✅ Clear both
      });
    } finally {
      updateState({ loading: false });
    }
  }, [state.userLocation, state.radius, updateState]);

  // ✅ UPDATED: Include tracking reports in refresh
  const onRefresh = useCallback(async () => {
    console.log("🔄 Scroll to refresh triggered");
    updateState({ refreshing: true });
    await Promise.all([
      fetchLocationAndAddress(),
      fetchNearbyReports(),
      fetchNotifications(),
      fetchTrackingReports(),
    ]);
    updateState({ refreshing: false });
  }, [
    fetchLocationAndAddress,
    fetchNearbyReports,
    fetchNotifications,
    fetchTrackingReports,
    updateState,
  ]);

  const onRadiusSelect = useCallback(
    (newRadius: string) => {
      updateState({ radius: newRadius });
    },
    [updateState]
  );

  const handleMiniCardPress = useCallback(
    (rescue: any) => {
      updateState({ selectedRescue: rescue, showModal: true });
    },
    [updateState]
  );

  const closeModal = useCallback(() => {
    updateState({ selectedRescue: null, showModal: false });
  }, [updateState]);

  // ✅ Monitor acceptedReports changes and trigger tracking fetch
  useEffect(() => {
    if (acceptedReports.length > 0) {
      console.log("🔍 acceptedReports changed, fetching tracking data");
      fetchTrackingReports();
    }
  }, [acceptedReports, fetchTrackingReports]);

  // ✅ UPDATED: Monitor allOriginalReports changes and update tracking reports
  useEffect(() => {
    if (acceptedReports.length > 0 && state.allOriginalReports.length > 0) {
      console.log("🔍 allOriginalReports updated, refreshing tracking reports");
      fetchTrackingReports();
    }
  }, [state.allOriginalReports, acceptedReports, fetchTrackingReports]); // ✅ Use allOriginalReports

  // ✅ Initial effects
  useEffect(() => {
    fetchLocationAndAddress();
    fetchNotifications();
  }, [fetchLocationAndAddress, fetchNotifications]);

  useEffect(() => {
    if (state.userLocation) {
      fetchNearbyReports();
    }
  }, [state.userLocation, state.radius, fetchNearbyReports]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState) => {
      updateState({ isOffline: !netState.isConnected });
    });
    return unsubscribe;
  }, [updateState]);

  // ✅ Focus effect
  useFocusEffect(
    useCallback(() => {
      if (route.params?.newRescue) {
        const newRescue =
          route.params.newRescue.report || route.params.newRescue;
        updateState({
          rescueCases: [newRescue, ...state.rescueCases],
          allOriginalReports: [newRescue, ...state.allOriginalReports], // ✅ Also add to allOriginalReports
        });
        navigation.setParams({ newRescue: undefined });
      }

      if (userId && acceptedReports.length > 0) {
        fetchTrackingReports();
      }
    }, [
      route.params,
      navigation,
      state.rescueCases,
      state.allOriginalReports,
      updateState,
      userId,
      acceptedReports,
      fetchTrackingReports,
    ])
  );

  const renderMiniRescueCard = useCallback(
    ({ item }: { item: any }) => (
      <MiniRescueCard rescue={item} onPress={() => handleMiniCardPress(item)} />
    ),
    [handleMiniCardPress]
  );

  const renderTrackingCard = useCallback(
    ({ item }: { item: any }) => {
      // ✅ Log the item to debug
      console.log("🎯 Rendering tracking card with data:", {
        title: item.title,
        status: item.status,
        severity: item.severity,
        hasImage: !!item.image_url,
      });

      return (
        <TrackingReportMiniCard
          report={item}
          onPress={() => handleTrackingCardPress(item)}
        />
      );
    },
    [handleTrackingCardPress]
  );

  const keyExtractor = useCallback((item: any, index: number) => {
    return item.report_id || item.id || `rescue-${index}`;
  }, []);

  if (state.isOffline) {
    return (
      <View style={themedStyles.loadingContainer}>
        <Ionicons
          name="wifi-outline"
          size={64}
          color={theme.colors.onSurface}
        />
        <Text style={themedStyles.offlineText}>No internet connection</Text>
        <Text style={themedStyles.offlineSubtext}>
          Please check your network settings
        </Text>
      </View>
    );
  }

  return (
    <View style={themedStyles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={themedStyles.header}>
          <View style={themedStyles.headerRow}>
            <View style={themedStyles.headerTextContainer}>
              <Text style={themedStyles.greeting}>{getGreeting()},</Text>
              <Text style={themedStyles.userName}>
                {userProfile?.name || "User"}
              </Text>
              <View style={themedStyles.headerSubRow}>
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text style={themedStyles.subText}>{state.address}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={themedStyles.headerNotifContainer}
              onPress={handleNotificationPress}
            >
              <Ionicons
                name="notifications-outline"
                size={24}
                color={theme.colors.onSurface}
              />
              {(state.notifications.filter((n) => !n.is_read).length > 0 ||
                filteredRescueCases.length > 0) && (
                <Badge style={themedStyles.notifBadge} size={20}>
                  {state.notifications.filter((n) => !n.is_read).length ||
                    filteredRescueCases.length}
                </Badge>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Ad Banner */}
        <AdBanner />

        {/* ✅ Emergency Cases Section - Updated title */}
        <Surface style={themedStyles.miniCardsSection}>
          <View style={themedStyles.sectionHeader}>
            <Text style={themedStyles.sectionTitle}>
              🚨 Emergency Cases{" "}
              {acceptedReports.length > 0 &&
                `(${filteredRescueCases.length} remaining)`}
            </Text>
          </View>

          {filteredRescueCases.length > 0 ? (
            <FlatList
              data={filteredRescueCases}
              renderItem={renderMiniRescueCard}
              keyExtractor={keyExtractor}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          ) : (
            <View style={themedStyles.emptyState}>
              <Text style={themedStyles.emptyStateText}>
                {acceptedReports.length > 0
                  ? "All nearby cases are being tracked!"
                  : "No emergency cases in your area"}
              </Text>
              <Text style={themedStyles.emptyStateSubtext}>
                {acceptedReports.length > 0
                  ? "Check 'My Tracking Reports' below 📊"
                  : "All animals are safe! 🐾"}
              </Text>
            </View>
          )}
        </Surface>

        {/* ✅ Map Section */}
        <Surface style={themedStyles.mapSection}>
          <View style={themedStyles.mapHeader}>
            <Text style={themedStyles.sectionTitle}>📍 Live Rescue Map</Text>
            <IconButton
              icon="refresh"
              size={20}
              onPress={async () => {
                updateState({ mapRefreshing: true });
                await fetchNearbyReports();
                updateState({ mapRefreshing: false });
              }}
            />
          </View>

          {state.mapRefreshing ? (
            <View style={themedStyles.mapLoadingContainer}>
              <Text style={themedStyles.mapLoadingText}>Refreshing map...</Text>
            </View>
          ) : (
            <LeafletMap
              userLocation={state.userLocation}
              rescueCases={filteredRescueCases}
              radius={state.radius}
              theme={theme}
            />
          )}

          {/* Radius Selection */}
          <View style={themedStyles.radiusContainer}>
            <Text style={themedStyles.radiusLabel}>🎯 Search Radius</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={themedStyles.radiusChipsContainer}
            >
              {radiusOptions.map((option) => (
                <Chip
                  key={option}
                  selected={state.radius === option}
                  onPress={() => onRadiusSelect(option)}
                  style={[
                    themedStyles.radiusChip,
                    state.radius === option && themedStyles.selectedRadiusChip,
                  ]}
                  textStyle={[
                    themedStyles.radiusChipText,
                    state.radius === option &&
                      themedStyles.selectedRadiusChipText,
                  ]}
                >
                  {option}
                </Chip>
              ))}
            </ScrollView>
          </View>
        </Surface>

        {/* ✅ My Tracking Reports Section - Always visible when there are tracking reports */}
        <Surface style={themedStyles.trackingSection}>
          <View style={themedStyles.sectionHeader}>
            <Text style={themedStyles.sectionTitle}>
              📊 My Tracking Reports{" "}
              {trackingReportsFromRedux.length > 0 &&
                `(${trackingReportsFromRedux.length})`}
            </Text>
          </View>

          {trackingReportsFromRedux.length > 0 ? (
            <FlatList
              data={trackingReportsFromRedux}
              renderItem={renderTrackingCard}
              keyExtractor={keyExtractor}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          ) : (
            <View style={themedStyles.emptyState}>
              <Text style={themedStyles.emptyStateText}>
                No tracking reports yet
              </Text>
              <Text style={themedStyles.emptyStateSubtext}>
                Accept some reports to start tracking! 📋
              </Text>
            </View>
          )}
        </Surface>

        {/* Ad Banner */}
        <AdBanner />

        {/* ✅ Notifications Section */}
        {state.notifications.length > 0 && (
          <Surface style={themedStyles.notificationSection}>
            <View style={themedStyles.sectionHeader}>
              <Text style={themedStyles.sectionTitle}>🔔 Recent Updates</Text>
            </View>

            {state.notifications.slice(0, 3).map((notification, index) => (
              <TouchableOpacity
                key={index}
                style={themedStyles.notificationItem}
                onPress={() => {
                  if (notification.report) {
                    handleMiniCardPress(notification.report);
                  }
                }}
              >
                <View style={themedStyles.notificationContent}>
                  <View
                    style={[
                      themedStyles.notificationDot,
                      {
                        backgroundColor: notification.is_read
                          ? theme.colors.outline
                          : theme.colors.primary,
                      },
                    ]}
                  />
                  <View style={themedStyles.notificationTextContainer}>
                    <Text
                      style={[
                        themedStyles.notificationTitle,
                        !notification.is_read &&
                          themedStyles.notificationTitleUnread,
                      ]}
                    >
                      {notification.title}
                    </Text>
                    <Text style={themedStyles.notificationMessage}>
                      {notification.message}
                    </Text>
                    <Text style={themedStyles.notificationTime}>
                      {new Date(notification.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </Surface>
        )}
      </ScrollView>

      {/* ✅ Detail Modal */}
      <Modal
        visible={state.showModal}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={themedStyles.modalContainer}>
          <View style={themedStyles.modalHeader}>
            <Text style={themedStyles.modalTitle}>Rescue Report Details</Text>
            <IconButton
              icon="close"
              size={24}
              onPress={closeModal}
              style={themedStyles.modalCloseButton}
            />
          </View>
          {state.selectedRescue && (
            <ScrollView style={{ flex: 1 }}>
              <StrayRescueCard
                rescue={state.selectedRescue}
                onReportStatusUpdate={handleReportStatusUpdate}
              />
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingBottom: 90,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      padding: 20,
    },
    offlineText: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.onSurface,
      marginTop: 16,
      textAlign: "center",
    },
    offlineSubtext: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginTop: 8,
      textAlign: "center",
    },
    header: {
      paddingTop: 50,
      paddingBottom: 5,
      paddingHorizontal: 18,
      backgroundColor: theme.colors.background,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    headerTextContainer: {
      flex: 1,
    },
    greeting: {
      fontSize: 18,
      color: theme.colors.onSurfaceVariant,
      fontWeight: "400",
      fontFamily: "sans-serif",
    },
    userName: {
      fontSize: 28,
      color: theme.colors.onSurface,
      fontWeight: "600",
      fontStyle: "italic",
      fontFamily: "serif",
      marginBottom: 8,
    },
    headerSubRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 1,
    },
    subText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginLeft: 6,
      flex: 1,
    },
    headerNotifContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 12,
      position: "relative",
      elevation: 2,
    },
    notifBadge: {
      position: "absolute",
      top: -4,
      right: -4,
      backgroundColor: theme.colors.error,
    },
    trackingSection: {
    marginTop: 14,
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 16,
    elevation: 1,
    paddingVertical: 12, // ✅ Increased padding
    height: 260, // ✅ Reduced height to fit content properly
    backgroundColor: theme.colors.surface,
  },

  miniCardsSection: {
    marginTop: 14,
    marginHorizontal: 14,
    marginBottom: 20,
    borderRadius: 16,
    elevation: 1,
    paddingVertical: 12, // ✅ Increased padding
    height: 260, // ✅ Consistent height
    backgroundColor: theme.colors.surface,
  },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      marginBottom: 9,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.onSurface,
    },
    refreshChip: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outline,
    },
    emptyState: {
      alignItems: "center",
      padding: 32,
    },
    emptyStateText: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.onSurface,
      marginTop: 16,
      textAlign: "center",
    },
    emptyStateSubtext: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginTop: 4,
      textAlign: "center",
    },
    mapSection: {
      marginTop: 4,
      marginHorizontal: 16,
      marginBottom: 10,
      borderRadius: 16,
      overflow: "hidden",
      elevation: 4,
      backgroundColor: theme.colors.surface,
    },
    mapHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 10,
    },
    mapLoadingContainer: {
      height: 250,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.surfaceVariant,
    },
    mapLoadingText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginTop: 8,
    },
    radiusContainer: {
      padding: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline + "30",
    },
    radiusLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.onSurface,
      marginBottom: 2,
    },
    radiusChipsContainer: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 4,
    },
    radiusChip: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outline,
    },
    selectedRadiusChip: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    radiusChipText: {
      color: theme.colors.onSurface,
      fontSize: 12,
    },
    selectedRadiusChipText: {
      color: theme.colors.onPrimary,
      fontWeight: "600",
    },
    notificationSection: {
      margin: 16,
      borderRadius: 16,
      elevation: 1,
      paddingVertical: 16,
      backgroundColor: theme.colors.surface,
    },
    notificationItem: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline + "20",
    },
    notificationContent: {
      flexDirection: "row",
      alignItems: "center",
    },
    notificationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 12,
    },
    notificationTextContainer: {
      flex: 1,
    },
    notificationTitle: {
      fontSize: 14,
      color: theme.colors.onSurface,
      marginBottom: 2,
    },
    notificationTitleUnread: {
      fontWeight: "600",
    },
    notificationMessage: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
    },
    notificationTime: {
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      padding: 5,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline + "30",
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.onSurface,
    },
    modalCloseButton: {
      backgroundColor: theme.colors.surfaceVariant,
    },
  });
