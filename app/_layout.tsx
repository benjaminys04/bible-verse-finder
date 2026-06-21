import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../src/lib/useTheme';

export default function RootLayout() {
  const { theme } = useTheme();

  // Count a page view (web only; fire-and-forget).
  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetch(`/pageview?p=${encodeURIComponent(window.location.pathname)}`).catch(() => {});
    }
  }, []);
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.bg },
            animation: 'fade',
          }}
        />
      </View>
    </SafeAreaProvider>
  );
}
