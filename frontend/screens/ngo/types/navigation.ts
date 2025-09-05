// types/navigation.ts
export type RootStackParamList = {
  // Authentication screens
  LoginScreen: undefined;
  SignIn: undefined;
  
  // User screens
  UserOnboarding: undefined;
  UserHome: undefined;
  UploadRescue: undefined;
  
  // NGO screens
  NGOAdminDashboard: undefined;
  NGOProfile: undefined;
  NGOSettings: { 
    ngoId: string;
    // Removed non-serializable function parameter
  };
  
  // Shared screens
  Settings: undefined;
  NotificationScreen: undefined;
  NotificationPreferences: undefined;
};
