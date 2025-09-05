import React, { useState, useMemo, useEffect } from "react";
import { View, StyleSheet, SafeAreaView, TouchableOpacity, Alert, Text } from "react-native";
import { FAB, Surface, useTheme } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import NetInfo from '@react-native-community/netinfo'; // For offline detection; install via npm/yarn if needed

import UserHomeScreen from "../user/UserHomeScreen";
import ReportsScreen from "../user/ReportsScreen";
import NGOListScreen from "../user/NGOListScreen";
import UploadRescueScreen from "../user/camera/UploadRescueScreen";
import ProfileScreen from "../user/UserProfileScreen";

export default function UserBottomTabs() {
  const [index, setIndex] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const theme = useTheme();
  const navigation = useNavigation<any>();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  const routes: { key: string; icon: keyof typeof Ionicons.glyphMap; iconOutline?: keyof typeof Ionicons.glyphMap }[] = [
    { key: "home", icon: "home", iconOutline: "home-outline" },
    { key: "donations", icon: "heart", iconOutline: "heart-outline" },
    { key: "ngos", icon: "people", iconOutline: "people-outline" },
    { key: "profile", icon: "person", iconOutline: "person-outline" },
  ];

  const renderScene = useMemo(() => {
    try {
      switch (index) {
        case 0:
          return <UserHomeScreen />;
        case 1:
          return <ReportsScreen navigation={undefined} />;
        case 2:
          return <NGOListScreen />;
        case 3:
          return <ProfileScreen />;
        default:
          return <UserHomeScreen />;
      }
    } catch (error) {
      console.error('Error rendering screen:', error);
      return (
        <View style={styles.errorContainer}>
          <Text style={{ color: theme.colors.error }}>Failed to load screen. Please try again.</Text>
        </View>
      );
    }
  }, [index, theme.colors.error]);

  const handleCameraPress = async () => {
    // Request camera and media library permissions
    const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
    const mediaStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (cameraStatus.status !== "granted" || mediaStatus.status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Camera and media library access are required. Please enable them in your device settings.",
        [{ text: "OK" }]
      );
      return;
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      // Navigate to UploadRescueScreen with the captured image
      navigation.navigate("UploadRescue", { imageUri: result.assets[0].uri });
    } else if (result.canceled) {
      // User canceled the camera
      Alert.alert("Cancelled", "No image was captured.");
    }
  };

  if (isOffline) {
    return (
      <SafeAreaView style={styles.mainContainer}>
        <View style={styles.contentContainer}>
          <View style={styles.errorContainer}>
            <Text style={{ color: theme.colors.error }}>No internet connection. Please check your network.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <View style={styles.contentContainer}>{renderScene}</View>

      {/* Bottom Navigation with Centered Camera */}
      <Surface style={styles.bottomNavigation} elevation={4}>
        <View style={styles.navContent}>
          {/* First two tabs */}
          <TouchableOpacity
            style={[styles.navItem, index === 0 && styles.navItemActive]}
            onPress={() => setIndex(0)}
            activeOpacity={0.7}
            accessibilityLabel="Home"
            accessibilityRole="tab"
          >
            <Ionicons
              name={index === 0 ? routes[0].icon : routes[0].iconOutline || routes[0].icon}
              size={24}
              color={index === 0 ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, index === 1 && styles.navItemActive]}
            onPress={() => setIndex(1)}
            activeOpacity={0.7}
            accessibilityLabel="Donations"
            accessibilityRole="tab"
          >
            <Ionicons
              name={index === 1 ? routes[1].icon : routes[1].iconOutline || routes[1].icon}
              size={24}
              color={index === 1 ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
          </TouchableOpacity>

          {/* Centered Camera Button */}
          <View style={styles.cameraContainer}>
            <FAB
              icon={() => <Ionicons name="camera" size={24} color={theme.colors.onPrimary} />}
              onPress={handleCameraPress}
              style={[styles.cameraFab, { backgroundColor: theme.colors.primary }]}
              size="medium"
              accessibilityLabel="Open camera for rescue upload"
              accessibilityRole="button"
            />
          </View>

          {/* Last two tabs */}
          <TouchableOpacity
            style={[styles.navItem, index === 2 && styles.navItemActive]}
            onPress={() => setIndex(2)}
            activeOpacity={0.7}
            accessibilityLabel="NGOs"
            accessibilityRole="tab"
          >
            <Ionicons
              name={index === 2 ? routes[2].icon : routes[2].iconOutline || routes[2].icon}
              size={24}
              color={index === 2 ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, index === 3 && styles.navItemActive]}
            onPress={() => setIndex(3)}
            activeOpacity={0.7}
            accessibilityLabel="Profile"
            accessibilityRole="tab"
          >
            <Ionicons
              name={index === 3 ? routes[3].icon : routes[3].iconOutline || routes[3].icon}
              size={24}
              color={index === 3 ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        </View>
      </Surface>

      <SafeAreaView style={styles.safeArea} />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  contentContainer: {
    flex: 1,
  },
  bottomNavigation: {
    position: "absolute",
    height: 95,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingVertical: 5,
  },
  navContent: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
    paddingVertical: 8,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  navItemActive: {
    backgroundColor: "rgba(98, 0, 238, 0.08)",
  },
  cameraContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -50, // Pull camera button up to overlap
  },
  cameraFab: {
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  safeArea: {
    backgroundColor: "#ffffff",
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
});
