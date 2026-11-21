import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router/js-tabs';
import { Gift, Home, ListChecks, Target, Users } from 'lucide-react-native';
import { colors, fonts, motion } from '@/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';

/** Bottom tabs in spec order: Home, Habits, Quests, Family, Rewards. */
export default function TabsLayout() {
  const reduceMotion = useReduceMotion();

  return (
    <Tabs
      screenListeners={{ tabPress: () => void Haptics.selectionAsync() }}
      screenOptions={{
        headerShown: false,
        animation: reduceMotion ? 'none' : 'fade',
        transitionSpec: { animation: 'timing', config: { duration: motion.tab } },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.secondary,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 12 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Нүүр',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Дадал',
          tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="quests"
        options={{
          title: 'Даалгавар',
          tabBarIcon: ({ color, size }) => <Target color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: 'Гэр бүл',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Шагнал',
          tabBarIcon: ({ color, size }) => <Gift color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
