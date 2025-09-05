import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { notificationApi, NotificationPreferences } from '../../api/notificationApi';
import pushNotificationService from '../../services/PushNotificationService';

const NotificationPreferencesScreen: React.FC = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emergency_alerts: true,      // Always enabled for safety
    status_updates: true,
    general_announcements: true,
    injury_reports: false,
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSend, setTestingSend] = useState(false);

  // Load current preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const currentPrefs = await notificationApi.getNotificationPreferences();
      setPreferences(currentPrefs);
    } catch (error) {
      console.error('Failed to load preferences:', error);
      Alert.alert('Error', 'Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    // Prevent disabling emergency alerts
    if (key === 'emergency_alerts' && !value) {
      Alert.alert(
        'Safety Notice',
        'Emergency alerts cannot be disabled for your safety and the safety of animals in need.',
        [{ text: 'OK' }]
      );
      return;
    }

    const newPreferences = { ...preferences, [key]: value };
    
    try {
      setSaving(true);
      await notificationApi.updateNotificationPreferences({ [key]: value });
      setPreferences(newPreferences);
      
      // Show confirmation
      const preferenceNames = {
        emergency_alerts: 'Emergency Alerts',
        status_updates: 'Status Updates',
        general_announcements: 'General Announcements',
        injury_reports: 'Injury Report Notifications',
      };
      
      Alert.alert(
        'Updated',
        `${preferenceNames[key]} ${value ? 'enabled' : 'disabled'}`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('Failed to update preference:', error);
      Alert.alert('Error', 'Failed to update notification preference');
    } finally {
      setSaving(false);
    }
  };

  const sendTestNotification = async () => {
    try {
      setTestingSend(true);
      
      Alert.alert(
        'Test Notification',
        'Choose which test to send:',
        [
          {
            text: 'Backend Test',
            onPress: async () => {
              try {
                await notificationApi.sendTestNotification();
                Alert.alert('Success', 'Backend test notification sent! Check your notifications.');
              } catch (error) {
                Alert.alert('Error', 'Failed to send backend test notification');
              }
            }
          },
          {
            text: 'Local Test',
            onPress: async () => {
              try {
                await pushNotificationService.sendTestNotification();
                Alert.alert('Success', 'Local test notification scheduled! It will appear in 2 seconds.');
              } catch (error) {
                Alert.alert('Error', 'Failed to schedule local test notification');
              }
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
      
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
    } finally {
      setTestingSend(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading preferences...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Notification Settings</Text>
        <Text style={styles.subtitle}>
          Choose which notifications you'd like to receive
        </Text>

        {/* Emergency Alerts */}
        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Text style={styles.preferenceTitle}>🚨 Emergency Alerts</Text>
            <Text style={styles.preferenceDescription}>
              Critical emergency notifications about animals in immediate danger.
              Cannot be disabled for safety reasons.
            </Text>
          </View>
          <Switch
            value={preferences.emergency_alerts}
            onValueChange={(value) => updatePreference('emergency_alerts', value)}
            disabled={true} // Always enabled
            trackColor={{ false: '#767577', true: '#FF6B6B' }}
            thumbColor={preferences.emergency_alerts ? '#FFFFFF' : '#f4f3f4'}
          />
        </View>

        {/* Status Updates */}
        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Text style={styles.preferenceTitle}>� Report Status Updates</Text>
            <Text style={styles.preferenceDescription}>
              Get notified when the status of your submitted reports changes.
            </Text>
          </View>
          <Switch
            value={preferences.status_updates}
            onValueChange={(value) => updatePreference('status_updates', value)}
            disabled={saving}
            trackColor={{ false: '#767577', true: '#4CAF50' }}
            thumbColor={preferences.status_updates ? '#FFFFFF' : '#f4f3f4'}
          />
        </View>

        {/* General Announcements */}
        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Text style={styles.preferenceTitle}>📢 General Announcements</Text>
            <Text style={styles.preferenceDescription}>
              Updates about the app, animal welfare tips, and community news.
            </Text>
          </View>
          <Switch
            value={preferences.general_announcements}
            onValueChange={(value) => updatePreference('general_announcements', value)}
            disabled={saving}
            trackColor={{ false: '#767577', true: '#2196F3' }}
            thumbColor={preferences.general_announcements ? '#FFFFFF' : '#f4f3f4'}
          />
        </View>

        {/* Injury Report Notifications */}
        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Text style={styles.preferenceTitle}>🐕 Injury Report Notifications</Text>
            <Text style={styles.preferenceDescription}>
              Get notified when new injury reports are submitted near you.
              Only available for volunteers and NGO members.
            </Text>
          </View>
          <Switch
            value={preferences.injury_reports}
            onValueChange={(value) => updatePreference('injury_reports', value)}
            disabled={saving}
            trackColor={{ false: '#767577', true: '#FF9800' }}
            thumbColor={preferences.injury_reports ? '#FFFFFF' : '#f4f3f4'}
          />
        </View>

        {/* Test Notification Button */}
        <TouchableOpacity
          style={styles.testButton}
          onPress={sendTestNotification}
          disabled={testingSend}
        >
          {testingSend ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.testButtonText}>🧪 Send Test Notification</Text>
          )}
        </TouchableOpacity>

        {/* Information */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ About Notifications</Text>
          <Text style={styles.infoText}>
            • Emergency alerts are sent to all users and cannot be disabled{'\n'}
            • Status updates keep you informed about your reports{'\n'}
            • Injury reports are only sent to active volunteers{'\n'}
            • You can change these settings anytime
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  preferenceItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 16,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  testButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
});

export default NotificationPreferencesScreen;
