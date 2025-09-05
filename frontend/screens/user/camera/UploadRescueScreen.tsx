import React, { useState, useEffect } from "react";
import { View, ScrollView, Image, Alert } from "react-native";
import { Text, Button, TextInput, Card, Chip, ActivityIndicator } from "react-native-paper";
import { useRoute, useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import { reportsApi } from "../../../api/reportsApi";

export default function UploadRescueScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const imageUri = route.params?.imageUri;

  const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [reportCreated, setReportCreated] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  // Get current location when component mounts
  const getCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required to submit reports.');
        return;
      }

      let locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const coords = {
        latitude: locationResult.coords.latitude,
        longitude: locationResult.coords.longitude
      };
      
      setLocation(coords);
      console.log('✅ Location obtained:', coords);

    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Location Error', 'Could not get your current location. Please try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  // ✅ SECURITY: No user ID needed - JWT handles authentication
  const analyzeAndCreateReport = async () => {
    if (!imageUri || !location) {
      console.log('⚠️ Missing required data for analysis:', { imageUri: !!imageUri, location: !!location });
      return;
    }
    
    setIsAnalyzing(true);
    try {
      console.log("🔄 Starting AI analysis with JWT authentication...");
      
      // ✅ SECURITY: Only send image and location - JWT provides user identity
      const response = await reportsApi.analyzeImage(
        imageUri, 
        location.latitude, 
        location.longitude
      );
      
      console.log('✅ AI Analysis and Report Creation Response:', response);
      
      if (response && response.report) {
        setReportData(response.report);
        setAnalysisComplete(true);
        setReportCreated(true);
        
        Alert.alert(
          "Success!", 
          "AI analysis complete and rescue report created successfully! Nearby NGOs have been notified.",
          [
            {
              text: "View Report",
              onPress: () => navigation.navigate("UserHome", { 
                newRescue: response.report,
                refresh: true,
                showSuccess: true
              })
            }
          ]
        );
        
        console.log("✅ Report created successfully with JWT authentication");
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error("❌ AI analysis and report creation failed:", error);
      
      let errorMessage = "Could not process the image and create report.";
      
      if (error.message?.includes('Authentication token not available')) {
        errorMessage = "Authentication error. Please log in again.";
      } else if (error.message?.includes('Authentication required')) {
        errorMessage = "Session expired. Please log in again.";
      } else if (error.message?.includes('Location coordinates')) {
        errorMessage = "Location is required. Please enable location services.";
      } else if (error.message?.includes('400')) {
        errorMessage = "Invalid data provided. Please check your inputs.";
      } else if (error.message?.includes('401') || error.message?.includes('403')) {
        errorMessage = "Authentication failed. Please log in again.";
      } else if (error.message?.includes('500')) {
        errorMessage = "Server error. Please try again later.";
      }
      
      Alert.alert("Processing Failed", errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  // Trigger analysis when we have both image and location
  useEffect(() => {
    if (imageUri && location && !isAnalyzing && !analysisComplete) {
      analyzeAndCreateReport();
    }
  }, [imageUri, location]);

  // Manual retry function
  const handleRetry = () => {
    setAnalysisComplete(false);
    setReportCreated(false);
    setReportData(null);
    if (imageUri && location) {
      analyzeAndCreateReport();
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={{ fontSize: 22, fontWeight: "bold", marginBottom: 16, textAlign: "center" }}>
        🔐 Secure AI-Powered Rescue Report
      </Text>

      {/* Image Display */}
      {imageUri ? (
        <Image 
          source={{ uri: imageUri }} 
          style={{ 
            width: "100%", 
            height: 250, 
            borderRadius: 10, 
            marginBottom: 16,
            backgroundColor: '#f0f0f0'
          }} 
          resizeMode="cover"
        />
      ) : (
        <View style={{ 
          width: "100%", 
          height: 250, 
          borderRadius: 10, 
          backgroundColor: '#f0f0f0',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 16,
          borderWidth: 2,
          borderColor: '#ddd',
          borderStyle: 'dashed'
        }}>
          <Text style={{ color: "gray", fontSize: 16 }}>No image selected</Text>
        </View>
      )}

      {/* Security Notice */}
      <Card style={{ marginBottom: 16, backgroundColor: '#e3f2fd' }}>
        <Card.Content>
          <Text style={{ fontWeight: 'bold', marginBottom: 4, color: '#1976d2' }}>🔐 Secure Authentication</Text>
          <Text style={{ fontSize: 12, color: '#1976d2' }}>
            Your identity is securely verified through JWT authentication. No personal data is sent in the request.
          </Text>
        </Card.Content>
      </Card>

      {/* Location Status */}
      <Card style={{ marginBottom: 16, backgroundColor: '#f8f9fa' }}>
        <Card.Content>
          <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Location Status:</Text>
          {locationLoading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#007bff" />
              <Text style={{ color: '#007bff', marginLeft: 8 }}>Getting location...</Text>
            </View>
          ) : location ? (
            <Text style={{ color: '#28a745' }}>
              ✅ Location obtained: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </Text>
          ) : (
            <Text style={{ color: '#dc3545' }}>❌ Location not available</Text>
          )}
        </Card.Content>
      </Card>

      {/* AI Processing Status */}
      <Card style={{ marginBottom: 16, backgroundColor: '#f8f9fa' }}>
        <Card.Content>
          <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>AI Processing Status:</Text>
          {isAnalyzing ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#007bff" />
              <Text style={{ color: '#007bff', marginLeft: 8 }}>Securely analyzing with JWT authentication...</Text>
            </View>
          ) : analysisComplete && reportCreated ? (
            <View>
              <Text style={{ color: '#28a745', marginBottom: 4 }}>✅ AI analysis complete & report created securely</Text>
              <Text style={{ fontSize: 12, fontStyle: 'italic', marginTop: 4 }}>
                Report created using secure JWT authentication. Your privacy is protected.
              </Text>
            </View>
          ) : !imageUri ? (
            <Text style={{ color: '#6c757d' }}>No image to analyze</Text>
          ) : !location ? (
            <Text style={{ color: '#dc3545' }}>Waiting for location...</Text>
          ) : (
            <Text style={{ color: '#dc3545' }}>Analysis failed</Text>
          )}
        </Card.Content>
      </Card>

      {/* Report Summary */}
      {reportCreated && reportData && (
        <Card style={{ marginBottom: 16, backgroundColor: '#e8f5e8' }}>
          <Card.Content>
            <Text style={{ fontWeight: 'bold', marginBottom: 8, color: '#28a745' }}>🔐 Report Created Securely!</Text>
            <Text style={{ marginBottom: 4 }}>
              <Text style={{ fontWeight: 'bold' }}>Title:</Text> {reportData.title || 'AI-Generated Report'}
            </Text>
            <Text style={{ marginBottom: 4 }}>
              <Text style={{ fontWeight: 'bold' }}>Species:</Text> {reportData.species || 'Unknown'}
            </Text>
            <Text style={{ marginBottom: 4 }}>
              <Text style={{ fontWeight: 'bold' }}>Severity:</Text> {reportData.severity || 'Unknown'}
            </Text>
            <Text style={{ marginBottom: 4 }}>
              <Text style={{ fontWeight: 'bold' }}>Status:</Text> {reportData.status || 'Pending'}
            </Text>
            <Text style={{ fontSize: 12, fontStyle: 'italic', marginTop: 8, color: '#28a745' }}>
              ✅ Authenticated securely via JWT - No personal data exposed
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* Action Buttons */}
      <View style={{ marginTop: 20 }}>
        {!reportCreated ? (
          <>
            {(!imageUri || !location) && (
              <Button
                mode="outlined"
                onPress={getCurrentLocation}
                disabled={locationLoading}
                style={{ marginBottom: 12 }}
                icon="map-marker"
              >
                {locationLoading ? "Getting Location..." : "Retry Location"}
              </Button>
            )}
            
            {imageUri && location && !isAnalyzing && !analysisComplete && (
              <Button
                mode="contained"
                onPress={analyzeAndCreateReport}
                style={{ paddingVertical: 8 }}
                contentStyle={{ height: 50 }}
                icon="shield-check"
              >
                🔐 Start Secure AI Analysis
              </Button>
            )}
            
            {!analysisComplete && isAnalyzing && (
              <Button
                mode="contained"
                disabled
                loading
                style={{ paddingVertical: 8 }}
                contentStyle={{ height: 50 }}
              >
                🔐 Processing Securely...
              </Button>
            )}
            
            {analysisComplete && !reportCreated && (
              <Button
                mode="contained"
                onPress={handleRetry}
                style={{ paddingVertical: 8 }}
                contentStyle={{ height: 50 }}
                icon="refresh"
              >
                Retry Secure Analysis
              </Button>
            )}
          </>
        ) : (
          <View style={{ gap: 12 }}>
            <Button
              mode="contained"
              onPress={() => navigation.navigate("UserHome", { 
                newRescue: reportData,
                refresh: true,
                showSuccess: true
              })}
              style={{ paddingVertical: 8 }}
              contentStyle={{ height: 50 }}
              icon="home"
            >
              Go to Home
            </Button>
            
            <Button
              mode="outlined"
              onPress={() => navigation.navigate("ReportsList")}
              style={{ paddingVertical: 8 }}
              contentStyle={{ height: 50 }}
              icon="format-list-bulleted"
            >
              View All Reports
            </Button>
          </View>
        )}
        
        <Text style={{ 
          textAlign: 'center', 
          marginTop: 12, 
          color: '#666',
          fontSize: 12,
          fontStyle: 'italic'
        }}>
          {reportCreated ? 
            "🔐 Report created securely using JWT authentication" : 
            isAnalyzing ? "🔐 Securely processing with JWT authentication..." :
            "🔐 JWT authentication ensures your data security"}
        </Text>
      </View>
    </ScrollView>
  );
}
