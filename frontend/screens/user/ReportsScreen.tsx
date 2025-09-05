import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  FlatList,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  Linking,
  Alert,
  ScrollView,
} from "react-native";
import {
  Text,
  Button,
  Searchbar,
  IconButton,
  Chip,
  Divider,
  Surface,
  ActivityIndicator,
  Badge,
  ProgressBar,
  Card,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useThemeContext } from "../../theme";
import { reportsApi } from "../../api/reportsApi";

const { width: screenWidth } = Dimensions.get("window");
const CARD_MAX_WIDTH = screenWidth - 32;
const PAGE_SIZE = 10;
const CACHE_DURATION = 5 * 60 * 1000;

// Cache implementation
const cache = {
  data: null as any,
  timestamp: null as number | null,
  filters: null as any,
  
  isValid(filters: any) {
    const now = Date.now();
    return this.data && 
           this.timestamp && 
           (now - this.timestamp < CACHE_DURATION) &&
           JSON.stringify(this.filters) === JSON.stringify(filters);
  },
  
  set(data: any, filters: any) {
    this.data = data;
    this.timestamp = Date.now();
    this.filters = filters;
  },
  
  clear() {
    this.data = null;
    this.timestamp = null;
    this.filters = null;
  }
};

interface Report {
  id: number | string;
  title?: string;
  description?: string;
  summary?: string;
  category?: string;
  urgency?: string;
  status?: string;
  created_at?: string;
  location?: string;
  location_string?: string;
  species?: string;
  age?: string;
  breed?: string;
  story?: string;
  impact?: string;
  donors?: number;
  days_left?: number;
  confidence_score?: number;
  raised?: number;
  goal?: number;
  verified?: boolean;
  featured?: boolean;
  image_url?: string;
  injury_summary?: string;
  symptoms?: string[];
  behavior?: string;
  context?: string;
  environment_factors?: string;
  care_tips?: string[];
  immediate_actions?: string[];
  gender?: string;
  weight?: string;
  severity?: string;
  contact_phone?: string;
  reporter_name?: string;
  reporter_phone?: string;
}

interface ReportsScreenProps {
  navigation: any;
}

// Helper function for alpha colors
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

export default function ReportsScreen({ navigation }: ReportsScreenProps) {
  const { theme } = useThemeContext();
  const styles = createStyles(theme);

  // Core state
  const [reports, setReports] = useState<Report[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [expandedReport, setExpandedReport] = useState<Report | null>(null);
  const [sortBy, setSortBy] = useState('all');

  // Debounced search
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Helper functions
  const safeText = (value: any) => (value ? value : 'Not mentioned');

  const getSeverityColor = (severity?: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return '#D32F2F';
      case 'high':
        return '#FF5722';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#4CAF50';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return '#FF9800';
      case 'in_progress':
        return '#2196F3';
      case 'resolved':
      case 'completed':
        return '#4CAF50';
      case 'cancelled':
        return '#9E9E9E';
      default:
        return '#FF9800';
    }
  };

  // Sorted reports
  const sortedReports = useMemo(() => {
    const sorted = [...reports];
    switch (sortBy) {
      case 'date_asc':
        return sorted.sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime());
      case 'date_desc':
        return sorted.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
      case 'urgency':
        return sorted.sort((a, b) => {
          const urgencyOrder: Record<string, number> = { 'High': 3, 'Moderate': 2, 'Low': 1 };
          return (urgencyOrder[b.urgency || ''] || 0) - (urgencyOrder[a.urgency || ''] || 0);
        });
      case 'category':
        return sorted.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
      default: // 'all'
        return sorted;
    }
  }, [reports, sortBy]);

  const fetchReports = useCallback(
    async (reset = false, useCache = true) => {
      if (loading && !reset) return;
      
      const currentFilters = { searchQuery: debouncedSearchQuery };
      
      if (useCache && reset && cache.isValid(currentFilters)) {
        setReports(cache.data.results || cache.data);
        setTotalPages(Math.ceil((cache.data.count || cache.data.length) / PAGE_SIZE));
        setHasMore((cache.data.count || cache.data.length) > PAGE_SIZE);
        return;
      }
      
      setLoading(true);
      try {
        const params: any = {
          page: reset ? 1 : page,
          page_size: PAGE_SIZE,
        };
        
        if (debouncedSearchQuery) {
          params["search"] = debouncedSearchQuery;
        }

        const data = await reportsApi.listReports(params);
        console.log("API response:", data);

        let fetchedReports: Report[];
        let total: number;

        if (Array.isArray(data)) {
          fetchedReports = data;
          total = data.length;
        } else if (data?.results) {
          fetchedReports = data.results;
          total = data.count ?? fetchedReports.length;
        } else {
          fetchedReports = [];
          total = 0;
        }

        if (reset) {
          cache.set(data, currentFilters);
        }

        const fetchedTotalPages = Math.ceil(total / PAGE_SIZE);

        if (reset) {
          setReports(fetchedReports);
          setPage(2);
          setHasMore(total > PAGE_SIZE);
        } else {
          setReports(prev => {
            const existingIds = new Set(prev.map(r => r.id));
            const newReports = fetchedReports.filter(r => !existingIds.has(r.id));
            return [...prev, ...newReports];
          });
          setPage(prev => prev + 1);
          setHasMore(fetchedReports.length === PAGE_SIZE);
        }

        setTotalPages(fetchedTotalPages);
      } catch (error) {
        console.error("Failed to fetch reports:", error);
        setHasMore(false);
      } finally {
        setLoading(false);
        if (refreshing) setRefreshing(false);
      }
    },
    [page, debouncedSearchQuery, loading, refreshing]
  );

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchReports(true);
  }, [debouncedSearchQuery]);

  const onRefresh = useCallback(() => {
    cache.clear();
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    fetchReports(true, false);
  }, [fetchReports]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore && page <= totalPages) {
      fetchReports();
    }
  }, [loading, hasMore, page, totalPages, fetchReports]);

  const clearSearch = () => {
    setSearchQuery("");
    setSearchActive(false);
  };

  const openReportDetails = (report: Report) => setExpandedReport(report);
  const closeReportDetails = () => setExpandedReport(null);

  // Rich Report Card Component
  const RichReportCard = React.memo(({ report, onPress }: { report: Report; onPress: (report: Report) => void }) => {
    const [expanded, setExpanded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [showFallback, setShowFallback] = useState(false);

    const toggleExpanded = useCallback(() => setExpanded((prev) => !prev), []);

    const openImage = useCallback(() => {
      if (report.image_url && !imageError) {
        Linking.openURL(report.image_url).catch(() => {
          Alert.alert('Error', 'Unable to open image.');
        });
      } else {
        Alert.alert('Image not available');
      }
    }, [report.image_url, imageError]);

    const openLocation = useCallback(() => {
      try {
        let locationObj = report.location;
        if (typeof locationObj === 'string') {
          locationObj = JSON.parse(locationObj);
        }
        if (locationObj && locationObj.latitude && locationObj.longitude) {
          const url = `https://www.google.com/maps/search/?api=1&query=${locationObj.latitude},${locationObj.longitude}`;
          Linking.openURL(url);
        }
      } catch {
        Alert.alert('Could not open location');
      }
    }, [report.location]);

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
          backgroundColor: '#f0f0f0',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 16,
          borderWidth: 1,
          borderColor: '#e0e0e0',
        }}
      >
        <Ionicons name="camera-outline" size={32} color="#666666" />
        <Text
          style={{
            fontSize: 10,
            color: '#666666',
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
                style={{ backgroundColor: addAlpha(getSeverityColor(report.severity || report.urgency), 0.2) }}
                textStyle={{ color: getSeverityColor(report.severity || report.urgency), fontWeight: 'bold', fontSize: 15 }}
                compact
              >
                {safeText(report.severity || report.urgency)}
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
                  Click to view location
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
            <Chip mode="outlined" compact>🐕 {safeText(report.species)}</Chip>
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
              🩺 Comprehensive Health Report
            </Text>
          </View>
          <Text
            style={{ color: theme.colors.onSurfaceVariant || '#8d6e63', lineHeight: 20, fontSize: 14 }}
            numberOfLines={expanded ? undefined : 3}
          >
            {safeText(report.injury_summary || report.description || report.summary)}
          </Text>
          {(report.injury_summary?.length > 150 || report.description?.length > 150) && (
            <TouchableOpacity onPress={toggleExpanded} style={{ marginTop: 4 }}>
              <Text style={{ color: theme.colors.primary || '#ffd3a7', fontSize: 13 }}>
                {expanded ? 'Show less' : 'Show more'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Symptoms section */}
        {report.symptoms && report.symptoms.length > 0 && (
          <View>
            <Divider />
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="list-outline" size={16} color={theme.colors.secondary || '#ffe0b2'} />
                <Text style={{ fontWeight: 'bold', marginLeft: 8, color: theme.colors.onSurface || '#4e342e' }}>
                  🔍 Observed Symptoms
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {report.symptoms.slice(0, expanded ? report.symptoms.length : 3).map((symptom: string, index: number) => (
                  <Chip
                    key={`symptom-${index}`}
                    mode="outlined"
                    compact
                    style={{ backgroundColor: theme.colors.errorContainer || '#ffcec6' }}
                    textStyle={{ color: theme.colors.onErrorContainer || '#4e342e', fontSize: 11 }}
                  >
                    {symptom}
                  </Chip>
                ))}
                {!expanded && report.symptoms.length > 3 && (
                  <Chip compact onPress={toggleExpanded}>
                    +{report.symptoms.length - 3} more
                  </Chip>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Behavior & Context */}
        <Divider />
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface || '#4e342e', marginBottom: 4 }}>
                🐕 Behavior
              </Text>
              <Text style={{ color: theme.colors.onSurfaceVariant || '#8d6e63', fontSize: 13 }}>
                {safeText(report.behavior)}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface || '#4e342e', marginBottom: 4 }}>
                ⚡ Urgency Level
              </Text>
              <Text style={{ color: theme.colors.onSurfaceVariant || '#8d6e63', fontSize: 13 }}>
                {safeText(report.urgency)}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface || '#4e342e', marginBottom: 4 }}>
                🏙️ Context
              </Text>
              <Text style={{ color: theme.colors.onSurfaceVariant || '#8d6e63', fontSize: 13 }}>
                {safeText(report.context)}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface || '#4e342e', marginBottom: 4 }}>
                🌍 Environment
              </Text>
              <Text style={{ color: theme.colors.onSurfaceVariant || '#8d6e63', fontSize: 13 }} numberOfLines={2}>
                {safeText(report.environment_factors || 'Urban environment')}
              </Text>
            </View>
          </View>
        </View>

        {/* Care Tips & Immediate Actions */}
        {expanded && report.care_tips && report.care_tips.length > 0 && (
          <View>
            <Divider />
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontWeight: 'bold', color: theme.colors.primary || '#ffd3a7', marginBottom: 8 }}>
                    💡 Care Tips
                  </Text>
                  {report.care_tips.slice(0, 3).map((tip: string, index: number) => (
                    <View key={`care-tip-${index}`} style={{ flexDirection: 'row', marginBottom: 4 }}>
                      <Text style={{ color: theme.colors.primary || '#ffd3a7', marginRight: 4 }}>•</Text>
                      <Text style={{ color: theme.colors.onSurfaceVariant || '#8d6e63', fontSize: 12, flex: 1 }}>
                        {tip}
                      </Text>
                    </View>
                  ))}
                </View>

                {report.immediate_actions && report.immediate_actions.length > 0 && (
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={{ fontWeight: 'bold', color: theme.colors.error || '#ff7043', marginBottom: 8 }}>
                      🚨 Immediate Actions
                    </Text>
                    {report.immediate_actions.slice(0, 3).map((action: string, index: number) => (
                      <View key={`action-${index}`} style={{ flexDirection: 'row', marginBottom: 4 }}>
                        <Text style={{ color: theme.colors.error || '#ff7043', marginRight: 4 }}>•</Text>
                        <Text style={{ color: theme.colors.onSurfaceVariant || '#8d6e63', fontSize: 12, flex: 1 }}>
                          {action}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Progress Section */}
        {report.raised !== undefined && report.goal !== undefined && (
          <View>
            <Divider />
            <View style={{ padding: 16 }}>
              <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface || '#4e342e', marginBottom: 8 }}>
                💰 Funding Progress
              </Text>
              <ProgressBar 
                progress={report.goal > 0 ? report.raised / report.goal : 0} 
                color={theme.colors.primary} 
                style={{ height: 8, borderRadius: 4, marginBottom: 8 }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant || '#8d6e63' }}>
                  ₹{report.raised?.toLocaleString() || 0} raised
                </Text>
                <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant || '#8d6e63' }}>
                  Goal: ₹{report.goal?.toLocaleString() || 0}
                </Text>
              </View>
            </View>
          </View>
        )}

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
          <Button
            mode="outlined"
            icon="eye"
            style={{ flex: 1, marginRight: 8 }}
            onPress={() => onPress(report)}
          >
            View Details
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
                Alert.alert('No contact number available');
              }
            }}
          >
            Contact Reporter
          </Button>
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
            Report Created At: {report.created_at ? new Date(report.created_at).toLocaleString() : 'Time unknown'}
          </Text>
        </View>
      </Card>
    );
  });

  // Horizontal Sort Controls Component
  const renderHorizontalSort = () => {
    const sortOptions = [
      { key: 'all', label: 'All' },
      { key: 'date_desc', label: 'New First' },
      { key: 'date_asc', label: 'Old First' },
      { key: 'category', label: 'Category' },
      { key: 'urgency', label: 'Urgency' },
    ];

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.horizontalSortContainer}
        contentContainerStyle={styles.horizontalSortContent}
      >
        {sortOptions.map((option) => {
          const isSelected = sortBy === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              onPress={() => setSortBy(option.key)}
              style={[
                styles.sortOption,
                isSelected && styles.sortOptionSelected,
                { 
                  backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                  borderColor: isSelected ? theme.colors.primary : theme.colors.outline,
                }
              ]}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  { color: isSelected ? '#FFFFFF' : theme.colors.onSurface }
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header - REMOVED FILTER BUTTON */}
      <LinearGradient
        colors={["white", theme.colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.titleContainer}>
            <Text style={[styles.karunaTitle, { color: theme.colors.primary }]}>
              Reports
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
              {reports.length} report{reports.length !== 1 ? "s" : ""} found
            </Text>
          </View>
          <View style={styles.headerIcons}>
            <Surface style={styles.iconButton} elevation={1}>
              <IconButton
                icon="magnify"
                size={22}
                iconColor={theme.colors.primary}
                onPress={() => setSearchActive(true)}
              />
            </Surface>
          </View>
        </View>

        {searchActive && (
          <View style={styles.searchContainer}>
            <Searchbar
              placeholder="Search reports..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchbar}
              iconColor={theme.colors.primary}
              inputStyle={{ color: theme.colors.onSurface }}
              autoFocus
              onBlur={() => !searchQuery && setSearchActive(false)}
              right={() =>
                searchQuery ? (
                  <IconButton
                    icon="close"
                    size={20}
                    onPress={clearSearch}
                    iconColor={theme.colors.onSurfaceVariant}
                  />
                ) : undefined
              }
            />
          </View>
        )}
      </LinearGradient>

      {/* Horizontal Sort Controls */}
      {renderHorizontalSort()}

      {/* Content */}
      {loading && reports.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
            Loading reports...
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedReports}
          renderItem={({ item }) => (
            <RichReportCard 
              report={item} 
              onPress={openReportDetails}
            />
          )}
          keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReachedThreshold={0.2}
          onEndReached={loadMore}
          ListFooterComponent={() => {
            if (loading && reports.length > 0) {
              return (
                <View style={styles.loadingFooter}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>
                    Loading more reports...
                  </Text>
                </View>
              );
            }
            if (!hasMore && reports.length > 0) {
              return (
                <View style={styles.endFooter}>
                  <View style={styles.endLine} />
                  <Text style={[styles.endText, { color: theme.colors.onSurfaceVariant }]}>
                    You've reached the end
                  </Text>
                </View>
              );
            }
            return <View style={{ height: 20 }} />;
          }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !loading && reports.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="document-text-outline"
                  size={64}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                  No reports found
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {debouncedSearchQuery
                    ? "Try adjusting your search terms"
                    : "Reports will appear here once they're available"
                  }
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Detail Modal */}
      <Modal
        visible={!!expandedReport}
        animationType="slide"
        onRequestClose={closeReportDetails}
      >
        <View style={[styles.detailModal, { backgroundColor: theme.colors.background }]}>
          <View style={styles.detailHeader}>
            <IconButton
              icon="arrow-left"
              size={28}
              onPress={closeReportDetails}
              iconColor={theme.colors.primary}
            />
            <Text style={[styles.detailTitle, { color: theme.colors.onSurface }]}>
              Report Details
            </Text>
            <View style={{ width: 40 }} />
          </View>
          {expandedReport && (
            <View style={styles.detailContent}>
              <RichReportCard report={expandedReport} onPress={() => {}} />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF8F6",
  },
 
  header: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: "#887d66ff",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  titleContainer: {
    flex: 1,
    justifyContent: "center",
  },
  karunaTitle: {
    fontSize: 38,
    fontFamily: "cursive",
    fontWeight: "700",
    color: "#7B6945",
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#998570",
    fontWeight: "400",
    marginBottom: 0,
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButton: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    marginLeft: 10,
    marginBottom: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: "#EEEDEC",
  },
  searchContainer: { marginTop: 0 },
  searchbar: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    elevation: 0,
    borderWidth: 1,
    borderColor: "#EEEDEC",
    paddingVertical: 0,
    fontSize: 15,
  },

  // New Horizontal Sort Styles
 horizontalSortContainer: {
    backgroundColor: "#FBFAF8",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEDEC",
    paddingVertical: 20,
  },
  horizontalSortContent: {
    paddingHorizontal: 15,
  },
  sortOption: {
    height: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    marginRight: 8,
  },
  sortOptionSelected: {
    elevation: 2,
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  listContent: {
    paddingTop: 1,
    paddingBottom: 24,
    backgroundColor: "#FAF8F6",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingFooter: {
    alignItems: "center",
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 11,
    color: "#998570",
    textAlign: "center",
  },

  endFooter: {
    alignItems: "center",
    paddingVertical: 22,
  },
  endLine: {
    width: 60,
    height: 2,
    backgroundColor: "#EEEDEC",
    borderRadius: 1,
    marginBottom: 11,
  },
  endText: {
    fontSize: 13,
    fontStyle: "italic",
    color: "#998570",
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 35,
    paddingTop: 54,
    backgroundColor: "#FAF8F6",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 13,
    color: "#7B6945",
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 5,
    color: "#998570",
  },

  detailModal: {
    flex: 1,
    backgroundColor: "#FAF8F6",
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 38,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEDEC",
    backgroundColor: "#FBFAF8",
    elevation: 1,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#7B6945",
  },
  detailContent: {
    flex: 1,
    backgroundColor: "#FAF8F6",
  },
});
