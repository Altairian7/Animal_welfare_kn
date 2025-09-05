import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Animated, Text as RNText } from "react-native";
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useThemeContext } from "../../theme";

export default function SplashScreenComponent({ onFinish }: { onFinish?: () => void }) {
  const { theme } = useThemeContext();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    const loadFonts = async () => {
      await SplashScreen.preventAutoHideAsync();
      await Font.loadAsync({
        'Samarkan': require('../../assets/fonts/Samarkan.ttf'),
      });
      setFontsLoaded(true);
      await SplashScreen.hideAsync();
    };
    loadFonts();
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;

    // Sequential animations for smoother effect
    Animated.sequence([
      Animated.delay(300), // Initial delay
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      if (onFinish) {
        timeoutRef.current = setTimeout(onFinish, 1200);
      }
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: fadeAnim,
            transform: [
              { translateY },
              { scale: scaleAnim }
            ],
          },
        ]}
      >
        <RNText style={[styles.title, styles.karuna]}>Karuna</RNText>
        <RNText style={[styles.title, styles.nidhan]}>nidhan</RNText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fce9d3ff', // Cream background color
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 64,
    fontWeight: 'bold',
    letterSpacing: 3,
    textAlign: 'center',
    textShadowColor: 'rgba(139, 69, 19, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
  },
  karuna: {
     fontFamily: 'Samarkan',
    color: '#8B4513', // Brown color like splash screen
    textShadowColor: 'rgba(255, 129, 39, 0.9)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
    fontWeight: '600',
    marginTop: -10,
    letterSpacing: 0,
    fontSize: 98,
  },
  nidhan: {
    fontFamily: 'Samarkan',
    color: '#8B4513', // Brown color like splash screen
    textShadowColor: 'rgba(255, 129, 39, 0.9)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
    fontSize: 88,
    fontWeight: '600',
    marginTop: -15,
    letterSpacing: 0,
  },
});
