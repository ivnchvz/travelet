import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useColorScheme } from '@/hooks/useColorScheme';

import { GestureHandlerRootView } from 'react-native-gesture-handler'; // Added for Carousel

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    // Plus Jakarta Sans (Tokotype, OFL) — the passes and sleeves are set in it
    PlusJakartaSans_400Regular: require('@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf'),
    PlusJakartaSans_500Medium: require('@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf'),
    PlusJakartaSans_600SemiBold: require('@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf'),
    PlusJakartaSans_700Bold: require('@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf'),
    PlusJakartaSans_800ExtraBold: require('@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf'),
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Rubik: require('../assets/fonts/Rubik.ttf'),
    'BeVietnamPro-BoldItalic': require('../assets/fonts/BeVietnamPro-BoldItalic.ttf'),
    'BeVietnamPro-ExtraBoldItalic': require('../assets/fonts/BeVietnamPro-ExtraBoldItalic.ttf'),
    'BeVietnamPro-Black': require('../assets/fonts/BeVietnamPro-Black.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    // Inside the gesture root so the fallback still gets a laid-out host view,
    // and outside the navigator so a throw on any screen is caught rather than
    // taking the whole stack down with it.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}