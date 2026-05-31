import { TouchableOpacity } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Icon } from '@/components/Icon';
import { haptics } from '@/lib/haptics';

/**
 * Swipe a row left to reveal a Delete button. Tapping it runs `onDelete`
 * (which removes the item → the row unmounts, so no manual close needed).
 * Requires GestureHandlerRootView at the app root (app/_layout.tsx).
 */
export function SwipeToDelete({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <TouchableOpacity
          onPress={() => { haptics.warning(); onDelete(); }}
          activeOpacity={0.85}
          className="bg-red-500 rounded-3xl items-center justify-center ml-2"
          style={{ width: 76 }}
        >
          <Icon name="delete-outline" color="#fff" size={24} />
        </TouchableOpacity>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
