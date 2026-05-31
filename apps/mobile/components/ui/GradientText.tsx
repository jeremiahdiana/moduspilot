import { Text, TextStyle, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENTS } from '@/lib/theme';

/**
 * Text filled with the brand headline gradient (matches web's animated headline
 * `#a78bfa → #7c3aed → #c084fc → #818cf8`). The Text is used as a mask over a
 * LinearGradient. Keep to short headlines/wordmarks — gradient fills don't wrap
 * as predictably as plain Text.
 */
export function GradientText({
  children,
  style,
  className,
  colors = GRADIENTS.headline,
}: {
  children: string;
  style?: TextStyle;
  className?: string;
  colors?: readonly [string, string, ...string[]];
}) {
  return (
    <MaskedView
      maskElement={
        <Text className={className} style={[{ backgroundColor: 'transparent' }, style]}>
          {children}
        </Text>
      }
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }}>
        {/* Transparent copy sizes the gradient to the text bounds. */}
        <Text className={className} style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

/** A small View wrapper so gradient text aligns cleanly in rows. */
export function GradientTextRow({ children }: { children: React.ReactNode }) {
  return <View className="flex-row">{children}</View>;
}
