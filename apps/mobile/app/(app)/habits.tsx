import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HabitsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="px-5 py-3 border-b border-border">
        <Text className="text-xl font-black text-text">Habits</Text>
      </View>
      <View className="flex-1 items-center justify-center gap-2">
        <Text className="text-text font-semibold">Coming soon</Text>
        <Text className="text-muted text-sm">Ask MODUS in chat to track habits</Text>
      </View>
    </SafeAreaView>
  );
}
