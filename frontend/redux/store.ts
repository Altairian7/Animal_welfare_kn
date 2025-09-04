import { configureStore, combineReducers } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import reportsReducer from './slices/reportSlice';
import { useDispatch } from 'react-redux';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Combine reducers first
const rootReducer = combineReducers({
  auth: authReducer,
  reports: reportsReducer,
});

// ✅ Update persist config to include reports
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'reports'], // ✅ Include reports in persistence
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  reducer: persistedReducer, // ✅ Use persisted reducer
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export default store;
