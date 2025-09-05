import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Alert, Linking, Platform } from "react-native";
import {
  Text,
  Card,
  Switch,
  List,
  Button,
  Divider,
  IconButton,
  Modal,
  Portal,
  TextInput as PaperTextInput,
  Chip,
  RadioButton,
  Surface,
} from "react-native-paper";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useThemeContext } from "../../theme";
import { useSelector } from "react-redux";
import { logoutUser } from "../../core/redux/slices/authSlice";
import { useAppDispatch } from "../../core/redux/store";
import pushNotificationService from "../../services/PushNotificationService";
import Toast from 'react-native-toast-message';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import usersApi from "../../api/usersApi";

// Settings API
const settingsApi = {
  async updateUserSettings(userId: string, settings: any) {
    try {
      const token = await import('../../api/authService').then(m => m.default.ensureFreshToken());
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/user/${userId}/settings/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update settings');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Settings API error:', error);
      throw error;
    }
  },

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    try {
      const token = await import('../../api/authService').then(m => m.default.ensureFreshToken());
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/user/${userId}/change-password/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to change password');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Change password API error:', error);
      throw error;
    }
  },

  async getUserSettings(userId: string) {
    try {
      const token = await import('../../api/authService').then(m => m.default.ensureFreshToken());
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/user/${userId}/settings/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to get settings');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get settings API error:', error);
      return null;
    }
  }
};

export default function SettingsScreen() {
  const { theme, toggleTheme, isDark } = useThemeContext();
  const dispatch = useAppDispatch();
  const { user, accountType } = useSelector((state: any) => state.auth);
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [dataUsageModalVisible, setDataUsageModalVisible] = useState(false);
  const [twoFactorModalVisible, setTwoFactorModalVisible] = useState(false);

  // FIXED - Edit Profile form data with proper initialization
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    bio: '',
    title: '',
    address: '',
    latitude: null as number | null,
    longitude: null as number | null,
    avatar_url: '',
  });

  const [locationLoading, setLocationLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Change Password form data
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Privacy settings
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: 'public',
    showEmail: true,
    showPhone: false,
    dataCollection: true,
    analyticsOptOut: false,
  });

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
    loadProfileData();
  }, [user]);

  // FIXED - Load profile data function
  const loadProfileData = async () => {
    try {
      console.log('🔄 Loading profile data...');
      const [profileResult, extraFieldsResult] = await Promise.allSettled([
        usersApi.getProfile(),
        usersApi.getExtraFields(),
      ]);

      const backendProfile = profileResult.status === 'fulfilled' ? profileResult.value : null;
      const extraFields = extraFieldsResult.status === 'fulfilled' ? extraFieldsResult.value || {} : {};

      console.log('📊 Backend profile:', backendProfile);
      console.log('📱 Extra fields:', extraFields);

      if (backendProfile || extraFields) {
        const newProfileData = {
          name: backendProfile?.name || '',
          email: backendProfile?.email || user?.email || '',
          bio: backendProfile?.bio || '',
          latitude: backendProfile?.latitude || null,
          longitude: backendProfile?.longitude || null,
          avatar_url: backendProfile?.avatar_url || '',
          phone: extraFields.phone || '',
          title: extraFields.title || '',
          address: extraFields.address || '',
        };
        
        console.log('✅ Setting profile data:', newProfileData);
        setProfileData(newProfileData);
      }
    } catch (error) {
      console.error('❌ Error loading profile data:', error);
    }
  };

  // FIXED - Get current location function
  const getCurrentLocation = async (): Promise<boolean> => {
    setLocationLoading(true);
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
                setLocationLoading(false);
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
                  setLocationLoading(false);
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
      
      setProfileData(prev => ({
        ...prev,
        latitude: coords.latitude,
        longitude: coords.longitude,
      }));
      
      setLocationLoading(false);
      console.log('✅ Location obtained:', coords);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Location updated successfully!',
      });
      return true;

    } catch (error) {
      console.error('❌ Error getting location:', error);
      setLocationLoading(false);
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
  };

  // FIXED - Handle avatar upload function
  const handleAvatarUpload = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "Please grant permission to access photos");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setAvatarLoading(true);
        
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

        const fileName = `avatar_${user?.id || user?.$id || Date.now()}.${fileType}`;
        const file = { uri, name: fileName, type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}` };

        try {
          const uploadResponse = await usersApi.uploadAvatar(file);
          
          setProfileData(prev => ({
            ...prev,
            avatar_url: uploadResponse.avatar_url || uploadResponse.avatar
          }));
          
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: 'Profile picture updated successfully!',
          });
        } catch (uploadError: any) {
          if (uploadError.message?.includes('500')) {
            throw new Error('Server error during upload. Please try again later.');
          } else {
            throw new Error(`Upload failed: ${uploadError.message}`);
          }
        }
        
        setAvatarLoading(false);
      }
    } catch (error: unknown) {
      console.error("❌ Avatar upload failed:", error);
      setAvatarLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload avatar';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
    }
  };

  // FIXED - Save profile function with proper backend updates
  const handleSaveProfile = async () => {
    try {
      console.log('🔄 Starting profile save with data:', profileData);
      
      if (!profileData.name || !profileData.name.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Name is required',
        });
        return;
      }

      setSaveLoading(true);
      
      let finalLatitude = profileData.latitude;
      let finalLongitude = profileData.longitude;
      
      // Get location if not available
      if (!finalLatitude || !finalLongitude) {
        console.log('📍 No coordinates available, getting current location...');
        const locationObtained = await getCurrentLocation();
        
        if (locationObtained && profileData.latitude && profileData.longitude) {
          finalLatitude = profileData.latitude;
          finalLongitude = profileData.longitude;
          console.log('✅ Location obtained:', { finalLatitude, finalLongitude });
        } else {
          finalLatitude = 0.0;
          finalLongitude = 0.0;
          console.log('⚠️ Using fallback coordinates (0.0, 0.0)');
        }
      }

      // Helper function to clean fields
      const cleanField = (value: string | undefined | null): string | null => {
        if (value === null || value === undefined) return null;
        const trimmed = value.toString().trim();
        return trimmed === '' ? null : trimmed;
      };

      // Split data: Backend fields vs Extra fields
      const backendData = {
        name: profileData.name.trim(),
        email: profileData.email || user?.email || "",
        bio: cleanField(profileData.bio),
        latitude: finalLatitude,
        longitude: finalLongitude,
      };

      const extraData = {
        phone: cleanField(profileData.phone),
        title: cleanField(profileData.title),
        address: cleanField(profileData.address),
      };

      console.log('📤 Sending to backend:', backendData);
      console.log('📱 Storing locally:', extraData);

      // Save to backend
      const updatedBackendProfile = await usersApi.updateProfile(backendData);
      console.log('✅ Backend profile updated:', updatedBackendProfile);

      // Save extra fields with AsyncStorage
      await usersApi.updateExtraFields(extraData);
      console.log('✅ Extra fields stored locally');
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Profile updated successfully!',
      });
      
      setEditProfileModalVisible(false);
      
      // Refresh profile data
      setTimeout(() => {
        console.log('🔄 Verifying data persistence...');
        loadProfileData();
      }, 1000);
      
    } catch (error: unknown) {
      console.error("❌ Failed to save profile:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('latitude') || errorMessage.includes('longitude')) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Location coordinates are required. Please enable location or try again.',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to update profile. Please try again.',
        });
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const [notifications, location, sound, vibration] = await Promise.all([
        AsyncStorage.getItem('notificationsEnabled'),
        AsyncStorage.getItem('locationEnabled'),
        AsyncStorage.getItem('soundEnabled'),
        AsyncStorage.getItem('vibrationEnabled'),
      ]);

      setNotificationsEnabled(notifications !== 'false');
      setLocationEnabled(location !== 'false');
      setSoundEnabled(sound !== 'false');
      setVibrationEnabled(vibration !== 'false');

      if (user?.id || user?.$id) {
        const serverSettings = await settingsApi.getUserSettings(user.id || user.$id);
        if (serverSettings) {
          setNotificationsEnabled(serverSettings.notificationsEnabled ?? true);
          setLocationEnabled(serverSettings.locationEnabled ?? true);
          setSoundEnabled(serverSettings.soundEnabled ?? true);
          setVibrationEnabled(serverSettings.vibrationEnabled ?? true);
          
          if (serverSettings.privacy) {
            setPrivacySettings({ ...privacySettings, ...serverSettings.privacy });
          }
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load settings',
      });
    }
  };

  const updateSetting = async (key: string, value: boolean) => {
    try {
      await AsyncStorage.setItem(key, value.toString());

      if (user?.id || user?.$id) {
        const settingsUpdate = { [key]: value };
        await settingsApi.updateUserSettings(user.id || user.$id, settingsUpdate);
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `${key.replace('Enabled', '')} ${value ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update setting',
      });
    }
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      Alert.alert(
        "Enable Push Notifications",
        "You'll receive alerts for nearby rescue cases, emergency alerts, and volunteer updates. Do you want to continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Enable",
            onPress: async () => {
              try {
                setLoading(true);
                const token = await pushNotificationService.initialize(user?.$id || user?.id);
                
                if (token) {
                  setNotificationsEnabled(true);
                  await updateSetting('notificationsEnabled', true);
                  
                  Alert.alert(
                    "Success!",
                    "Push notifications have been enabled. You will now receive:\n• General notifications\n• Emergency alerts\n• Volunteer updates\n• Injury reports"
                  );
                } else {
                  throw new Error("Failed to get push token");
                }
              } catch (error) {
                console.error("Error enabling notifications:", error);
                Alert.alert(
                  "Error",
                  "Failed to enable push notifications. Please check your device settings and try again."
                );
                setNotificationsEnabled(false);
              } finally {
                setLoading(false);
              }
            }
          }
        ]
      );
    } else {
      Alert.alert(
        "Disable Notifications",
        "You'll stop receiving push notifications. You can re-enable them anytime.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: async () => {
              setNotificationsEnabled(false);
              await updateSetting('notificationsEnabled', false);
            }
          }
        ]
      );
    }
  };

  const handleTestNotification = async () => {
    try {
      if (!notificationsEnabled) {
        Alert.alert("Notifications Disabled", "Please enable push notifications first to test them.");
        return;
      }

      setLoading(true);
      await pushNotificationService.sendTestNotification();
      
      try {
        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/notifications/notifications/send-test/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${await import('../../api/authService').then(m => m.default.ensureFreshToken())}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          Alert.alert("Test Sent!", "Check for notifications - you should receive both a local test and a backend test notification.");
        }
      } catch (backendError) {
        console.log("Backend test failed, but local test was sent:", backendError);
        Alert.alert("Local Test Sent", "A test notification was sent locally. Backend test may not be available.");
      }
    } catch (error) {
      console.error("Test notification error:", error);
      Alert.alert("Error", "Failed to send test notification.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    try {
      setLoading(true);
      
      if (user?.id || user?.$id) {
        await settingsApi.changePassword(
          user.id || user.$id,
          passwordData.oldPassword,
          passwordData.newPassword
        );
        
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Password changed successfully',
        });
        
        setPasswordData({
          oldPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        
        setChangePasswordModalVisible(false);
      }
    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert('Error', error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrivacySettings = async () => {
    try {
      setLoading(true);
      
      if (user?.id || user?.$id) {
        await settingsApi.updateUserSettings(user.id || user.$id, {
          privacy: privacySettings
        });
        
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Privacy settings updated',
        });
        
        setPrivacyModalVisible(false);
      }
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update privacy settings',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await usersApi.clearStoredData();
              await dispatch(logoutUser()).unwrap();
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Logged out successfully',
              });
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert("Error", "Failed to logout. Please try again.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // FIXED - Enhanced Edit Profile Modal with working text inputs
  const EditProfileModal = () => (
    <Portal>
      <Modal
        visible={editProfileModalVisible}
        onDismiss={() => setEditProfileModalVisible(false)}
        contentContainerStyle={styles(theme).modalContainer}
      >
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Card style={styles(theme).modalCard}>
            <Card.Content>
              <Text variant="titleLarge" style={[styles(theme).modalTitle, { color: theme.colors.primary }]}>
                Edit Profile
              </Text>
              
              {/* Avatar Upload Section */}
              <Surface style={styles(theme).avatarSection}>
                <Text style={styles(theme).sectionLabel}>Profile Picture</Text>
                <Button
                  mode="outlined"
                  onPress={handleAvatarUpload}
                  loading={avatarLoading}
                  disabled={avatarLoading}
                  icon="camera"
                  style={styles(theme).avatarButton}
                >
                  {avatarLoading ? 'Uploading...' : 'Change Avatar'}
                </Button>
                {profileData.avatar_url && (
                  <Text style={styles(theme).helperText}>
                    ✅ Profile picture uploaded
                  </Text>
                )}
              </Surface>
              
              <PaperTextInput
                label="Full Name *"
                value={profileData.name || ''}
                onChangeText={(text) => {
                  console.log('Name changed to:', text);
                  setProfileData(prev => ({ ...prev, name: text }));
                }}
                style={styles(theme).input}
                mode="outlined"
                error={!profileData.name || !profileData.name.trim()}
                left={<PaperTextInput.Icon icon="account" />}
                autoFocus={false}
                editable={true}
              />
              
              <PaperTextInput
                label="Title/Role"
                value={profileData.title || ''}
                onChangeText={(text) => {
                  console.log('Title changed to:', text);
                  setProfileData(prev => ({ ...prev, title: text }));
                }}
                style={styles(theme).input}
                mode="outlined"
                left={<PaperTextInput.Icon icon="briefcase" />}
                placeholder="e.g., Animal Lover, Veterinarian, Student"
                editable={true}
              />
              
              <PaperTextInput
                label="Email"
                value={profileData.email || ''}
                onChangeText={(text) => {
                  console.log('Email changed to:', text);
                  setProfileData(prev => ({ ...prev, email: text }));
                }}
                style={styles(theme).input}
                mode="outlined"
                keyboardType="email-address"
                left={<PaperTextInput.Icon icon="email" />}
                editable={true}
              />
              
              <PaperTextInput
                label="Phone Number"
                value={profileData.phone || ''}
                onChangeText={(text) => {
                  console.log('Phone changed to:', text);
                  setProfileData(prev => ({ ...prev, phone: text }));
                }}
                style={styles(theme).input}
                mode="outlined"
                keyboardType="phone-pad"
                left={<PaperTextInput.Icon icon="phone" />}
                editable={true}
              />
              
              <PaperTextInput
                label="Address"
                value={profileData.address || ''}
                onChangeText={(text) => {
                  console.log('Address changed to:', text);
                  setProfileData(prev => ({ ...prev, address: text }));
                }}
                style={styles(theme).input}
                mode="outlined"
                left={<PaperTextInput.Icon icon="map-marker" />}
                placeholder="City, State, Country"
                editable={true}
              />

              {/* Location Update Section - FIXED */}
              <Surface style={styles(theme).locationSection}>
                <View style={styles(theme).locationHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles(theme).locationTitle}>📍 Current Location</Text>
                    <Text style={styles(theme).locationSubtitle}>
                      {profileData.latitude && profileData.longitude 
                        ? `Lat: ${profileData.latitude.toFixed(4)}, Lng: ${profileData.longitude.toFixed(4)}`
                        : "Location not set - click Update to get current location"}
                    </Text>
                  </View>
                  <Button
                    mode="contained"
                    onPress={async () => {
                      console.log('🔄 Fetch Location button pressed');
                      await getCurrentLocation();
                    }}
                    loading={locationLoading}
                    disabled={locationLoading}
                    icon="crosshairs-gps"
                    compact
                    buttonColor={theme.colors.primary}
                  >
                    {locationLoading ? 'Getting...' : 'Update Location'}
                  </Button>
                </View>
              </Surface>
              
              <PaperTextInput
                label="Bio"
                value={profileData.bio || ''}
                onChangeText={(text) => {
                  console.log('Bio changed to:', text);
                  setProfileData(prev => ({ ...prev, bio: text }));
                }}
                style={styles(theme).input}
                mode="outlined"
                multiline
                numberOfLines={3}
                left={<PaperTextInput.Icon icon="text" />}
                placeholder="Tell us about yourself..."
                editable={true}
              />
              
              <View style={styles(theme).modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => {
                    console.log('❌ Cancel button pressed');
                    setEditProfileModalVisible(false);
                  }}
                  style={styles(theme).modalButton}
                  disabled={saveLoading}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={async () => {
                    console.log('💾 Save button pressed with data:', profileData);
                    await handleSaveProfile();
                  }}
                  style={styles(theme).modalButton}
                  loading={saveLoading}
                  disabled={saveLoading || !profileData.name || !profileData.name.trim()}
                  icon="content-save"
                >
                  Save Changes
                </Button>
              </View>
            </Card.Content>
          </Card>
        </ScrollView>
      </Modal>
    </Portal>
  );

  // Change Password Modal
  const ChangePasswordModal = () => (
    <Portal>
      <Modal
        visible={changePasswordModalVisible}
        onDismiss={() => setChangePasswordModalVisible(false)}
        contentContainerStyle={styles(theme).modalContainer}
      >
        <Card style={styles(theme).modalCard}>
          <Card.Content>
            <Text variant="titleLarge" style={[styles(theme).modalTitle, { color: theme.colors.primary }]}>
              Change Password
            </Text>
            
            <PaperTextInput
              label="Current Password"
              value={passwordData.oldPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, oldPassword: text })}
              style={styles(theme).input}
              mode="outlined"
              secureTextEntry
            />
            
            <PaperTextInput
              label="New Password"
              value={passwordData.newPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, newPassword: text })}
              style={styles(theme).input}
              mode="outlined"
              secureTextEntry
            />
            
            <PaperTextInput
              label="Confirm New Password"
              value={passwordData.confirmPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
              style={styles(theme).input}
              mode="outlined"
              secureTextEntry
            />
            
            <Text style={styles(theme).helperText}>
              Password must be at least 8 characters long
            </Text>
            
            <View style={styles(theme).modalActions}>
              <Button
                mode="outlined"
                onPress={() => setChangePasswordModalVisible(false)}
                style={styles(theme).modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleChangePassword}
                style={styles(theme).modalButton}
                loading={loading}
                disabled={loading}
              >
                Change Password
              </Button>
            </View>
          </Card.Content>
        </Card>
      </Modal>
    </Portal>
  );

  // Privacy Settings Modal
  const PrivacySettingsModal = () => (
    <Portal>
      <Modal
        visible={privacyModalVisible}
        onDismiss={() => setPrivacyModalVisible(false)}
        contentContainerStyle={styles(theme).modalContainer}
      >
        <Card style={styles(theme).modalCard}>
          <Card.Content>
            <Text variant="titleLarge" style={[styles(theme).modalTitle, { color: theme.colors.primary }]}>
              Privacy Settings
            </Text>
            
            <Text variant="bodyMedium" style={styles(theme).sectionLabel}>
              Profile Visibility
            </Text>
            <RadioButton.Group
              onValueChange={(value) => setPrivacySettings({ ...privacySettings, profileVisibility: value })}
              value={privacySettings.profileVisibility}
            >
              <RadioButton.Item label="Public" value="public" />
              <RadioButton.Item label="Friends Only" value="friends" />
              <RadioButton.Item label="Private" value="private" />
            </RadioButton.Group>
            
            <Divider style={styles(theme).divider} />
            
            <List.Item
              title="Show Email in Profile"
              right={() => (
                <Switch
                  value={privacySettings.showEmail}
                  onValueChange={(value) => setPrivacySettings({ ...privacySettings, showEmail: value })}
                />
              )}
            />
            
            <List.Item
              title="Show Phone in Profile"
              right={() => (
                <Switch
                  value={privacySettings.showPhone}
                  onValueChange={(value) => setPrivacySettings({ ...privacySettings, showPhone: value })}
                />
              )}
            />
            
            <List.Item
              title="Allow Data Collection"
              right={() => (
                <Switch
                  value={privacySettings.dataCollection}
                  onValueChange={(value) => setPrivacySettings({ ...privacySettings, dataCollection: value })}
                />
              )}
            />
            
            <List.Item
              title="Opt Out of Analytics"
              right={() => (
                <Switch
                  value={privacySettings.analyticsOptOut}
                  onValueChange={(value) => setPrivacySettings({ ...privacySettings, analyticsOptOut: value })}
                />
              )}
            />
            
            <View style={styles(theme).modalActions}>
              <Button
                mode="outlined"
                onPress={() => setPrivacyModalVisible(false)}
                style={styles(theme).modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSavePrivacySettings}
                style={styles(theme).modalButton}
                loading={loading}
                disabled={loading}
              >
                Save
              </Button>
            </View>
          </Card.Content>
        </Card>
      </Modal>
    </Portal>
  );

  // Data Usage Modal
  const DataUsageModal = () => (
    <Portal>
      <Modal
        visible={dataUsageModalVisible}
        onDismiss={() => setDataUsageModalVisible(false)}
        contentContainerStyle={styles(theme).modalContainer}
      >
        <Card style={styles(theme).modalCard}>
          <Card.Content>
            <Text variant="titleLarge" style={[styles(theme).modalTitle, { color: theme.colors.primary }]}>
              Data Usage
            </Text>
            
            <List.Item
              title="Download Data"
              description="Download all your data"
              left={() => <Ionicons name="download-outline" size={24} color={theme.colors.primary} />}
              right={() => <Ionicons name="chevron-forward" size={24} color={theme.colors.onSurface} />}
              onPress={() => {
                Alert.alert('Coming Soon', 'Data download feature will be available soon.');
              }}
            />
            
            <List.Item
              title="Delete Account"
              description="Permanently delete your account"
              left={() => <Ionicons name="trash-outline" size={24} color={theme.colors.error} />}
              right={() => <Ionicons name="chevron-forward" size={24} color={theme.colors.onSurface} />}
              onPress={() => {
                Alert.alert(
                  'Delete Account',
                  'Are you sure you want to permanently delete your account? This action cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => {
                      Alert.alert('Coming Soon', 'Account deletion feature will be available soon.');
                    }}
                  ]
                );
              }}
              titleStyle={{ color: theme.colors.error }}
            />
            
            <View style={styles(theme).modalActions}>
              <Button
                mode="contained"
                onPress={() => setDataUsageModalVisible(false)}
                style={[styles(theme).modalButton, { width: '100%' }]}
              >
                Close
              </Button>
            </View>
          </Card.Content>
        </Card>
      </Modal>
    </Portal>
  );

  // Two Factor Auth Modal
  const TwoFactorAuthModal = () => (
    <Portal>
      <Modal
        visible={twoFactorModalVisible}
        onDismiss={() => setTwoFactorModalVisible(false)}
        contentContainerStyle={styles(theme).modalContainer}
      >
        <Card style={styles(theme).modalCard}>
          <Card.Content>
            <Text variant="titleLarge" style={[styles(theme).modalTitle, { color: theme.colors.primary }]}>
              Two-Factor Authentication
            </Text>
            
            <Text variant="bodyMedium" style={styles(theme).modalDescription}>
              Add an extra layer of security to your account by enabling two-factor authentication.
            </Text>
            
            <List.Item
              title="Enable SMS Authentication"
              description="Receive codes via SMS"
              left={() => <Ionicons name="phone-portrait-outline" size={24} color={theme.colors.primary} />}
              right={() => <Ionicons name="chevron-forward" size={24} color={theme.colors.onSurface} />}
              onPress={() => {
                Alert.alert('Coming Soon', 'SMS authentication will be available soon.');
              }}
            />
            
            <List.Item
              title="Enable Authenticator App"
              description="Use Google Authenticator or similar app"
              left={() => <Ionicons name="shield-checkmark-outline" size={24} color={theme.colors.primary} />}
              right={() => <Ionicons name="chevron-forward" size={24} color={theme.colors.onSurface} />}
              onPress={() => {
                Alert.alert('Coming Soon', 'Authenticator app integration will be available soon.');
              }}
            />
            
            <View style={styles(theme).modalActions}>
              <Button
                mode="contained"
                onPress={() => setTwoFactorModalVisible(false)}
                style={[styles(theme).modalButton, { width: '100%' }]}
              >
                Close
              </Button>
            </View>
          </Card.Content>
        </Card>
      </Modal>
    </Portal>
  );

  const NotificationSettings = () => (
    <Card style={[styles(theme).sectionCard, { backgroundColor: theme.colors.surface }]} mode="elevated">
      <Card.Content>
        <Text variant="titleMedium" style={[styles(theme).sectionTitle, { color: theme.colors.primary }]}>
          Notifications
        </Text>
        <List.Item
          title="Push Notifications"
          description="Receive alerts for nearby rescue cases, emergencies, and updates"
          left={() => <Ionicons name="notifications-outline" size={24} color={theme.colors.primary} />}
          right={() => (
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              color={theme.colors.primary}
              disabled={loading}
            />
          )}
        />
        <List.Item
          title="Sound Alerts"
          description="Play sound for notifications"
          left={() => <Ionicons name="volume-high-outline" size={24} color={theme.colors.primary} />}
          right={() => (
            <Switch
              value={soundEnabled}
              onValueChange={async (value) => {
                setSoundEnabled(value);
                await updateSetting('soundEnabled', value);
              }}
              color={theme.colors.primary}
              disabled={loading}
            />
          )}
        />
        <List.Item
          title="Vibration"
          description="Vibrate on notifications"
          left={() => <Ionicons name="phone-portrait-outline" size={24} color={theme.colors.primary} />}
          right={() => (
            <Switch
              value={vibrationEnabled}
              onValueChange={async (value) => {
                setVibrationEnabled(value);
                await updateSetting('vibrationEnabled', value);
              }}
              color={theme.colors.primary}
              disabled={loading}
            />
          )}
        />
        {notificationsEnabled && (
          <List.Item
            title="Test Notifications"
            description="Send a test notification to verify setup"
            left={() => <Ionicons name="send-outline" size={24} color={theme.colors.primary} />}
            right={() => <Ionicons name="chevron-forward" size={24} color={theme.colors.onSurface} />}
            onPress={handleTestNotification}
            disabled={loading}
          />
        )}
      </Card.Content>
    </Card>
  );

  const PersonalSettings = () => (
    <Card style={[styles(theme).sectionCard, { backgroundColor: theme.colors.surface }]} mode="elevated">
      <Card.Content>
        <Text variant="titleMedium" style={[styles(theme).sectionTitle, { color: theme.colors.primary }]}>
          Personal
        </Text>
        <List.Item
          title="Edit Profile"
          description="Update your personal information, location & avatar"
          left={() => <Ionicons name="person-outline" size={24} color={theme.colors.primary} />}
          right={() => <Ionicons name="chevron-forward" size={24} color={theme.colors.onSurface} />}
          onPress={() => setEditProfileModalVisible(true)}
        />
        <List.Item
          title="Change Password"
          description="Update your account password"
          left={() => <Ionicons name="lock-closed-outline" size={24} color={theme.colors.primary} />}
          right={() => <Ionicons name="chevron-forward" size={24} color={theme.colors.onSurface} />}
          onPress={() => setChangePasswordModalVisible(true)}
        />
        <List.Item
          title="Privacy Settings"
          description="Manage your privacy preferences"
          left={() => <Ionicons name="shield-outline" size={24} color={theme.colors.primary} />}
          right={() => <Ionicons name="chevron-forward" size={24} color={theme.colors.onSurface} />}
          onPress={() => setPrivacyModalVisible(true)}
        />
      </Card.Content>
    </Card>
  );

  const AccessibilitySettings = () => (
    <Card style={[styles(theme).sectionCard, { backgroundColor: theme.colors.surface }]} mode="elevated">
      <Card.Content>
        <Text variant="titleMedium" style={[styles(theme).sectionTitle, { color: theme.colors.primary }]}>
          Accessibility
        </Text>
        <List.Item
          title="Theme Mode"
          description={isDark ? "Dark Mode" : "Light Mode"}
          left={() => <Ionicons name="color-palette-outline" size={24} color={theme.colors.primary} />}
          right={() => (
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              color={theme.colors.primary}
            />
          )}
        />
        <List.Item
          title="Location Services"
          description="Allow access to your location"
          left={() => <Ionicons name="location-outline" size={24} color={theme.colors.primary} />}
          right={() => (
            <Switch
              value={locationEnabled}
              onValueChange={async (enabled) => {
                if (enabled) {
                  Alert.alert(
                    "Enable Location Services",
                    "This app uses location to show nearby rescue cases and help you report incidents accurately.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Enable",
                        onPress: async () => {
                          setLocationEnabled(true);
                          await updateSetting('locationEnabled', true);
                        }
                      }
                    ]
                  );
                } else {
                  setLocationEnabled(false);
                  await updateSetting('locationEnabled', false);
                }
              }}
              color={theme.colors.primary}
              disabled={loading}
            />
          )}
        />
        <List.Item
          title="Large Text"
          description="Increase text size for better readability"
          left={() => <Ionicons name="text-outline" size={24} color={theme.colors.primary} />}
          right={() => <Ionicons name="chevron-forward" size={24} color={theme.colors.onSurface} />}
          onPress={() => {
            if (Platform.OS === 'ios') {
              Linking.openURL('prefs:root=ACCESSIBILITY&path=FONT_SIZE');
            } else {
              Linking.openSettings();
            }
          }}
        />
      </Card.Content>
    </Card>
  );

  const PrivacySecuritySettings = () => (
    <Card style={[styles(theme).sectionCard, { backgroundColor: theme.colors.surface }]} mode="elevated">
      <Card.Content>
        <Text variant="titleMedium" style={[styles(theme).sectionTitle, { color: theme.colors.primary }]}>
          Privacy & Security
        </Text>
        <List.Item
          title="Data Usage"
          description="Manage how your data is used"
          left={() => <Ionicons name="analytics-outline" size={24} color={theme.colors.primary} />}
          right={() => <Ionicons name="chevron-forward" size={24} color={theme.colors.onSurface} />}
          onPress={() => setDataUsageModalVisible(true)}
        />
        <List.Item
          title="App Permissions"
          description="Manage app permissions"
          left={() => <Ionicons name="settings-outline" size={24} color={theme.colors.primary} />}
          right={() => <Ionicons name="chevron-forward" size={24} color={theme.colors.onSurface} />}
          onPress={() => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          }}
        />
        <List.Item
          title="Two-Factor Authentication"
          description="Add extra security to your account"
          left={() => <Ionicons name="key-outline" size={24} color={theme.colors.primary} />}
          right={() => <Ionicons name="chevron-forward" size={24} color={theme.colors.onSurface} />}
          onPress={() => setTwoFactorModalVisible(true)}
        />
      </Card.Content>
    </Card>
  );

  const AccountSettings = () => (
    <Card style={[styles(theme).sectionCard, { backgroundColor: theme.colors.surface }]} mode="elevated">
      <Card.Content>
        <Text variant="titleMedium" style={[styles(theme).sectionTitle, { color: theme.colors.primary }]}>
          Account
        </Text>
        <List.Item
          title={user?.name || "User"}
          description={`${accountType?.toUpperCase() || 'USER'} Account • ${user?.email || ''}`}
          left={() => <Ionicons name="person-circle-outline" size={24} color={theme.colors.primary} />}
        />
        <Divider style={{ marginVertical: 8 }} />
        <List.Item
          title="Logout"
          description="Sign out of your account"
          left={() => <Ionicons name="log-out-outline" size={24} color={theme.colors.error} />}
          onPress={handleLogout}
          titleStyle={{ color: theme.colors.error }}
          disabled={loading}
        />
      </Card.Content>
    </Card>
  );

  const sections = [
    { title: "Account", component: AccountSettings },
    { title: "Notifications", component: NotificationSettings },
    { title: "Personal", component: PersonalSettings },
    { title: "Accessibility", component: AccessibilitySettings },
    { title: "Privacy & Security", component: PrivacySecuritySettings },
  ];

  return (
    <View style={[styles(theme).container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles(theme).content} showsVerticalScrollIndicator={false}>
        {sections.map((section, index) => (
          <View key={index}>
            {section.component()}
            {index < sections.length - 1 && <View style={styles(theme).sectionSpacing} />}
          </View>
        ))}
      </ScrollView>
      
      {/* All Modals */}
      <EditProfileModal />
      <ChangePasswordModal />
      <PrivacySettingsModal />
      <DataUsageModal />
      <TwoFactorAuthModal />
      
      <Toast />
    </View>
  );
}

const styles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.outline || '#E0E0E0',
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: "bold",
  },
  sectionSpacing: {
    height: 16,
  },
  modalContainer: {
    padding: 20,
    justifyContent: 'center',
    maxHeight: '90%',
  },
  modalCard: {
    borderRadius: 16,
    maxHeight: '155%',
  },
  modalTitle: {
    marginBottom: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalDescription: {
    marginBottom: 20,
    textAlign: 'center',
    color: theme.colors.onSurfaceVariant,
  },
  input: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    gap: 10,
  },
  modalButton: {
    flex: 1,
  },
  helperText: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 8,
    textAlign: 'center',
  },
  sectionLabel: {
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 16,
    color: theme.colors.onSurface,
  },
  divider: {
    marginVertical: 16,
  },
  // Profile editing styles
  avatarSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  avatarButton: {
    borderRadius: 8,
  },
  locationSection: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    marginBottom: 16,
  },
  locationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.onSurface,
  },
  locationSubtitle: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
});
