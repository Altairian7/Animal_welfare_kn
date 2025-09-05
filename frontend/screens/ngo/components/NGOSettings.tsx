import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Surface,
  Text,
  TextInput,
  Button,
  Card,
  ActivityIndicator,
  Appbar,
  SegmentedButtons,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../../../theme';
import { ngoApi, APIError, NetworkError, AuthenticationError } from '../../../api/ngoApi';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { useSelector } from 'react-redux';

type NGOSettingsRouteProp = RouteProp<RootStackParamList, 'NGOSettings'>;
type NGOSettingsNavigationProp = StackNavigationProp<RootStackParamList, 'NGOSettings'>;

interface NGOSettingsData {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  description: string;
  specialization: string;
  website?: string;
  established: string;
  registration_number?: string;
  license_number?: string;
  image?: string;
  is_verified: boolean;
  latitude: string;
  longitude: string;
  category: string;
}

// ✅ ENHANCED: Validation function
const validateProfileData = (data: NGOSettingsData) => {
  const errors: string[] = [];

  // Required fields
  if (!data.name.trim()) errors.push('Organization name is required');
  if (!data.email.trim()) errors.push('Email is required');
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (data.email && !emailRegex.test(data.email)) {
    errors.push('Please enter a valid email address');
  }

  // ✅ CRITICAL: Latitude/Longitude validation (cannot be 0.00000)
  const lat = parseFloat(data.latitude);
  const lng = parseFloat(data.longitude);
  
  if (isNaN(lat) || lat === 0) {
    errors.push('Valid latitude coordinates are required (cannot be 0.00000)');
  }
  
  if (isNaN(lng) || lng === 0) {
    errors.push('Valid longitude coordinates are required (cannot be 0.00000)');
  }

  // Category validation
  if (!data.category || data.category.trim() === '') {
    errors.push('Category is required');
  }

  // Website validation (only if provided)
  if (data.website && data.website.trim() !== '') {
    const urlRegex = /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/;
    if (!urlRegex.test(data.website)) {
      errors.push('Please enter a valid website URL (e.g., https://example.com)');
    }
  }

  return errors;
};

const NGOSettings: React.FC = () => {
  const { theme } = useThemeContext();
  const navigation = useNavigation<NGOSettingsNavigationProp>();
  const route = useRoute<NGOSettingsRouteProp>();
  const user = useSelector((state: any) => state.auth.user);
  
  const ngoId = route.params?.ngoId || user?.ngo_id || user?.id || "14";
  
  // State management
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ FIXED: Form data with proper defaults
  const [formData, setFormData] = useState<NGOSettingsData>({
    id: ngoId,
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    description: '',
    specialization: '',
    website: '',
    established: '',
    registration_number: '',
    license_number: '',
    image: '',
    is_verified: false,
    // ✅ IMPORTANT: Real coordinates (Delhi as default)
    latitude: '28.6139',
    longitude: '77.2090',
    category: 'animal_welfare',
  });

  // ✅ Category options for better UX
  const categoryOptions = [
    { value: 'animal_welfare', label: 'Animal Welfare' },
    { value: 'education', label: 'Education' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'environment', label: 'Environment' },
    { value: 'poverty', label: 'Poverty Alleviation' },
    { value: 'disaster_relief', label: 'Disaster Relief' },
    { value: 'women_empowerment', label: 'Women Empowerment' },
    { value: 'child_welfare', label: 'Child Welfare' },
    { value: 'other', label: 'Other' },
  ];

  const fetchNGOSettings = useCallback(async () => {
    if (!ngoId) {
      Alert.alert('Error', 'Missing NGO ID');
      navigation.goBack();
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`🔄 Fetching NGO settings for ID: ${ngoId}`);

      const ngoDetails = await ngoApi.getNGODetail(ngoId, false);
      
      console.log(`✅ Successfully fetched NGO settings:`, ngoDetails);
      
      // ✅ ENHANCED: Better field mapping with proper defaults
      setFormData({
        id: ngoId,
        name: ngoDetails?.name || '',
        email: ngoDetails?.email || '',
        phone: ngoDetails?.phone || '',
        address: ngoDetails?.address || '',
        city: ngoDetails?.city || '',
        state: ngoDetails?.state || '',
        description: ngoDetails?.description || '',
        specialization: ngoDetails?.specialization || '',
        website: ngoDetails?.website || '',
        established: ngoDetails?.established || '',
        registration_number: ngoDetails?.registration_number || '',
        license_number: ngoDetails?.license_number || '',
        image: ngoDetails?.image || '',
        is_verified: Boolean(ngoDetails?.is_verified),
        // ✅ FIXED: Only use 0.00000 if no valid coordinates exist
        latitude: (ngoDetails?.latitude && ngoDetails.latitude !== '0.00000') ? 
                  ngoDetails.latitude : '28.6139', // Delhi default
        longitude: (ngoDetails?.longitude && ngoDetails.longitude !== '0.00000') ? 
                   ngoDetails.longitude : '77.2090', // Delhi default  
        category: ngoDetails?.category || 'animal_welfare',
      });

    } catch (error: any) {
      console.error('❌ Failed to fetch NGO settings:', error);
      setError(error?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ngoId, navigation]);

  useEffect(() => {
    fetchNGOSettings();
  }, [fetchNGOSettings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNGOSettings();
  }, [fetchNGOSettings]);

  // ✅ ENHANCED: Save with comprehensive validation
  const saveBasicSettings = useCallback(async () => {
    // Validate form before submission
    const validationErrors = validateProfileData(formData);
    if (validationErrors.length > 0) {
      Alert.alert(
        'Validation Error', 
        validationErrors.join('\n\n'),
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setSaving(true);
      
      // ✅ CLEAN: Prepare data for API (remove empty strings)
      const updateData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        description: formData.description.trim(),
        specialization: formData.specialization.trim(),
        website: formData.website?.trim() || '', // Can be empty
        established: formData.established.trim(),
        registration_number: formData.registration_number?.trim() || '',
        license_number: formData.license_number?.trim() || '',
        // ✅ CRITICAL: Ensure valid coordinates and category
        latitude: formData.latitude,
        longitude: formData.longitude,
        category: formData.category,
      };

      console.log(`🔄 Saving NGO settings:`, updateData);

      await ngoApi.updateNGOProfile(ngoId, updateData);

      console.log(`✅ Successfully saved NGO settings`);

      Alert.alert(
        'Success', 
        'Settings updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );

    } catch (error: any) {
      console.error('❌ Failed to save NGO settings:', error);
      
      let errorMessage = 'Failed to save settings. Please try again.';
      
      // ✅ ENHANCED: Better error parsing
      if (error instanceof APIError && error.status === 400) {
        if (error.errorMessage && typeof error.errorMessage === 'object') {
          const validationMessages = Object.entries(error.errorMessage)
            .map(([field, messages]: [string, any]) => {
              const messageList = Array.isArray(messages) ? messages : [messages];
              return `• ${field}: ${messageList.join(', ')}`;
            })
            .join('\n');
          errorMessage = `Please fix the following issues:\n\n${validationMessages}`;
        }
      } else if (error instanceof AuthenticationError) {
        errorMessage = 'Session expired. Please login again.';
      } else if (error instanceof NetworkError) {
        errorMessage = 'Network error. Please check your internet connection.';
      }

      Alert.alert('Save Failed', errorMessage);
    } finally {
      setSaving(false);
    }
  }, [ngoId, formData, navigation]);

  const updateField = useCallback((field: keyof NGOSettingsData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // ✅ HELPER: Get current location (you can implement this)
  const getCurrentLocation = useCallback(() => {
    Alert.alert(
      'Get Current Location',
      'This will help you set accurate coordinates for your NGO location.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Use Delhi (Default)', 
          onPress: () => {
            updateField('latitude', '28.6139');
            updateField('longitude', '77.2090');
          }
        },
        { 
          text: 'Use Mumbai', 
          onPress: () => {
            updateField('latitude', '19.0760');
            updateField('longitude', '72.8777');
          }
        },
      ]
    );
  }, [updateField]);

  // Loading state
  if (loading) {
    return (
      <View style={styles(theme).container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="NGO Settings" />
        </Appbar.Header>
        <View style={styles(theme).loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles(theme).loadingText}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles(theme).container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="NGO Settings" />
      </Appbar.Header>

      <ScrollView
        style={styles(theme).content}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles(theme).errorBanner}>
            <Ionicons name="warning" size={16} color="#856404" />
            <Text style={styles(theme).errorBannerText}>{error}</Text>
            <Button mode="text" onPress={() => setError(null)}>
              Dismiss
            </Button>
          </View>
        )}

        <Surface style={styles(theme).card}>
          <Text style={styles(theme).sectionTitle}>Basic Information</Text>
          
          <TextInput
            label="Organization Name *"
            value={formData.name}
            onChangeText={(text) => updateField('name', text)}
            style={styles(theme).input}
            mode="outlined"
            error={!formData.name.trim()}
            disabled={saving}
          />
          
          <TextInput
            label="Email *"
            value={formData.email}
            onChangeText={(text) => updateField('email', text)}
            style={styles(theme).input}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            error={!formData.email.trim()}
            disabled={saving}
          />
          
          <TextInput
            label="Phone"
            value={formData.phone}
            onChangeText={(text) => updateField('phone', text)}
            style={styles(theme).input}
            mode="outlined"
            keyboardType="phone-pad"
            disabled={saving}
          />
          
          <TextInput
            label="Address"
            value={formData.address}
            onChangeText={(text) => updateField('address', text)}
            style={styles(theme).input}
            mode="outlined"
            multiline
            numberOfLines={3}
            disabled={saving}
          />
          
          <View style={styles(theme).row}>
            <TextInput
              label="City"
              value={formData.city}
              onChangeText={(text) => updateField('city', text)}
              style={[styles(theme).input, { flex: 1, marginRight: 8 }]}
              mode="outlined"
              disabled={saving}
            />
            
            <TextInput
              label="State"
              value={formData.state}
              onChangeText={(text) => updateField('state', text)}
              style={[styles(theme).input, { flex: 1, marginLeft: 8 }]}
              mode="outlined"
              disabled={saving}
            />
          </View>
          
          <TextInput
            label="Description"
            value={formData.description}
            onChangeText={(text) => updateField('description', text)}
            style={styles(theme).input}
            mode="outlined"
            multiline
            numberOfLines={4}
            disabled={saving}
          />
          
          <TextInput
            label="Specialization/Focus Area"
            value={formData.specialization}
            onChangeText={(text) => updateField('specialization', text)}
            style={styles(theme).input}
            mode="outlined"
            disabled={saving}
          />

          {/* ✅ ENHANCED: Location & Category Section */}
          <Text style={styles(theme).sectionSubtitle}>Location & Category *</Text>
          
          <View style={styles(theme).locationRow}>
            <View style={styles(theme).coordinateContainer}>
              <TextInput
                label="Latitude *"
                value={formData.latitude}
                onChangeText={(text) => updateField('latitude', text)}
                style={styles(theme).coordinateInput}
                mode="outlined"
                keyboardType="numeric"
                placeholder="28.6139"
                disabled={saving}
                error={!formData.latitude || formData.latitude === '0.00000'}
              />
            </View>
            
            <View style={styles(theme).coordinateContainer}>
              <TextInput
                label="Longitude *"
                value={formData.longitude}
                onChangeText={(text) => updateField('longitude', text)}
                style={styles(theme).coordinateInput}
                mode="outlined"
                keyboardType="numeric"
                placeholder="77.2090"
                disabled={saving}
                error={!formData.longitude || formData.longitude === '0.00000'}
              />
            </View>
            
            <Button
              mode="outlined"
              onPress={getCurrentLocation}
              style={styles(theme).locationButton}
              disabled={saving}
            >
              📍
            </Button>
          </View>

          {/* ✅ ENHANCED: Category selection */}
          <Text style={styles(theme).fieldLabel}>Category *</Text>
          <SegmentedButtons
            value={formData.category}
            onValueChange={(value) => updateField('category', value)}
            buttons={[
              { value: 'animal_welfare', label: 'Animals' },
              { value: 'education', label: 'Education' },
              { value: 'healthcare', label: 'Health' },
              { value: 'other', label: 'Other' },
            ]}
            style={styles(theme).categoryButtons}
          />
          
          <TextInput
            label="Website"
            value={formData.website}
            onChangeText={(text) => updateField('website', text)}
            style={styles(theme).input}
            mode="outlined"
            keyboardType="url"
            autoCapitalize="none"
            placeholder="https://your-ngo-website.com"
            disabled={saving}
          />
          
          <View style={styles(theme).row}>
            <TextInput
              label="Established (Year)"
              value={formData.established}
              onChangeText={(text) => updateField('established', text)}
              style={[styles(theme).input, { flex: 1, marginRight: 8 }]}
              mode="outlined"
              keyboardType="numeric"
              maxLength={4}
              placeholder="2010"
              disabled={saving}
            />
            
            <TextInput
              label="Registration Number"
              value={formData.registration_number}
              onChangeText={(text) => updateField('registration_number', text)}
              style={[styles(theme).input, { flex: 1, marginLeft: 8 }]}
              mode="outlined"
              disabled={saving}
            />
          </View>
          
          <TextInput
            label="License Number"
            value={formData.license_number}
            onChangeText={(text) => updateField('license_number', text)}
            style={styles(theme).input}
            mode="outlined"
            disabled={saving}
          />
          
          <Button
            mode="contained"
            onPress={saveBasicSettings}
            loading={saving}
            disabled={saving}
            style={styles(theme).saveButton}
          >
            {saving ? 'Saving Changes...' : 'Save Changes'}
          </Button>
          
          <Text style={styles(theme).helpText}>
            * Required fields cannot be empty
          </Text>
          <Text style={styles(theme).helpText}>
            💡 Coordinates must be valid (not 0.00000). Use location button for help.
          </Text>
          <Text style={styles(theme).helpText}>
            🌐 Website must be a valid URL starting with http:// or https://
          </Text>
        </Surface>
      </ScrollView>
    </View>
  );
};

const styles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.onSurface,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.primary,
    marginTop: 16,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.onSurface,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    marginBottom: 12,
    backgroundColor: theme.colors.surface,
  },
  row: {
    flexDirection: 'row',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  coordinateContainer: {
    flex: 1,
  },
  coordinateInput: {
    marginRight: 8,
    backgroundColor: theme.colors.surface,
  },
  locationButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryButtons: {
    marginBottom: 16,
  },
  saveButton: {
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  helpText: {
    fontSize: 12,
    color: theme.colors.primary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3CD",
    borderColor: "#FFC107",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    flex: 1,
    color: "#856404",
    fontSize: 14,
    marginLeft: 8,
  },
});

export default NGOSettings;
