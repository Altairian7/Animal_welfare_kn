// UserProfileScreen.tsx - Complete Version with AsyncStorage (React Native Compatible)
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  Share,
} from "react-native";
import {
  Text,
  Surface,
  Avatar,
  Button,
  IconButton,
  TextInput,
  Switch,
  Chip,
  Card,
  ActivityIndicator,
  Snackbar,
  Divider,
  Badge,
} from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useNavigation } from "@react-navigation/native";
import { useThemeContext } from "../../theme";
import { useAppDispatch } from "../../core/redux/store";
import { logoutUser } from "../../core/redux/slices/authSlice";
import usersApi from "../../api/usersApi";

// Enhanced Type definitions matching backend structure
interface UserProfile {
  appwrite_user_id?: string;
  name: string;
  email: string;
  is_volunteer?: boolean;
  latitude?: number;
  longitude?: number;
  bio?: string;
  avatar_url?: string;
  notification_preferences?: NotificationPreferences;
  created_at?: string;
  updated_at?: string;
  // Extra fields stored locally (not in backend)
  phone?: string | null;
  title?: string | null;
  address?: string | null;
}

interface AccountType {
  account_type: string;
}

interface Report {
  id?: string;
  report_id?: string;
  title?: string;
  status?: string;
  created_at?: string;
  severity?: string;
  location?: string;
}

interface NotificationPreferences {
  injury_reports?: boolean;
  volunteer_updates?: boolean;
  emergency_alerts?: boolean;
  general?: boolean;
  digest_frequency?: string;
  // Frontend mapping
  email_notifications: boolean;
  push_notifications: boolean;
}

interface ProfileScreenState {
  user: UserProfile | null;
  accountType: AccountType | null;
  loading: boolean;
  refreshing: boolean;
  editMode: boolean;
  saveLoading: boolean;
  locationLoading: boolean;
  avatarLoading: boolean;
  showAvatarModal: boolean;
  userReports: Report[];
  helperReports: Report[];
  editData: Partial<UserProfile>;
  notificationPrefs: NotificationPreferences;
  showSnackbar: boolean;
  snackbarMessage: string;
  snackbarType: 'success' | 'error';
  profileCompletion: number;
}

const UserProfileScreen: React.FC = () => {
  const { theme } = useThemeContext();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();

  const [state, setState] = useState<ProfileScreenState>({
    user: null,
    accountType: null,
    loading: true,
    refreshing: false,
    editMode: false,
    saveLoading: false,
    locationLoading: false,
    avatarLoading: false,
    showAvatarModal: false,
    userReports: [],
    helperReports: [],
    editData: {
      name: "",
      title: "",
      phone: "",
      address: "",
      bio: "",
      latitude: null,
      longitude: null,
    },
    notificationPrefs: {
      email_notifications: true,
      push_notifications: true,
      emergency_alerts: true,
    },
    showSnackbar: false,
    snackbarMessage: '',
    snackbarType: 'success',
    profileCompletion: 0,
  });

  const updateState = useCallback((updates: Partial<ProfileScreenState>): void => {
    setState(prevState => ({ ...prevState, ...updates }));
  }, []);

  const showFeedback = useCallback((message: string, type: 'success' | 'error' = 'success'): void => {
    updateState({
      showSnackbar: true,
      snackbarMessage: message,
      snackbarType: type
    });
  }, [updateState]);

  const cleanField = useCallback((value: string | undefined | null): string | null => {
    if (value === null || value === undefined) return null;
    const trimmed = value.toString().trim();
    return trimmed === '' ? null : trimmed;
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<boolean> => {
    updateState({ locationLoading: true });
    try {
      console.log('🔄 Requesting location permissions...');
      let { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required', 
          'Location permission is required to save your profile with accurate location data.',
          [
            { 
              text: 'Skip Location', 
              style: 'cancel', 
              onPress: () => {
                updateState({ locationLoading: false });
                return false;
              }
            },
            { 
              text: 'Grant Permission', 
              onPress: async () => {
                const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
                if (newStatus === 'granted') {
                  return await getCurrentLocation();
                } else {
                  updateState({ locationLoading: false });
                  return false;
                }
              }
            }
          ]
        );
        return false;
      }

      console.log('📍 Getting current location...');
      let locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const coords = {
        latitude: locationResult.coords.latitude,
        longitude: locationResult.coords.longitude
      };
      
      updateState({
        editData: {
          ...state.editData,
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
        locationLoading: false
      });
      
      console.log('✅ Location obtained:', coords);
      showFeedback('Location updated successfully!');
      return true;

    } catch (error) {
      console.error('❌ Error getting location:', error);
      updateState({ locationLoading: false });
      Alert.alert(
        'Location Error', 
        'Could not get your current location. You can still save your profile without precise location data.',
        [
          { text: 'Continue Without Location', style: 'default' },
          { text: 'Try Again', onPress: getCurrentLocation }
        ]
      );
      return false;
    }
  }, [state.editData, updateState, showFeedback]);

  const calculateProfileCompletion = useCallback((profile: UserProfile | null): number => {
    if (!profile) return 0;
    
    const fields = [
      profile.name,
      profile.email,
      profile.phone,
      profile.title,
      profile.bio,
      profile.address,
      profile.avatar_url,
    ];
    
    console.log('📊 Profile completion check:', {
      name: !!profile.name,
      email: !!profile.email,
      phone: !!(profile.phone && profile.phone.toString().trim()),
      title: !!(profile.title && profile.title.toString().trim()),
      bio: !!(profile.bio && profile.bio.toString().trim()),
      address: !!(profile.address && profile.address.toString().trim()),
      avatar: !!profile.avatar_url,
    });
    
    const completedFields = fields.filter(field => field && field.toString().trim().length > 0).length;
    return Math.round((completedFields / fields.length) * 100);
  }, []);

  const formatJoinDate = useCallback((dateString?: string): string => {
    if (!dateString) return 'Recently joined';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Joined yesterday';
    if (diffDays < 7) return `Joined ${diffDays} days ago`;
    if (diffDays < 30) return `Joined ${Math.ceil(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `Joined ${Math.ceil(diffDays / 30)} months ago`;
    
    return `Joined ${date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    })}`;
  }, []);

  const handleShareProfile = useCallback(async (): Promise<void> => {
    try {
      const user = state.user;
      const profileStats = {
        name: user?.name || 'Animal Rescue Volunteer',
        title: user?.title || 'Animal Welfare Supporter',
        location: user?.address || 'Location not specified',
        reportsCreated: state.userReports.length,
        casesHelped: state.helperReports.length,
        volunteerStatus: user?.is_volunteer ? 'Active Volunteer' : 'Supporter',
        joinDate: formatJoinDate(user?.created_at),
        profileCompletion: state.profileCompletion
      };

      const message = `🐾 ${profileStats.name} - Animal Rescue Profile\n\n` +
        `👤 ${profileStats.title}\n` +
        `📍 Location: ${profileStats.location}\n` +
        `📊 Profile: ${profileStats.profileCompletion}% Complete\n\n` +
        `📈 Impact Summary:\n` +
        `  • Reports Created: ${profileStats.reportsCreated}\n` +
        `  • Cases Helped: ${profileStats.casesHelped}\n` +
        `  • Status: ${profileStats.volunteerStatus}\n\n` +
        `📅 ${profileStats.joinDate}\n\n` +
        `Join our mission to help animals in need! 🐕🐱`;

      await Share.share({
        message,
        title: `${profileStats.name} - Animal Rescue Profile`
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage !== 'User did not share') {
        showFeedback('Failed to share profile', 'error');
      }
    }
  }, [state.user, state.userReports, state.helperReports, state.profileCompletion, formatJoinDate, showFeedback]);

  // ✅ FIXED: Enhanced profile data fetching with AsyncStorage
  const fetchProfileData = useCallback(async (showLoader: boolean = true): Promise<void> => {
    try {
      if (showLoader) {
        updateState({ loading: true });
      }
      
      console.log('🔄 Fetching profile data from backend + AsyncStorage...');
      
      const [
        profileResult,
        accountResult,
        reportsResult,
        helpedResult,
        extraFieldsResult,
      ] = await Promise.allSettled([
        usersApi.getProfile(),
        usersApi.getAccountType(),
        usersApi.getUserReports(),
        usersApi.getHelperReports(),
        usersApi.getExtraFields(),
      ]);

      const backendProfile = profileResult.status === 'fulfilled' ? profileResult.value as UserProfile : null;
      const accountType = accountResult.status === 'fulfilled' ? accountResult.value as AccountType : null;
      const userReports = reportsResult.status === 'fulfilled' ? (reportsResult.value as Report[]) || [] : [];
      const helperReports = helpedResult.status === 'fulfilled' ? (helpedResult.value as Report[]) || [] : [];
      const extraFields = extraFieldsResult.status === 'fulfilled' ? extraFieldsResult.value || {} : {};

      console.log('🔍 Backend profile data:', backendProfile);
      console.log('📱 Extra fields from AsyncStorage:', extraFields);

      // ✅ MERGE backend data with AsyncStorage extra fields
      const profile: UserProfile | null = backendProfile ? {
        ...backendProfile,
        phone: extraFields.phone || null,
        title: extraFields.title || null,
        address: extraFields.address || null,
      } : null;

      console.log('🔧 Complete merged profile:', profile);

      const completion = calculateProfileCompletion(profile);

      // ✅ Map backend notification preferences to frontend
      let frontendNotificationPrefs = {
        email_notifications: true,
        push_notifications: true,
        emergency_alerts: true,
      };

      if (profile?.notification_preferences) {
        frontendNotificationPrefs = {
          email_notifications: profile.notification_preferences.injury_reports || false,
          push_notifications: profile.notification_preferences.volunteer_updates || false,
          emergency_alerts: profile.notification_preferences.emergency_alerts || false,
        };
      }

      updateState({
        user: profile,
        accountType: accountType,
        editData: profile ? {
          name: profile.name || "",
          title: profile.title || "",
          address: profile.address || "",
          phone: profile.phone || "",
          bio: profile.bio || "",
          latitude: profile.latitude || null,
          longitude: profile.longitude || null,
        } : {
          name: "",
          title: "",
          address: "",
          phone: "",
          bio: "",
          latitude: null,
          longitude: null,
        },
        userReports,
        helperReports,
        notificationPrefs: frontendNotificationPrefs,
        profileCompletion: completion,
        loading: false,
        refreshing: false
      });

      console.log('✅ Complete profile data loaded successfully', {
        profileCompletion: completion,
        isVolunteer: profile?.is_volunteer,
        hasPhone: !!(profile?.phone && profile.phone.toString().trim()),
        hasTitle: !!(profile?.title && profile.title.toString().trim()),
        hasAddress: !!(profile?.address && profile.address.toString().trim()),
        hasCoordinates: !!(profile?.latitude && profile?.longitude),
      });
      
    } catch (error: unknown) {
      console.error("❌ Failed to load profile data:", error);
      showFeedback('Failed to load profile data', 'error');
      updateState({ loading: false, refreshing: false });
    }
  }, [updateState, showFeedback, calculateProfileCompletion]);

  // ✅ FIXED: Save profile with backend + AsyncStorage split
  const saveProfile = useCallback(async (): Promise<void> => {
    try {
      if (!state.editData.name || !state.editData.name.trim()) {
        showFeedback('Name is required', 'error');
        return;
      }

      updateState({ saveLoading: true });
      console.log('🔄 Saving profile data to backend + AsyncStorage...');
      
      let finalLatitude = state.editData.latitude;
      let finalLongitude = state.editData.longitude;
      
      if (!finalLatitude || !finalLongitude) {
        console.log('📍 No coordinates available, getting current location...');
        const locationObtained = await getCurrentLocation();
        
        if (locationObtained && state.editData.latitude && state.editData.longitude) {
          finalLatitude = state.editData.latitude;
          finalLongitude = state.editData.longitude;
        } else {
          finalLatitude = 0.0;
          finalLongitude = 0.0;
          console.log('⚠️ Using fallback coordinates (0.0, 0.0)');
        }
      }

      // ✅ Split data: Backend fields vs Extra fields
      const backendData = {
        name: state.editData.name.trim(),
        email: state.user?.email || "",
        bio: cleanField(state.editData.bio),
        is_volunteer: state.user?.is_volunteer || false,
        latitude: finalLatitude,
        longitude: finalLongitude,
        notification_preferences: state.notificationPrefs,
      };

      const extraData = {
        phone: cleanField(state.editData.phone),
        title: cleanField(state.editData.title),
        address: cleanField(state.editData.address),
      };

      console.log('📤 Sending to backend:', backendData);
      console.log('📱 Storing locally:', extraData);

      // ✅ Save to backend
      const updatedBackendProfile = await usersApi.updateProfile(backendData);
      console.log('✅ Backend profile updated:', updatedBackendProfile);

      // ✅ Save extra fields with AsyncStorage
      await usersApi.updateExtraFields(extraData);
      console.log('✅ Extra fields stored locally');

      // ✅ Merge updated data
      const completeProfile = {
        ...state.user,
        ...updatedBackendProfile,
        phone: extraData.phone,
        title: extraData.title,
        address: extraData.address,
        latitude: finalLatitude,
        longitude: finalLongitude,
      };
      
      const newCompletion = calculateProfileCompletion(completeProfile as UserProfile);
      
      updateState({
        user: completeProfile as UserProfile,
        editMode: false,
        saveLoading: false,
        profileCompletion: newCompletion
      });
      
      showFeedback(`Profile updated successfully! ${newCompletion}% complete.`);
      console.log('✅ Complete profile updated with hybrid storage');
      
      setTimeout(() => {
        console.log('🔄 Verifying data persistence...');
        fetchProfileData(false);
      }, 1000);
      
    } catch (error: unknown) {
      console.error("❌ Failed to save profile:", error);
      updateState({ saveLoading: false });
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('latitude') || errorMessage.includes('longitude')) {
        showFeedback('Location coordinates are required. Please enable location or try again.', 'error');
      } else {
        showFeedback('Failed to update profile. Please try again.', 'error');
      }
    }
  }, [state.editData, state.user, state.notificationPrefs, updateState, showFeedback, calculateProfileCompletion, getCurrentLocation, fetchProfileData, cleanField]);

  // ✅ Avatar upload with proper MediaType
  const handleAvatarUpload = useCallback(async (): Promise<void> => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "Please grant permission to access photos");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1] as [number, number],
        quality: 0.7,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        updateState({ avatarLoading: true });
        
        const asset = result.assets[0];
        const uri = asset.uri;
        const fileType = uri.substring(uri.lastIndexOf('.') + 1).toLowerCase();
        
        if (!['jpg', 'jpeg', 'png', 'webp'].includes(fileType)) {
          throw new Error('Please select a valid image file (JPG, PNG, or WebP)');
        }

        const fileSize = (asset as any).fileSize || (asset as any).size || 0;
        if (fileSize > 2 * 1024 * 1024) {
          throw new Error('Image size must be less than 2MB. Please choose a smaller image.');
        }

        const fileName = `avatar_${state.user?.appwrite_user_id || Date.now()}.${fileType}`;
        const file = { uri, name: fileName, type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}` };

        try {
          const uploadResponse = await usersApi.uploadAvatar(file);
          
          if (state.user) {
            const updatedUser = { ...state.user, avatar_url: uploadResponse.avatar_url || uploadResponse.avatar };
            const newCompletion = calculateProfileCompletion(updatedUser);
            
            updateState({
              user: updatedUser,
              showAvatarModal: false,
              avatarLoading: false,
              profileCompletion: newCompletion
            });
          }
          
          showFeedback('Profile picture updated successfully!');
        } catch (uploadError: any) {
          if (uploadError.message?.includes('500')) {
            throw new Error('Server error during upload. Please try again later.');
          } else {
            throw new Error(`Upload failed: ${uploadError.message}`);
          }
        }
      }
    } catch (error: unknown) {
      console.error("❌ Avatar upload failed:", error);
      updateState({ avatarLoading: false });
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload avatar';
      showFeedback(errorMessage, 'error');
    }
  }, [state.user, updateState, showFeedback, calculateProfileCompletion]);

  const toggleVolunteerStatus = useCallback(async (isVolunteer: boolean): Promise<void> => {
    if (!state.user) return;
    const originalStatus = state.user.is_volunteer;
    
    try {
      updateState({ user: { ...state.user, is_volunteer: isVolunteer } });
      const response = await usersApi.toggleVolunteerStatus(isVolunteer);
      updateState({ user: { ...state.user, is_volunteer: response.is_volunteer } });
      showFeedback(`Volunteer status ${isVolunteer ? 'enabled' : 'disabled'}`);
    } catch (error: unknown) {
      updateState({ user: { ...state.user, is_volunteer: originalStatus } });
      showFeedback('Failed to update volunteer status', 'error');
    }
  }, [state.user, updateState, showFeedback]);

  const updateNotificationPrefs = useCallback(async (newPrefs: NotificationPreferences): Promise<void> => {
    const oldPrefs = state.notificationPrefs;
    try {
      updateState({ notificationPrefs: newPrefs });
      await usersApi.updateNotificationPreferences(newPrefs);
      showFeedback('Notification preferences updated!');
    } catch (error: unknown) {
      updateState({ notificationPrefs: oldPrefs });
      showFeedback('Failed to update notification preferences', 'error');
    }
  }, [state.notificationPrefs, updateState, showFeedback]);

  const handleLogout = useCallback((): void => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Sign Out", 
        style: "destructive",
        onPress: async () => {
          try {
            // ✅ Clear AsyncStorage data on logout
            await usersApi.clearStoredData();
            await dispatch(logoutUser());
          } catch (error: unknown) {
            showFeedback('Logout failed', 'error');
          }
        }
      },
    ]);
  }, [dispatch, showFeedback]);

  useEffect(() => {
    fetchProfileData();
  }, []);

  if (state.loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 16, color: theme.colors.onSurface }}>Loading your profile...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingBottom: 80 }}>
      {/* Header */}
      <View style={{ 
        flexDirection: "row", 
        justifyContent: "space-between", 
        alignItems: "center", 
        padding: 20, 
        paddingTop: 60,
        backgroundColor: theme.colors.surface,
        elevation: 2,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize:40, fontFamily: "cursive", fontWeight: "800", color: theme.colors.primary, letterSpacing: 1  }}>Profile</Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant, marginRight: 8 }}>
              {state.profileCompletion}% Complete
            </Text>
            <View style={{ flex: 1, height: 4, backgroundColor: theme.colors.outline, borderRadius: 2, maxWidth: 100 }}>
              <View style={{ 
                width: `${state.profileCompletion}%`, 
                height: '100%', 
                backgroundColor: state.profileCompletion > 80 ? '#4CAF50' : state.profileCompletion > 50 ? '#FF9800' : '#F44336',
                borderRadius: 2 
              }} />
            </View>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <IconButton icon="share-variant" onPress={handleShareProfile} mode="contained" size={20} />
          <IconButton icon="cog" onPress={() => navigation.navigate('Settings')} mode="contained" size={20} />
        </View>
      </View>

      <ScrollView 
        refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => { updateState({ refreshing: true }); fetchProfileData(false); }} />}
        contentContainerStyle={{ padding: 20, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <Surface style={{ padding: 24, borderRadius: 20, backgroundColor: theme.colors.surface, alignItems: "center", gap: 16, elevation: 2 }}>
          {/* Avatar */}
          <TouchableOpacity onPress={() => updateState({ showAvatarModal: true })}>
            <View style={{ position: 'relative' }}>
              {state.user?.avatar_url ? (
                <Avatar.Image size={120} source={{ uri: state.user.avatar_url }} />
              ) : (
                <Avatar.Icon size={120} icon="account" style={{ backgroundColor: theme.colors.primaryContainer }} />
              )}
              <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: theme.colors.primary, borderRadius: 20, padding: 8 }}>
                <Ionicons name="camera" size={20} color={theme.colors.onPrimary} />
              </View>
              {state.profileCompletion === 100 && (
                <View style={{ position: 'absolute', top: 0, left: 0, backgroundColor: '#4CAF50', borderRadius: 15, padding: 4 }}>
                  <Ionicons name="checkmark" size={16} color="white" />
                </View>
              )}
            </View>
          </TouchableOpacity>
          
          {state.editMode ? (
            /* Edit Mode */
            <View style={{ width: "100%", gap: 12 }}>
              <TextInput 
                label="Full Name *" 
                value={state.editData.name || ""} 
                onChangeText={(text: string) => updateState({ editData: { ...state.editData, name: text } })}
                mode="outlined"
                error={!state.editData.name || !state.editData.name.trim()}
                left={<TextInput.Icon icon="account" />}
              />
              
              <TextInput 
                label="Title/Role" 
                value={state.editData.title || ""} 
                onChangeText={(text: string) => updateState({ editData: { ...state.editData, title: text } })}
                mode="outlined"
                left={<TextInput.Icon icon="briefcase" />}
                placeholder="e.g., Animal Lover, Veterinarian, Student"
              />
              
              <TextInput 
                label="Phone Number" 
                value={state.editData.phone || ""} 
                onChangeText={(text: string) => updateState({ editData: { ...state.editData, phone: text } })}
                mode="outlined"
                keyboardType="phone-pad"
                left={<TextInput.Icon icon="phone" />}
              />
              
              <TextInput 
                label="Address" 
                value={state.editData.address || ""} 
                onChangeText={(text: string) => updateState({ editData: { ...state.editData, address: text } })}
                mode="outlined"
                left={<TextInput.Icon icon="map-marker" />}
                placeholder="City, State, Country"
              />

              {/* Location Update Section */}
              <Surface style={{ padding: 16, borderRadius: 12, backgroundColor: theme.colors.surfaceVariant, borderWidth: 1, borderColor: theme.colors.outline }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: theme.colors.onSurface }}>📍 Current Location</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                      {state.editData.latitude && state.editData.longitude 
                        ? `Lat: ${state.editData.latitude.toFixed(4)}, Lng: ${state.editData.longitude.toFixed(4)}`
                        : "Location not set - click Update to get current location"}
                    </Text>
                  </View>
                  <Button
                    mode="contained"
                    onPress={getCurrentLocation}
                    loading={state.locationLoading}
                    disabled={state.locationLoading}
                    icon="crosshairs-gps"
                    compact
                    buttonColor={theme.colors.primary}
                  >
                    {state.locationLoading ? 'Getting...' : 'Update'}
                  </Button>
                </View>
              </Surface>
              
              <TextInput 
                label="Bio" 
                value={state.editData.bio || ""} 
                onChangeText={(text: string) => updateState({ editData: { ...state.editData, bio: text } })}
                mode="outlined"
                multiline
                numberOfLines={3}
                left={<TextInput.Icon icon="text" />}
                placeholder="Tell us about yourself..."
              />
              
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button 
                  mode="contained" 
                  onPress={saveProfile} 
                  style={{ flex: 1 }}
                  loading={state.saveLoading}
                  disabled={state.saveLoading || !state.editData.name || !state.editData.name.trim()}
                  icon="content-save"
                >
                  Save Changes
                </Button>
                <Button 
                  mode="outlined" 
                  onPress={() => updateState({ 
                    editMode: false, 
                    editData: state.user ? {
                      name: state.user.name || "",
                      title: state.user.title || "",
                      address: state.user.address || "",
                      phone: state.user.phone || "",
                      bio: state.user.bio || "",
                      latitude: state.user.latitude || null,
                      longitude: state.user.longitude || null,
                    } : { name: "", title: "", address: "", phone: "", bio: "", latitude: null, longitude: null }
                  })} 
                  style={{ flex: 1 }}
                  disabled={state.saveLoading}
                  icon="cancel"
                >
                  Cancel
                </Button>
              </View>
            </View>
          ) : (
            /* Display Mode */
            <View style={{ alignItems: "center", gap: 8, width: "100%" }}>
              <Text style={{ fontSize: 24, fontWeight: "700", color: theme.colors.onSurface, textAlign: "center" }}>
                {state.user?.name || "Complete Your Profile"}
              </Text>
              
              {state.user?.title && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="briefcase" size={16} color={theme.colors.primary} />
                  <Text style={{ fontSize: 16, color: theme.colors.primary, fontWeight: "500" }}>
                    {state.user.title}
                  </Text>
                </View>
              )}
              
              {state.user?.bio && (
                <Text style={{ fontSize: 14, color: theme.colors.onSurfaceVariant, textAlign: "center", marginTop: 8, lineHeight: 20, fontStyle: "italic" }}>
                  "{state.user.bio}"
                </Text>
              )}
              
              <View style={{ width: "100%", gap: 8, marginTop: 12 }}>
                {state.user?.phone && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" }}>
                    <Ionicons name="call" size={16} color={theme.colors.onSurfaceVariant} />
                    <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 14 }}>{state.user.phone}</Text>
                  </View>
                )}
                
                {state.user?.address && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" }}>
                    <Ionicons name="location" size={16} color={theme.colors.onSurfaceVariant} />
                    <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 14, textAlign: "center" }}>{state.user.address}</Text>
                  </View>
                )}
                
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 4 }}>
                  <Ionicons name="calendar" size={16} color={theme.colors.onSurfaceVariant} />
                  <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 14 }}>{formatJoinDate(state.user?.created_at)}</Text>
                </View>
              </View>
              
              <View style={{ flexDirection: "row", gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Chip key="account-type" mode="outlined" icon="account">{state.accountType?.account_type || "User"}</Chip>
                
                {state.user?.is_volunteer && (
                  <Chip key="volunteer-status" mode="flat" icon="heart" style={{ backgroundColor: theme.colors.primaryContainer }}>
                    Active Volunteer
                  </Chip>
                )}
                
                {state.profileCompletion === 100 && (
                  <Chip key="profile-complete" mode="flat" icon="check-circle" style={{ backgroundColor: '#E8F5E8' }} textStyle={{ color: '#2E7D32' }}>
                    Profile Complete
                  </Chip>
                )}
              </View>
              
              {/* <Button 
                mode="contained" 
                onPress={() => updateState({ 
                  editMode: true, 
                  editData: state.user ? {
                    name: state.user.name || "",
                    title: state.user.title || "",
                    address: state.user.address || "",
                    phone: state.user.phone || "",
                    bio: state.user.bio || "",
                    latitude: state.user.latitude || null,
                    longitude: state.user.longitude || null,
                  } : { name: "", title: "", address: "", phone: "", bio: "", latitude: null, longitude: null }
                })} 
                style={{ marginTop: 8 }}
                icon="pencil"
                buttonColor={theme.colors.primary}
              >
                Edit Profile
              </Button> */}
            </View>
          )}
        </Surface>

        {/* Impact Summary */}
        <Surface style={{ padding: 20, borderRadius: 20, backgroundColor: theme.colors.surface, elevation: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <Ionicons name="analytics" size={24} color={theme.colors.primary} />
            <Text style={{ fontSize: 18, fontWeight: "600", marginLeft: 8, color: theme.colors.onSurface }}>Impact Summary</Text>
          </View>
          
          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            {[
              { label: "Reports Created", value: state.userReports.length, icon: "document-text" as const, color: "#2196F3" },
              { label: "Cases Helped", value: state.helperReports.length, icon: "heart" as const, color: "#F44336" },
              { label: "Profile Score", value: `${state.profileCompletion}%`, icon: "star" as const, color: "#FF9800" },
            ].map((stat, index) => (
              <View key={`stat-${index}`} style={{ alignItems: "center", gap: 8, flex: 1 }}>
                <View style={{ backgroundColor: `${stat.color}20`, padding: 12, borderRadius: 50 }}>
                  <Ionicons name={stat.icon} size={24} color={stat.color} />
                </View>
                <Text style={{ fontSize: 20, fontWeight: "bold", color: theme.colors.onSurface }}>{stat.value}</Text>
                <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant, textAlign: "center" }}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </Surface>

        {/* Volunteer Status */}
        <Surface style={{ padding: 20, borderRadius: 20, backgroundColor: theme.colors.surface, elevation: 2 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <Ionicons name="heart" size={20} color={theme.colors.primary} />
                <Text style={{ fontSize: 16, fontWeight: "600", color: theme.colors.onSurface, marginLeft: 8 }}>Volunteer Status</Text>
              </View>
              <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                {state.user?.is_volunteer 
                  ? "You're helping animals in need! Thank you."
                  : "Enable to receive volunteer opportunities and help animals in your area."
                }
              </Text>
            </View>
            <Switch
              value={state.user?.is_volunteer || false}
              onValueChange={toggleVolunteerStatus}
              trackColor={{ false: theme.colors.outline, true: theme.colors.primary }}
            />
          </View>
        </Surface>

        {/* Notification Preferences */}
        <Surface style={{ padding: 20, borderRadius: 20, backgroundColor: theme.colors.surface, elevation: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <Ionicons name="notifications" size={24} color={theme.colors.primary} />
            <Text style={{ fontSize: 18, fontWeight: "600", marginLeft: 8, color: theme.colors.onSurface }}>Notification Preferences</Text>
          </View>
          
          {[
            { key: 'email_notifications' as keyof NotificationPreferences, label: 'Email Notifications', desc: 'Receive updates about injury reports', icon: 'mail' },
            { key: 'push_notifications' as keyof NotificationPreferences, label: 'Push Notifications', desc: 'Get instant volunteer updates', icon: 'notifications' },
            { key: 'emergency_alerts' as keyof NotificationPreferences, label: 'Emergency Alerts', desc: 'Urgent notifications for critical situations', icon: 'warning' },
          ].map((pref, index) => (
            <View key={pref.key}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 }}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name={pref.icon as any} size={20} color={state.notificationPrefs[pref.key] ? theme.colors.primary : theme.colors.onSurfaceVariant} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: theme.colors.onSurface }}>{pref.label}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant, marginTop: 2 }}>{pref.desc}</Text>
                  </View>
                </View>
                <Switch
                  value={state.notificationPrefs[pref.key]}
                  onValueChange={(value: boolean) => {
                    const newPrefs: NotificationPreferences = { ...state.notificationPrefs, [pref.key]: value };
                    updateNotificationPrefs(newPrefs);
                  }}
                  trackColor={{ false: theme.colors.outline, true: theme.colors.primary }}
                />
              </View>
              {index < 2 && <Divider style={{ marginVertical: 4 }} />}
            </View>
          ))}
        </Surface>

        {/* Logout */}
        <Surface style={{ padding: 20, borderRadius: 20, backgroundColor: theme.colors.errorContainer, marginBottom: 20, elevation: 2 }}>
          <Button mode="contained" onPress={handleLogout} buttonColor={theme.colors.error} textColor={theme.colors.onError} icon="logout" style={{ borderRadius: 12 }}>
            Sign Out
          </Button>
        </Surface>
      </ScrollView>

      {/* Avatar Modal */}
      <Modal visible={state.showAvatarModal} transparent animationType="slide" onRequestClose={() => updateState({ showAvatarModal: false })}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <Surface style={{ padding: 24, borderRadius: 20, margin: 20, width: '85%', maxWidth: 400, backgroundColor: theme.colors.surface }}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Ionicons name="camera" size={48} color={theme.colors.primary} />
              <Text style={{ fontSize: 18, fontWeight: '600', marginTop: 12, textAlign: 'center', color: theme.colors.onSurface }}>Update Profile Picture</Text>
            </View>
            <View style={{ gap: 12 }}>
              <Button mode="contained" onPress={handleAvatarUpload} loading={state.avatarLoading} disabled={state.avatarLoading} icon="image" style={{ borderRadius: 12 }}>
                {state.avatarLoading ? 'Uploading...' : 'Choose from Gallery'}
              </Button>
              <Button mode="outlined" onPress={() => updateState({ showAvatarModal: false })} disabled={state.avatarLoading} style={{ borderRadius: 12 }}>Cancel</Button>
            </View>
          </Surface>
        </View>
      </Modal>

      {/* Snackbar */}
      <Snackbar
        visible={state.showSnackbar}
        onDismiss={() => updateState({ showSnackbar: false })}
        duration={4000}
        style={{ backgroundColor: state.snackbarType === 'error' ? theme.colors.errorContainer : theme.colors.primaryContainer, borderRadius: 12, margin: 16 }}
        action={{ label: 'Close', onPress: () => updateState({ showSnackbar: false }), textColor: state.snackbarType === 'error' ? theme.colors.onErrorContainer : theme.colors.onPrimaryContainer }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name={state.snackbarType === 'error' ? 'alert-circle' : 'checkmark-circle'} size={20} color={state.snackbarType === 'error' ? theme.colors.onErrorContainer : theme.colors.onPrimaryContainer} style={{ marginRight: 8 }} />
          <Text style={{ color: state.snackbarType === 'error' ? theme.colors.onErrorContainer : theme.colors.onPrimaryContainer, flex: 1 }}>{state.snackbarMessage}</Text>
        </View>
      </Snackbar>
    </View>
  );
};

export default UserProfileScreen;
