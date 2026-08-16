import {
  DarkTheme,
  NavigationContainer,
  Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ScannerProvider } from '@/ble/useBleScanner';
import type { RootStackParamList } from '@/navigation';
import { CalibrationScreen } from '@/screens/CalibrationScreen';
import { ScanScreen } from '@/screens/ScanScreen';
import { TrackScreen } from '@/screens/TrackScreen';
import { SettingsProvider } from '@/storage/SettingsContext';
import { colors, mono } from '@/theme/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    primary: colors.nearby,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ScannerProvider>
          <StatusBar style="light" />
          <NavigationContainer theme={navTheme}>
            <Stack.Navigator
              screenOptions={{
                headerStyle: { backgroundColor: colors.bg },
                headerTitleStyle: {
                  fontFamily: mono,
                  fontSize: 14,
                  letterSpacing: 1.5,
                },
                headerShadowVisible: false,
                headerTintColor: colors.text,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen
                name="Scan"
                component={ScanScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Track"
                component={TrackScreen}
                options={{ title: 'TRACKING' }}
              />
              <Stack.Screen
                name="Calibration"
                component={CalibrationScreen}
                options={{ title: 'CALIBRATION', presentation: 'modal' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </ScannerProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
