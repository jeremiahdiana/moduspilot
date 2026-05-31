import { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Pressable, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon, type IconName } from '@/components/Icon';
import { GRADIENTS, useThemeColors } from '@/lib/theme';
import { GradientText } from '@/components/ui/GradientText';
import { haptics } from '@/lib/haptics';

const WIDTH = Math.min(300, Dimensions.get('window').width * 0.82);

const NAV: { label: string; seg: string; href: string; icon: IconName }[] = [
  { label: 'Dashboard', seg: 'dashboard', href: '/(app)/dashboard', icon: 'dashboard' },
  { label: 'Briefing', seg: 'briefing', href: '/(app)/briefing', icon: 'wb-sunny' },
  { label: 'Chat',     seg: 'chat',     href: '/(app)/chat',     icon: 'auto-awesome' },
  { label: 'Goals',    seg: 'goals',    href: '/(app)/goals',    icon: 'flag' },
  { label: 'Tasks',    seg: 'tasks',    href: '/(app)/tasks',    icon: 'checklist' },
  { label: 'Habits',   seg: 'habits',   href: '/(app)/habits',   icon: 'local-fire-department' },
  { label: 'Projects', seg: 'projects', href: '/(app)/projects', icon: 'folder' },
  { label: 'Settings', seg: 'settings', href: '/(app)/settings', icon: 'settings' },
];

const DrawerCtx = createContext<{ open: () => void; close: () => void }>({ open: () => {}, close: () => {} });
export const useDrawer = () => useContext(DrawerCtx);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const slide = useRef(new Animated.Value(-WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const pathname = usePathname();
  const c = useThemeColors();

  const open = useCallback(() => {
    setMounted(true);
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [slide, fade]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: -WIDTH, duration: 240, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) setMounted(false); });
  }, [slide, fade]);

  function go(href: string) {
    haptics.select();
    close();
    // Let the close animation start before swapping routes.
    setTimeout(() => router.replace(href as never), 60);
  }

  return (
    <DrawerCtx.Provider value={{ open, close }}>
      <View className="flex-1">
        {children}

        {mounted && (
          <View className="absolute inset-0" style={{ zIndex: 50 }}>
            <Animated.View style={{ opacity: fade }} className="absolute inset-0">
              <Pressable className="flex-1 bg-black/60" onPress={close} />
            </Animated.View>

            <Animated.View
              style={{ transform: [{ translateX: slide }], width: WIDTH }}
              className="absolute inset-y-0 left-0 bg-surface border-r border-border"
            >
              <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
                <View className="flex-1 px-5 pt-6 pb-4">
                  <View className="flex-row items-center justify-between mb-10 px-1">
                    <View className="flex-row items-center gap-2.5">
                      <LinearGradient
                        colors={GRADIENTS.brand}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text className="text-white font-black text-lg">M</Text>
                      </LinearGradient>
                      <GradientText className="text-2xl font-black tracking-widest">MODUS</GradientText>
                    </View>
                    <TouchableOpacity onPress={close} className="p-1.5 rounded-full" activeOpacity={0.7}>
                      <Icon name="close" tone="muted" size={22} />
                    </TouchableOpacity>
                  </View>

                  <View className="gap-1.5">
                    {NAV.map(item => {
                      const active = pathname === `/${item.seg}`;
                      const row = (
                        <View className="flex-row items-center gap-4 px-4 py-3.5">
                          <Icon name={item.icon} size={22} color={active ? '#fff' : c.muted} />
                          <Text className={`text-[15px] tracking-wide ${active ? 'text-white font-bold' : 'text-text font-medium'}`}>
                            {item.label}
                          </Text>
                        </View>
                      );
                      return (
                        <TouchableOpacity key={item.seg} activeOpacity={0.8} onPress={() => go(item.href)}>
                          {active ? (
                            <LinearGradient
                              colors={GRADIENTS.brand}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={{ borderRadius: 16 }}
                            >
                              {row}
                            </LinearGradient>
                          ) : (
                            row
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </SafeAreaView>
            </Animated.View>
          </View>
        )}
      </View>
    </DrawerCtx.Provider>
  );
}
