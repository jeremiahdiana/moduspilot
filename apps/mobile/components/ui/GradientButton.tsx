import { ActivityIndicator, Pressable, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENTS, useThemeColors } from '@/lib/theme';
import { Icon, type IconName } from '@/components/Icon';

/**
 * Primary action button with the brand gradient fill (matches web's
 * `#8b5cf6 → #7c3aed → #6d28d9`). `variant="outline"` renders a bordered/ghost
 * button instead. Press scales slightly for tactile feedback.
 */
export function GradientButton({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  variant = 'solid',
  size = 'md',
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'solid' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}) {
  const c = useThemeColors();
  const pad = size === 'sm' ? 'py-2 px-3.5' : size === 'lg' ? 'py-4 px-6' : 'py-3 px-5';
  const text = size === 'sm' ? 'text-sm' : 'text-base';
  const isDisabled = disabled || loading;

  const inner = (
    <View className={`flex-row items-center justify-center gap-2 ${pad}`}>
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'solid' ? '#fff' : c.brand} />
      ) : (
        <>
          {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} color={variant === 'solid' ? '#fff' : c.brand} />}
          <Text className={`font-semibold ${text}`} style={{ color: variant === 'solid' ? '#fff' : c.brand }}>
            {label}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [{ opacity: isDisabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }, style]}
    >
      {variant === 'solid' ? (
        <LinearGradient
          colors={GRADIENTS.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 16, overflow: 'hidden' }}
        >
          {inner}
        </LinearGradient>
      ) : (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
          {inner}
        </View>
      )}
    </Pressable>
  );
}
