import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from './src/theme/ThemeContext';
import PlayScreen from './src/screens/PlayScreen';
import LearnScreen from './src/screens/LearnScreen';
import OpeningScreen from './src/screens/OpeningScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const LearnStack = createNativeStackNavigator();

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
    </LearnStack.Navigator>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="dark" />
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
      </NavigationContainer>
    </ThemeProvider>
  );
}
