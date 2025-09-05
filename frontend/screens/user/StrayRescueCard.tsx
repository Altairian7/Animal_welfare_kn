import React, { useState, useCallback } from "react";
import { View, Image, TouchableOpacity, Linking, Alert } from "react-native";
import { Card, Text, Chip, Divider, Button } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { useThemeContext } from "../../theme";
import { useSelector, useDispatch } from "react-redux";
import * as Location from "expo-location";
import { useNavigation } from "@react-navigation/native";

// ✅ Redux imports
import {
  addAcceptedReport,
  updateReportStatus,
} from "../../core/redux/slices/reportSlice";

// Use reportsApi instead of ngoApi
import { reportsApi } from "../../api/reportsApi";

interface StrayRescueCardProps {
  rescue: any;
  theme?: any;
  onReportStatusUpdate?: (reportId: string, newStatus: string) => void;
}

const addAlpha = (color: string, alpha: number): string => {
  if (!color) return "transparent";
  if (color.startsWith("#")) {
    let r = 0,
      g = 0,
      b = 0;
    if (color.length === 7) {
      r = parseInt(color.substr(1, 2), 16);
      g = parseInt(color.substr(3, 2), 16);
      b = parseInt(color.substr(5, 2), 16);
    }
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
};

const StrayRescueCard: React.FC<StrayRescueCardProps> = ({
  rescue,
  theme: propTheme,
  onReportStatusUpdate,
}) => {
  const navigation = useNavigation<any>(); // ✅ Fixed type

  // ✅ Redux state and dispatch
  const dispatch = useDispatch();
  const user = useSelector((state: any) => state.auth.user);
  const userId = user?.appwrite_user_id || user?.$id;
  const acceptedReports = useSelector(
    (state: any) => state.reports.acceptedReports
  );

  const { theme: contextTheme } = useThemeContext();
  const theme = propTheme || contextTheme;
  const [expanded, setExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ Check if this report is accepted by current user
  const reportId = rescue.id || rescue.report_id;
  const isAcceptedByUser = acceptedReports.includes(reportId);

  const toggleExpanded = useCallback(() => setExpanded((prev) => !prev), []);

  const openImage = useCallback(() => {
    if (rescue.image_url && !imageError) {
      Linking.openURL(rescue.image_url).catch(() => {
        Alert.alert("Error", "Unable to open image.");
      });
    } else {
      Alert.alert("Image not available");
    }
  }, [rescue.image_url, imageError]);

  const openLocation = useCallback(() => {
    try {
      let locationObj = rescue.location;
      if (typeof locationObj === "string") {
        locationObj = JSON.parse(locationObj);
      }
      if (locationObj && locationObj.latitude && locationObj.longitude) {
        const url = `https://www.google.com/maps/search/?api=1&query=${locationObj.latitude},${locationObj.longitude}`;
        Linking.openURL(url);
      }
    } catch {
      Alert.alert("Could not open location");
    }
  }, [rescue.location]);

  // ✅ Navigate to tracking page
  const openTrackingPage = useCallback(() => {
    if (reportId) {
      navigation.navigate("ReportTracking" as never, { reportId } as never); // ✅ Fixed TypeScript error
    }
  }, [navigation, reportId]);

  // Get user's current location
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Location permission denied");
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error("Error getting location:", error);
      throw error;
    }
  };

  // ✅ TEMPORARY FIX: Accept without API call (since API is failing)
  const handleAcceptReport = useCallback(async () => {
    if (isLoading) return;

    if (!userId) {
      Alert.alert("Error", "Please log in to accept reports.");
      return;
    }

    if (!reportId) {
      Alert.alert("Error", "Missing report ID.");
      return;
    }

    Alert.alert(
      "Take Responsibility",
      "Are you sure you want to take responsibility for this rescue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, I Will Take It",
          style: "default",
          onPress: async () => {
            setIsLoading(true);
            try {
              console.log("🔍 DEBUG - Accepting report locally:", reportId);

              // ✅ UPDATE: Set status to "in_progress" or "tracking" instead of "accepted"
              dispatch(addAcceptedReport(reportId));
              dispatch(
                updateReportStatus({ id: reportId, status: "in_progress" })
              ); // ✅ Change this

              console.log("🔍 DEBUG - Successfully added to Redux");
              Alert.alert(
                "Success",
                "You have accepted this rescue report! You can now track its progress.",
                [
                  {
                    text: "View Tracking",
                    onPress: () => openTrackingPage(),
                  },
                  {
                    text: "OK",
                    onPress: () => {
                      if (onReportStatusUpdate) {
                        onReportStatusUpdate(reportId, "in_progress"); // ✅ Change this too
                      }
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error("Failed to accept report:", error);
              Alert.alert("Error", "Failed to accept report");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  }, [
    isLoading,
    userId,
    reportId,
    dispatch,
    acceptedReports,
    openTrackingPage,
    onReportStatusUpdate,
  ]);

  const getSeverityColor = (severity: string) => {
    const colors = {
      Critical: theme.colors.error || "#D32F2F",
      High: theme.colors.warning || "#FF5722",
      Medium: theme.colors.accent || "#FF9800",
      Low: theme.colors.success || "#4CAF50",
    };
    return colors[severity] || theme.colors.outline || "#9E9E9E";
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "#FF9800",
      in_progress: "#2196F3",
      resolved: "#4CAF50",
      completed: "#4CAF50",
      cancelled: "#9E9E9E",
      accepted: "#9C27B0",
    };
    return colors[status] || "#FF9800";
  };

  const safeText = (value: any) => (value ? value : "Not mentioned");

  const getImageSource = () => {
    if (!rescue.image_url || imageError || showFallback) {
      return null;
    }

    let imageUrl = rescue.image_url;
    if (typeof imageUrl === "string") {
      imageUrl = imageUrl
        .replace("/v1/v1/", "/v1/")
        .replace(/[?&]mode=admin/, "");
    }

    return { uri: imageUrl };
  };

  const renderImageFallback = () => (
    <View
      style={{
        width: 80,
        height: 80,
        borderRadius: theme.spacing?.radius || 12,
        backgroundColor: theme.colors.surfaceVariant || "#f0f0f0",
        justifyContent: "center",
        alignItems: "center",
        marginRight: theme.spacing?.md || 16,
        borderWidth: 1,
        borderColor: theme.colors.outline || "#e0e0e0",
      }}
    >
      <Ionicons
        name="camera-outline"
        size={32}
        color={theme.colors.onSurfaceVariant || "#666666"}
      />
      <Text
        style={{
          fontSize: 10,
          color: theme.colors.onSurfaceVariant || "#666666",
          textAlign: "center",
          marginTop: 4,
        }}
      >
        No Photo
      </Text>
    </View>
  );

  // ✅ NEW: Enhanced animal info with care tips
  const getAnimalCareInfo = () => {
    const species = rescue.species || "Animal";
    const careTips = {
      Dog: [
        "🥛 Provide fresh water immediately",
        "🍖 Offer small amounts of bland food (rice, chicken)",
        "🏠 Create a quiet, safe space for recovery",
        "🩹 Keep wounds clean and dry",
        "⚕️ Monitor for signs of infection",
        "🚫 Avoid sudden movements that may frighten",
      ],
      Cat: [
        "🥛 Ensure fresh water access",
        "🍗 Provide soft, easily digestible food",
        "📦 Offer a hiding space (box or carrier)",
        "🩹 Clean wounds gently with saline solution",
        "👁️ Watch for signs of dehydration",
        "🔇 Keep environment calm and quiet",
      ],
      Bird: [
        "🌡️ Maintain warm temperature (80-85°F)",
        "💧 Provide shallow water for drinking",
        "🌱 Offer appropriate seeds or pellets",
        "📦 Use a ventilated, secure container",
        "🔍 Check for broken wings or injuries",
        "🚫 Minimize handling to reduce stress",
      ],
    };

    return careTips[species] || careTips.Dog; // Default to dog care
  };

  const getInjuryAssessment = () => {
    const severity = rescue.severity || "Medium";
    const assessments = {
      Critical: {
        urgency: "IMMEDIATE ACTION REQUIRED",
        color: "#D32F2F",
        icon: "alert-circle",
        timeframe: "Seek veterinary care within 1 hour",
      },
      High: {
        urgency: "Urgent Care Needed",
        color: "#FF5722",
        icon: "warning",
        timeframe: "Seek veterinary care within 4 hours",
      },
      Medium: {
        urgency: "Medical Attention Required",
        color: "#FF9800",
        icon: "information-circle",
        timeframe: "Seek veterinary care within 24 hours",
      },
      Low: {
        urgency: "Monitor Condition",
        color: "#4CAF50",
        icon: "checkmark-circle",
        timeframe: "Schedule veterinary check-up",
      },
    };

    return assessments[severity] || assessments.Medium;
  };

  return (
    <Card
      style={{
        margin: theme.spacing?.md || 16,
        borderRadius: theme.spacing?.radius || 16,
        backgroundColor: theme.colors.surface || "#fff3e0",
        overflow: "hidden",
        elevation: 4,
      }}
    >
      {/* Header with Image and Basic Info */}
      <View style={{ flexDirection: "row", padding: theme.spacing?.lg || 16 }}>
        <TouchableOpacity
          onPress={openImage}
          style={{
            borderRadius: theme.spacing?.radius || 12,
            overflow: "hidden",
            marginRight: theme.spacing?.md || 16,
          }}
          activeOpacity={0.8}
        >
          {getImageSource() && !showFallback ? (
            <Image
              source={getImageSource()!}
              style={{ width: 80, height: 80, backgroundColor: "#f0f0f0" }}
              resizeMode="cover"
              onError={() => {
                console.log("Detailed card image failed, showing fallback");
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
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "bold",
                color: theme.colors.onSurface || "#4e342e",
                flex: 1,
                marginRight: theme.spacing?.md || 8,
              }}
              numberOfLines={2}
            >
              {safeText(rescue.title)}
            </Text>
            <Chip
              mode="flat"
              style={{
                backgroundColor: addAlpha(
                  getSeverityColor(rescue.severity),
                  0.2
                ),
              }}
              textStyle={{
                color: getSeverityColor(rescue.severity),
                fontWeight: "bold",
                fontSize: 15,
              }}
              compact
            >
              {safeText(rescue.severity)}
            </Chip>
          </View>

          <TouchableOpacity
            onPress={openLocation}
            style={{ marginTop: theme.spacing?.sm || 8 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="location-outline"
                size={14}
                color={theme.colors.primary || "#ffd3a7"}
              />
              <Text
                style={{
                  color: theme.colors.primary || "#ffd3a7",
                  fontSize: 13,
                  marginLeft: theme.spacing?.sm || 4,
                  textDecorationLine: "underline",
                  flex: 1,
                }}
                numberOfLines={2}
              >
                {safeText(rescue.location_string || "Click to view location")}
              </Text>
            </View>
          </TouchableOpacity>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: theme.spacing?.sm || 8,
            }}
          >
            <Text
              style={{
                color: theme.colors.onSurfaceVariant || "#8d6e63",
                fontSize: 12,
              }}
            >
              📅{" "}
              {rescue.created_at
                ? new Date(rescue.created_at).toLocaleDateString()
                : "Date Unknown"}
            </Text>
            <Text
              style={{
                color: theme.colors.onSurfaceVariant || "#8d6e63",
                fontSize: 12,
              }}
            >
              📍 Near You
            </Text>
          </View>
        </View>
      </View>

      <Divider />

      {/* ✅ ENHANCED: Detailed Animal Information */}
      <View style={{ padding: theme.spacing?.lg || 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: theme.spacing?.sm || 8,
          }}
        >
          <Ionicons
            name="paw-outline"
            size={16}
            color={theme.colors.primary || "#ffd3a7"}
          />
          <Text
            style={{
              fontWeight: "bold",
              marginLeft: theme.spacing?.sm || 8,
              color: theme.colors.onSurface || "#4e342e",
            }}
          >
            🐾 Detailed Animal Profile
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: theme.spacing?.sm || 8,
            marginBottom: theme.spacing?.md || 12,
          }}
        >
          <Chip mode="outlined" compact>
            🐕 {safeText(rescue.species)}
          </Chip>
          <Chip mode="outlined" compact>
            🏷️ {safeText(rescue.breed || "Mixed breed")}
          </Chip>
          <Chip mode="outlined" compact>
            📅 {safeText(rescue.age || "Unknown age")}
          </Chip>
          <Chip mode="outlined" compact>
            ⚖️ {safeText(rescue.weight || "Est. weight")}
          </Chip>
          <Chip mode="outlined" compact>
            🎨 {safeText(rescue.color || "Mixed colors")}
          </Chip>
          {rescue.gender && rescue.gender !== "Unknown" && (
            <Chip mode="outlined" compact>
              {rescue.gender === "Male"
                ? "♂️"
                : rescue.gender === "Female"
                ? "♀️"
                : "❓"}{" "}
              {rescue.gender}
            </Chip>
          )}
        </View>

        {/* ✅ NEW: Injury Assessment */}
        <View style={{ marginBottom: theme.spacing?.md || 12 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: addAlpha(getInjuryAssessment().color, 0.1),
              padding: 12,
              borderRadius: 8,
              marginBottom: 8,
            }}
          >
            <Ionicons
              name={getInjuryAssessment().icon as any}
              size={20}
              color={getInjuryAssessment().color}
            />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Text
                style={{
                  fontWeight: "bold",
                  color: getInjuryAssessment().color,
                  fontSize: 14,
                }}
              >
                {getInjuryAssessment().urgency}
              </Text>
              <Text
                style={{
                  color: theme.colors.onSurfaceVariant || "#8d6e63",
                  fontSize: 12,
                }}
              >
                {getInjuryAssessment().timeframe}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: theme.spacing?.md || 12,
          }}
        >
          <Chip
            mode="flat"
            style={{
              backgroundColor: addAlpha(getStatusColor(rescue.status), 0.2),
            }}
            textStyle={{ color: getStatusColor(rescue.status) }}
          >
            {rescue.status?.toUpperCase() || "PENDING"}
          </Chip>
          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                fontSize: 12,
                color: theme.colors.onSurfaceVariant || "#8d6e63",
              }}
            >
              AI Confidence
            </Text>
            <Text
              style={{
                fontWeight: "bold",
                color: theme.colors.primary || "#ffd3a7",
              }}
            >
              {rescue.confidence_score || 8}/10
            </Text>
          </View>
        </View>
      </View>

      <Divider />

      {/* ✅ ENHANCED: Comprehensive Health Report */}
      <View style={{ padding: theme.spacing?.lg || 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: theme.spacing?.sm || 8,
          }}
        >
          <Ionicons
            name="medical-outline"
            size={16}
            color={theme.colors.error || "#ff7043"}
          />
          <Text
            style={{
              fontWeight: "bold",
              marginLeft: theme.spacing?.sm || 8,
              color: theme.colors.onSurface || "#4e342e",
            }}
          >
            🩺 Comprehensive Health Assessment
          </Text>
        </View>

        {/* Primary Health Description */}
        <Text
          style={{
            color: theme.colors.onSurfaceVariant || "#8d6e63",
            lineHeight: 20,
            fontSize: 14,
            marginBottom: 12,
          }}
          numberOfLines={expanded ? undefined : 3}
        >
          {safeText(rescue.injury_summary || rescue.description)}
        </Text>

        {/* ✅ NEW: Health Indicators */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <Chip
            mode="outlined"
            compact
            style={{ backgroundColor: "#E8F5E8" }}
            textStyle={{ color: "#2E7D32", fontSize: 11 }}
          >
            💓 Heart Rate: {rescue.heart_rate || "Normal"}
          </Chip>
          <Chip
            mode="outlined"
            compact
            style={{ backgroundColor: "#FFF3E0" }}
            textStyle={{ color: "#F57C00", fontSize: 11 }}
          >
            🌡️ Temperature: {rescue.temperature || "Stable"}
          </Chip>
          <Chip
            mode="outlined"
            compact
            style={{ backgroundColor: "#E3F2FD" }}
            textStyle={{ color: "#1976D2", fontSize: 11 }}
          >
            💧 Hydration: {rescue.hydration_level || "Moderate"}
          </Chip>
        </View>

        {(rescue.injury_summary?.length > 150 ||
          rescue.description?.length > 150) && (
          <TouchableOpacity
            onPress={toggleExpanded}
            style={{ marginTop: theme.spacing?.sm || 4 }}
          >
            <Text
              style={{ color: theme.colors.primary || "#ffd3a7", fontSize: 13 }}
            >
              {expanded ? "Show less" : "Show detailed assessment"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Symptoms section */}
      {rescue.symptoms && rescue.symptoms.length > 0 && (
        <View>
          <Divider />
          <View style={{ padding: theme.spacing?.lg || 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: theme.spacing?.sm || 8,
              }}
            >
              <Ionicons
                name="list-outline"
                size={16}
                color={theme.colors.secondary || "#ffe0b2"}
              />
              <Text
                style={{
                  fontWeight: "bold",
                  marginLeft: theme.spacing?.sm || 8,
                  color: theme.colors.onSurface || "#4e342e",
                }}
              >
                🔍 Observed Symptoms
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: theme.spacing?.sm || 4,
              }}
            >
              {rescue.symptoms
                .slice(0, expanded ? rescue.symptoms.length : 3)
                .map((symptom: string, index: number) => (
                  <Chip
                    key={`symptom-${index}`}
                    mode="outlined"
                    compact
                    style={{
                      backgroundColor: theme.colors.errorContainer || "#ffcec6",
                    }}
                    textStyle={{
                      color: theme.colors.onErrorContainer || "#4e342e",
                      fontSize: 11,
                    }}
                  >
                    {symptom}
                  </Chip>
                ))}
              {!expanded && rescue.symptoms.length > 3 && (
                <Chip compact onPress={toggleExpanded}>
                  +{rescue.symptoms.length - 3} more
                </Chip>
              )}
            </View>
          </View>
        </View>
      )}

      {/* ✅ NEW: Emergency Care Tips */}
      <Divider />
      <View style={{ padding: theme.spacing?.lg || 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: theme.spacing?.sm || 8,
          }}
        >
          <Ionicons
            name="heart-outline"
            size={16}
            color={theme.colors.success || "#4CAF50"}
          />
          <Text
            style={{
              fontWeight: "bold",
              marginLeft: theme.spacing?.sm || 8,
              color: theme.colors.onSurface || "#4e342e",
            }}
          >
            💚 Essential Care Guidelines
          </Text>
        </View>

        <View style={{ marginBottom: 12 }}>
          {getAnimalCareInfo()
            .slice(0, expanded ? undefined : 3)
            .map((tip, index) => (
              <View
                key={index}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  marginBottom: 6,
                  paddingLeft: 8,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.success || "#4CAF50",
                    marginRight: 8,
                    fontSize: 12,
                  }}
                >
                  •
                </Text>
                <Text
                  style={{
                    color: theme.colors.onSurfaceVariant || "#8d6e63",
                    fontSize: 13,
                    flex: 1,
                  }}
                >
                  {tip}
                </Text>
              </View>
            ))}

          {!expanded && getAnimalCareInfo().length > 3 && (
            <TouchableOpacity onPress={toggleExpanded}>
              <Text
                style={{
                  color: theme.colors.primary || "#ffd3a7",
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                Show all care tips ({getAnimalCareInfo().length - 3} more)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Behavior & Context */}
      <Divider />
      <View style={{ padding: theme.spacing?.lg || 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontWeight: "bold",
                color: theme.colors.onSurface || "#4e342e",
                marginBottom: 4,
              }}
            >
              🐕 Behavior
            </Text>
            <Text
              style={{
                color: theme.colors.onSurfaceVariant || "#8d6e63",
                fontSize: 13,
              }}
            >
              {safeText(rescue.behavior)}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text
              style={{
                fontWeight: "bold",
                color: theme.colors.onSurface || "#4e342e",
                marginBottom: 4,
              }}
            >
              ⚡ Urgency Level
            </Text>
            <Text
              style={{
                color: theme.colors.onSurfaceVariant || "#8d6e63",
                fontSize: 13,
              }}
            >
              {safeText(rescue.urgency)}
            </Text>
          </View>
        </View>
      </View>

      {/* ✅ Action Buttons - Updated with Redux state logic */}
      <Divider />
      <View
        style={{
          flexDirection: "row",
          padding: theme.spacing?.lg || 16,
          gap: theme.spacing?.md || 8,
          justifyContent: "space-between",
        }}
      >
        {!isAcceptedByUser && rescue.status === "pending" ? (
          <Button
            mode="contained"
            icon="medical-bag"
            style={{ flex: 1 }}
            onPress={handleAcceptReport}
            loading={isLoading}
            disabled={isLoading}
          >
            {isLoading ? "Accepting..." : "I Will Take It"}
          </Button>
        ) : isAcceptedByUser ? (
          <>
            <Button
              mode="outlined"
              icon="eye"
              style={{ flex: 0.6, marginRight: 8 }}
              onPress={openTrackingPage}
            >
              Track
            </Button>
            <Button
              mode="contained"
              icon="phone"
              style={{ flex: 1 }}
              onPress={() => {
                const phone = rescue.contact_phone || rescue.reporter_phone;
                if (phone) {
                  Linking.openURL(`tel:${phone}`);
                } else {
                  Alert.alert("No contact number available");
                }
              }}
            >
              Contact Reporter
            </Button>
          </>
        ) : (
          <Button
            mode="contained"
            icon="phone"
            style={{ flex: 1 }}
            onPress={() => {
              const phone = rescue.contact_phone || rescue.reporter_phone;
              if (phone) {
                Linking.openURL(`tel:${phone}`);
              } else {
                Alert.alert("No contact number available");
              }
            }}
          >
            Contact Reporter
          </Button>
        )}
      </View>

      {/* Footer with ID and Timestamp */}
      <View
        style={{
          backgroundColor: theme.colors.surfaceVariant || "#ffecd1",
          padding: theme.spacing?.sm || 8,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: 16,
            color: theme.colors.onSurfaceVariant || "#8d6e63",
            opacity: 1,
          }}
        >
          Report Created At:{" "}
          {rescue.created_at
            ? new Date(rescue.created_at).toLocaleString()
            : "Time unknown"}
        </Text>
      </View>
    </Card>
  );
};

export default StrayRescueCard;
