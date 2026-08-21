import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppProvider } from '../src/components/ui/AppProvider';
import { StorageBootstrap } from '../src/components/storage/StorageBootstrap';
import { colors } from '../src/theme/tokens';

export default function RootLayout() {
  return (
    <AppProvider>
      <StorageBootstrap>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="profiles/new"
            options={{ title: 'New profile' }}
          />
          <Stack.Screen
            name="profiles/[id]/edit"
            options={{ title: 'Edit profile' }}
          />
          <Stack.Screen
            name="profiles/[id]/sky"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="profiles/[id]/targets"
            options={{ title: 'All targets' }}
          />
          <Stack.Screen
            name="profiles/[id]/capture-panorama"
            options={{ title: 'Capture panorama' }}
          />
          <Stack.Screen
            name="profiles/[id]/mask"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="equipment/new"
            options={{ title: 'New imaging setup' }}
          />
          <Stack.Screen
            name="equipment/[id]/edit"
            options={{ title: 'Edit imaging setup' }}
          />
          <Stack.Screen
            name="licences"
            options={{ title: 'About · licences' }}
          />
        </Stack>
      </StorageBootstrap>
    </AppProvider>
  );
}
