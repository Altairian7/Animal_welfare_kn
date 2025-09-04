import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AuthService from '../../../api/authService';
import { savePushToken as savePushTokenApi } from '../../../api/savePushToken';
import * as Notifications from 'expo-notifications';

interface User {
  $id: string;
  name: string;
  email: string;
  account_type?: string;
}


interface NGOListCache {
  data: any[];
  lastFetched: number | null;
}

interface AuthState {
  initialized: boolean;
  authenticated: boolean;
  user: User | null;
  token: string | null;
  accountType: string | null;
  loading: boolean;
  error: string | null;
  isNewUser: boolean;
  profileLastFetched: number | null;
  ngoList: NGOListCache;
}

const initialState: AuthState = {
  initialized: false,
  authenticated: false,
  user: null,
  token: null,
  accountType: null,
  loading: false,
  error: null,
  isNewUser: false,
  profileLastFetched: null,
  ngoList: { data: [], lastFetched: null },
};

export const initSession = createAsyncThunk(
  'auth/initSession', 
  async (_, thunkAPI) => {
    try {
      const authStatus = await AuthService.checkAuthStatus();
      if (!authStatus.isLoggedIn) {
        throw new Error('No valid session found');
      }
      
      return {
        user: authStatus.userInfo,
        token: AuthService.token,
        accountType: authStatus.accountType
      };
    } catch (err: any) {
      throw err.message || 'Session check failed';
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, thunkAPI) => {
    try {
      const result = await AuthService.login(email, password);
      
      if (!result.success) {
        throw new Error(result.error || 'Login failed');
      }

      return {
        user: result.appwrite_user,
        token: result.appwrite_jwt,
        accountType: result.user_info?.account_type,
        userInfo: result.user_info
      };
    } catch (err: any) {
      throw err.message || 'Login failed';
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout', 
  async (_, thunkAPI) => {
    try {
      await AuthService.logout();
      return;
    } catch (err: any) {
      // Log the error but don't fail the logout process
      console.warn('Logout API call failed, but local session cleared:', err);
      return;
    }
  }
);

export const createUserAccount = createAsyncThunk(
  'auth/createAccount',
  async ({ email, password, name, accountType }: { email: string; password: string; name: string; accountType: 'user' | 'ngo' }, thunkAPI) => {
    try {
      const result = await AuthService.register(email, password, name, accountType);
      
      if (!result.success) {
        throw new Error(result.error || 'Account creation failed');
      }

      return {
        user: result.appwrite_user,
        token: result.appwrite_jwt,
        accountType: result.user_info?.account_type,
        userInfo: result.user_info
      };
    } catch (err: any) {
      throw err.message || 'Account creation failed';
    }
  }
);

export const saveExpoPushToken = createAsyncThunk(
  'auth/saveExpoPushToken',
  async (_, thunkAPI) => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        throw new Error('Push notification permissions not granted');
      }
      const tokenData = await Notifications.getExpoPushTokenAsync();
      // Optionally send tokenData.data to your backend here
      return tokenData.data;
    } catch (err: any) {
      throw err.message || 'Failed to get push token';
    }
  }
);

export const savePushTokenToBackend = createAsyncThunk(
  'auth/savePushTokenToBackend',
  async (token: string, thunkAPI) => {
    try {
      const result = await savePushTokenApi(token);
      return result;
    } catch (err: any) {
      throw err.message || 'Failed to save push token to backend';
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    resetError(state) {
      state.error = null;
    },
    setToken(state, action: PayloadAction<string>) {
      state.token = action.payload;
    },
    clearAuth(state) {
      state.user = null;
      state.token = null;
      state.accountType = null;
      state.authenticated = false;
      state.error = null;
      state.isNewUser = false; // ✅ NEW: Reset new user flag on clear
    },
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
      state.profileLastFetched = Date.now();
      if (action.payload) {
        state.authenticated = true;
        state.token = AuthService.token;
      }
    },
    setNGOList(state, action: PayloadAction<any[]>) {
      state.ngoList = { data: action.payload, lastFetched: Date.now() };
    },
    setInitialized(state, action: PayloadAction<boolean>) {
      state.initialized = action.payload;
    },
    // ✅ NEW: Action to reset new user flag after onboarding
    resetNewUserFlag(state) {
      state.isNewUser = false;
    },
    // ✅ NEW: Action to manually set new user flag if needed
    setNewUserFlag(state, action: PayloadAction<boolean>) {
      state.isNewUser = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // INIT SESSION
      .addCase(initSession.pending, (state) => {
        state.loading = true;
      })
      .addCase(initSession.fulfilled, (state, action) => {
        state.initialized = true;
        state.authenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.accountType = action.payload.accountType;
        state.loading = false;
        state.error = null;
        state.isNewUser = false; // ✅ NEW: Existing users are not new
      })
      .addCase(initSession.rejected, (state, action) => {
        state.initialized = true;
        state.authenticated = false;
        state.user = null;
        state.token = null;
        state.accountType = null;
        state.loading = false;
        state.error = null; // Don't show error for failed init
        state.isNewUser = false; // ✅ NEW: Reset flag on init failure
      })
      // LOGIN
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.authenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.accountType = action.payload.accountType;
        state.loading = false;
        state.error = null;
        state.isNewUser = false; // ✅ NEW: Regular login users are not new
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.error = action.error.message || 'Login error';
        state.loading = false;
        state.authenticated = false;
        state.user = null;
        state.token = null;
        state.accountType = null;
        state.isNewUser = false; // ✅ NEW: Reset flag on login failure
      })
      // LOGOUT
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.authenticated = false;
        state.user = null;
        state.token = null;
        state.accountType = null;
        state.loading = false;
        state.error = null;
        state.isNewUser = false; // ✅ NEW: Reset flag on logout
      })
      .addCase(logoutUser.rejected, (state) => {
        // Even if logout fails, clear local state
        state.authenticated = false;
        state.user = null;
        state.token = null;
        state.accountType = null;
        state.loading = false;
        state.error = null;
        state.isNewUser = false; // ✅ NEW: Reset flag on logout failure
      })
      // CREATE ACCOUNT - ✅ MODIFIED: Set isNewUser flag
      .addCase(createUserAccount.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createUserAccount.fulfilled, (state, action) => {
        state.authenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.accountType = action.payload.accountType;
        state.loading = false;
        state.error = null;
        state.isNewUser = true; // ✅ NEW: Mark as new user after registration
      })
      .addCase(createUserAccount.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Account creation failed';
        state.isNewUser = false; // ✅ NEW: Reset flag on registration failure
      })
      // SAVE EXPO PUSH TOKEN
      .addCase(saveExpoPushToken.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveExpoPushToken.fulfilled, (state, action) => {
        // Optionally store the push token in state if you want
        // state.pushToken = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(saveExpoPushToken.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to save push token';
      })
      // SAVE PUSH TOKEN TO BACKEND
      .addCase(savePushTokenToBackend.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(savePushTokenToBackend.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(savePushTokenToBackend.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to save push token to backend';
      });
  },
});

export const { 
  resetError, 
  setToken, 
  clearAuth, 
  setUser, 
  setInitialized,
  resetNewUserFlag, // ✅ NEW: Export new action
  setNewUserFlag,   // ✅ NEW: Export new action
  setNGOList
} = authSlice.actions;

export default authSlice.reducer;
