// AdBanner.tsx
import React from "react";
import { View, Text, Dimensions, Platform } from "react-native";

const screenWidth = Dimensions.get("window").width;

// Try importing the ads library (fails inside Expo Go)
let BannerAd, BannerAdSize, TestIds;
try {
  const ads = require("react-native-google-mobile-ads");
  BannerAd = ads.BannerAd;
  BannerAdSize = ads.BannerAdSize;
  TestIds = ads.TestIds;
} catch (e) {
  BannerAd = null;
}

const AdBanner = () => {
  const isExpoGo = !BannerAd; // if import failed → Expo Go or simulator

  // Responsive sizing
  const horizontalMargin = 16;
  const bannerWidth = screenWidth - horizontalMargin * 2;
  const bannerHeight = Math.round(bannerWidth * 0.22); // ~22% of width (nice ratio)

  if (isExpoGo) {
    // 🎨 Mock banner card for Expo Go / Dev Preview
    return (
      <View
        style={{
          marginVertical: 12,
          marginHorizontal: horizontalMargin,
          alignItems: "flex-start",
          justifyContent: "center",
          width: bannerWidth,
          height: 115, // bannerHeight,
          backgroundColor: "rgba(255, 255, 240, 1)",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#ffefd2ff",
          padding: 12,
          flexDirection: "row",
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 3,
        }}
      >
        <View style={{ flex: 1, justifyContent: "center" }}>
          {/* Sponsored Label */}
          <Text
            style={{
              fontSize: 11,
              color: "#888",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 2,
            }}
          >
            Sponsored Ad
          </Text>

          {/* Headline */}
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: "#222",
              marginBottom: 4,
            }}
            numberOfLines={1}
          >
            Amazing Pet Rescue App
          </Text>

          {/* Description */}
          <Text
            style={{
              fontSize: 12,
              color: "#555",
              lineHeight: 16,
              marginBottom: 6,
            }}
            numberOfLines={2}
          >
            Track rescues, get live updates, and help stray animals with ease. Lorem ipsum dolor sit amet consectetur, adipisicing elit. Delectus, voluptatibus repellendus? Deserunt ea libero eaque sint corrupti eum obcaecati quas in beatae cupiditate veritatis, assumenda eos sequi adipisci cum reprehenderit?
          </Text>

          {/* CTA */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: "#1e88e5",
            }}
          >
            Learn More →
          </Text>
        </View>
      </View>
    );
  }

  const unitId =
    __DEV__ && Platform.OS === "android"
      ? TestIds.BANNER
      : "ca-app-pub-3948390437131273/9083522131"; // ✅ Corrected unit ID

  return (
    <View
      style={{
        marginVertical: 12,
        marginHorizontal: horizontalMargin,
        alignItems: "center",
      }}
    >
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdFailedToLoad={(error) => {
          console.log('Ad failed to load:', error);
        }}
        onAdLoaded={() => {
          console.log('Ad loaded successfully');
        }}
      />
    </View>
  );
};

export default AdBanner;
