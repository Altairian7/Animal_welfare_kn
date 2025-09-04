import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  Dimensions, 
  Animated,
  StatusBar
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Snackbar,
  useTheme,
  Card,
  Surface,
  Switch,
  ProgressBar,
  IconButton
} from 'react-native-paper';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '../../core/redux/store';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import usersApi from '../../api/usersApi';
import { resetNewUserFlag } from '../../core/redux/slices/authSlice';

interface OnboardingFormData {
  name: string;
  email: string;
  bio: string;
  phone: string;
  title: string;
  isVolunteer: boolean;
  location: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  notificationPreferences: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    emergencyAlerts: boolean;
  };
}

interface LocationPermissionState {
  granted: boolean;
  loading: boolean;
  error?: string;
}

export default function UserOnboardingScreen() {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { user } = useSelector((state: any) => state.auth);

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<OnboardingFormData>({
    name: user?.name || '',
    email: user?.email || '',
    bio: user?.bio || '', // Initialize with user's bio if available
    phone: '',
    title: '',
    isVolunteer: true,
    location: {},
    notificationPreferences: {
      emailNotifications: true,
      pushNotifications: true,
      emergencyAlerts: true,
    }
  });
  
  const [locationState, setLocationState] = useState<LocationPermissionState>({
    granted: false,
    loading: false
  });
  
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [progressValue, setProgressValue] = useState(0);

  const totalSteps = 4;
  const stepTitles = [
    'Personal Details',
    'Volunteer Settings', 
    'Location Access',
    'Notifications'
  ];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  useEffect(() => {
    const listenerId = progressAnim.addListener(({ value }) => {
      setProgressValue(value);
    });

    Animated.timing(progressAnim, {
      toValue: currentStep / (totalSteps - 1),
      duration: 400,
      useNativeDriver: false,
    }).start();

    return () => progressAnim.removeListener(listenerId);
  }, [currentStep]);

  const showSnackbar = useCallback((msg: string) => {
    setSnackbarMsg(msg);
    setSnackbarVisible(true);
  }, []);

  const handleInputChange = (field: string, value: any) => {
    if (field === 'bio') {
      console.log('🔤 Bio field updated:', { value, length: value?.length });
    }

    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => {
        const currentParentValue = prev[parent as keyof OnboardingFormData];
        const safeParentValue = (
          typeof currentParentValue === 'object' && 
          currentParentValue !== null && 
          !Array.isArray(currentParentValue)
        ) ? currentParentValue : {};

        return {
          ...prev,
          [parent]: {
            ...safeParentValue,
            [child]: value
          }
        };
      });
    } else {
      setFormData(prev => {
        const newState = { ...prev, [field]: value };
        if (field === 'bio') {
          console.log('📝 Updated formData bio:', newState.bio);
        }
        return newState;
      });
    }
  };

  const requestLocationPermission = async () => {
    setLocationState(prev => ({ ...prev, loading: true }));
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        setLocationState({
          granted: false,
          loading: false,
          error: 'Location permission denied'
        });
        showSnackbar('Location access denied. You can enable it later.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });

        const address = addresses[0];
        let formattedAddress = '';
        
        if (address) {
          const addressParts = [];
          if (address.city) addressParts.push(address.city);
          if (address.region) addressParts.push(address.region);
          if (address.country) addressParts.push(address.country);
          formattedAddress = addressParts.join(', ');
        }

        setFormData(prev => ({
          ...prev,
          location: {
            ...prev.location,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            address: formattedAddress
          }
        }));
      } catch (geocodeError) {
        console.error('Geocoding error:', geocodeError);
      }

      setLocationState({
        granted: true,
        loading: false
      });
      showSnackbar('Location access granted successfully!');
    } catch (error) {
      console.error('Location error:', error);
      setLocationState({
        granted: false,
        loading: false,
        error: 'Failed to get location'
      });
      showSnackbar('Failed to get location. Please try again.');
    }
  };

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 0:
        return formData.name.trim().length > 0 && formData.email.includes('@');
      case 1:
      case 2:
      case 3:
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (!validateCurrentStep()) {
      showSnackbar('Please fill all required fields.');
      return;
    }
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // ✅ FIXED: Enhanced onboarding completion with proper bio handling
  const completeOnboarding = async () => {
    if (!validateCurrentStep()) {
      showSnackbar('Please complete all required fields.');
      return;
    }
    
    setLoading(true);
    console.log('🚀 Starting onboarding completion...');
    
    try {
      // ✅ CRITICAL FIX: Proper bio handling
      const cleanBio = formData.bio?.trim() || "";
      console.log('📝 Processing bio for backend:', { 
        originalBio: formData.bio, 
        cleanBio, 
        isEmpty: !cleanBio 
      });

      // ✅ Backend data (Django serializer fields only)
      const backendOnboardingData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        bio: cleanBio, // Just use bio field as that's what backend expects
        is_volunteer: formData.isVolunteer,
        latitude: formData.location.latitude || null,
        longitude: formData.location.longitude || null,
        notification_preferences: {
          digest_frequency: "immediate",
          emergency_alerts: formData.notificationPreferences.emergencyAlerts,
          general: true,
          injury_reports: formData.notificationPreferences.emailNotifications,
          volunteer_updates: formData.notificationPreferences.pushNotifications
        }
      };

      // ✅ Extra fields for AsyncStorage
      const extraFieldsData = {
        phone: formData.phone.trim() || null,
        title: formData.title.trim() || null,
        address: formData.location.address?.trim() || null,
      };
      
      console.log('📤 Backend data:', backendOnboardingData);
      console.log('📱 AsyncStorage data:', extraFieldsData);
      
      // ✅ Call onboarding API
      const result = await usersApi.completeOnboarding(backendOnboardingData);
      console.log('✅ Onboarding response:', result);
      
      // ✅ Store extra fields in AsyncStorage
      await usersApi.updateExtraFields(extraFieldsData);
      console.log('✅ Extra fields stored');
      
      showSnackbar('Welcome to Karuna Nidhan! 🎉');
      dispatch(resetNewUserFlag());
      
    } catch (error: any) {
      console.error('❌ Onboarding error:', error);
      
      if (error?.message?.includes('Profile already exists') || 
          error?.message?.includes('redirect_to_profile') ||
          error?.message?.includes('400')) {
        
        try {
          // ✅ Store extra fields even if profile exists
          const extraFieldsData = {
            phone: formData.phone.trim() || null,
            title: formData.title.trim() || null,
            address: formData.location.address?.trim() || null,
          };
          
          await usersApi.updateExtraFields(extraFieldsData);
          
          // ✅ FIXED: Try to update profile with bio
          // Ensure bio exists and is properly formatted
          const cleanBio = formData.bio?.trim();
          console.log('🔄 Profile update - Bio value:', {
            raw: formData.bio,
            cleaned: cleanBio
          });

          const updateData = {
            name: formData.name.trim(),
            email: formData.email.trim(),
            bio: formData.bio, // Send bio directly without modification
            is_volunteer: formData.isVolunteer,
            latitude: formData.location.latitude || null,
            longitude: formData.location.longitude || null,
            notification_preferences: {
              digest_frequency: "immediate",
              emergency_alerts: formData.notificationPreferences.emergencyAlerts,
              general: true,
              injury_reports: formData.notificationPreferences.emailNotifications,
              volunteer_updates: formData.notificationPreferences.pushNotifications
            }
          };
          
          console.log('🔄 Updating existing profile with bio:', updateData);
          await usersApi.updateProfile(updateData);
          
        } catch (updateError) {
          console.error('⚠️ Update failed:', updateError);
        }
        
        showSnackbar('Profile setup complete! 🎉');
        dispatch(resetNewUserFlag());
        
      } else {
        showSnackbar('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Tell us about yourself</Text>
              <Text style={styles.stepSubtitle}>We'll use this to personalize your experience</Text>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                label="Full Name"
                value={formData.name}
                onChangeText={text => handleInputChange('name', text)}
                style={styles.input}
                mode="outlined"
                outlineStyle={styles.inputOutline}
                contentStyle={styles.inputContent}
                left={<TextInput.Icon icon="account-outline" size={20} />}
                error={!formData.name.trim()}
              />
              
              <TextInput
                label="Email Address"
                value={formData.email}
                onChangeText={text => handleInputChange('email', text)}
                style={styles.input}
                mode="outlined"
                outlineStyle={styles.inputOutline}
                contentStyle={styles.inputContent}
                keyboardType="email-address"
                autoCapitalize="none"
                left={<TextInput.Icon icon="email-outline" size={20} />}
                error={!formData.email.includes('@')}
              />
              
              <TextInput
                label="Phone Number (Optional)"
                value={formData.phone}
                onChangeText={text => handleInputChange('phone', text)}
                style={styles.input}
                mode="outlined"
                outlineStyle={styles.inputOutline}
                contentStyle={styles.inputContent}
                keyboardType="phone-pad"
                left={<TextInput.Icon icon="phone-outline" size={20} />}
                placeholder="+1 (555) 123-4567"
              />
              
              <TextInput
                label="Role/Title (Optional)"
                value={formData.title}
                onChangeText={text => handleInputChange('title', text)}
                style={styles.input}
                mode="outlined"
                outlineStyle={styles.inputOutline}
                contentStyle={styles.inputContent}
                left={<TextInput.Icon icon="badge-account-outline" size={20} />}
                placeholder="Animal Lover, Veterinarian, Student..."
              />
              
              <TextInput
                label="About You (Optional)"
                value={formData.bio}
                onChangeText={text => {
                  console.log('📝 Bio input changed to:', text);
                  handleInputChange('bio', text);
                }}
                style={[styles.input, styles.bioInput]}
                mode="outlined"
                outlineStyle={styles.inputOutline}
                contentStyle={[styles.inputContent, styles.bioContent]}
                multiline
                numberOfLines={4}
                left={<TextInput.Icon icon="text" size={20} />}
                placeholder="Share your passion for animal welfare..."
              />
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Join our volunteer network</Text>
              <Text style={styles.stepSubtitle}>Help rescue animals in your community</Text>
            </View>

            <Surface style={styles.optionCard}>
              <View style={styles.optionHeader}>
                <View style={styles.iconContainer}>
                  <Ionicons name="heart" size={24} color="#FF6B6B" />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Become a Volunteer</Text>
                  <Text style={styles.optionDescription}>
                    Respond to rescue requests and help coordinate emergency operations
                  </Text>
                </View>
                <Switch
                  value={formData.isVolunteer}
                  onValueChange={value => handleInputChange('isVolunteer', value)}
                  trackColor={{ false: '#E0E0E0', true: '#FF6B6B40' }}
                  thumbColor={formData.isVolunteer ? '#FF6B6B' : '#FFFFFF'}
                />
              </View>
            </Surface>

            {formData.isVolunteer && (
              <Surface style={styles.benefitsCard}>
                <Text style={styles.benefitsTitle}>🐾 As a volunteer, you'll:</Text>
                <View style={styles.benefitsList}>
                  {[
                    'Receive nearby emergency alerts',
                    'Coordinate with rescue teams',
                    'Provide first aid assistance',
                    'Help with animal transportation',
                    'Make a real impact on lives'
                  ].map((benefit, index) => (
                    <View key={index} style={styles.benefitItem}>
                      <View style={styles.benefitDot} />
                      <Text style={styles.benefitText}>{benefit}</Text>
                    </View>
                  ))}
                </View>
              </Surface>
            )}
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Location & Address</Text>
              <Text style={styles.stepSubtitle}>Help us connect you with nearby rescue operations</Text>
            </View>

            <TextInput
              label="Address (Optional)"
              value={formData.location.address || ''}
              onChangeText={text => handleInputChange('location.address', text)}
              style={styles.input}
              mode="outlined"
              outlineStyle={styles.inputOutline}
              contentStyle={styles.inputContent}
              left={<TextInput.Icon icon="map-marker-outline" size={20} />}
              placeholder="City, State, Country"
            />

            <Surface style={styles.locationCard}>
              <View style={styles.locationHeader}>
                <View style={styles.iconContainer}>
                  <Ionicons 
                    name={locationState.granted ? "location" : "location-outline"} 
                    size={32} 
                    color={locationState.granted ? "#4CAF50" : "#666"} 
                  />
                </View>
                <View style={styles.locationContent}>
                  <Text style={styles.locationTitle}>
                    {locationState.granted ? "Location Enabled" : "Enable Precise Location"}
                  </Text>
                  <Text style={styles.locationDescription}>
                    {locationState.granted 
                      ? "You'll receive alerts for nearby emergencies"
                      : "Get immediate alerts for animals in your area"
                    }
                  </Text>
                </View>
              </View>
              
              {!locationState.granted && (
                <Button
                  mode="contained"
                  onPress={requestLocationPermission}
                  loading={locationState.loading}
                  style={styles.locationButton}
                  buttonColor="#4CAF50"
                  contentStyle={styles.buttonContent}
                >
                  {locationState.loading ? 'Getting Location...' : 'Enable Location'}
                </Button>
              )}
              
              {locationState.error && (
                <Text style={styles.errorText}>{locationState.error}</Text>
              )}
            </Surface>

            <Text style={styles.helperText}>
              Location is optional but helps us send you relevant alerts
            </Text>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Notification Preferences</Text>
              <Text style={styles.stepSubtitle}>Choose how you'd like to stay informed</Text>
            </View>

            <View style={styles.notificationList}>
              {[
                {
                  key: 'emailNotifications',
                  icon: 'mail-outline',
                  title: 'Email Updates',
                  description: 'Reports and volunteer activity updates',
                  color: '#2196F3'
                },
                {
                  key: 'pushNotifications',
                  icon: 'notifications-outline',
                  title: 'Push Notifications',
                  description: 'Instant alerts on your device',
                  color: '#FF9800'
                },
                {
                  key: 'emergencyAlerts',
                  icon: 'warning-outline',
                  title: 'Emergency Alerts',
                  description: 'Critical animal emergency notifications',
                  color: '#F44336'
                }
              ].map((option, index) => (
                <Surface key={index} style={styles.notificationCard}>
                  <View style={styles.notificationHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: `${option.color}15` }]}>
                      <Ionicons name={option.icon as any} size={20} color={option.color} />
                    </View>
                    <View style={styles.notificationContent}>
                      <Text style={styles.notificationTitle}>{option.title}</Text>
                      <Text style={styles.notificationDescription}>{option.description}</Text>
                    </View>
                    <Switch
                      value={formData.notificationPreferences[option.key as keyof typeof formData.notificationPreferences]}
                      onValueChange={value => handleInputChange(`notificationPreferences.${option.key}`, value)}
                      trackColor={{ false: '#E0E0E0', true: `${option.color}40` }}
                      thumbColor={formData.notificationPreferences[option.key as keyof typeof formData.notificationPreferences] ? option.color : '#FFFFFF'}
                    />
                  </View>
                </Surface>
              ))}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContainer} 
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[
                styles.content,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Welcome to Karuna Nidhan</Text>
                <Text style={styles.subtitle}>Let's set up your profile in just a few steps</Text>
              </View>

              {/* Progress */}
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressText}>
                    Step {currentStep + 1} of {totalSteps} • {stepTitles[currentStep]}
                  </Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <Animated.View 
                    style={[
                      styles.progressBarFill,
                      { width: `${(progressValue * 100)}%` }
                    ]} 
                  />
                </View>
              </View>

              {/* Content */}
              <View style={styles.formContainer}>
                {renderStepContent()}
              </View>

              {/* Navigation */}
              <View style={styles.navigationContainer}>
                {currentStep > 0 && (
                  <Button
                    mode="outlined"
                    onPress={previousStep}
                    style={styles.backButton}
                    contentStyle={styles.buttonContent}
                    labelStyle={styles.backButtonLabel}
                  >
                    Back
                  </Button>
                )}

                {currentStep < totalSteps - 1 ? (
                  <Button
                    mode="contained"
                    onPress={nextStep}
                    style={[styles.nextButton, currentStep === 0 && styles.fullWidthButton]}
                    contentStyle={styles.buttonContent}
                    buttonColor="#000000"
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    mode="contained"
                    onPress={completeOnboarding}
                    loading={loading}
                    disabled={loading}
                    style={styles.completeButton}
                    contentStyle={styles.buttonContent}
                    buttonColor="#4CAF50"
                  >
                    Complete Setup
                  </Button>
                )}
              </View>
            </Animated.View>
          </ScrollView>

          <Snackbar
            visible={snackbarVisible}
            onDismiss={() => setSnackbarVisible(false)}
            duration={3000}
            style={styles.snackbar}
            action={{ 
              label: 'Dismiss', 
              onPress: () => setSnackbarVisible(false),
              labelStyle: { color: '#4CAF50' }
            }}
          >
            {snackbarMsg}
          </Snackbar>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const { height, width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: { 
    flex: 1 
  },
  scrollContainer: { 
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: height * 0.08,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
  progressContainer: {
    marginBottom: 32,
  },
  progressHeader: {
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#000000',
    borderRadius: 2,
  },
  formContainer: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
  },
  stepHeader: {
    marginBottom: 32,
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
  inputContainer: {
    gap: 20,
  },
  input: {
    backgroundColor: '#FFFFFF',
  },
  inputOutline: {
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 12,
  },
  inputContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  bioInput: {
    minHeight: 100,
  },
  bioContent: {
    paddingTop: 16,
    textAlignVertical: 'top',
  },
  optionCard: {
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginBottom: 20,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  benefitsCard: {
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#F8FFF8',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 16,
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#388E3C',
    flex: 1,
  },
  locationCard: {
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginTop: 20,
    marginBottom: 16,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationContent: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  locationDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  locationButton: {
    borderRadius: 12,
  },
  helperText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  notificationList: {
    gap: 16,
  },
  notificationCard: {
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#FFFFFF',
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  notificationDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 18,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    gap: 16,
  },
  backButton: {
    flex: 1,
    borderRadius: 12,
    borderColor: '#E0E0E0',
  },
  backButtonLabel: {
    color: '#666666',
  },
  nextButton: {
    flex: 1,
    borderRadius: 12,
  },
  fullWidthButton: {
    flex: 2,
  },
  completeButton: {
    flex: 1,
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  snackbar: {
    backgroundColor: '#000000',
    borderRadius: 8,
    margin: 16,
  },
});
