import { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Pressable, Dimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useColorScheme } from 'nativewind';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing,
} from 'react-native-reanimated';
import { Icon, type IconName } from '@/components/Icon';
import { useThemeColors } from '@/lib/theme';
import { GradientText } from '@/components/ui/GradientText';
import { Logo } from '@/components/ui/Logo';
import { haptics } from '@/lib/haptics';

const WIDTH = Math.min(300, Dimensions.get('window').width * 0.82);

const NAV: { label: string; seg: string; href: string; icon: IconName }[] = [
  { label: 'Dashboard', seg: 'dashboard', href: '/(app)/dashboard', icon: 'dashboard' },
  { label: 'Briefing',  seg: 'briefing',  href: '/(app)/briefing',  icon: 'wb-sunny' },
  { label: 'Chat',      seg: 'chat',      href: '/(app)/chat',      icon: 'auto-awesome' },
  { label: 'Goals',     seg: 'goals',     href: '/(app)/goals',     icon: 'flag' },
  { label: 'Reminders', seg: 'reminders', href: '/(app)/reminders', icon: 'checklist' },
  { label: 'Projects',  seg: 'projects',  href: '/(app)/projects',  icon: 'folder' },
  { label: 'Settings',  seg: 'settings',  href: '/(app)/settings',  icon: 'settings' },
];

const DrawerCtx = createContext<{ open: () => void; close: () => void }>({ open: () => {}, close: () => {} });
export const useDrawer = () => useContext(DrawerCtx);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  // isOpen drives pointerEvents — the drawer itself is always mounted so
  // BlurView is pre-rendered and the animation starts on the first frame.
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const c = useThemeColors();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';

  const slideX   = useSharedValue(-WIDTH);
  const backdrop = useSharedValue(0);

  const open = useCallback(() => {
    setIsOpen(true);
    // Material "emphasized decelerate" — fast start, gentle settle into place
    slideX.value   = withTiming(0,    { duration: 300, easing: Easing.bezier(0.05, 0.7, 0.1, 1.0) });
    backdrop.value = withTiming(1,    { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [slideX, backdrop]);

  const close = useCallback(() => {
    // Material "emphasized accelerate" — smooth pickup, decisive exit
    slideX.value   = withTiming(-WIDTH, { duration: 240, easing: Easing.bezier(0.3, 0, 0.8, 0.15) });
    backdrop.value = withTiming(0,      { duration: 220, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setIsOpen)(false);
    });
  }, [slideX, backdrop]);

  const slideStyle    = useAnimatedStyle(() => ({ transform: [{ translateX: slideX.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  function go(href: string) {
    haptics.select();
    close();
    router.replace(href as never);
  }

  return (
    <DrawerCtx.Provider value={{ open, close }}>
      <View style={{ flex: 1 }}>
        {children}

        {/* Always mounted — pointerEvents blocks touches when closed */}
        <View
          style={[StyleSheet.absoluteFill, { zIndex: 50 }]}
          pointerEvents={isOpen ? 'box-none' : 'none'}
        >
          {/* Backdrop */}
          <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents={isOpen ? 'auto' : 'none'}>
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={close} />
          </Animated.View>

          {/* Drawer panel */}
          <Animated.View
            style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: WIDTH, overflow: 'hidden' }, slideStyle]}
            className="border-r border-border"
          >
            <BlurView intensity={dark ? 45 : 65} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(17,17,24,0.5)' : 'rgba(255,255,255,0.55)' }]} />
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
              <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40, paddingHorizontal: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Logo width={34} />
                    <GradientText className="text-2xl font-black tracking-widest">MODUS</GradientText>
                  </View>
                  <TouchableOpacity onPress={close} style={{ padding: 6, borderRadius: 999 }} activeOpacity={0.7}>
                    <Icon name="close" tone="muted" size={22} />
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 4 }}>
                  {NAV.map(item => {
                    const active = pathname === `/${item.seg}`;
                    return (
                      <TouchableOpacity
                        key={item.seg}
                        activeOpacity={0.7}
                        onPress={() => go(item.href)}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 16,
                          paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12,
                          backgroundColor: active ? `${c.brand}18` : 'transparent',
                        }}
                      >
                        <Icon name={item.icon} size={22} color={active ? c.brand : c.muted} />
                        <Text style={{
                          fontSize: 15, letterSpacing: 0.3,
                          color: active ? c.brand : c.text,
                          fontWeight: active ? '600' : '500',
                        }}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </View>
    </DrawerCtx.Provider>
  );
}
