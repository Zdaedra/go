import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { ui } from './src/theme/uiTheme';
import { ThemeProvider } from './src/theme/ThemeContext';
import { AuthProvider, useAuth } from './src/state/AuthContext';
import { I18nProvider, useT } from './src/i18n';
import { initStoneSounds } from './src/sound/stones';
import PlayScreen from './src/screens/PlayScreen';
import LearnScreen from './src/screens/LearnScreen';
import OpeningScreen from './src/screens/OpeningScreen';
import TsumegoListScreen from './src/screens/TsumegoListScreen';
import TrainingSessionScreen from './src/screens/TrainingSessionScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AuthScreen from './src/screens/AuthScreen';
import PaywallScreen from './src/screens/PaywallScreen';

// The layout is measured against the reference at multiplier 1.0; iOS
// Dynamic Type may still nudge text up to +15%, beyond that it breaks
// the cards (titles and opening lists stop fitting).
(Text as any).defaultProps = { ...(Text as any).defaultProps, maxFontSizeMultiplier: 1.15 };
(TextInput as any).defaultProps = { ...(TextInput as any).defaultProps, maxFontSizeMultiplier: 1.15 };

const Tab = createBottomTabNavigator();
const LearnStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: ui.bg,
    card: ui.bg,
    text: ui.ink,
    primary: ui.accent,
    border: 'rgba(255,255,255,0.07)',
  },
};

// Approved header language: centered 17px/600 title on the shared ground,
// no seam hairline, lavender back chevron.
const headerOptions = {
  headerTitleAlign: 'center' as const,
  headerTitleStyle: { fontSize: 15, fontWeight: '600' as const, color: ui.ink },
  headerShadowVisible: true,
  headerTintColor: '#B9B4C9',
  headerBackTitleVisible: false,
};

function LearnNavigator() {
  const t = useT();
  return (
    <LearnStack.Navigator screenOptions={headerOptions}>
      <LearnStack.Screen
        name="LearnList"
        component={LearnScreen}
        // Хаб рисует собственную крупную шапку (референс-макет «Обучение»).
        options={{ title: t('tab_learn'), headerShown: false }}
      />
      <LearnStack.Screen
        name="Opening"
        component={OpeningScreen}
        options={{ title: t('title_opening') }}
      />
      <LearnStack.Screen
        name="TsumegoList"
        component={TsumegoListScreen}
        options={{ title: t('title_tsumego_list') }}
      />
      <LearnStack.Screen
        name="TrainingSession"
        component={TrainingSessionScreen}
        options={{ title: t('title_training') }}
      />
    </LearnStack.Navigator>
  );
}

function Tabs() {
  const t = useT();
  return (
    <Tab.Navigator
      screenOptions={{
        ...headerOptions,
        tabBarActiveTintColor: ui.accentSoft,
        tabBarInactiveTintColor: ui.dim,
      }}
    >
      <Tab.Screen
        name="Play"
        component={PlayScreen}
        options={{
          title: t('tab_play'),
          // the profile card is the header, as in the approved reference
          headerShown: false,
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>◉</Text>,
        }}
      />
      <Tab.Screen
        name="Learn"
        component={LearnNavigator}
        options={{
          title: t('tab_learn'),
          headerShown: false,
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>☰</Text>,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={ProfileScreen}
        options={{
          title: t('title_profile'),
          tabBarLabel: t('tab_profile'),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>{'☺︎'}</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

function Root() {
  const auth = useAuth();
  const t = useT();
  if (!auth.ready) return null; // splash while restoring the session
  if (!auth.signedIn) return <AuthScreen />;
  return (
    <RootStack.Navigator screenOptions={headerOptions}>
      <RootStack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <RootStack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ presentation: 'modal', title: t('title_paywall') }}
      />
    </RootStack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Playfair: require('./assets/fonts/PlayfairDisplay.ttf'),
    InterV: require('./assets/fonts/Inter.ttf'),
  });
  React.useEffect(() => { initStoneSounds(); }, []);
  if (!fontsLoaded) return null;
  return (
    <I18nProvider>
      <AuthProvider>
        <ThemeProvider>
          <NavigationContainer theme={navTheme}>
            <StatusBar style="light" />
            <Root />
          </NavigationContainer>
        </ThemeProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
