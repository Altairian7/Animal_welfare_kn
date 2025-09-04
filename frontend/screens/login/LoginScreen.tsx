import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Dimensions, Animated } from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Snackbar,
  SegmentedButtons,
  useTheme,
  Card,
  Surface,
  RadioButton,
  Divider,
  Chip,
} from 'react-native-paper';
import { useSelector } from 'react-redux';
import { loginUser, resetError, createUserAccount } from '../../core/redux/slices/authSlice';
import { setupNotificationsForUser } from '../../services/NotificationSetup';
import { pushNotificationService } from '../../services/PushNotificationService';
import { useAppDispatch } from '../../core/redux/store';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  organizationName?: string;
  registrationNumber?: string;
  phone?: string;
}

type AccountType = 'user' | 'ngo';
type AuthMode = 'login' | 'register';

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { loading, error, authenticated, user, accountType } = useSelector((state: any) => state.auth);

  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [selectedAccountType, setSelectedAccountType] = useState<AccountType>('user');
  const [formData, setFormData] = useState<FormData>({ 
    email: '', 
    password: '', 
    confirmPassword: '', 
    name: '',
    organizationName: '',
    registrationNumber: '',
    phone: ''
  });
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const loginCooldown = useRef(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const cardFadeAnim = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    const loadFonts = async () => {
      try {
        await Font.loadAsync({
          'Samarkan': require('../../assets/fonts/Samarkan.ttf'),
        });
        setFontsLoaded(true);
      } catch (error) {
        console.log('Font loading error:', error);
        setFontsLoaded(true);
      }
    };
    loadFonts();
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;

    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(cardFadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(cardTranslateY, {
          toValue: 0,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fontsLoaded]);

  useEffect(() => {
    if (loginAttempts >= 3) {
      const timer = setTimeout(() => {
        setLoginAttempts(0);
        showSnackbar('You can try logging in again now.');
      }, 300000);
      return () => clearTimeout(timer);
    }
  }, [loginAttempts]);

  // ✅ REMOVED: Manual navigation useEffect - Let conditional rendering handle navigation

  useEffect(() => {
    if (error) {
      handleLoginError(error);
      dispatch(resetError());
    }
  }, [error]);

  const showSnackbar = useCallback((msg: string) => {
    setSnackbarMsg(msg);
    setSnackbarVisible(true);
  }, []);

  const handleLoginError = (errorMessage: string) => {
    if (errorMessage?.includes('rate limit')) {
      showSnackbar('Too many requests. Please wait a moment and try again.');
    } else if (
      errorMessage?.includes('Invalid credentials') ||
      errorMessage?.includes('user') ||
      errorMessage?.includes('email') ||
      errorMessage?.includes('password')
    ) {
      showSnackbar('Invalid email or password. Please check your credentials.');
    } else if (errorMessage?.includes('session is active')) {
      showSnackbar('Already logged in. Refreshing...');
    } else {
      showSnackbar('Login failed. Please try again.');
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAuthModeChange = (value: string) => {
    setAuthMode(value as AuthMode);
    setFormData({ 
      email: '', 
      password: '', 
      confirmPassword: '', 
      name: '',
      organizationName: '',
      registrationNumber: '',
      phone: ''
    });
    if (value === 'login') {
      setSelectedAccountType('user');
    }
  };

  const isFormValid = () => {
    if (authMode === 'login') {
      return formData.email.includes('@') && formData.password.length >= 6;
    } else {
      const baseValid = (
        formData.email.includes('@') &&
        formData.password.length >= 6 &&
        formData.name.trim() !== '' &&
        formData.confirmPassword === formData.password
      );

      if (selectedAccountType === 'ngo') {
        return baseValid && 
               formData.organizationName?.trim() !== '' &&
               formData.registrationNumber?.trim() !== '' &&
               formData.phone?.trim() !== '';
      }

      return baseValid;
    }
  };

  const handleLogin = async () => {
    if (loginCooldown.current || loginAttempts >= 3) return;
    loginCooldown.current = true;
    setTimeout(() => (loginCooldown.current = false), 1500);

    if (!formData.email.trim() || !formData.password.trim()) {
      showSnackbar('Please enter both email and password.');
      return;
    }

    setLoginAttempts(prev => prev + 1);

    try {
      await dispatch(
        loginUser({ email: formData.email, password: formData.password })
      ).unwrap();
      setLoginAttempts(0);
      showSnackbar("Login successful! Welcome back.");

      // Initialize OneSignal and push notifications after successful login
      const result = await setupNotificationsForUser();
      console.log('OneSignal setup result:', result);
      // Use userId from Redux user object if available
      if (user && user.id) {
        await pushNotificationService.initialize(user.id);
      } else {
        await pushNotificationService.initialize(formData.email);
      }
    } catch (error: any) {
      console.error("Login error:", error);
      showSnackbar("Login failed. Please check your credentials.");
    }
  };

  const handleRegister = async () => {
    if (!isFormValid()) {
      showSnackbar('Please fill all fields correctly.');
      return;
    }

    try {
      const registrationData = {
        email: formData.email,
        password: formData.password,
        name: formData.name,
        accountType: selectedAccountType,
        ...(selectedAccountType === 'ngo' && {
          organizationName: formData.organizationName,
          registrationNumber: formData.registrationNumber,
          phone: formData.phone,
        })
      };

      await dispatch(createUserAccount(registrationData)).unwrap();

      // ✅ FIXED: Only show messages - no manual navigation
      if (selectedAccountType === 'user') {
        showSnackbar('Registration successful! Setting up your profile...');
        // Redux isNewUser = true will automatically show UserOnboarding screen
      } else {
        showSnackbar('NGO registration successful! Welcome to Karuna Nidhan.');
        // Redux accountType = 'ngo' will automatically show NGO screens
      }

      // Reset form
      setFormData({ 
        email: '', 
        password: '', 
        confirmPassword: '', 
        name: '',
        organizationName: '',
        registrationNumber: '',
        phone: ''
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      showSnackbar('Registration failed. Please try again.');
    }
  };

  const resetAttempts = () => {
    setLoginAttempts(0);
    showSnackbar('You can try logging in again now.');
  };

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          {/* Animated Title */}
          <Animated.View
            style={[
              styles.titleContainer,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY },
                  { scale: scaleAnim }
                ],
              },
            ]}
          >
            <Text style={[styles.title, fontsLoaded && { fontFamily: 'Samarkan' }]}>
              Karuna Nidhan
            </Text>
            <Text style={styles.subtitle}>A single touch of kindness can heal a life that never had a voice.</Text>
          </Animated.View>

          {/* Animated Form Card */}
          <Animated.View
            style={[
              {
                opacity: cardFadeAnim,
                transform: [{ translateY: cardTranslateY }],
              },
            ]}
          >
            <Card style={styles.formCard}>
              <Card.Content>
                {/* Auth Mode Selection */}
                <SegmentedButtons
                  value={authMode}
                  onValueChange={handleAuthModeChange}
                  buttons={[
                    { 
                      value: 'login', 
                      label: 'Sign In',
                      icon: 'login'
                    },
                    { 
                      value: 'register', 
                      label: 'Sign Up',
                      icon: 'account-plus'
                    },
                  ]}
                  style={styles.authModeButtons}
                />

                {/* Account Type Selection for Registration */}
                {authMode === 'register' && (
                  <View style={styles.accountTypeSection}>
                    <Text style={styles.accountTypeTitle}>Choose Account Type:</Text>
                    
                    <View style={styles.accountTypeOptions}>
                      <Surface style={[
                        styles.accountTypeCard,
                        selectedAccountType === 'user' && styles.selectedAccountType
                      ]}>
                        <View style={styles.accountTypeContent}>
                          <RadioButton
                            value="user"
                            status={selectedAccountType === 'user' ? 'checked' : 'unchecked'}
                            onPress={() => setSelectedAccountType('user')}
                            color="#8B4513"
                          />
                          <View style={styles.accountTypeInfo}>
                            <View style={styles.accountTypeHeader}>
                              <Ionicons name="person" size={20} color="#8B4513" />
                              <Text style={styles.accountTypeLabel}>Individual User</Text>
                            </View>
                            <Text style={styles.accountTypeDescription}>
                              Report animal emergencies, track rescue status
                            </Text>
                          </View>
                        </View>
                      </Surface>

                      <Surface style={[
                        styles.accountTypeCard,
                        selectedAccountType === 'ngo' && styles.selectedAccountType
                      ]}>
                        <View style={styles.accountTypeContent}>
                          <RadioButton
                            value="ngo"
                            status={selectedAccountType === 'ngo' ? 'checked' : 'unchecked'}
                            onPress={() => setSelectedAccountType('ngo')}
                            color="#8B4513"
                          />
                          <View style={styles.accountTypeInfo}>
                            <View style={styles.accountTypeHeader}>
                              <Ionicons name="business" size={20} color="#8B4513" />
                              <Text style={styles.accountTypeLabel}>NGO Organization</Text>
                            </View>
                            <Text style={styles.accountTypeDescription}>
                              Manage rescue operations, coordinate volunteers
                            </Text>
                          </View>
                        </View>
                      </Surface>
                    </View>

                    <Divider style={styles.divider} />
                  </View>
                )}

                {/* Registration Fields */}
                {authMode === 'register' && (
                  <>
                    <TextInput
                      label={selectedAccountType === 'ngo' ? "Contact Person Name" : "Full Name"}
                      value={formData.name}
                      onChangeText={text => handleInputChange('name', text)}
                      style={styles.input}
                      mode="outlined"
                      outlineColor="#D2B48C"
                      activeOutlineColor="#8B4513"
                      left={<TextInput.Icon icon="account" />}
                    />

                    {selectedAccountType === 'ngo' && (
                      <>
                        <TextInput
                          label="Organization Name *"
                          value={formData.organizationName}
                          onChangeText={text => handleInputChange('organizationName', text)}
                          style={styles.input}
                          mode="outlined"
                          outlineColor="#D2B48C"
                          activeOutlineColor="#8B4513"
                          left={<TextInput.Icon icon="domain" />}
                        />

                        <TextInput
                          label="Registration Number *"
                          value={formData.registrationNumber}
                          onChangeText={text => handleInputChange('registrationNumber', text)}
                          style={styles.input}
                          mode="outlined"
                          outlineColor="#D2B48C"
                          activeOutlineColor="#8B4513"
                          left={<TextInput.Icon icon="certificate" />}
                          placeholder="NGO Registration/License Number"
                        />

                        <TextInput
                          label="Phone Number *"
                          value={formData.phone}
                          onChangeText={text => handleInputChange('phone', text)}
                          style={styles.input}
                          mode="outlined"
                          outlineColor="#D2B48C"
                          activeOutlineColor="#8B4513"
                          keyboardType="phone-pad"
                          left={<TextInput.Icon icon="phone" />}
                        />
                      </>
                    )}
                  </>
                )}

                {/* Common Fields */}
                <TextInput
                  label="Email"
                  value={formData.email}
                  onChangeText={text => handleInputChange('email', text)}
                  style={styles.input}
                  mode="outlined"
                  outlineColor="#D2B48C"
                  activeOutlineColor="#8B4513"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  left={<TextInput.Icon icon="email" />}
                />

                <TextInput
                  label="Password"
                  value={formData.password}
                  onChangeText={text => handleInputChange('password', text)}
                  style={styles.input}
                  mode="outlined"
                  outlineColor="#D2B48C"
                  activeOutlineColor="#8B4513"
                  secureTextEntry
                  left={<TextInput.Icon icon="lock" />}
                />

                {authMode === 'register' && (
                  <TextInput
                    label="Confirm Password"
                    value={formData.confirmPassword}
                    onChangeText={text => handleInputChange('confirmPassword', text)}
                    style={styles.input}
                    mode="outlined"
                    outlineColor="#D2B48C"
                    activeOutlineColor="#8B4513"
                    secureTextEntry
                    left={<TextInput.Icon icon="lock-check" />}
                  />
                )}

                {/* Action Button */}
                <Button
                  mode="contained"
                  onPress={authMode === 'login' ? handleLogin : handleRegister}
                  disabled={!isFormValid() || loading || loginAttempts >= 3}
                  loading={loading}
                  style={styles.actionButton}
                  buttonColor="#8B4513"
                  icon={authMode === 'login' ? 'login' : 'account-plus'}
                >
                  {authMode === 'login' 
                    ? 'Sign In' 
                    : `Create ${selectedAccountType === 'ngo' ? 'NGO' : 'User'} Account`
                  }
                </Button>

                {/* Registration Info for NGOs */}
                {authMode === 'register' && selectedAccountType === 'ngo' && (
                  <View style={styles.ngoInfoSection}>
                    <Text style={styles.ngoInfoTitle}>📋 NGO Registration Info:</Text>
                    <Text style={styles.ngoInfoText}>
                      • Your NGO account will be reviewed for verification{'\n'}
                      • Provide valid registration documents{'\n'}
                      • Verification typically takes 1-2 business days{'\n'}
                      • You'll receive email confirmation once approved
                    </Text>
                  </View>
                )}

                {loginAttempts >= 3 && (
                  <Button mode="text" onPress={resetAttempts} style={styles.resetButton} textColor="#8B4513">
                    Reset and Try Again
                  </Button>
                )}
              </Card.Content>
            </Card>
          </Animated.View>

          <Animated.View
            style={[
              styles.quoteContainer,
              {
                opacity: cardFadeAnim,
                transform: [{ translateY: cardTranslateY }],
              },
            ]}
          >
            <Text style={styles.quoteText}>
              "The greatness of a nation can be judged by the way its animals are treated."
            </Text>
            <Text style={styles.authorText}>— Mahatma Gandhi</Text>
          </Animated.View>
        </ScrollView>

        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={4000}
          action={{ label: 'Close', onPress: () => setSnackbarVisible(false) }}
        >
          {snackbarMsg}
        </Snackbar>
      </KeyboardAvoidingView>
    </View>
  );
}

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fce9d3ff',
  },
  keyboardView: { 
    flex: 1 
  },
  scrollContainer: { 
    flexGrow: 1, 
    padding: 20, 
    paddingTop: height * 0.08, 
    justifyContent: 'center' 
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { 
    fontSize: 88, 
    lineHeight: 84,
    fontWeight: '600', 
    textTransform: 'capitalize',
    textAlign: 'center', 
    marginBottom: 12, 
    fontFamily: 'Samarkan',
    color: '#8B4513',
    textShadowColor: 'rgba(255, 129, 39, 0.9)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: { 
    fontSize: 15, 
    textAlign: 'center', 
    fontStyle: 'italic',
    color: '#b87a3cff',
    fontWeight: '600',
    letterSpacing: 2,
  },
  formCard: { 
    borderRadius: 0, 
    backgroundColor: '#fce9d3ff',
    marginBottom: 10,
    elevation: 1,
    shadowColor: 'rgba(139, 69, 19, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  authModeButtons: {
    marginBottom: 16
  },
  accountTypeSection: {
    marginBottom: 16
  },
  accountTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#8B4513'
  },
  accountTypeOptions: {
    gap: 8
  },
  accountTypeCard: {
    borderRadius: 12,
    padding: 12,
    elevation: 1,
    backgroundColor: '#FFF8DC'
  },
  selectedAccountType: {
    backgroundColor: '#F0E68C',
    borderWidth: 2,
    borderColor: '#8B4513'
  },
  accountTypeContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  accountTypeInfo: {
    flex: 1,
    marginLeft: 8
  },
  accountTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  accountTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#8B4513'
  },
  accountTypeDescription: {
    fontSize: 12,
    color: '#654321',
    lineHeight: 16
  },
  divider: {
    marginTop: 16,
    backgroundColor: '#D2B48C'
  },
  input: { 
    marginVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)'
  },
  actionButton: { 
    marginTop: 16,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ngoInfoSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF8DC',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#8B4513'
  },
  ngoInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#8B4513'
  },
  ngoInfoText: {
    fontSize: 12,
    color: '#654321',
    lineHeight: 18
  },
  resetButton: {
    marginTop: 8
  },
  quoteContainer: {
    alignItems: 'center',
  },
  quoteText: { 
    textAlign: 'center', 
    fontStyle: 'italic', 
    marginVertical: 8,
    color: '#8B4513',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  authorText: { 
    textAlign: 'center', 
    color: '#654321',
    fontSize: 12,
    fontWeight: '600',
  },
});
