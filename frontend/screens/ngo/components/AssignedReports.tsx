import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Image,
  TouchableOpacity,
  Linking,
} from 'react-native';
import {
  Surface,
  Text,
  Card,
  Chip,
  Button,
  Searchbar,
  ActivityIndicator,
  Divider,
  Banner,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../../../theme';
import { ngoApi, APIError, NetworkError, AuthenticationError } from '../../../api/ngoApi';
import { reportsApi } from '../../../api/reportsApi';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';

interface LocationObject {
  latitude: number;
  longitude: number;
}

interface Report {
  id: string;
  report_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  location: string | LocationObject;
  reporter_name?: string;
  reporter_email?: string;
  created_at: string;
  assigned_at?: string;
  eta?: string;
  animal_type?: string;
  urgency_level?: string;
  contact_phone?: string;
  notes?: string;
  image?: string;
  image_url?: string;
  species?: string;
  breed?: string;
  age?: string;
  weight?: string;
  gender?: string;
  severity?: string;
  location_string?: string;
  confidence_score?: number;
  injury_summary?: string;
  symptoms?: string[];
  behavior?: string;
  urgency?: string;
  context?: string;
  environment_factors?: string;
  care_tips?: string[];
  immediate_actions?: string[];
  reporter_phone?: string;
}

interface AssignedReportsProps {
  ngoId: string;
  ngoData?: any;
  dashboardStats?: any;
  onRefresh?: () => void;
  refreshing?: boolean;
}

interface FlexibleThemeColors {
  primary: string;
  secondary: string;
  tertiary: string;
  background: string;
  surface: string;
  card: string;
  disabled: string;
  text: string;
  subtext: string;
  accent: string;
  error?: string;
  warning?: string;
  success?: string;
  outline?: string;
  onSurface?: string;
  onSurfaceVariant?: string;
  surfaceVariant?: string;
  tabBar?: string;
  [key: string]: any;
}

interface FlexibleTheme {
  colors: FlexibleThemeColors;
  [key: string]: any;
}

// Helper function for alpha colors with null safety
const addAlpha = (color: string, alpha: number): string => {
  if (!color) return 'transparent';
  if (color.startsWith('#')) {
    let r = 0, g = 0, b = 0;
    if (color.length === 7) {
      r = parseInt(color.substr(1, 2), 16);
      g = parseInt(color.substr(3, 2), 16);
      b = parseInt(color.substr(5, 2), 16);
    }
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
};

const AssignedReports: React.FC<AssignedReportsProps> = ({
  ngoId,
  ngoData,
  dashboardStats,
  onRefresh: parentOnRefresh,
  refreshing: parentRefreshing = false
}) => {
  const { theme } = useThemeContext() as { theme: FlexibleTheme };
  const user = useSelector((state: any) => state.auth.user);
  const navigation = useNavigation();
  
  // ✅ FIXED: Use proper NGO ID hierarchy
  const currentNgoId = useMemo(() => {
    const possibleIds = [
      user?.ngo_id,
      user?.id,
      user?.$id,
      ngoId,
      "14" // Fallback
    ].filter(id => id && id !== user?.email);
    
    const numericId = possibleIds.find(id => /^\d+$/.test(String(id)));
    return numericId || possibleIds[0] || "14";
  }, [user, ngoId]);

  // State management
  const [assignedReports, setAssignedReports] = useState<Report[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(true);
  const [assignedError, setAssignedError] = useState<string | null>(null);

  const [allReports, setAllReports] = useState<Report[]>([]);
  const [allLoading, setAllLoading] = useState(true);
  const [allError, setAllError] = useState<string | null>(null);

  const [localRefreshing, setLocalRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterTab, setSelectedFilterTab] = useState<'unassigned'|'assigned'>('unassigned');
  const [filterStatus, setFilterStatus] = useState('all');
  const [processingReports, setProcessingReports] = useState<Set<string>>(new Set());
  
  // ✅ NEW: Location validation state
  const [locationWarningVisible, setLocationWarningVisible] = useState(false);
  const [ngoLocationValid, setNgoLocationValid] = useState<boolean | null>(null);

  console.log(`🔍 Using NGO ID: ${currentNgoId}`);

  // ✅ NEW: Validate NGO location coordinates
  const validateNGOLocation = useCallback(async () => {
    try {
      console.log(`🔄 Validating NGO location for ID: ${currentNgoId}`);
      const ngoDetails = await ngoApi.getNGODetail(currentNgoId, false);
      
      const lat = parseFloat(ngoDetails?.latitude || '0');
      const lng = parseFloat(ngoDetails?.longitude || '0');
      
      console.log(`📍 NGO Coordinates: ${lat}, ${lng}`);
      
      const isValid = lat !== 0 && lng !== 0 && !isNaN(lat) && !isNaN(lng);
      setNgoLocationValid(isValid);
      setLocationWarningVisible(!isValid);
      
      if (!isValid) {
        console.warn('⚠️ NGO location coordinates are invalid (0.00000 or NaN)');
      } else {
        console.log('✅ NGO location coordinates are valid');
      }
      
      return isValid;
    } catch (error) {
      console.error('❌ Failed to validate NGO location:', error);
      setNgoLocationValid(false);
      setLocationWarningVisible(true);
      return false;
    }
  }, [currentNgoId]);

  // ✅ ENHANCED: Fetch assigned reports with better error handling
  const fetchAssignedReports = useCallback(async () => {
    if (!currentNgoId) return;
    
    setAssignedLoading(true);
    setAssignedError(null);
    
    try {
      console.log(`🔄 Fetching assigned reports for NGO ID: ${currentNgoId}`);
      const response = await ngoApi.getAssignedReports(currentNgoId);
      const reportsArray = response.reports || response || [];
      
      const transformedReports = reportsArray.map((report: any) => ({
        id: report.id || report.report_id,
        report_id: report.report_id || report.id,
        title: report.title || `${report.animal_type || report.species || 'Animal'} Rescue Report`,
        description: report.description || report.injury_summary || 'No description provided',
        status: report.status || 'pending',
        priority: report.urgency_level || report.priority || report.severity || 'medium',
        location: report.location || 'Location not specified',
        location_string: report.location_string,
        reporter_name: report.reporter_name || 'Unknown Reporter',
        reporter_email: report.reporter_email || '',
        created_at: report.created_at,
        assigned_at: report.assigned_at,
        eta: report.eta || 'Not specified',
        animal_type: report.animal_type || report.species || 'Unknown',
        urgency_level: report.urgency_level || 'medium',
        contact_phone: report.contact_phone || report.reporter_phone,
        notes: report.notes || '',
        image: report.image || report.image_url || null,
        image_url: report.image_url || report.image,
        species: report.species,
        breed: report.breed,
        age: report.age,
        weight: report.weight,
        gender: report.gender,
        severity: report.severity,
        confidence_score: report.confidence_score,
        injury_summary: report.injury_summary,
        symptoms: report.symptoms,
        behavior: report.behavior,
        urgency: report.urgency,
        context: report.context,
        environment_factors: report.environment_factors,
        care_tips: report.care_tips,
        immediate_actions: report.immediate_actions,
        reporter_phone: report.reporter_phone,
      }));
      
      setAssignedReports(transformedReports);
      console.log(`✅ Successfully fetched ${transformedReports.length} assigned reports`);
      
    } catch (err: any) {
      console.error('❌ Failed to fetch assigned reports:', err);
      
      if (err instanceof APIError && err.message?.includes('Missing NGO location coordinates')) {
        setAssignedError('Your NGO location coordinates are missing. Please update your profile in Settings.');
        setLocationWarningVisible(true);
      } else if (err instanceof AuthenticationError) {
        setAssignedError('Session expired. Please login again.');
      } else if (err instanceof NetworkError) {
        setAssignedError('Network error. Please check your connection and try again.');
      } else {
        setAssignedError('Failed to fetch assigned reports. Please try again.');
      }
    } finally {
      setAssignedLoading(false);
    }
  }, [currentNgoId]);

  // ✅ ENHANCED: Fetch all reports with better error handling
  const fetchAllReports = useCallback(async () => {
    setAllLoading(true);
    setAllError(null);
    
    try {
      console.log('🔄 Fetching all available reports');
      const result = await reportsApi.listReports();
      
      const transformedReports = (result || []).map((report: any) => ({
        id: report.id || report.report_id,
        report_id: report.report_id || report.id,
        title: report.title || `${report.animal_type || report.species || 'Animal'} Rescue Report`,
        description: report.description || report.injury_summary || 'No description provided',
        status: report.status || 'pending',
        priority: report.urgency_level || report.priority || report.severity || 'medium',
        location: report.location || 'Location not specified',
        location_string: report.location_string,
        reporter_name: report.reporter_name || 'Unknown Reporter',
        reporter_email: report.reporter_email || '',
        created_at: report.created_at,
        assigned_at: report.assigned_at,
        eta: report.eta || 'Not specified',
        animal_type: report.animal_type || report.species || 'Unknown',
        urgency_level: report.urgency_level || 'medium',
        contact_phone: report.contact_phone || report.reporter_phone,
        notes: report.notes || '',
        image: report.image || report.image_url || null,
        image_url: report.image_url || report.image,
        species: report.species,
        breed: report.breed,
        age: report.age,
        weight: report.weight,
        gender: report.gender,
        severity: report.severity,
        confidence_score: report.confidence_score,
        injury_summary: report.injury_summary,
        symptoms: report.symptoms,
        behavior: report.behavior,
        urgency: report.urgency,
        context: report.context,
        environment_factors: report.environment_factors,
        care_tips: report.care_tips,
        immediate_actions: report.immediate_actions,
        reporter_phone: report.reporter_phone,
      }));
      
      setAllReports(transformedReports);
      console.log(`✅ Successfully fetched ${transformedReports.length} total reports`);
      
    } catch (err: any) {
      console.error('❌ Failed to fetch all reports:', err);
      setAllError('Failed to fetch available reports. Please try again.');
    } finally {
      setAllLoading(false);
    }
  }, []);

  // Initialize data and validate location
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        fetchAssignedReports(),
        fetchAllReports(),
        validateNGOLocation()
      ]);
    };
    
    initializeData();
  }, [currentNgoId, fetchAssignedReports, fetchAllReports, validateNGOLocation]);

  const assignedIds = useMemo(
    () => new Set((assignedReports || []).map(r => r.report_id || r.id)),
    [assignedReports]
  );

  // ✅ ENHANCED: Pre-validate location before accepting reports
  const handleAssignToNgo = useCallback(async (report: Report) => {
    if (!currentNgoId) {
      Alert.alert('Error', 'Missing NGO/User ID. Please log in again.');
      return;
    }
    
    const reportId = report.id || report.report_id;
    if (!reportId) {
      Alert.alert('Error', 'Missing report ID.');
      return;
    }

    // ✅ NEW: Pre-validate NGO location
    const isLocationValid = await validateNGOLocation();
    if (!isLocationValid) {
      Alert.alert(
        'Location Required',
        'Your NGO location coordinates are missing or invalid (0.00000). Please update your organization profile with valid coordinates in Settings to accept reports.',
        [
          {
            text: 'Go to Settings',
            onPress: () => {
              // @ts-ignore
              navigation.navigate('NGOSettings', { ngoId: currentNgoId });
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
      return;
    }

    setProcessingReports(prev => new Set(prev).add(report.id));
    
    Alert.alert(
      'Accept Rescue Report',
      `Are you sure you want to take responsibility for this ${report.animal_type || 'animal'} rescue?\n\n📍 Location: ${report.location_string || 'Unknown'}\n🚨 Priority: ${report.priority}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Accept',
          style: 'default',
          onPress: async () => {
            try {
              console.log(`🔄 Accepting report ${reportId} for NGO ${currentNgoId}`);
              await ngoApi.acceptReport(currentNgoId, { report_id: reportId });
              
              console.log(`✅ Successfully accepted report ${reportId}`);
              Alert.alert(
                'Success! 🎉', 
                `You have successfully accepted this ${report.animal_type || 'animal'} rescue report!\n\nThe report has been assigned to your organization.`
              );
              
              // Refresh both lists
              await Promise.all([fetchAssignedReports(), fetchAllReports()]);
              
            } catch (error: any) {
              console.error('❌ Accept report error:', error);
              let errorMessage = 'Failed to accept report. Please try again.';
              let errorTitle = 'Accept Failed';
              
              if (error instanceof AuthenticationError) {
                errorMessage = 'Your session has expired. Please login again.';
                errorTitle = 'Session Expired';
              } else if (error instanceof NetworkError) {
                errorMessage = 'Network error. Please check your internet connection and try again.';
                errorTitle = 'Connection Error';
              } else if (error instanceof APIError) {
                if (error.message?.includes('Missing NGO location coordinates')) {
                  Alert.alert(
                    'Location Required',
                    'Your NGO location coordinates are missing or invalid. Please update your organization profile with valid coordinates in Settings.',
                    [
                      {
                        text: 'Go to Settings',
                        onPress: () => {
                          // @ts-ignore
                          navigation.navigate('NGOSettings', { ngoId: currentNgoId });
                        }
                      },
                      {
                        text: 'Cancel',
                        style: 'cancel'
                      }
                    ]
                  );
                  return; // Don't show additional error
                } else if (error.message?.includes('already assigned')) {
                  errorMessage = 'This report has already been assigned to another NGO.';
                  errorTitle = 'Already Assigned';
                } else {
                  errorMessage = error.message || errorMessage;
                }
              }
              
              Alert.alert(errorTitle, errorMessage);
            } finally {
              setProcessingReports(prev => {
                const newSet = new Set(prev);
                newSet.delete(report.id);
                return newSet;
              });
            }
          },
        },
      ]
    );
  }, [currentNgoId, fetchAssignedReports, fetchAllReports, validateNGOLocation, navigation]);

  // ✅ ENHANCED: Accept already assigned report
  const handleAcceptReport = useCallback(async (reportId: string) => {
    if (!currentNgoId) return;
    
    setProcessingReports(prev => new Set(prev).add(reportId));
    
    try {
      console.log(`🔄 Accepting assigned report ${reportId}`);
      await ngoApi.acceptReport(currentNgoId, { report_id: reportId });
      
      // Update local state
      setAssignedReports(prev => prev.map(report =>
        report.id === reportId ? { ...report, status: 'active' } : report
      ));
      
      console.log(`✅ Successfully accepted assigned report ${reportId}`);
      Alert.alert('Success', 'Report accepted and activated successfully! 🎉');
      
    } catch (err: any) {
      console.error('❌ Failed to accept assigned report:', err);
      
      if (err instanceof APIError && err.message?.includes('Missing NGO location coordinates')) {
        Alert.alert(
          'Location Required', 
          'Your NGO location coordinates are missing or invalid. Please update your organization profile with valid coordinates in Settings.',
          [
            {
              text: 'Go to Settings',
              onPress: () => {
                // @ts-ignore
                navigation.navigate('NGOSettings', { ngoId: currentNgoId });
              }
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to accept report. Please try again.');
      }
    } finally {
      setProcessingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportId);
        return newSet;
      });
    }
  }, [currentNgoId, navigation]);

  // ✅ ENHANCED: Update report status
  const handleUpdateStatus = useCallback(async (
    reportId: string, newStatus: string, notes?: string
  ) => {
    if (!currentNgoId) return;
    
    setProcessingReports(prev => new Set(prev).add(reportId));
    
    try {
      console.log(`🔄 Updating report ${reportId} status to ${newStatus}`);
      await ngoApi.updateReportStatus(currentNgoId, reportId, newStatus, notes);
      
      // Update local state
      setAssignedReports(prev => prev.map(report =>
        report.id === reportId ? { ...report, status: newStatus } : report
      ));
      
      console.log(`✅ Successfully updated report ${reportId} status to ${newStatus}`);
      Alert.alert('Success', `Report status updated to ${newStatus.replace('_', ' ')} 📋`);
      
    } catch (err: any) {
      console.error('❌ Failed to update report status:', err);
      Alert.alert('Error', 'Failed to update report status. Please try again.');
    } finally {
      setProcessingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportId);
        return newSet;
      });
    }
  }, [currentNgoId]);

  // Filtering logic
  const filteredUnassigned = useMemo(() =>
    allReports
      .filter(r => !assignedIds.has(r.report_id || r.id))
      .filter(report => {
        const matchesSearch = report.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          report.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          report.animal_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (typeof report.location === 'string' ? report.location : report.location_string || '')
            ?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterStatus === 'all' || report.status?.toLowerCase() === filterStatus.toLowerCase();
        return matchesSearch && matchesFilter;
      }), [allReports, assignedIds, searchQuery, filterStatus]
  );

  const filteredAssigned = useMemo(() =>
    assignedReports.filter(report => {
      const matchesSearch = report.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.animal_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (typeof report.location === 'string' ? report.location : report.location_string || '')
          ?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === 'all' || report.status?.toLowerCase() === filterStatus.toLowerCase();
      return matchesSearch && matchesFilter;
    }), [assignedReports, searchQuery, filterStatus]
  );

  // ✅ ENHANCED: Color helpers
  const getSeverityColor = (severity: string) => {
    const colors: { [key: string]: string } = {
      Critical: theme.colors.error || '#D32F2F',
      High: theme.colors.warning || '#FF5722', 
      Medium: theme.colors.accent || '#FF9800',
      Low: theme.colors.success || '#4CAF50',
      critical: theme.colors.error || '#D32F2F',
      high: theme.colors.warning || '#FF5722', 
      medium: theme.colors.accent || '#FF9800',
      low: theme.colors.success || '#4CAF50',
    };
    return colors[severity] || theme.colors.outline || '#666666';
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: '#FF9800',
      in_progress: '#2196F3',
      active: '#2196F3',
      resolved: '#4CAF50',
      completed: '#4CAF50',
      cancelled: '#9E9E9E',
    };
    return colors[status] || '#FF9800';
  };

  const safeText = (value: any) => (value ? value : 'Not mentioned');

  // ✅ ENHANCED: Rich Report Card Component
  const RichReportCard = useCallback(({ report, isUnassigned }: { report: Report; isUnassigned: boolean }) => {
    const [expanded, setExpanded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [showFallback, setShowFallback] = useState(false);
    const isProcessing = processingReports.has(report.id);

    const openLocation = useCallback(() => {
      try {
        let locationObj: LocationObject | null = null;
        
        if (typeof report.location === 'string') {
          try {
            locationObj = JSON.parse(report.location);
          } catch {
            Alert.alert('Location', 'Location coordinates not available');
            return;
          }
        } else if (report.location && typeof report.location === 'object') {
          locationObj = report.location as LocationObject;
        }

        if (locationObj && 
            typeof locationObj.latitude === 'number' && 
            typeof locationObj.longitude === 'number') {
          const url = `https://www.google.com/maps/search/?api=1&query=${locationObj.latitude},${locationObj.longitude}`;
          Linking.openURL(url);
        } else {
          Alert.alert('Location', 'Location coordinates not available');
        }
      } catch (error) {
        console.error('Location error:', error);
        Alert.alert('Error', 'Could not open location');
      }
    }, [report.location]);

    const openImage = useCallback(() => {
      if (report.image_url && !imageError) {
        Linking.openURL(report.image_url).catch(() => {
          Alert.alert('Error', 'Unable to open image.');
        });
      } else {
        Alert.alert('Image not available');
      }
    }, [report.image_url, imageError]);

    const getImageSource = () => {
      if (!report.image_url || imageError || showFallback) return null;
      let imageUrl = report.image_url;
      if (typeof imageUrl === 'string') {
        imageUrl = imageUrl.replace('/v1/v1/', '/v1/').replace(/[?&]mode=admin/, '');
      }
      return { uri: imageUrl };
    };

    const renderImageFallback = () => (
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 12,
          backgroundColor: theme.colors.surfaceVariant || '#f0f0f0',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 16,
          borderWidth: 1,
          borderColor: theme.colors.outline || '#e0e0e0',
        }}
      >
        <Ionicons name="camera-outline" size={32} color={theme.colors.onSurfaceVariant || '#666666'} />
        <Text
          style={{
            fontSize: 10,
            color: theme.colors.onSurfaceVariant || '#666666',
            textAlign: 'center',
            marginTop: 4,
          }}
        >
          No Photo
        </Text>
      </View>
    );

    return (
      <Card
        style={{
          margin: 16,
          borderRadius: 16,
          backgroundColor: theme.colors.surface || '#fff3e0',
          overflow: 'hidden',
          elevation: 4,
        }}
      >
        {/* Header with Image and Info */}
        <View style={{ flexDirection: 'row', padding: 16 }}>
          <TouchableOpacity
            onPress={openImage}
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              marginRight: 16,
            }}
            activeOpacity={0.8}
          >
            {getImageSource() && !showFallback ? (
              <Image
                source={getImageSource()!}
                style={{ width: 80, height: 80, backgroundColor: '#f0f0f0' }}
                resizeMode="cover"
                onError={() => {
                  setImageError(true);
                  setShowFallback(true);
                }}
                onLoad={() => {
                  setImageError(false);
                  setShowFallback(false);
                }}
              />
            ) : (
              renderImageFallback()
            )}
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  color: theme.colors.onSurface || '#4e342e',
                  flex: 1,
                  marginRight: 8,
                }}
                numberOfLines={2}
              >
                {safeText(report.title)}
              </Text>
              <Chip
                mode="flat"
                style={{ backgroundColor: addAlpha(getSeverityColor(report.severity || report.priority), 0.2) }}
                textStyle={{ color: getSeverityColor(report.severity || report.priority), fontWeight: 'bold', fontSize: 15 }}
                compact
              >
                {safeText(report.severity || report.priority)}
              </Chip>
            </View>

            <TouchableOpacity onPress={openLocation} style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="location-outline" size={14} color={theme.colors.primary || '#ffd3a7'} />
                <Text
                  style={{
                    color: theme.colors.primary || '#ffd3a7',
                    fontSize: 13,
                    marginLeft: 4,
                    textDecorationLine: 'underline',
                    flex: 1,
                  }}
                  numberOfLines={2}
                >
                  {safeText(report.location_string || 'Click to view location')}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: theme.colors.onSurfaceVariant || '#8d6e63', fontSize: 12 }}>
                📅 {report.created_at ? new Date(report.created_at).toLocaleDateString() : 'Date Unknown'}
              </Text>
              <Text style={{ color: theme.colors.onSurfaceVariant || '#8d6e63', fontSize: 12 }}>📍 Near You</Text>
            </View>
          </View>
        </View>

        <Divider />

        {/* Animal Details */}
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <Chip mode="outlined" compact>🐕 {safeText(report.species || report.animal_type)}</Chip>
            {report.breed && <Chip mode="outlined" compact>🏷️ {safeText(report.breed)}</Chip>}
            {report.age && <Chip mode="outlined" compact>📅 {safeText(report.age)}</Chip>}
            {report.weight && <Chip mode="outlined" compact>⚖️ {safeText(report.weight)}</Chip>}
            {report.gender && report.gender !== 'Unknown' && (
              <Chip mode="outlined" compact>
                {report.gender === 'Male' ? '♂️' : report.gender === 'Female' ? '♀️' : '❓'} {report.gender}
              </Chip>
            )}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Chip
              mode="flat"
              style={{ backgroundColor: addAlpha(getStatusColor(report.status), 0.2) }}
              textStyle={{ color: getStatusColor(report.status) }}
            >
              {report.status?.toUpperCase() || 'PENDING'}
            </Chip>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant || '#8d6e63' }}>AI Confidence</Text>
              <Text style={{ fontWeight: 'bold', color: theme.colors.primary || '#ffd3a7' }}>
                {report.confidence_score || 8}/10
              </Text>
            </View>
          </View>
        </View>

        <Divider />

        {/* Comprehensive Injury Report */}
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="medical-outline" size={16} color={theme.colors.error || '#ff7043'} />
            <Text style={{ fontWeight: 'bold', marginLeft: 8, color: theme.colors.onSurface || '#4e342e' }}>
              🩺 Health Assessment
            </Text>
          </View>
          <Text
            style={{ color: theme.colors.onSurfaceVariant || '#8d6e63', lineHeight: 20, fontSize: 14 }}
            numberOfLines={expanded ? undefined : 3}
          >
            {safeText(report.injury_summary || report.description)}
          </Text>
          {(report.injury_summary?.length > 150 || report.description?.length > 150) && (
            <TouchableOpacity onPress={() => setExpanded(!expanded)} style={{ marginTop: 4 }}>
              <Text style={{ color: theme.colors.primary || '#ffd3a7', fontSize: 13 }}>
                {expanded ? 'Show less' : 'Show more'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Action Buttons */}
        <Divider />
        <View
          style={{
            flexDirection: 'row',
            padding: 16,
            gap: 8,
            justifyContent: 'space-between',
          }}
        >
          {isUnassigned ? (
            <Button
              mode="contained"
              icon="medical-bag"
              style={{ flex: 1 }}
              onPress={() => handleAssignToNgo(report)}
              loading={isProcessing}
              disabled={isProcessing || (ngoLocationValid === false)}
            >
              {isProcessing ? 'Assigning...' : 'Assign to Me'}
            </Button>
          ) : (
            <>
              {report.status === 'pending' ? (
                <Button
                  mode="contained"
                  icon="medical-bag"
                  style={{ flex: 1 }}
                  onPress={() => handleAcceptReport(report.id)}
                  loading={isProcessing}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Accepting...' : 'Accept Report'}
                </Button>
              ) : (
                <>
                  <Button
                    mode="outlined"
                    icon="update"
                    style={{ flex: 1, marginRight: 8 }}
                    onPress={() => {
                      Alert.alert(
                        'Update Status',
                        'Choose new status:',
                        [
                          { text: 'In Progress', onPress: () => handleUpdateStatus(report.id, 'in_progress') },
                          { text: 'Completed', onPress: () => handleUpdateStatus(report.id, 'completed', 'Report completed successfully') },
                          { text: 'Cancel', style: 'cancel' },
                        ]
                      );
                    }}
                    disabled={isProcessing}
                  >
                    Update Status
                  </Button>
                  <Button
                    mode="contained"
                    icon="phone"
                    style={{ flex: 1 }}
                    onPress={() => {
                      const phone = report.contact_phone || report.reporter_phone;
                      if (phone) {
                        Linking.openURL(`tel:${phone}`);
                      } else {
                        Alert.alert('No Contact', 'No contact number available for this report.');
                      }
                    }}
                  >
                    Contact
                  </Button>
                </>
              )}
            </>
          )}
        </View>

        {/* Footer with ID and Timestamp */}
        <View
          style={{
            backgroundColor: theme.colors.surfaceVariant || '#ffecd1',
            padding: 8,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant || '#8d6e63', opacity: 1 }}>
            Created: {report.created_at ? new Date(report.created_at).toLocaleString() : 'Time unknown'}
          </Text>
        </View>
      </Card>
    );
  }, [theme, processingReports, handleAssignToNgo, handleAcceptReport, handleUpdateStatus, getSeverityColor, getStatusColor, ngoLocationValid]);

  // ✅ ENHANCED: Refresh handler
  const onRefresh = useCallback(async () => {
    setLocalRefreshing(true);
    try {
      await Promise.all([
        fetchAssignedReports(),
        fetchAllReports(),
        validateNGOLocation()
      ]);
    } finally {
      setLocalRefreshing(false);
    }
  }, [fetchAssignedReports, fetchAllReports, validateNGOLocation]);

  // Loading state
  if (assignedLoading || allLoading) {
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles(theme).loadingText}>Loading reports...</Text>
        <Text style={styles(theme).loadingSubText}>
          Fetching data for NGO ID: {currentNgoId}
        </Text>
      </View>
    );
  }

  // Error state
  if (assignedError || allError) {
    return (
      <View style={styles(theme).errorContainer}>
        <Ionicons name="warning-outline" size={64} color={theme.colors.primary} />
        <Text style={styles(theme).errorTitle}>Unable to Load Reports</Text>
        <Text style={styles(theme).errorText}>{assignedError || allError}</Text>
        <Button mode="contained" onPress={onRefresh} style={{ marginTop: 16 }}>
          Try Again
        </Button>
        {(assignedError?.includes('location') || allError?.includes('location')) && (
          <Button 
            mode="outlined" 
            onPress={() => {
              // @ts-ignore
              navigation.navigate('NGOSettings', { ngoId: currentNgoId });
            }}
            style={{ marginTop: 8 }}
          >
            Update Location in Settings
          </Button>
        )}
      </View>
    );
  }

  return (
    <Surface style={styles(theme).container}>
      {/* ✅ NEW: Location Warning Banner */}
      {locationWarningVisible && (
        <Banner
          visible={locationWarningVisible}
          actions={[
            {
              label: 'Update Now',
              onPress: () => {
                // @ts-ignore
                navigation.navigate('NGOSettings', { ngoId: currentNgoId });
              },
            },
            {
              label: 'Dismiss',
              onPress: () => setLocationWarningVisible(false),
            },
          ]}
          icon="map-marker-alert"
          style={styles(theme).warningBanner}
        >
          <Text style={styles(theme).warningText}>
            ⚠️ Your NGO location coordinates are missing or invalid. Please update them in Settings to accept reports.
          </Text>
        </Banner>
      )}

      {/* Tab Selection */}
      <View style={styles(theme).tabContainer}>
        <Button
          mode={selectedFilterTab === 'unassigned' ? 'contained' : 'outlined'}
          onPress={() => setSelectedFilterTab('unassigned')}
          style={styles(theme).tabButton}
        >
          Available Reports ({filteredUnassigned.length})
        </Button>
        <Button
          mode={selectedFilterTab === 'assigned' ? 'contained' : 'outlined'}
          onPress={() => setSelectedFilterTab('assigned')}
          style={styles(theme).tabButton}
        >
          My Reports ({filteredAssigned.length})
        </Button>
      </View>

      {/* Search and Filter */}
      <View style={styles(theme).searchSection}>
        <Searchbar
          placeholder={`Search ${selectedFilterTab === 'unassigned' ? 'available' : 'assigned'} reports...`}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles(theme).searchBar}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles(theme).filterContainer}>
            {['all', 'pending', 'active', 'in_progress', 'completed'].map((filter) => (
              <Chip
                key={filter}
                selected={filterStatus === filter}
                onPress={() => setFilterStatus(filter)}
                style={[
                  styles(theme).filterChip,
                  filterStatus === filter && styles(theme).filterChipActive
                ]}
                textStyle={[
                  styles(theme).filterText,
                  filterStatus === filter && styles(theme).filterTextActive
                ]}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1).replace('_', ' ')}
              </Chip>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Reports List */}
      <ScrollView
        style={styles(theme).reportsContainer}
        refreshControl={
          <RefreshControl 
            refreshing={localRefreshing || parentRefreshing} 
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {(selectedFilterTab === 'unassigned' ? filteredUnassigned : filteredAssigned).length === 0 ? (
          <View style={styles(theme).emptyContainer}>
            <Ionicons 
              name={selectedFilterTab === 'unassigned' ? 'document-outline' : 'checkmark-circle-outline'} 
              size={64} 
              color={theme.colors.primary} 
            />
            <Text style={styles(theme).emptyTitle}>
              {searchQuery ? 'No Matching Reports' : 
               selectedFilterTab === 'unassigned' ? 'No Available Reports' : 'No Assigned Reports'}
            </Text>
            <Text style={styles(theme).emptyText}>
              {searchQuery ? 'Try adjusting your search terms or filters.' : 
               selectedFilterTab === 'unassigned' ? 'Check back later for new rescue requests.' : 
               'Accept some reports from the Available tab to see them here.'}
            </Text>
            <Button mode="outlined" onPress={onRefresh} style={{ marginTop: 16 }}>
              Refresh
            </Button>
          </View>
        ) : (
          (selectedFilterTab === 'unassigned' ? filteredUnassigned : filteredAssigned)
            .map((report) => (
              <RichReportCard 
                key={report.id} 
                report={report} 
                isUnassigned={selectedFilterTab === 'unassigned'} 
              />
            ))
        )}
      </ScrollView>
    </Surface>
  );
};

// ✅ ENHANCED: Comprehensive styles
const styles = (theme: FlexibleTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  warningBanner: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  warningText: {
    color: '#E65100',
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    margin: 16,
    gap: 12,
  },
  tabButton: {
    flex: 1,
  },
  searchSection: {
    padding: 16,
    paddingTop: 0,
  },
  searchBar: {
    marginBottom: 16,
    borderRadius: 16,
    elevation: 3,
    backgroundColor: theme.colors.surface,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    minWidth: 80,
    elevation: 2,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
  },
  filterText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
    textAlign: 'center',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  reportsContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '600',
  },
  loadingSubText: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.primary,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: theme.colors.background,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    opacity: 0.6,
    lineHeight: 24,
  },
});

export default AssignedReports;
