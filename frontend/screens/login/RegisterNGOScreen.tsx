import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Text, ActivityIndicator } from "react-native-paper";
import { useNavigation } from '@react-navigation/native';

export default function RegisterNGOScreen() {
  const navigation = useNavigation<any>();

  useEffect(() => {
    // Redirect to LoginScreen which now handles both login and registration
    navigation.replace('SignIn');
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <Text style={styles.text}>Redirecting to login...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});