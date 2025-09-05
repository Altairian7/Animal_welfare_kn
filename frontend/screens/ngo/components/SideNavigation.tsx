import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Animated,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import {
  Surface,
  Text,
  Avatar,
  Chip,
  List,
  Badge,
  Button,
  Divider,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../../../theme';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, persistor } from '../../../core/redux/store';
import { logoutUser } from '../../../core/redux/slices/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SideNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  setSidebarOpen: (open: boolean) => void;
  ngoData?: any;
  dashboardStats?: any;
}

interface NavItem {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge: string | null;
}

// Helper function to safely create rgba colors from hex
const createRgbaColor = (hexColor: string, opacity: number): string => {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Handle 3-digit hex
  let fullHex = hex;
  if (hex.length === 3) {
    fullHex = hex.split('').map(char => char + char).join('');
  }
  
  // Extract RGB values
  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Helper function to get safe color with opacity
const getSafeColorWithOpacity = (color: string, opacity: number): string => {
  if (!color) {
    return `rgba(0, 0, 0, ${opacity})`;
  }
  
  // If it's already rgba, just return it
  if (color.startsWith('rgba')) {
    return color;
  }
  
  // If it's already rgb, convert to rgba
  if (color.startsWith('rgb')) {
    return color.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
  }
  
  // If it's hex, convert to rgba
  if (color.startsWith('#')) {
    return createRgbaColor(color, opacity);
  }
  
  // For named colors or other formats, use transparent fallback
  return `rgba(0, 0, 0, ${opacity})`;
};

const SideNavigation: React.FC<SideNavigationProps> = ({
  activeTab,
  setActiveTab,
  setSidebarOpen,
  ngoData,
  dashboardStats
}) => {
  const { theme } = useThemeContext();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const dimensions = useWindowDimensions();
  
  // Animations
  const [animatedValue] = useState(new Animated.Value(0));
  const sidebarWidth = Math.min(280, dimensions.width * 0.8);

  // Start animation on mount
  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Dynamic navigation items with real data
  const navigationItems: NavItem[] = useMemo(() => [
    {
      key: 'profile',
      title: 'Profile',
      icon: 'person',
      badge: null
    },
    {
      key: 'reports',
      title: 'Assigned Reports',
      icon: 'document-text',
      badge: dashboardStats?.active_reports > 0 ? dashboardStats.active_reports.toString() : null
    },
    {
      key: 'stats',
      title: 'Dashboard Stats',
      icon: 'stats-chart',
      badge: null
    },
    {
      key: 'timeline',
      title: 'Report Timeline',
      icon: 'time',
      badge: null
    },
    {
      key: 'volunteers',
      title: 'Volunteer Requests',
      icon: 'people',
      badge: dashboardStats?.pending_applications > 0 ? dashboardStats.pending_applications.toString() : null
    },
  ], [dashboardStats]);

  // Handle logout with confirmation
  const handleLogout = useCallback(async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear all local storage data
              const keysToRemove = [
                'activeTab',
                'currentNGOId',
                'ngoId',
                'user_info',
                'userProfile',
                'authToken',
                'refreshToken',
                'JWT_TOKEN',
                'entity_id'
              ];
              await AsyncStorage.multiRemove(keysToRemove);

              // Purge redux-persist state
              await persistor.purge();

              // Dispatch logout action
              dispatch(logoutUser());

              // Navigate to auth screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('Logout failed:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  }, [dispatch, navigation]);

  // Handle navigation item press
  const handleNavPress = useCallback((key: string) => {
    setActiveTab(key);
    setSidebarOpen(false);
  }, [setActiveTab, setSidebarOpen]);

  // Render navigation item
  const renderNavItem = useCallback((item: NavItem, index: number) => (
    <Animated.View
      key={item.key}
      style={{
        opacity: animatedValue,
        transform: [{
          translateX: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [-20, 0],
          })
        }]
      }}
    >
      <List.Item
        title={item.title}
        left={(props) => (
          <View style={styles(theme).navItemIcon}>
            <Ionicons 
              name={item.icon} 
              size={22} 
              color={activeTab === item.key ? theme.colors.primary : theme.colors.text} 
            />
          </View>
        )}
        right={() => item.badge ? (
          <Badge style={styles(theme).navBadge}>
            {item.badge}
          </Badge>
        ) : null}
        onPress={() => handleNavPress(item.key)}
        style={[
          styles(theme).navItem,
          activeTab === item.key && styles(theme).activeNavItem
        ]}
        titleStyle={[
          styles(theme).navItemText,
          activeTab === item.key && styles(theme).activeNavItemText
        ]}
        accessibilityLabel={item.title}
        accessibilityRole="menuitem"
      />
    </Animated.View>
  ), [activeTab, theme, handleNavPress, animatedValue]);

  return (
    <>
      {/* Backdrop */}
      <TouchableOpacity
        style={styles(theme).backdrop}
        activeOpacity={1}
        onPress={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <Animated.View
        style={[
          styles(theme).sidebar,
          {
            width: sidebarWidth,
            transform: [{
              translateX: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [-sidebarWidth, 0],
              })
            }]
          }
        ]}
      >
        <Surface style={styles(theme).sidebarContent}>
          {/* Profile Section */}
          <View style={styles(theme).profileSection}>
            <View style={styles(theme).avatarContainer}>
              <Avatar.Image
                size={60}
                source={{ 
                  uri: ngoData?.image || `https://picsum.photos/200/200?random=${ngoData?.id || 'ngo'}` 
                }}
                style={styles(theme).profileAvatar}
              />
              {ngoData?.is_verified && (
                <View style={styles(theme).statusIndicator} />
              )}
            </View>
            <Text style={styles(theme).profileName} numberOfLines={2}>
              {ngoData?.name || 'NGO Name'}
            </Text>
            <Text style={styles(theme).profileEmail} numberOfLines={1}>
              {ngoData?.email || 'ngo@email.com'}
            </Text>
            {ngoData?.is_verified && (
              <Chip style={styles(theme).verifiedChip} textStyle={styles(theme).verifiedText}>
                ✅ Verified NGO
              </Chip>
            )}
          </View>


          {/* Navigation Section */}
          <View style={styles(theme).navigationSection}>
            {navigationItems.map((item, index) => renderNavItem(item, index))}
          </View>

          {/* Footer Section */}
          <View style={styles(theme).sidebarFooter}>
            {/* Quick Stats */}
            {/* <View style={styles(theme).quickStats}>
              <Text style={styles(theme).quickStatsTitle}>Quick Stats</Text>
              <Text style={styles(theme).quickStatsText}>
                Active Reports: {dashboardStats?.active_reports || 0}
              </Text>
              <Text style={styles(theme).quickStatsText}>
                Pending Volunteers: {dashboardStats?.pending_applications || 0}
              </Text>
              <Text style={styles(theme).quickStatsText}>
                Success Rate: {dashboardStats?.success_rate || 0}%
              </Text>
            </View> */}

            {/* Logout Button */}
            <Button
              mode="outlined"
              onPress={handleLogout}
              style={styles(theme).logoutButton}
              labelStyle={styles(theme).logoutButtonText}
              icon="logout"
            >
              Logout
            </Button>
          </View>
        </Surface>
      </Animated.View>
    </>
  );
};

const styles = (theme: any) => StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 998,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  sidebarContent: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  profileSection: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline || '#E5E5E5',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profileAvatar: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  profileName: {
    color: theme.colors.text,
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 4,
  },
  profileEmail: {
    color: theme.colors.primary,
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 8,
  },
  verifiedChip: {
    backgroundColor: getSafeColorWithOpacity(theme.colors.primary, 0.2),
    height: 28,
  },
  verifiedText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '600',
  },
  divider: {
    backgroundColor: theme.colors.outline || '#E5E5E5',
    marginVertical: 8,
  },
  navigationSection: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  navItem: {
    borderRadius: 12,
    marginVertical: 2,
    paddingVertical: 4,
  },
  activeNavItem: {
    backgroundColor: getSafeColorWithOpacity(theme.colors.primary, 0.15),
  },
  navItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  navItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  activeNavItemText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  navBadge: {
    backgroundColor: theme.colors.error,
    color: theme.colors.surface,
    fontSize: 12,
    marginRight: 8,
  },
  sidebarFooter: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline || '#E5E5E5',
  },
  quickStats: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.outline || '#E5E5E5',
  },
  quickStatsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  quickStatsText: {
    fontSize: 12,
    color: theme.colors.primary,
    marginBottom: 4,
  },
  logoutButton: {
    borderColor: theme.colors.error,
    borderWidth: 1,
    borderRadius: 12,
  },
  logoutButtonText: {
    color: theme.colors.error,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SideNavigation;
