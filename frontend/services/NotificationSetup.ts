/**
 * Complete Notification Setup and Integration with Native FCM Tokens
 *
 * This file provides a comprehensive setup function for integrating
 * the notification system using your API backend and native Firebase tokens.
 */
import { notificationApi } from '../api/notificationApi';
import pushNotificationService from './PushNotificationService';

interface NotificationSetupResult {
  success: boolean;
  pushToken: string | null;
  preferences: any;
  error?: string;
}

/**
 * Complete notification setup for authenticated users
 * Call this after successful login/registration
 */
export async function setupNotificationsForUser(): Promise<NotificationSetupResult> {
  try {
    console.log('🔄 Starting complete notification setup...');
    // Step 1: Initialize push notification service (OneSignal)
    const pushToken = await pushNotificationService.initialize();
    if (!pushToken) {
      alert('Notifications are disabled or permission not granted. Please enable them in your device settings to receive important alerts.');
      return {
        success: false,
        pushToken: null,
        preferences: null,
        error: 'Notification permission not granted',
      };
    }

    // Step 2: Set up notification listeners
    console.log('👂 Setting up notification listeners...');
    pushNotificationService.setupNotificationListeners();

    // Step 3: Get user's notification preferences
    console.log('⚙️ Loading notification preferences...');
    const preferences = await notificationApi.getNotificationPreferences();

    console.log('✅ Notification setup completed successfully!');
    console.log('📋 User preferences:', preferences);
    return {
      success: true,
      pushToken,
      preferences,
    };
  } catch (error) {
    console.error('❌ Notification setup failed:', error);
    alert('Notification setup failed. Please try again.');
    return {
      success: false,
      pushToken: null,
      preferences: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update user notification preferences
 */
export async function updateUserNotificationPreferences(preferences: any) {
  try {
    console.log('🔄 Updating notification preferences...');
    const result = await notificationApi.updateNotificationPreferences(preferences);
    console.log('✅ Preferences updated successfully');
    return result;
  } catch (error) {
    console.error('❌ Failed to update preferences:', error);
    throw error;
  }
}

/**
 * Send a test notification to verify the system is working
 */
export async function testNotificationSystem() {
  try {
    console.log('🧪 Testing notification system...');
    const result = await notificationApi.sendTestNotification();
    console.log('✅ Test notification sent successfully');
    return result;
  } catch (error) {
    console.error('❌ Test notification failed:', error);
    throw error;
  }
}

/**
 * Get user's notification history
 */
export async function getUserNotificationHistory(pageSize: number = 50) {
  try {
    console.log('📚 Fetching notification history...');
    const history = await notificationApi.getNotificationHistory(pageSize);
    console.log(`✅ Fetched ${history.length} notifications`);
    return history;
  } catch (error) {
    console.error('❌ Failed to fetch notification history:', error);
    throw error;
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  try {
    const result = await notificationApi.markAsRead(notificationId);
    console.log('✅ Notification marked as read');
    return result;
  } catch (error) {
    console.error('❌ Failed to mark notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead() {
  try {
    const result = await notificationApi.markAllAsRead();
    console.log('✅ All notifications marked as read');
    return result;
  } catch (error) {
    console.error('❌ Failed to mark all notifications as read:', error);
    throw error;
  }
}

/**
 * Cleanup function - call when user logs out
 */
export function cleanupNotifications(listeners?: any) {
  try {
    console.log('🧹 Cleaning up notification listeners...');
    if (listeners && listeners.cleanup) {
      listeners.cleanup();
    }
    console.log('✅ Notification cleanup completed');
  } catch (error) {
    console.error('❌ Notification cleanup failed:', error);
  }
}

/**
 * Admin functions for NGOs
 */
export const notificationAdmin = {
  /**
   * Send emergency alert (NGO/Admin only)
   */
  async sendEmergencyAlert(reportId: string, location: string, description?: string) {
    try {
      console.log('🚨 Sending emergency alert...');
      const result = await notificationApi.admin.sendEmergencyAlert(
        reportId,
        location,
        description
      );
      console.log('✅ Emergency alert sent successfully');
      return result;
    } catch (error) {
      console.error('❌ Failed to send emergency alert:', error);
      throw error;
    }
  },
  /**
   * Send injury report notification to volunteers (NGO/Admin only)
   */
  async sendInjuryReportNotification(reportId: string, location: string, description?: string) {
    try {
      console.log('🐕 Sending injury report notification...');
      const result = await notificationApi.admin.sendInjuryReportNotification(
        reportId,
        location,
        description
      );
      console.log('✅ Injury report notification sent successfully');
      return result;
    } catch (error) {
      console.error('❌ Failed to send injury report notification:', error);
      throw error;
    }
  },
  /**
   * Send status update to user (NGO/Admin only)
   */
  async sendStatusUpdate(
    userId: string,
    reportId: string,
    newStatus: string,
    location?: string
  ) {
    try {
      console.log('📋 Sending status update...');
      const result = await notificationApi.admin.sendStatusUpdate(
        userId,
        reportId,
        newStatus,
        location
      );
      console.log('✅ Status update sent successfully');
      return result;
    } catch (error) {
      console.error('❌ Failed to send status update:', error);
      throw error;
    }
  },
  /**
   * Send general announcement (NGO/Admin only)
   */
  async sendAnnouncement(title: string, body: string, userIds?: string[]) {
    try {
      console.log('📢 Sending announcement...');
      const result = await notificationApi.admin.sendAnnouncement(title, body, userIds);
      console.log('✅ Announcement sent successfully');
      return result;
    } catch (error) {
      console.error('❌ Failed to send announcement:', error);
      throw error;
    }
  },
};

// Export default setup function
export default setupNotificationsForUser;
