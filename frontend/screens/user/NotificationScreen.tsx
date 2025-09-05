import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import {
  Text,
  Surface,
  IconButton,
  Button,
  Badge,
} from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useThemeContext } from "../../theme";
import { notificationApi } from "../../api/notificationApi";

export default function NotificationScreen() {
  const { theme } = useThemeContext();
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [emergencyCases, setEmergencyCases] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      setRefreshing(true);
      const allNotifs = await notificationApi.getNotificationHistory() || [];
      setNotifications(allNotifs);
      // Fetch emergencies separately, merge if you prefer
      // const emergencies = await notificationApi.getEmergencyRescues?.() || [];
      // setEmergencyCases(emergencies);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      await notificationApi.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  // Optionally, handle real-time update of emergencies
  // Could use polling, websockets, or just refresh for now

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: 50, height: 800 }}>
      {/* Header */}
      <View style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 24,
        backgroundColor: theme.colors.surface,
        elevation: 2,
      }}>
        <Button
          onPress={() => navigation.goBack()}
          icon="arrow-left"
          compact
        >
          Back
        </Button>
        
        <Text style={{ fontSize: 22, fontWeight: "700", color: theme.colors.onSurface }}>
          Notifications
        </Text>
        
        <Button
          mode="outlined"
          icon="cog"
          onPress={() => navigation.navigate("NotificationPreferences")}
          compact
        >
          Preferences
        </Button>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchNotifications} />
        }
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      >

        {/* Emergency Rescue Notifications */}
        {emergencyCases.length > 0 && (
          <>
            <Text style={{ color: "#d32f2f", fontSize: 18, fontWeight: "700", marginBottom: 6 }}>
              🛑 Emergency Rescue Alerts
            </Text>
            {emergencyCases.map((em, idx) => (
              <Surface key={em.id || idx} style={styles.emergencySurface}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="alert-circle" size={28} color="#d32f2f" style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.emergencyTitle}>{em.title || "Rescue Needed"}</Text>
                    <Text style={styles.emergencyMessage}>{em.message || em.details}</Text>
                    <Text style={styles.emergencyMeta}>
                      {new Date(em.created_at).toLocaleString()}
                    </Text>
                  </View>
                </View>
                {em.location &&
                  <Text style={{ color: "#1976D2", fontSize: 13, marginTop: 6 }}>
                    📍 {em.location}
                  </Text>
                }
                <Button
                  onPress={() => {/* open map or details */}}
                  style={{ marginTop: 10 }}
                  mode="contained"
                  icon="map-marker"
                  compact
                  buttonColor="#d32f2f"
                  textColor="#fff"
                >
                  View Details
                </Button>
              </Surface>
            ))}
            <View style={{ marginVertical: 8 }} />
          </>
        )}

        {/* Regular Notifications */}
        <Text style={{ color: theme.colors.primary, fontWeight: "600", fontSize: 17, marginBottom: 6 }}>
          Recent Updates
        </Text>

        {notifications.length === 0 ? (
          <Surface style={styles.emptyBox}>
            <Text style={{ color: "#888", fontSize: 15 }}>No notifications yet</Text>
            <Text style={{ color: "#aaa", fontSize: 13, marginTop: 6, fontStyle: 'italic' }}>
              You'll see updates about rescue cases here.
            </Text>
          </Surface>
        ) : (
          notifications.map((notification, idx) => (
            <TouchableOpacity
              key={notification.id || idx}
              activeOpacity={0.7}
              onPress={() => !notification.is_read && markAsRead(notification.id)}
            >
              <Surface style={[
                styles.surface,
                !notification.is_read && styles.unreadSurface
              ]}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {notification.icon && (
                    <Ionicons
                      name={notification.icon}
                      size={24}
                      color={notification.is_read ? "#AAA" : theme.colors.primary}
                      style={{ marginRight: 12 }}
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: notification.is_read ? "normal" : "600", fontSize: 16 }}>
                      {notification.title}
                    </Text>
                    <Text style={{
                      color: "#666",
                      marginBottom: 2,
                      fontSize: 13,
                    }}>
                      {notification.message}
                    </Text>
                    <Text style={{ color: "#888", fontSize: 11 }}>
                      {new Date(notification.created_at).toLocaleString()}
                    </Text>
                  </View>
                  {!notification.is_read && <Badge visible>new</Badge>}
                </View>
              </Surface>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: "#FFF",
    elevation: 2,
  },
  unreadSurface: {
    borderColor: "#ff9800",
    borderWidth: 1.6,
    backgroundColor: "#fff8e1",
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    margin: 24,
    padding: 32,
    backgroundColor: "#f5f5f5",
    elevation: 1,
  },
  emergencySurface: {
    backgroundColor: "#ffebee",
    borderColor: "#d32f2f",
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#d32f2f",
    shadowOpacity: 0.11,
    shadowRadius: 8,
  },
  emergencyTitle: {
    fontWeight: "bold",
    color: "#d32f2f",
    fontSize: 16,
    marginBottom: 2,
  },
  emergencyMessage: {
    fontSize: 14,
    color: "#990000",
    marginBottom: 3,
  },
  emergencyMeta: {
    color: "#555",
    fontSize: 12,
    fontStyle: "italic",
  },
});
