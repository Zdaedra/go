import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { ui } from './src/theme/uiTheme';
import { ThemeProvider } from './src/theme/ThemeContext';
import { AuthProvider, useAuth } from './src/state/AuthContext';
import PlayScreen from './src/screens/PlayScreen';
import LearnScreen from './src/screens/LearnScreen';
import OpeningScreen from './src/screens/OpeningScreen';
import TsumegoListScreen from './src/screens/TsumegoListScreen';
import TsumegoProblemScreen from './src/screens/TsumegoProblemScreen';
import TrainingSessionScreen from './src/screens/TrainingSessionScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AuthScreen from './src/screens/AuthScreen';
import PaywallScreen from './src/screens/PaywallScreen';

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
  headerTitleStyle: { fontSize: 17, fontWeight: '600' as const, color: ui.ink },
  headerShadowVisible: false,
  headerTintColor: ui.accentSoft,
  headerBackTitleVisible: false,
};

function LearnNavigator() {
  return (
    <LearnStack.Navigator screenOptions={headerOptions}>
      <LearnStack.Screen
        name="LearnList"
        component={LearnScreen}
        options={{ title: 'Обучение' }}
      />
      <LearnStack.Screen
        name="Opening"
        component={OpeningScreen}
        options={{ title: 'Дебют' }}
      />
      <LearnStack.Screen
        name="TsumegoList"
        component={TsumegoListScreen}
        options={{ title: 'Задачи' }}
      />
      <LearnStack.Screen
        name="TsumegoProblem"
        component={TsumegoProblemScreen}
        options={{ title: 'Задача' }}
      />
      <LearnStack.Screen
        name="TrainingSession"
        component={TrainingSessionScreen}
        options={{ title: 'Тренировка' }}
      />
    </LearnStack.Navigator>
  );
}

function Tabs() {
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
          title: 'Игра',
          // the profile card is the header, as in the approved reference
          headerShown: false,
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>◉</Text>,
        }}
      />
      <Tab.Screen
        name="Learn"
        component={LearnNavigator}
        options={{
          title: 'Обучение',
          headerShown: false,
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>☰</Text>,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Настройки',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⚙︎</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

function Root() {
  const auth = useAuth();
  if (!auth.ready) return null; // splash while restoring the session
  if (!auth.signedIn) return <AuthScreen />;
  return (
    <RootStack.Navigator screenOptions={headerOptions}>
      <RootStack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <RootStack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ presentation: 'modal', title: 'Подписка' }}
      />
    </RootStack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Playfair: require('./assets/fonts/PlayfairDisplay.ttf'),
    InterV: require('./assets/fonts/Inter.ttf'),
  });
  if (!fontsLoaded) return null;
  return (
    <AuthProvider>
      <ThemeProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          <Root />
        </NavigationContainer>
      </ThemeProvider>
    </AuthProvider>
  );
}
