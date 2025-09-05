import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  BackHandler,
  RefreshControl,
} from 'react-native';
import {
  Text,
  IconButton,
  ActivityIndicator,
  Badge,
  Card,
  Button,
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useThemeContext } from '../../theme';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppDispatch } from '../../core/redux/store';
import { persistor } from '../../core/redux/store';
import { logoutUser } from '../../core/redux/slices/authSlice';
import { ngoApi, APIError, NetworkError, AuthenticationError } from '../../api/ngoApi';

// Lazy-loaded components
const NGOProfile = React.lazy(() => import('./components/NGOProfile'));
const AssignedReports = React.lazy(() => import('./components/AssignedReports'));
const DashboardStats = React.lazy(() => import('./components/DashboardStats'));
const ReportTimeline = React.lazy(() => import('./components/ReportTimeline'));
const VolunteerRequests = React.lazy(() => import('./components/VolunteerRequests'));
const SideNavigation = React.lazy(() => import('./components/SideNavigation'));

// TypeScript interfaces
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
  image?: string;
  established?: string;
  created_at?: string;
}

interface DashboardStats {
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

type TabType = 'profile' | 'reports' | 'stats' | 'timeline' | 'volunteers';

const NGOAdminDashboard: React.FC = () => {
  const { theme } = useThemeContext();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();

  // Core state
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [ngoId, setNgoId] = useState<string | null>(null);
  const [ngoData, setNgoData] = useState<NGOData | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [notifications, setNotifications] = useState(0);

  // Get NGO ID from storage
  const getNGOId = useCallback(async (): Promise<string | null> => {
    try {
      // Check user_info first (your specific format)
      const userInfo = await AsyncStorage.getItem('user_info');
      if (userInfo && userInfo !== 'null') {
        const parsed = JSON.parse(userInfo);
        if (parsed.account_type === 'ngo' && parsed.entity_id) {
          return parsed.entity_id.toString();
        }
      }

      // Fallback to other possible keys
      const possibleKeys = ['currentNGOId', 'ngoId', 'NGO_ID'];
      for (const key of possibleKeys) {
        const id = await AsyncStorage.getItem(key);
        if (id && id !== 'null') {
          return id;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting NGO ID:', error);
      return null;
    }
  }, []);

  // Network status monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const currentNgoId = await getNGOId();
      if (!currentNgoId) {
        throw new Error('NGO ID not found. Please login again.');
      }

      setNgoId(currentNgoId);

      // Load data in parallel
      const [profileResult, statsResult] = await Promise.allSettled([
        ngoApi.getNGODetail(currentNgoId),
        ngoApi.getDashboardStats(currentNgoId),
      ]);

      // Handle profile data
      if (profileResult.status === 'fulfilled') {
        setNgoData(profileResult.value);
      } else {
        console.error('Failed to load profile:', profileResult.reason);
        if (profileResult.reason instanceof AuthenticationError) {
          throw profileResult.reason;
        }
        // Set minimal profile data for graceful degradation
        setNgoData({
          id: currentNgoId,
          ngo_id: currentNgoId,
          name: 'NGO Dashboard',
          email: 'Loading...',
          phone: 'Loading...',
          address: 'Loading...',
          city: 'Loading...',
          state: 'Loading...',
          description: 'Loading profile information...',
          is_verified: false,
        });
      }

      // Handle stats data
      if (statsResult.status === 'fulfilled') {
        setDashboardStats(statsResult.value);
        setNotifications(
          (statsResult.value.pending_applications || 0) + 
          (statsResult.value.active_reports || 0)
        );
      } else {
        console.error('Failed to load stats:', statsResult.reason);
        if (statsResult.reason instanceof AuthenticationError) {
          throw statsResult.reason;
        }
        // Set empty stats for graceful degradation
        setDashboardStats({
          total_reports: 0,
          active_reports: 0,
          completed_reports: 0,
          pending_reports: 0,
          total_volunteers: 0,
          active_volunteers: 0,
          new_volunteers: 0,
          success_rate: 0,
          pending_applications: 0,
          accepted_applications: 0,
          rejected_applications: 0,
        });
        setNotifications(0);
      }

    } catch (error: any) {
      console.error('Failed to load dashboard:', error);
      
      if (error instanceof AuthenticationError) {
        setError('Your session has expired. Please login again.');
        // Auto-logout after 3 seconds
        setTimeout(() => {
          handleLogout();
        }, 3000);
      } else if (error instanceof NetworkError) {
        setError('Network connection failed. Please check your internet connection.');
      } else {
        setError(error.message || 'Failed to load dashboard data.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getNGOId]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      // Clear storage
      const keysToRemove = [
        'user_info', 'currentNGOId', 'ngoId', 'authToken', 
        'refreshToken', 'activeTab', 'userProfile'
      ];
      await AsyncStorage.multiRemove(keysToRemove);

      // Purge redux-persist state
      await persistor.purge();

      // Dispatch logout
      dispatch(logoutUser());

      // Navigate to login
      navigation.reset({
        index: 0,
        routes: [{ name: 'LoginScreen' }],
      });
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Error', 'Failed to logout. Please restart the app.');
    }
  }, [dispatch, navigation]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData();
  }, [loadDashboardData]);

  // Initialize dashboard
  useFocusEffect(
    useCallback(() => {
      const initializeDashboard = async () => {
        // Load saved tab
        const savedTab = await AsyncStorage.getItem('activeTab');
        if (savedTab && ['profile', 'reports', 'stats', 'timeline', 'volunteers'].includes(savedTab)) {
          setActiveTab(savedTab as TabType);
        }
        
        // Load data
        await loadDashboardData();
      };

      initializeDashboard();
    }, [loadDashboardData])
  );

  // Handle back button
  useEffect(() => {
    const backAction = () => {
      if (sidebarOpen) {
        setSidebarOpen(false);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [sidebarOpen]);

  // Save active tab
  useEffect(() => {
    AsyncStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // Header info based on active tab
  const headerInfo = useMemo(() => {
    const stats = dashboardStats;
    const ngo = ngoData;

    switch (activeTab) {
      case 'profile':
        return {
          title: 'NGO Dashboard',
          subtitle: ngo?.name || 'Loading...',
          stats: `Active Reports: ${stats?.active_reports || 0}`,
        };
      case 'reports':
        return {
          title: 'Assigned Reports',
          subtitle: 'Manage rescue cases',
          stats: `${stats?.active_reports || 0} Active Cases`,
        };
      case 'stats':
        return {
          title: 'Dashboard Stats',
          subtitle: 'Performance metrics',
          stats: `${stats?.success_rate || 0}% Success Rate`,
        };
      case 'timeline':
        return {
          title: 'Report Timeline',
          subtitle: 'Activity history',
          stats: `${stats?.total_reports || 0} Total Reports`,
        };
      case 'volunteers':
        return {
          title: 'Volunteer Requests',
          subtitle: 'Manage applications',
          stats: `${stats?.pending_applications || 0} Pending Requests`,
        };
      default:
        return {
          title: 'NGO Dashboard',
          subtitle: ngo?.name || 'Loading...',
          stats: `Active Reports: ${stats?.active_reports || 0}`,
        };
    }
  }, [activeTab, dashboardStats, ngoData]);

  // Render content based on active tab
  const renderContent = useCallback(() => {
    if (!ngoId) return null;

    const commonProps = {
      ngoId,
      ngoData,
      dashboardStats,
      onRefresh,
      refreshing,
    };

    const components: Record<TabType, React.ComponentType<any>> = {
      profile: NGOProfile,
      reports: AssignedReports,
      stats: DashboardStats,
      timeline: ReportTimeline,
      volunteers: VolunteerRequests,
    };

    const Component = components[activeTab];
    
    return (
      <Suspense fallback={
        <View style={styles(theme).loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles(theme).loadingText}>Loading...</Text>
        </View>
      }>
        <Component {...commonProps} />
      </Suspense>
    );
  }, [activeTab, ngoId, ngoData, dashboardStats, onRefresh, refreshing, theme]);

  // Loading state
  if (loading) {
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles(theme).loadingTitle}>Loading NGO Dashboard...</Text>
        <Text style={styles(theme).loadingSubtitle}>Please wait while we load your data</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles(theme).errorContainer}>
        <Text style={styles(theme).errorTitle}>Something went wrong</Text>
        <Text style={styles(theme).errorMessage}>{error}</Text>
        <View style={styles(theme).errorActions}>
          <Button 
            mode="contained" 
            onPress={onRefresh}
            style={styles(theme).retryButton}
          >
            Try Again
          </Button>
          <Button 
            mode="outlined" 
            onPress={() => {
              Alert.alert(
                'Logout',
                'Are you sure you want to logout?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Logout', style: 'destructive', onPress: handleLogout },
                ]
              );
            }}
            style={styles(theme).logoutButton}
          >
            Logout & Login Again
          </Button>
        </View>
      </View>
    );
  }

  // Offline state
  if (isOffline) {
    return (
      <View style={styles(theme).errorContainer}>
        <Text style={styles(theme).errorTitle}>No Internet Connection</Text>
        <Text style={styles(theme).errorMessage}>
          Please check your network connection and try again.
        </Text>
        <Button mode="contained" onPress={onRefresh}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <View style={styles(theme).container}>
      {/* Header */}
      <View style={styles(theme).header}>
        <View style={styles(theme).headerRow}>
          {/* Sidebar Toggle */}
          <IconButton
            icon="menu"
            size={24}
            onPress={() => setSidebarOpen(true)}
            style={styles(theme).iconSpacing}
          />

          {/* Header Text */}
          <View style={styles(theme).headerTextContainer}>
            <Text style={styles(theme).greeting}>{headerInfo.title}</Text>
            <View style={styles(theme).headerSubRow}>
              <Text style={styles(theme).subText}>{headerInfo.subtitle}</Text>
              <View style={styles(theme).dot} />
              <Text style={styles(theme).subText}>{headerInfo.stats}</Text>
            </View>
          </View>

          {/* Header Actions */}
          <View style={styles(theme).headerActionsContainer}>
            {/* Notifications */}
            <View style={styles(theme).headerNotifContainer}>
              <IconButton
                icon={notifications > 0 ? 'bell' : 'bell-outline'}
                size={24}
                onPress={() => {
                  if (notifications > 0 && activeTab !== 'volunteers') {
                    setActiveTab('volunteers');
                  } else {
                    Alert.alert('Notifications', 'No new notifications');
                  }
                }}
              />
              {notifications > 0 && (
                <Badge style={styles(theme).notifBadge}>
                  {notifications}
                </Badge>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles(theme).main}>
        {/* Sidebar */}
        {sidebarOpen && (
          <>
            <View 
              style={styles(theme).backdrop} 
              onTouchStart={() => setSidebarOpen(false)}
            />
            <View style={styles(theme).sidebarContainer}>
              <Suspense fallback={<ActivityIndicator />}>
                <SideNavigation
                  activeTab={activeTab}
                  setActiveTab={(tab: string) => setActiveTab(tab as TabType)}
                  setSidebarOpen={setSidebarOpen}
                  ngoData={ngoData}
                  dashboardStats={dashboardStats}
                />
              </Suspense>
            </View>
          </>
        )}

        {/* Content */}
        <ScrollView
          style={styles(theme).contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {renderContent()}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    fontFamily: "cursive",
    backgroundColor: theme.colors.surface,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  greeting: {
    fontSize: 25.5,
    letterSpacing: 1,
    fontFamily: 'cursive',
    color: theme.colors.text,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  headerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
    marginHorizontal: 8,
  },
  iconSpacing: {
    margin: 0,
  },
  headerActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerNotifContainer: {
    position: 'relative',
    marginLeft: 8,
  },
  headerLogoutContainer: {
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: theme.colors.error,
    color: theme.colors.surface,
    fontSize: 10,
    minWidth: 18,
    height: 18,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 998,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    zIndex: 999,
    elevation: 16,
  },
  contentContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: theme.colors.background,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: theme.colors.primary,
    textAlign: 'center',
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
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    opacity: 0.8,
  },
  errorActions: {
    width: '100%',
    maxWidth: 300,
    gap: 16,
  },
  retryButton: {
    borderRadius: 12,
  },
  logoutButton: {
    borderRadius: 12,
    borderColor: theme.colors.error,
  },
});

export default NGOAdminDashboard;
