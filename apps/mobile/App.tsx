import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
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
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#FBF8F1',
    card: '#F3EDDF',
    text: '#2A2118',
    primary: '#B23A2B',
    border: '#E0D6C2',
  },
};

function LearnNavigator() {
  return (
    <LearnStack.Navigator>
      <LearnStack.Screen
        name="LearnList"
        component={LearnScreen}
        options={{ title: 'Обучение: дебюты' }}
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
        tabBarActiveTintColor: '#B23A2B',
        tabBarInactiveTintColor: '#8A7B65',
      }}
    >
      <Tab.Screen
        name="Play"
        component={PlayScreen}
        options={{
          title: 'Игра',
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
    <RootStack.Navigator>
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
  return (
    <AuthProvider>
      <ThemeProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="dark" />
          <Root />
        </NavigationContainer>
      </ThemeProvider>
    </AuthProvider>
  );
}
