import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, StyleSheet, FlatList, Dimensions, RefreshControl, TouchableOpacity, Animated, ScrollView, Alert, Linking } from 'react-native';
import { Text, Card, Searchbar, Chip, ActivityIndicator, FAB, Button, IconButton, Surface, ProgressBar, Divider } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import debounce from 'lodash.debounce';
import Toast from 'react-native-toast-message';
import NetInfo from '@react-native-community/netinfo';
import { ngoApi } from '../../api/ngolistApi';
import AuthService from '../../api/authService';
import { useThemeContext } from '../../theme';

const { width } = Dimensions.get('window');

interface NGO {
  appwrite_user_id: string; // ✅ FIXED: This is the primary ID field
  ngo_id?: string;
  id?: string;
  name: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  location?: string;
  city?: string;
  state?: string;
  category?: string;
  is_verified?: boolean;
  reports_count?: number;
  volunteers_count?: number;
  image?: string;
  established?: string;
  website?: string;
  success_rate?: number;
  featured?: boolean;
  latitude?: string;
  longitude?: string;
}

// ✅ FIXED: API response interface
interface NGOApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: NGO[];
}

export default function NGOListScreen({ navigation }: any) {
  const { theme } = useThemeContext();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  const [ngos, setNgos] = useState<NGO[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false); // ✅ NEW: Loading more state
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [sortBy, setSortBy] = useState('all');
  const [currentPage, setCurrentPage] = useState(1); // ✅ NEW: Current page tracking
  const [hasNextPage, setHasNextPage] = useState(true); // ✅ NEW: Has next page flag

  // ✅ FIXED: Proper NGO ID extraction
  const getNGOId = (ngo: NGO): string | null => {
    return ngo.appwrite_user_id || ngo.ngo_id || ngo.id || null;
  };

  // ✅ ENHANCED: Fetch NGOs with pagination support
  const fetchNGOs = useCallback(async (page = 1, append = false) => {
    try {
      if (page === 1) {
        setLoading(true);
        setCurrentPage(1);
        setHasNextPage(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      
      console.log(`📡 Fetching NGOs page ${page}...`);
      
      // ✅ FIXED: Add pagination parameters
      const params = {
        page: page,
        page_size: 50, // ✅ Request 50 items per page instead of default 10
        ordering: '-id' // Get newest first
      };
      
      const data: NGOApiResponse = await ngoApi.listNGOs(params);
      
      console.log(`✅ Loaded ${data.results?.length || 0} NGOs from API (page ${page})`);
      console.log(`📊 Total count: ${data.count}, Has next: ${!!data.next}`);
      
      if (data.results && Array.isArray(data.results)) {
        if (append && page > 1) {
          // ✅ Append new data to existing list
          setNgos(prevNgos => [...prevNgos, ...data.results]);
        } else {
          // ✅ Replace data for first page or refresh
          setNgos(data.results);
        }
        
        // ✅ Update pagination state
        setCurrentPage(page);
        setHasNextPage(!!data.next);
        
        if (data.results.length > 0) {
          const firstNGO = data.results[0];
          console.log('🔍 First NGO structure:', JSON.stringify(firstNGO, null, 2));
          console.log('🔍 NGO ID field:', getNGOId(firstNGO));
        }
      }
      
      setError(null);
    } catch (err: any) {
      console.error('❌ Error fetching NGOs:', err);
      setError(err.message || 'Failed to load NGO data');
      
      Toast.show({
        type: 'error',
        text1: 'Error Loading NGOs',
        text2: err.message || 'Please check your connection and try again.',
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  // ✅ NEW: Load more data when reaching end
  const loadMoreNGOs = useCallback(() => {
    if (!loadingMore && !loading && hasNextPage) {
      console.log(`🔄 Loading more NGOs... (page ${currentPage + 1})`);
      fetchNGOs(currentPage + 1, true);
    }
  }, [fetchNGOs, currentPage, hasNextPage, loadingMore, loading]);

  useEffect(() => {
    fetchNGOs(1, false); // Load first page
    
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
      if (!state.isConnected && loading) {
        setError('No internet connection');
        setLoading(false);
      }
    });

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    return () => unsubscribe();
  }, [fetchNGOs]);

  // ✅ ENHANCED: Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCurrentPage(1);
    setHasNextPage(true);
    fetchNGOs(1, false); // Reset to first page
  }, [fetchNGOs]);

  const debouncedSetSearch = useMemo(() => 
    debounce((query: string) => {
      setSearchQuery(query);
      console.log('🔍 Search query:', query);
    }, 300), 
  []);

  const clearSearch = () => {
    setSearchQuery("");
    setSearchActive(false);
  };

  const filteredAndSortedNgos = useMemo(() => {
    let result = Array.isArray(ngos) ? [...ngos] : [];

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(ngo =>
        (ngo.name || '').toLowerCase().includes(lowerQuery) ||
        (ngo.location || '').toLowerCase().includes(lowerQuery) ||
        (ngo.category || '').toLowerCase().includes(lowerQuery) ||
        (ngo.description || '').toLowerCase().includes(lowerQuery) ||
        (ngo.email || '').toLowerCase().includes(lowerQuery)
      );
    }

    switch (sortBy) {
      case 'verified':
        return result.sort((a, b) => {
          if (a.is_verified && !b.is_verified) return -1;
          if (!a.is_verified && b.is_verified) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });
      case 'featured':
        return result.sort((a, b) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });
      case 'name':
        return result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      case 'reports':
        return result.sort((a, b) => (b.reports_count || 0) - (a.reports_count || 0));
      case 'success':
        return result.sort((a, b) => (b.success_rate || 0) - (a.success_rate || 0));
      default:
        return result.sort((a, b) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          if (a.is_verified && !b.is_verified) return -1;
          if (!a.is_verified && b.is_verified) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });
    }
  }, [ngos, searchQuery, sortBy]);

  const handleNGOPress = (ngo: NGO) => {
    const ngoId = getNGOId(ngo);
    console.log('🔗 Navigating to NGO detail:', ngoId);
    navigation.navigate('NGODetail', { ngoId, ngo });
  };

  // ✅ FIXED: Enhanced volunteer apply handler
  const handleVolunteerApply = useCallback(async (ngo: NGO) => {
    try {
      const ngoId = getNGOId(ngo);
      
      if (!ngoId) {
        console.error('❌ NGO ID is missing:', ngo);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'NGO information is incomplete. Please try refreshing the list.',
        });
        return;
      }

      console.log('✅ NGO ID found:', ngoId);

      Alert.alert(
        'Apply as Volunteer',
        `Do you want to apply as a volunteer for ${ngo.name}?\n\nYou can contact them directly or express your interest.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Express Interest',
            style: 'default',
            onPress: async () => {
              try {
                console.log('🤝 Applying as volunteer to NGO:', ngoId);
                
                // ✅ FIXED: Use the correct application data structure
                const applicationData = {
                  volunteer_name: 'Current User', // TODO: Get from auth
                  volunteer_email: 'user@example.com', // TODO: Get from auth
                  volunteer_phone: '',
                  message: `I would like to volunteer for ${ngo.name}. Please let me know how I can help.`,
                  skills: [],
                  availability: 'flexible'
                };
                
                console.log('📤 Sending application data:', applicationData);
                
                try {
                  // ✅ ENHANCED: Better error handling for API call
                  if (typeof ngoApi.applyAsVolunteer === 'function') {
                    await ngoApi.applyAsVolunteer(ngoId, applicationData);
                    console.log('✅ Volunteer application submitted successfully');
                    
                    Toast.show({
                      type: 'success',
                      text1: 'Application Sent! 🎉',
                      text2: `Your volunteer interest in ${ngo.name} has been submitted successfully.`,
                      visibilityTime: 4000,
                    });
                  } else {
                    console.warn('⚠️ applyAsVolunteer method not available');
                    throw new Error('Volunteer application method not available');
                  }
                } catch (apiError: any) {
                  console.log('⚠️ API method failed, offering direct contact...', apiError);
                  
                  Toast.show({
                    type: 'info',
                    text1: 'Contact NGO Directly',
                    text2: 'Please use the contact options below to reach out to them.',
                    visibilityTime: 3000,
                  });
                }
                
                // ✅ Always offer direct contact options
                setTimeout(() => {
                  if (ngo.email || ngo.phone) {
                    Alert.alert(
                      'Contact NGO Directly',
                      'Would you like to contact them directly as well?',
                      [
                        { text: 'Not Now', style: 'cancel' },
                        {
                          text: 'Send Email',
                          onPress: () => {
                            if (ngo.email) {
                              const emailUrl = `mailto:${ngo.email}?subject=Volunteer Application for ${ngo.name}&body=Hello,\n\nI am interested in volunteering for ${ngo.name}. Please let me know how I can help.\n\nBest regards`;
                              Linking.openURL(emailUrl).catch(() => {
                                Toast.show({
                                  type: 'error',
                                  text1: 'Cannot open email client',
                                  text2: `Please email them at: ${ngo.email}`,
                                });
                              });
                            }
                          }
                        },
                        {
                          text: 'Call',
                          onPress: () => {
                            if (ngo.phone) {
                              Linking.openURL(`tel:${ngo.phone}`).catch(() => {
                                Toast.show({
                                  type: 'error',
                                  text1: 'Cannot make call',
                                  text2: `Please call them at: ${ngo.phone}`,
                                });
                              });
                            }
                          }
                        }
                      ]
                    );
                  }
                }, 2000);
                
              } catch (error: any) {
                console.error('❌ Volunteer application flow failed:', error);
                Toast.show({
                  type: 'error',
                  text1: 'Application Failed',
                  text2: 'Unable to submit application at this time. Please try contacting them directly.',
                });
              }
            }
          },
          {
            text: 'Contact Directly',
            onPress: () => {
              if (ngo.email) {
                const emailUrl = `mailto:${ngo.email}?subject=Volunteer Inquiry for ${ngo.name}&body=Hello,\n\nI would like to volunteer for your organization. Please let me know how I can help.\n\nBest regards`;
                Linking.openURL(emailUrl).catch(() => {
                  Alert.alert('Email not available', `Please contact them at: ${ngo.email}`);
                });
              } else if (ngo.phone) {
                Linking.openURL(`tel:${ngo.phone}`).catch(() => {
                  Alert.alert('Phone not available', `Please call them at: ${ngo.phone}`);
                });
              } else {
                Toast.show({
                  type: 'error',
                  text1: 'No contact information available',
                  text2: 'Please view their details for more information.',
                });
              }
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('❌ Error in volunteer application flow:', error);
      Toast.show({
        type: 'error',
        text1: 'Application Failed',
        text2: 'An unexpected error occurred. Please try again.'
      });
    }
  }, []);

  const getVerificationColor = (isVerified: boolean) => {
    return isVerified ? "#4CAF50" : "#FF9800";
  };

  const renderHorizontalSort = () => {
    const sortOptions = [
      { key: 'all', label: 'All' },
      { key: 'featured', label: 'Featured' },
      { key: 'verified', label: 'Verified' },
      { key: 'name', label: 'Name' },
      { key: 'reports', label: 'Most Reports' },
      { key: 'success', label: 'Success Rate' },
    ];

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles(theme).horizontalSortContainer}
        contentContainerStyle={styles(theme).horizontalSortContent}
      >
        {sortOptions.map((option) => {
          const isSelected = sortBy === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              onPress={() => setSortBy(option.key)}
              style={[
                styles(theme).sortOption,
                isSelected && styles(theme).sortOptionSelected,
                { 
                  backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                  borderColor: isSelected ? theme.colors.primary : theme.colors.outline,
                }
              ]}
            >
              <Text
                style={[
                  styles(theme).sortOptionText,
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

  // ✅ NEW: Footer component for loading more indicator
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles(theme).footerLoader}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles(theme).footerText, { color: theme.colors.text }]}>
          Loading more NGOs...
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: NGO }) => {
    const scaleAnim = new Animated.Value(1);

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    const avatarUrl = item.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=4CAF50&color=fff&size=200`;

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeAnim }}>
        <TouchableOpacity
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => handleNGOPress(item)}
          activeOpacity={0.9}
        >
          <Card style={[styles(theme).card, theme.cardShadow, { backgroundColor: theme.colors.card, borderColor: theme.colors.accent }]} mode="elevated">
            <View style={styles(theme).imageContainer}>
              <Card.Cover 
                source={{ uri: avatarUrl }} 
                style={styles(theme).cardImage}
              />
              
              <View style={styles(theme).badgeContainer}>
                {item.featured && (
                  <View style={styles(theme).featuredBadge}>
                    <Ionicons name="star" size={12} color="#000" />
                    <Text style={styles(theme).featuredText}>FEATURED</Text>
                  </View>
                )}
                
                {item.is_verified && (
                  <View style={styles(theme).verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="white" />
                  </View>
                )}
              </View>
              
              <View style={[styles(theme).statusBadge, { backgroundColor: getVerificationColor(item.is_verified || false) }]}>
                <Ionicons 
                  name={item.is_verified ? "checkmark-circle" : "time"} 
                  size={12} 
                  color="white" 
                  style={{ marginRight: 4 }}
                />
                <Text style={styles(theme).statusText}>
                  {item.is_verified ? 'VERIFIED' : 'PENDING'}
                </Text>
              </View>
            </View>
            
            <Card.Content>
              <View style={styles(theme).headerRow}>
                <Text variant="titleLarge" style={[styles(theme).title, { color: theme.colors.text }]} numberOfLines={2}>
                  {item.name}
                </Text>
                {item.category && (
                  <Chip 
                    style={[styles(theme).categoryChip, { backgroundColor: theme.colors.accent, borderColor: theme.colors.secondary }]} 
                    textStyle={[styles(theme).categoryChipText, { color: theme.colors.primary }]}
                    mode="outlined"
                  >
                    {item.category}
                  </Chip>
                )}
              </View>
              
              <Text variant="bodyMedium" style={[styles(theme).description, { color: theme.colors.subtext }]} numberOfLines={3}>
                {item.description || 'No description available for this NGO.'}
              </Text>
              
              <View style={styles(theme).locationSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="location" size={16} color={theme.colors.primary} />
                  <Text style={[styles(theme).sectionTitle, { color: theme.colors.text, marginLeft: 4, marginBottom: 0 }]}>Location</Text>
                </View>
                <Text style={[styles(theme).locationText, { color: theme.colors.subtext }]}>
                  {item.location || item.address || 'Location not specified'}
                </Text>
              </View>
              
              <Divider style={styles(theme).divider} />
              
              <View style={styles(theme).contactSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="call" size={16} color={theme.colors.primary} />
                  <Text style={[styles(theme).sectionTitle, { color: theme.colors.text, marginLeft: 4, marginBottom: 0 }]}>Contact</Text>
                </View>
                <View style={styles(theme).contactRow}>
                  {item.email && (
                    <TouchableOpacity 
                      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
                      onPress={() => {
                        const emailUrl = `mailto:${item.email}`;
                        Linking.openURL(emailUrl);
                      }}
                    >
                      <Ionicons name="mail" size={14} color={theme.colors.primary} />
                      <Text style={[styles(theme).contactText, { color: theme.colors.subtext, marginLeft: 4 }]} numberOfLines={1}>
                        {item.email}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {item.phone && (
                    <TouchableOpacity 
                      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
                      onPress={() => {
                        Linking.openURL(`tel:${item.phone}`);
                      }}
                    >
                      <Ionicons name="call" size={14} color={theme.colors.primary} />
                      <Text style={[styles(theme).contactText, { color: theme.colors.subtext, marginLeft: 4 }]}>
                        {item.phone}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Card.Content>
            
            <Card.Actions style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <Button
                mode="outlined"
                buttonColor="transparent"
                textColor={theme.colors.primary}
                style={[styles(theme).button, { marginRight: 8, borderColor: theme.colors.primary }]}
                icon="information-outline"
                onPress={() => handleNGOPress(item)}
                labelStyle={{ fontSize: 14 }}
              >
                View Details
              </Button>
              <Button
                mode="contained"
                buttonColor={theme.colors.primary}
                textColor={theme.colors.card}
                style={styles(theme).button}
                icon="hand-heart"
                onPress={() => handleVolunteerApply(item)}
                labelStyle={{ fontSize: 14 }}
              >
                Apply as Volunteer
              </Button>
            </Card.Actions>
          </Card>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={[styles(theme).loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 16, color: theme.colors.text, fontSize: 16 }}>Loading NGOs...</Text>
        <Text style={{ marginTop: 8, color: theme.colors.subtext, textAlign: 'center' }}>
          Fetching latest NGO data from server
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles(theme).loadingContainer, { backgroundColor: theme.colors.background }]}>
        <Ionicons name="alert-circle-outline" size={64} color={theme.colors.error} />
        <Text variant="headlineSmall" style={{ color: theme.colors.error, marginTop: 16, marginBottom: 8, textAlign: 'center' }}>
          ⚠️ Error Loading NGOs
        </Text>
        <Text style={{ textAlign: 'center', color: theme.colors.subtext, marginBottom: 16, paddingHorizontal: 20 }}>
          {error}
        </Text>
        <Button
          mode="contained"
          onPress={() => fetchNGOs(1, false)}
          icon="refresh"
          buttonColor={theme.colors.primary}
        >
          Retry Loading
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles(theme).container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={["white", theme.colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles(theme).header}
      >
        <View style={styles(theme).headerContent}>
          <View style={styles(theme).titleContainer}>
            <Text style={[styles(theme).karunaTitle, { color: theme.colors.primary }]}>
              NGO Directory
            </Text>
            <Text style={[styles(theme).subtitle, { color: theme.colors.onSurfaceVariant }]}>
              {filteredAndSortedNgos.length} NGO{filteredAndSortedNgos.length !== 1 ? 's' : ''} found
              {hasNextPage && !searchQuery && ` • More available`}
            </Text>
          </View>
          <View style={styles(theme).headerIcons}>
            <Surface style={styles(theme).iconButton} elevation={1}>
              <IconButton
                icon="refresh"
                size={22}
                iconColor={theme.colors.primary}
                onPress={onRefresh}
              />
            </Surface>
            <Surface style={styles(theme).iconButton} elevation={1}>
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
          <View style={styles(theme).searchContainer}>
            <Searchbar
              placeholder="Search NGOs by name, location, or category..."
              onChangeText={debouncedSetSearch}
              value={searchQuery}
              style={styles(theme).searchbar}
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

      {renderHorizontalSort()}

      {/* ✅ ENHANCED: FlatList with infinite scroll */}
      <FlatList
        data={filteredAndSortedNgos}
        keyExtractor={(item, index) => {
          return getNGOId(item) || `ngo-${index}`;
        }}
        renderItem={renderItem}
        contentContainerStyle={styles(theme).listContent}
        style={{ paddingTop: 10, paddingBottom: 100, marginTop: 15}}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        // ✅ NEW: Infinite scroll properties
        onEndReached={loadMoreNGOs}
        onEndReachedThreshold={0.1}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={5}
        ListEmptyComponent={() => (
          <Card style={styles(theme).emptyCard}>
            <Card.Content style={{ alignItems: 'center' }}>
              <Ionicons 
                name={searchQuery ? 'search-outline' : 'business-outline'} 
                size={64} 
                color={theme.colors.onSurfaceVariant} 
              />
              <Text variant="titleLarge" style={[styles(theme).emptyTitle, { color: theme.colors.text }]}>
                {searchQuery ? 'No Results Found' : 'No NGOs Available'}
              </Text>
              <Text style={{ textAlign: 'center', color: theme.colors.subtext, marginTop: 8 }}>
                {searchQuery 
                  ? 'Try adjusting your search terms or filters.' 
                  : 'Be the first to register an NGO in our directory!'
                }
              </Text>
              {!searchQuery && (
                <Button 
                  mode="outlined" 
                  onPress={() => navigation.navigate('RegisterNGO')}
                  style={{ marginTop: 16 }}
                  icon="plus"
                >
                  Register First NGO
                </Button>
              )}
            </Card.Content>
          </Card>
        )}
      />

      <FAB
        icon="plus"
        style={[styles(theme).fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => {
          console.log('🆕 Navigating to RegisterNGO');
          navigation.navigate('RegisterNGO');
        }}
        label="Register NGO"
        color={theme.colors.card}
      />
      
      <Toast />
    </View>
  );
}

// ✅ ENHANCED: Styles with footer loader
const styles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF8F6",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  // ✅ NEW: Footer loader styles
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    marginTop: 10,
    fontSize: 14,
  },
  card: {
    marginBottom: 20,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    elevation: 4,
  },
  imageContainer: {
    position: 'relative',
  },
  cardImage: {
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  badgeContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  featuredBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  featuredText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  verifiedBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 12,
    marginBottom: 6,
  },
  title: {
    fontWeight: "bold",
    flex: 1,
    marginRight: 8,
  },
  description: {
    marginBottom: 12,
    lineHeight: 20,
  },
  locationSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12,
    lineHeight: 16,
    paddingLeft: 20,
  },
  divider: {
    marginVertical: 8,
    backgroundColor: '#f5f5f5',
  },
  contactSection: {
    marginBottom: 8,
  },
  contactRow: {
    paddingLeft: 20,
  },
  contactText: {
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  categoryChip: {
    borderWidth: 1,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  categoryChipText: {
    fontSize: 12,
  },
  button: {
    borderRadius: 8,
    flex: 1,
  },
  emptyCard: {
    marginTop: 50,
    marginHorizontal: 20,
    padding: 20,
    elevation: 2,
    borderRadius: 12,
  },
  emptyTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
