import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Animated,
  Alert,
  Linking,
} from "react-native";
import {
  Surface,
  Text,
  Button,
  Chip,
  Avatar,
  Card,
  ActivityIndicator,
  ProgressBar,
  Divider,
} from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { PieChart } from "react-native-chart-kit";
import { useThemeContext } from "../../../theme";
import {
  ngoApi,
  APIError,
  NetworkError,
  AuthenticationError,
} from "../../../api/ngoApi";
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';

type NGOProfileNavigationProp = StackNavigationProp<RootStackParamList, 'NGOProfile'>;

const screenWidth = Dimensions.get("window").width;

interface NGOData {
  id: string | number;
  ngo_id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  description: string;
  is_verified: boolean;
  specialization?: string;
  reports_count?: number;
  volunteers_count?: number;
  success_rate?: number;
  image?: string;
  established?: string;
  // ✅ NEW: Additional details from settings
  category?: string;
  website?: string;
  registration_number?: string;
  license_number?: string;
  latitude?: string;
  longitude?: string;
}

interface ChartData {
  name: string;
  population: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
}

interface NGOProfileProps {
  ngoId?: string;
  ngoData?: NGOData | null;
  dashboardStats?: any;
  onRefresh?: () => void;
  refreshing?: boolean;
}

// Helper functions for color handling
const createRgbaColor = (hexColor: string, opacity: number): string => {
  if (!hexColor || typeof hexColor !== 'string') return `rgba(0, 0, 0, ${opacity})`;
  
  try {
    const hex = hexColor.replace("#", "");
    let fullHex = hex;
    if (hex.length === 3) {
      fullHex = hex.split("").map((char) => char + char).join("");
    }
    
    const r = parseInt(fullHex.substring(0, 2), 16) || 0;
    const g = parseInt(fullHex.substring(2, 4), 16) || 0;
    const b = parseInt(fullHex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  } catch (error) {
    return `rgba(0, 0, 0, ${opacity})`;
  }
};

const getSafeColorWithOpacity = (color: string, opacity: number): string => {
  if (!color) return `rgba(0, 0, 0, ${opacity})`;
  if (color.startsWith("rgba")) return color;
  if (color.startsWith("rgb"))
    return color.replace("rgb", "rgba").replace(")", `, ${opacity})`);
  if (color.startsWith("#")) return createRgbaColor(color, opacity);
  return `rgba(0, 0, 0, ${opacity})`;
};

// ✅ NEW: Category icon mapping
const getCategoryIcon = (category: string): keyof typeof Ionicons.glyphMap => {
  const categoryIcons: { [key: string]: keyof typeof Ionicons.glyphMap } = {
    'animal_welfare': 'paw',
    'education': 'school',
    'healthcare': 'medical',
    'environment': 'leaf',
    'poverty': 'home',
    'disaster_relief': 'shield-checkmark',
    'women_empowerment': 'woman',
    'child_welfare': 'happy',
    'other': 'star',
  };
  return categoryIcons[category] || 'star';
};

// ✅ NEW: Format category for display
const formatCategory = (category: string): string => {
  const categoryLabels: { [key: string]: string } = {
    'animal_welfare': 'Animal Welfare',
    'education': 'Education',
    'healthcare': 'Healthcare',
    'environment': 'Environment',
    'poverty': 'Poverty Alleviation',
    'disaster_relief': 'Disaster Relief',
    'women_empowerment': 'Women Empowerment',
    'child_welfare': 'Child Welfare',
    'other': 'Other Services',
  };
  return categoryLabels[category] || category;
};

const NGOProfile: React.FC<NGOProfileProps> = ({
  ngoId: propNgoId,
  ngoData: parentNgoData,
  dashboardStats,
  onRefresh: parentOnRefresh,
  refreshing: parentRefreshing = false,
}) => {
  const { theme } = useThemeContext();
  const navigation = useNavigation<NGOProfileNavigationProp>();
  const user = useSelector((state: any) => state.auth.user);
  
  const realNgoId = useMemo(() => {
    const possibleIds = [
      user?.ngo_id,
      user?.id, 
      user?.organization_id,
      propNgoId,
      "14"
    ].filter(id => id && id !== user?.email);
    
    const numericId = possibleIds.find(id => /^\d+$/.test(String(id)));
    return numericId || possibleIds[0] || "14";
  }, [user, propNgoId]);

  const [animatedValue] = useState(new Animated.Value(0));
  const [ngoData, setNgoData] = useState<NGOData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNGOProfile = useCallback(async () => {
    if (!realNgoId) {
      setError("NGO ID not available. Please ensure you're logged in properly.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`🔄 Fetching NGO profile for ID: ${realNgoId}`);

      const response = await ngoApi.getNGODetail(realNgoId, false);

      console.log(`✅ Successfully fetched NGO profile:`, response);

      // ✅ ENHANCED: Include all new fields from settings
      const transformedData: NGOData = {
        id: response?.appwrite_user_id || response?.id || realNgoId,
        ngo_id: String(realNgoId),
        name: response?.name || response?.organization_name || "NGO Profile",
        email: response?.email || user?.email || "Not provided",
        phone: response?.phone || response?.contact_number || "Not provided",
        address: response?.address || 
                 (response?.latitude && response?.longitude ? 
                  `Lat: ${response.latitude}, Long: ${response.longitude}` : 
                  "Address not available"),
        city: response?.city || "Not specified",
        state: response?.state || "Not specified", 
        description: response?.description || response?.about || "No description available",
        is_verified: Boolean(response?.is_verified || response?.verified),
        specialization: response?.specialization || response?.category || response?.focus_area || "General",
        reports_count: dashboardStats?.total_reports || response?.reports_count || 0,
        volunteers_count: dashboardStats?.volunteers_count || response?.volunteers_count || 0,
        success_rate: dashboardStats?.success_rate || response?.success_rate || 0,
        image: response?.image || response?.logo || response?.profile_image,
        established: response?.established || response?.year_established,
        // ✅ NEW: Additional details
        category: response?.category || 'other',
        website: response?.website,
        registration_number: response?.registration_number,
        license_number: response?.license_number,
        latitude: response?.latitude,
        longitude: response?.longitude,
      };

      setNgoData(transformedData);

    } catch (err: any) {
      console.error("❌ Failed to fetch NGO profile:", err);
      
      if (err instanceof AuthenticationError) {
        setError("Your session has expired. Please login again.");
        Alert.alert(
          "Session Expired",
          "Your login session has expired. Please log in again.",
          [
            {
              text: "OK",
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'LoginScreen' }],
                });
              }
            }
          ]
        );
      } else if (err instanceof NetworkError) {
        setError("Network connection failed. Please check your internet and try again.");
      } else if (err instanceof APIError) {
        if (err.status === 404) {
          setError(`NGO with ID ${realNgoId} not found. Please contact support.`);
        } else if (err.status === 500) {
          setError("Server temporarily unavailable. Please try again in a few minutes.");
        } else {
          setError(`API Error: ${err.message}`);
        }
      } else {
        setError("Unable to load profile data. Please try again later.");
      }
      
      setNgoData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [realNgoId, user, dashboardStats, navigation]);

  useFocusEffect(
    useCallback(() => {
      if (parentNgoData && Object.keys(parentNgoData).length > 0) {
        setNgoData(parentNgoData);
        setLoading(false);
      } else {
        fetchNGOProfile();
      }
    }, [parentNgoData, fetchNGOProfile])
  );

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [animatedValue]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (parentOnRefresh) {
      parentOnRefresh();
    } else {
      await fetchNGOProfile();
    }
  }, [parentOnRefresh, fetchNGOProfile]);

  const safeNgoData = useMemo(() => {
    if (!ngoData) return null;
    
    return {
      ...ngoData,
      name: ngoData.name || "NGO Profile",
      email: ngoData.email || user?.email || "Unknown",
      phone: ngoData.phone || "Not provided",
      address: ngoData.address || "Address not available",
      city: ngoData.city || "Unknown",
      state: ngoData.state || "Unknown",
      description: ngoData.description || "No description available",
      reports_count: ngoData.reports_count || dashboardStats?.total_reports || 0,
      volunteers_count: ngoData.volunteers_count || 0,
      success_rate: ngoData.success_rate || 0,
    };
  }, [ngoData, user, dashboardStats]);

  // ✅ NEW: Calculate organization age
  const organizationAge = useMemo(() => {
    if (!safeNgoData?.established) return null;
    const currentYear = new Date().getFullYear();
    const establishedYear = parseInt(safeNgoData.established);
    if (isNaN(establishedYear)) return null;
    return currentYear - establishedYear;
  }, [safeNgoData?.established]);

  // Chart data
  const pieChartData = useMemo((): ChartData[] => {
    if (!safeNgoData) return [];
    
    const totalReports = dashboardStats?.total_reports || safeNgoData.reports_count || 0;
    const inProgress = dashboardStats?.in_progress || Math.floor(totalReports * 0.3);
    const resolved = dashboardStats?.resolved || Math.floor(totalReports * 0.6);
    const pending = Math.max(0, totalReports - inProgress - resolved);

    if (totalReports === 0) return [];

    return [
      {
        name: "Resolved",
        population: resolved,
        color: "#4CAF50",
        legendFontColor: theme.colors.onSurface || "#000000",
        legendFontSize: 12,
      },
      {
        name: "In Progress", 
        population: inProgress,
        color: "#F59E0B",
        legendFontColor: theme.colors.onSurface || "#000000",
        legendFontSize: 12,
      },
      {
        name: "Pending",
        population: pending,
        color: "#3B82F6",
        legendFontColor: theme.colors.onSurface || "#000000", 
        legendFontSize: 12,
      },
    ].filter((item) => item.population > 0);
  }, [safeNgoData, dashboardStats, theme]);

  const volunteerChartData = useMemo((): ChartData[] => {
    if (!safeNgoData) return [];
    
    const totalVolunteers = safeNgoData.volunteers_count || 0;
    const activeVolunteers = Math.floor(totalVolunteers * 0.8);
    const newVolunteers = Math.max(0, totalVolunteers - activeVolunteers);

    if (totalVolunteers === 0) return [];

    return [
      {
        name: "Active",
        population: activeVolunteers,
        color: theme.colors.primary || "#2196F3",
        legendFontColor: theme.colors.onSurface || "#000000",
        legendFontSize: 12,
      },
      {
        name: "New",
        population: newVolunteers,
        color: "#10B981",
        legendFontColor: theme.colors.onSurface || "#000000",
        legendFontSize: 12,
      },
    ].filter((item) => item.population > 0);
  }, [safeNgoData, theme]);

  // ✅ NEW: Open website handler
  const openWebsite = useCallback(() => {
    if (safeNgoData?.website) {
      Linking.openURL(safeNgoData.website).catch(() => {
        Alert.alert('Error', 'Unable to open website');
      });
    }
  }, [safeNgoData?.website]);

  // ✅ NEW: Open location handler
  const openLocation = useCallback(() => {
    if (safeNgoData?.latitude && safeNgoData?.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${safeNgoData.latitude},${safeNgoData.longitude}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Unable to open location');
      });
    }
  }, [safeNgoData?.latitude, safeNgoData?.longitude]);

  const renderStatCard = useCallback(
    (
      title: string,
      value: string | number,
      subtitle: string,
      icon: keyof typeof Ionicons.glyphMap,
      color: string
    ) => (
      <Animated.View
        key={title}
        style={[
          styles(theme).card,
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
        <Card style={styles(theme).cardBackground}>
          <Card.Content style={styles(theme).cardContent}>
            <View style={styles(theme).statHeader}>
              <View
                style={[
                  styles(theme).iconContainer,
                  { backgroundColor: getSafeColorWithOpacity(color, 0.2) },
                ]}
              >
                <Ionicons name={icon} size={24} color={color} />
              </View>
              <View style={styles(theme).statInfo}>
                <Text style={styles(theme).statValue}>{value}</Text>
                <Text style={styles(theme).statTitle}>{title}</Text>
                <Text style={styles(theme).statSubtitle}>{subtitle}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </Animated.View>
    ),
    [animatedValue, theme]
  );

  if (loading) {
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles(theme).loadingText}>Loading your NGO profile...</Text>
        <Text style={styles(theme).loadingSubText}>
          Fetching data for NGO ID: {realNgoId}
        </Text>
      </View>
    );
  }

  if (error || !safeNgoData) {
    return (
      <Surface style={styles(theme).container}>
        <View style={styles(theme).errorContainer}>
          <Ionicons name="warning-outline" size={64} color={theme.colors.primary} />
          <Text style={styles(theme).errorTitle}>Profile Not Available</Text>
          <Text style={styles(theme).errorText}>{error || "Unable to load profile data"}</Text>
          <Text style={styles(theme).debugText}>NGO ID: {realNgoId}</Text>
          <Button mode="contained" onPress={onRefresh} style={styles(theme).retryButton}>
            Try Again
          </Button>
        </View>
      </Surface>
    );
  }

  return (
    <Surface style={styles(theme).container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing || parentRefreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles(theme).headerSection}>
          <Card style={styles(theme).headerCard}>
            <Card.Content style={styles(theme).headerCardContent}>
              <View style={styles(theme).profileHeader}>
                <Avatar.Image
                  size={90}
                  source={safeNgoData.image ? { uri: safeNgoData.image } : undefined}
                  style={styles(theme).profileAvatar}
                />
                <View style={styles(theme).profileInfo}>
                  <Text style={styles(theme).ngoName}>{safeNgoData.name}</Text>
                  <Text style={styles(theme).ngoEmail}>{safeNgoData.email}</Text>
                  
                  {/* ✅ NEW: Category and Verification Row */}
                  <View style={styles(theme).verificationRow}>
                    {safeNgoData.category && (
                      <Chip
                        style={styles(theme).categoryChip}
                        textStyle={styles(theme).categoryText}
                        icon={() => (
                          <Ionicons 
                            name={getCategoryIcon(safeNgoData.category)} 
                            size={16} 
                            color={theme.colors.primary} 
                          />
                        )}
                      >
                        {formatCategory(safeNgoData.category)}
                      </Chip>
                    )}
                    
                    {safeNgoData.is_verified && (
                      <Chip
                        style={styles(theme).verifiedChip}
                        textStyle={styles(theme).verifiedText}
                      >
                        ✅ Verified
                      </Chip>
                    )}
                  </View>

                  {/* ✅ NEW: Establishment info */}
                  {(safeNgoData.established || organizationAge) && (
                    <View style={styles(theme).establishmentRow}>
                      <Ionicons name="calendar" size={14} color={theme.colors.primary} />
                      <Text style={styles(theme).establishedText}>
                        Est. {safeNgoData.established}
                        {organizationAge && ` • ${organizationAge} years of service`}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <Divider style={styles(theme).divider} />

              <Text style={styles(theme).description}>{safeNgoData.description}</Text>

              {/* ✅ NEW: Enhanced Contact & Organization Info */}
              <View style={styles(theme).contactInfo}>
                <View style={styles(theme).contactRow}>
                  <Ionicons name="call" size={16} color={theme.colors.primary} />
                  <Text style={styles(theme).contactText}>{safeNgoData.phone}</Text>
                </View>
                
                <TouchableOpacity 
                  style={styles(theme).contactRow}
                  onPress={openLocation}
                  disabled={!safeNgoData.latitude || !safeNgoData.longitude}
                >
                  <Ionicons name="location" size={16} color={theme.colors.primary} />
                  <Text style={[
                    styles(theme).contactText,
                    (safeNgoData.latitude && safeNgoData.longitude) && styles(theme).linkText
                  ]}>
                    {safeNgoData.address}
                    {(safeNgoData.latitude && safeNgoData.longitude) && " 📍"}
                  </Text>
                </TouchableOpacity>

                {safeNgoData.specialization && (
                  <View style={styles(theme).contactRow}>
                    <Ionicons name="star" size={16} color={theme.colors.primary} />
                    <Text style={styles(theme).contactText}>
                      Focus: {safeNgoData.specialization}
                    </Text>
                  </View>
                )}

                {/* ✅ NEW: Website link */}
                {safeNgoData.website && (
                  <TouchableOpacity style={styles(theme).contactRow} onPress={openWebsite}>
                    <Ionicons name="globe" size={16} color={theme.colors.primary} />
                    <Text style={[styles(theme).contactText, styles(theme).linkText]}>
                      {safeNgoData.website} 🔗
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card.Content>
          </Card>
        </View>

        {/* ✅ NEW: Organization Credentials */}
        {(safeNgoData.registration_number || safeNgoData.license_number) && (
          <View style={styles(theme).credentialsSection}>
            <Card style={styles(theme).credentialsCard}>
              <Card.Content>
                <View style={styles(theme).credentialsHeader}>
                  <Ionicons name="shield-checkmark" size={24} color={theme.colors.primary} />
                  <Text style={styles(theme).credentialsTitle}>Organization Credentials</Text>
                </View>
                
                <View style={styles(theme).credentialsGrid}>
                  {safeNgoData.registration_number && (
                    <View style={styles(theme).credentialItem}>
                      <Text style={styles(theme).credentialLabel}>Registration No.</Text>
                      <Text style={styles(theme).credentialValue}>{safeNgoData.registration_number}</Text>
                    </View>
                  )}
                  
                  {safeNgoData.license_number && (
                    <View style={styles(theme).credentialItem}>
                      <Text style={styles(theme).credentialLabel}>License No.</Text>
                      <Text style={styles(theme).credentialValue}>{safeNgoData.license_number}</Text>
                    </View>
                  )}
                </View>
              </Card.Content>
            </Card>
          </View>
        )}

        {/* ✅ NEW: Impact & Progress Section */}
        <View style={styles(theme).impactSection}>
          <Card style={styles(theme).impactCard}>
            <Card.Content>
              <View style={styles(theme).impactHeader}>
                <Ionicons name="trending-up" size={24} color="#4CAF50" />
                <Text style={styles(theme).impactTitle}>Our Impact</Text>
              </View>
              
              <View style={styles(theme).impactMetrics}>
                <View style={styles(theme).impactItem}>
                  <Text style={styles(theme).impactValue}>{safeNgoData.reports_count}</Text>
                  <Text style={styles(theme).impactLabel}>Cases Handled</Text>
                  <ProgressBar 
                    progress={Math.min(safeNgoData.reports_count / 100, 1)} 
                    color="#4CAF50"
                    style={styles(theme).progressBar}
                  />
                </View>
                
                <View style={styles(theme).impactItem}>
                  <Text style={styles(theme).impactValue}>{safeNgoData.success_rate}%</Text>
                  <Text style={styles(theme).impactLabel}>Success Rate</Text>
                  <ProgressBar 
                    progress={safeNgoData.success_rate / 100} 
                    color="#2196F3"
                    style={styles(theme).progressBar}
                  />
                </View>
                
                <View style={styles(theme).impactItem}>
                  <Text style={styles(theme).impactValue}>{safeNgoData.volunteers_count}</Text>
                  <Text style={styles(theme).impactLabel}>Active Volunteers</Text>
                  <ProgressBar 
                    progress={Math.min(safeNgoData.volunteers_count / 50, 1)} 
                    color="#FF9800"
                    style={styles(theme).progressBar}
                  />
                </View>
              </View>
            </Card.Content>
          </Card>
        </View>

        {/* Charts Section */}
        {(pieChartData.length > 0 || volunteerChartData.length > 0) && (
          <View style={styles(theme).chartsSection}>
            <Text style={styles(theme).sectionTitle}>Statistics Overview</Text>

            {pieChartData.length > 0 && (
              <Card style={styles(theme).chartCard}>
                <Card.Content style={styles(theme).chartCardContent}>
                  <Text style={styles(theme).chartTitle}>Reports Distribution</Text>
                  <Text style={styles(theme).chartSubtitle}>
                    Total: {dashboardStats?.total_reports || safeNgoData.reports_count || 0} reports
                  </Text>
                  <PieChart
                    data={pieChartData}
                    width={screenWidth - 80}
                    height={220}
                    chartConfig={{
                      backgroundColor: "transparent",
                      backgroundGradientFrom: "transparent",
                      backgroundGradientTo: "transparent",
                      color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    }}
                    accessor="population"
                    backgroundColor="transparent"
                    paddingLeft="15"
                    absolute={false}
                    hasLegend={true}
                  />
                </Card.Content>
              </Card>
            )}

            {volunteerChartData.length > 0 && (
              <Card style={styles(theme).chartCard}>
                <Card.Content style={styles(theme).chartCardContent}>
                  <Text style={styles(theme).chartTitle}>Volunteer Distribution</Text>
                  <Text style={styles(theme).chartSubtitle}>
                    Total: {safeNgoData.volunteers_count || 0} volunteers
                  </Text>
                  <PieChart
                    data={volunteerChartData}
                    width={screenWidth - 80}
                    height={220}
                    chartConfig={{
                      backgroundColor: "transparent",
                      backgroundGradientFrom: "transparent", 
                      backgroundGradientTo: "transparent",
                      color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    }}
                    accessor="population"
                    backgroundColor="transparent"
                    paddingLeft="15"
                    absolute={false}
                  />
                </Card.Content>
              </Card>
            )}
          </View>
        )}

        {/* Quick Stats Cards */}
        <View style={styles(theme).quickStatsSection}>
          <Text style={styles(theme).sectionTitle}>Quick Metrics</Text>
          <View style={styles(theme).statsGrid}>
            {renderStatCard(
              "Success Rate",
              `${safeNgoData.success_rate || 0}%`,
              "Cases resolved",
              "checkmark-circle",
              "#4CAF50"
            )}
            {renderStatCard(
              "In Progress",
              (dashboardStats?.in_progress || 0).toString(),
              "Active cases",
              "time",
              "#F59E0B"
            )}
            {renderStatCard(
              "Total Reports",
              (dashboardStats?.total_reports || safeNgoData.reports_count || 0).toString(),
              "All time",
              "document-text",
              "#2196F3"
            )}
            {renderStatCard(
              "Resolved",
              (dashboardStats?.resolved || 0).toString(),
              "Completed cases",
              "checkmark-done",
              "#4CAF50"
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles(theme).actionsSection}>
          <Text style={styles(theme).sectionTitle}>Quick Actions</Text>
          <View style={styles(theme).actionsGrid}>
            <TouchableOpacity
              style={styles(theme).actionCard}
              onPress={() => {
                Alert.alert("Coming Soon", "View assigned reports feature will be available soon.");
              }}
            >
              <View style={styles(theme).actionIcon}>
                <Ionicons name="document-text" size={28} color={theme.colors.primary} />
              </View>
              <Text style={styles(theme).actionTitle}>View Reports</Text>
              <Text style={styles(theme).actionSubtitle}>Assigned reports</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles(theme).actionCard}
              onPress={() => {
                Alert.alert("Coming Soon", "Volunteer management feature will be available soon.");
              }}
            >
              <View style={styles(theme).actionIcon}>
                <Ionicons name="people" size={28} color={theme.colors.primary} />
              </View>
              <Text style={styles(theme).actionTitle}>Volunteers</Text>
              <Text style={styles(theme).actionSubtitle}>Manage applications</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles(theme).actionCard}
              onPress={onRefresh}
            >
              <View style={styles(theme).actionIcon}>
                <Ionicons name="refresh" size={28} color={theme.colors.primary} />
              </View>
              <Text style={styles(theme).actionTitle}>Refresh Stats</Text>
              <Text style={styles(theme).actionSubtitle}>Update metrics</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles(theme).actionCard}
              onPress={() => {
                navigation.navigate("NGOSettings", { ngoId: realNgoId });
              }}
            >
              <View style={styles(theme).actionIcon}>
                <Ionicons name="settings" size={28} color={theme.colors.primary} />
              </View>
              <Text style={styles(theme).actionTitle}>Settings</Text>
              <Text style={styles(theme).actionSubtitle}>Organization settings</Text>
            </TouchableOpacity>
          </View>
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
  headerSection: {
    margin: 16,
  },
  headerCard: {
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    elevation: 4,
  },
  headerCardContent: {
    padding: 20,
  },
  profileHeader: {
    flexDirection: "row",
    marginBottom: 20,
  },
  profileAvatar: {
    marginRight: 20,
    borderWidth: 3,
    borderColor: theme.colors.primary,
  },
  profileInfo: {
    flex: 1,
    justifyContent: "center",
  },
  ngoName: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  ngoEmail: {
    fontSize: 16,
    color: theme.colors.primary,
    marginBottom: 12,
  },
  verificationRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  categoryChip: {
    backgroundColor: getSafeColorWithOpacity(theme.colors.primary, 0.15),
    marginRight: 8,
    marginBottom: 4,
  },
  categoryText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  verifiedChip: {
    backgroundColor: getSafeColorWithOpacity("#4CAF50", 0.15),
    marginBottom: 4,
  },
  verifiedText: {
    color: "#4CAF50",
    fontSize: 12,
    fontWeight: "600",
  },
  establishmentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  establishedText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: "500",
    marginLeft: 6,
  },
  divider: {
    marginVertical: 16,
    backgroundColor: theme.colors.outline || "#E5E5E5",
  },
  description: {
    fontSize: 15,
    color: theme.colors.onSurface,
    lineHeight: 22,
    marginBottom: 16,
  },
  contactInfo: {
    gap: 12,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: theme.colors.onSurface,
    marginLeft: 12,
    flex: 1,
  },
  linkText: {
    color: theme.colors.primary,
    textDecorationLine: "underline",
  },
  // ✅ NEW: Credentials section styles
  credentialsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  credentialsCard: {
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    elevation: 2,
  },
  credentialsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  credentialsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.onSurface,
    marginLeft: 12,
  },
  credentialsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  credentialItem: {
    alignItems: "center",
    flex: 1,
  },
  credentialLabel: {
    fontSize: 12,
    color: theme.colors.primary,
    marginBottom: 4,
  },
  credentialValue: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.onSurface,
    textAlign: "center",
  },
  // ✅ NEW: Impact section styles
  impactSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  impactCard: {
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    elevation: 2,
  },
  impactHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  impactTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.onSurface,
    marginLeft: 12,
  },
  impactMetrics: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  impactItem: {
    alignItems: "center",
    flex: 1,
  },
  impactValue: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.primary,
    marginBottom: 4,
  },
  impactLabel: {
    fontSize: 12,
    color: theme.colors.onSurface,
    textAlign: "center",
    marginBottom: 8,
  },
  progressBar: {
    width: 60,
    height: 4,
    borderRadius: 2,
  },
  chartsSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.onSurface,
    marginBottom: 16,
  },
  chartCard: {
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    marginBottom: 16,
    elevation: 3,
  },
  chartCardContent: {
    padding: 16,
    alignItems: "center",
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 14,
    color: theme.colors.primary,
    marginBottom: 12,
  },
  quickStatsSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    marginBottom: 16,
  },
  cardBackground: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    elevation: 3,
  },
  cardContent: {
    padding: 16,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statInfo: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.onSurface,
  },
  statTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.onSurface,
  },
  statSubtitle: {
    fontSize: 13,
    color: theme.colors.primary,
  },
  actionsSection: {
    marginHorizontal: 16,
    marginTop: 32,
    marginBottom: 40,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  actionCard: {
    width: "48%",
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    elevation: 3,
    marginBottom: 16,
  },
  actionIcon: {
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.onSurface,
    textAlign: "center",
  },
  actionSubtitle: {
    fontSize: 12,
    color: theme.colors.primary,
    textAlign: "center",
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
    color: theme.colors.onSurface,
    fontWeight: "600",
  },
  loadingSubText: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.primary,
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.onSurface,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.onSurface,
    textAlign: "center",
    marginBottom: 8,
    opacity: 0.7,
  },
  debugText: {
    fontSize: 12,
    color: theme.colors.primary,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 16,
  },
});

export default NGOProfile;
