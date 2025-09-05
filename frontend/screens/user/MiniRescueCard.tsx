import React, { useState } from "react";
import { View, TouchableOpacity, Image } from "react-native";
import { Card, Text, Chip, Badge } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { useThemeContext } from "../../theme";

// Helper function for color alpha
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

interface MiniRescueCardProps {
  rescue: any;
  onPress: () => void;
}

const MiniRescueCard: React.FC<MiniRescueCardProps> = ({ rescue, onPress }) => {
  const { theme } = useThemeContext();
  const [imageError, setImageError] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  const getSeverityColor = (severity: string) => {
    const colors = {
      Critical: "#FF5722",
      High: "#FF5722", // or another color
      Medium: "#FF9800",
      Low: "#4CAF50",
    };
    return colors[severity] || theme.colors.outline || "#9E9E9E";
  };
  const getStatusColor = (status: string) => {
    const colors = {
      pending: "#FF9800",
      in_progress: "#2196F3",
      resolved: "#4CAF50",
    };
    return colors[status] || "#FF9800";
  };

  const getImageSource = () => {
    if (!rescue.image_url || imageError || showFallback) {
      return null;
    }

    let imageUrl = rescue.image_url;
    if (typeof imageUrl === "string") {
      // Fix double /v1 and remove mode=admin
      imageUrl = imageUrl
        .replace("/v1/v1/", "/v1/")
        .replace(/[?&]mode=admin/, "");
    }

    return { uri: imageUrl };
  };

  const safeText = (value: any) => (value ? value : "Not mentioned");

  const renderImageFallback = () => (
    <View
      style={{
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: theme.colors.surfaceVariant || "#f0f0f0",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
        borderWidth: 1,
        borderColor: theme.colors.outline || "#e0e0e0",
      }}
    >
      <Ionicons
        name="paw-outline"
        size={24}
        color={theme.colors.onSurfaceVariant || "#666666"}
      />
      <Text
        style={{
          fontSize: 8,
          color: theme.colors.onSurfaceVariant || "#666666",
          textAlign: "center",
          marginTop: 2,
        }}
      >
        No Image
      </Text>
    </View>
  );

  // Get most important health info for preview
  const getHealthPreview = () => {
    if (rescue.injury_summary) return rescue.injury_summary;
    if (rescue.symptoms && rescue.symptoms.length > 0)
      return rescue.symptoms.slice(0, 2).join(", ");
    if (rescue.description) return rescue.description;
    return "Health assessment pending...";
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card
        style={{
          width: 280,
          marginRight: 12,
          elevation: 3,
          backgroundColor: theme.colors.surface || "#ffffff",
        }}
      >
        {/* Severity indicator bar */}
        <View
          style={{
            height: 4,
            backgroundColor: getSeverityColor(rescue.severity),
          }}
        />

        <View style={{ flexDirection: "row", padding: 12, paddingBottom: 12 }}>
          {/* Image */}
          {getImageSource() && !showFallback ? (
            <Image
              source={getImageSource()!}
              style={{
                width: 60,
                height: 60,
                borderRadius: 8,
                backgroundColor: "#f0f0f0",
                marginRight: 12,
              }}
              resizeMode="cover"
              onError={() => {
                console.error("Mini card image error");
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

          {/* Main Info */}
          <View style={{ flex: 1, paddingBottom: 8 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "bold",
                  color: theme.colors.onSurface || "#000000",
                  flex: 1,
                  marginRight: 8,
                }}
                numberOfLines={1}
              >
                {safeText(rescue.title)}
              </Text>
              <Badge
                style={{
                  backgroundColor: getSeverityColor(rescue.severity),
                  fontSize: 10,
                }}
              >
                {safeText(rescue.severity)}
              </Badge>
            </View>

            {/* Animal basic info */}
            <Text
              style={{
                fontSize: 11,
                color: theme.colors.onSurfaceVariant || "#666666",
                marginTop: 2,
                marginBottom: 4,
              }}
              numberOfLines={1}
            >
              {safeText(rescue.species)} • {safeText(rescue.age)} •{" "}
              {safeText(rescue.breed)}
            </Text>

            {/* Health preview - most important */}
            <Text
              style={{
                fontSize: 12,
                color: theme.colors.onSurface || "#333333",
                marginBottom: 6,
                fontWeight: "500",
              }}
              numberOfLines={2}
            >
              🩺 {getHealthPreview()}
            </Text>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Chip
                mode="flat"
                compact
                style={{
                  backgroundColor: addAlpha(getStatusColor(rescue.status), 0.2),
                  height: 30,
                }}
                textStyle={{
                  color: getStatusColor(rescue.status),
                  fontSize: 10,
                  fontWeight: "bold",
                }}
              >
                {rescue.status?.toUpperCase() || "PENDING"}
              </Chip>

              <Text
                style={{
                  fontSize: 14,
                  color: theme.colors.onSurfaceVariant || "#666666",
                }}
              >
                📅{" "}
                {rescue.created_at
                  ? new Date(rescue.created_at).toLocaleDateString()
                  : "Unknown"}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Health Stats Footer */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: theme.colors.surfaceVariant || "#f5f5f5",
            borderTopWidth: 1,
            borderTopColor: theme.colors.outline + "30" || "rgba(0,0,0,0.1)",
          }}
        >
          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                fontSize: 10,
                color: theme.colors.onSurfaceVariant || "#666666",
              }}
            >
              Urgency
            </Text>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "bold",
                color: getSeverityColor(rescue.urgency || rescue.severity),
              }}
            >
              {safeText(rescue.urgency || rescue.severity)}
            </Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                fontSize: 10,
                color: theme.colors.onSurfaceVariant || "#666666",
              }}
            >
              AI Score
            </Text>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "bold",
                color: theme.colors.primary || "#1976D2",
              }}
            >
              {rescue.confidence_score || 8}/10
            </Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                fontSize: 10,
                color: theme.colors.onSurfaceVariant || "#666666",
              }}
            >
              Location
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="location"
                size={10}
                color={theme.colors.primary || "#1976D2"}
              />
              <Text
                style={{
                  fontSize: 10,
                  color: theme.colors.primary || "#1976D2",
                  marginLeft: 2,
                }}
              >
                Near You
              </Text>
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

export default MiniRescueCard;
