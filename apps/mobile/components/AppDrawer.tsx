import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Pressable, Dimensions, StyleSheet } from 'react-native';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
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

type NavItem = { key: string; label: string; seg: string; href: string; icon: IconName };

// Mirrors the web sidebar groups. `key` is shared cross-platform so a hide toggle set
// on web/iOS applies consistently (users/{uid}.settings.sidebar.hidden).
const PRIMARY: NavItem[] = [
  { key: 'chat',      label: 'Chat',      seg: 'chat',      href: '/(app)/(tabs)/chat',      icon: 'auto-awesome' },
  { key: 'dashboard', label: 'Dashboard', seg: 'dashboard', href: '/(app)/(tabs)/dashboard', icon: 'dashboard' },
  { key: 'briefing',  label: 'Briefing',  seg: 'briefing',  href: '/(app)/(tabs)/briefing',  icon: 'wb-sunny' },
  { key: 'projects',  label: 'Projects',  seg: 'projects',  href: '/(app)/(tabs)/projects',  icon: 'folder' },
];
const WORKSPACE: NavItem[] = [
  { key: 'goals',     label: 'Goals',     seg: 'goals',     href: '/(app)/(tabs)/goals',     icon: 'flag' },
  { key: 'reminders', label: 'Reminders', seg: 'reminders', href: '/(app)/(tabs)/reminders', icon: 'checklist' },
  { key: 'group',     label: 'Group',     seg: 'group',     href: '/(app)/group',            icon: 'group' },
];
const BOTTOM: NavItem[] = [
  { key: 'capabilities', label: 'Connections', seg: 'connectors', href: '/(app)/connectors',      icon: 'hub' },
  { key: 'settings',     label: 'Settings',    seg: 'settings',   href: '/(app)/(tabs)/settings', icon: 'settings' },
];

// Live sidebar prefs (hidden items + workspace collapse) from Firestore, synced with web.
function useSidebarPrefs() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);

  useEffect(() => {
    if (!uid) { setHidden(new Set()); setWorkspaceCollapsed(false); return; }
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      const sb = snap.data()?.settings?.sidebar;
      setHidden(new Set(Array.isArray(sb?.hidden) ? sb.hidden : []));
      setWorkspaceCollapsed(!!sb?.workspaceCollapsed);
    });
    return unsub;
  }, [uid]);

  const toggleWorkspace = useCallback(() => {
    if (!uid) return;
    const next = !workspaceCollapsed;
    setWorkspaceCollapsed(next);
    void setDoc(doc(db, 'users', uid), { settings: { sidebar: { workspaceCollapsed: next } } }, { merge: true });
  }, [uid, workspaceCollapsed]);

  return { hidden, workspaceCollapsed, toggleWorkspace };
}

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
  const { hidden, workspaceCollapsed, toggleWorkspace } = useSidebarPrefs();

  const slideX   = useSharedValue(-WIDTH);
  const backdrop = useSharedValue(0);

  // Queued navigation to fire after the drawer fully closes (eliminates flash through the sliding panel).
  const afterCloseRef = useRef<(() => void) | null>(null);
  const runAfterClose = useCallback(() => {
    const fn = afterCloseRef.current;
    afterCloseRef.current = null;
    fn?.();
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    slideX.value   = withTiming(0, { duration: 350, easing: Easing.bezier(0.05, 0.7, 0.1, 1.0) });
    backdrop.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [slideX, backdrop]);

  const close = useCallback(() => {
    slideX.value   = withTiming(-WIDTH, { duration: 280, easing: Easing.bezier(0.4, 0, 0.6, 1) }, (finished) => {
      if (finished) runOnJS(runAfterClose)();
    });
    backdrop.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setIsOpen)(false);
    });
  }, [slideX, backdrop, runAfterClose]);

  const slideStyle    = useAnimatedStyle(() => ({ transform: [{ translateX: slideX.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  function go(href: string) {
    haptics.select();
    // Navigate AFTER the drawer is fully closed so the screen switch is hidden behind the sliding panel.
    // lazy={false} in the Tabs layout ensures all screens are pre-rendered — no mount delay on arrival.
    afterCloseRef.current = () => router.navigate(href as never);
    close();
  }

  const renderRow = (item: NavItem) => {
    const active = pathname === `/${item.seg}`;
    return (
      <TouchableOpacity
        key={item.key}
        activeOpacity={0.7}
        onPress={() => go(item.href)}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 16,
          paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12,
          backgroundColor: active ? `${c.brand}18` : 'transparent',
        }}
      >
        <Icon name={item.icon} size={22} color={active ? c.brand : c.muted} />
        <Text style={{ fontSize: 15, letterSpacing: 0.3, color: active ? c.brand : c.text, fontWeight: active ? '600' : '500' }}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  // Chat + Settings are never hideable; everything else respects `hidden`.
  const visibleWorkspace = WORKSPACE.filter(i => !hidden.has(i.key));

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
                  {/* Primary group */}
                  {PRIMARY.filter(i => i.key === 'chat' || !hidden.has(i.key)).map(renderRow)}

                  {/* Workspace group — collapsible */}
                  {visibleWorkspace.length > 0 && (
                    <>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={toggleWorkspace}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}
                      >
                        <Text style={{ flex: 1, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600', color: c.muted }}>
                          Workspace
                        </Text>
                        <Icon name={workspaceCollapsed ? 'chevron-right' : 'expand-more'} size={18} color={c.muted} />
                      </TouchableOpacity>
                      {!workspaceCollapsed && visibleWorkspace.map(renderRow)}
                    </>
                  )}

                  {/* Bottom group — Connections + Settings */}
                  <View style={{ height: 1, backgroundColor: c.border, marginVertical: 8, marginHorizontal: 4 }} />
                  {BOTTOM.filter(i => i.key === 'settings' || !hidden.has(i.key)).map(renderRow)}
                </View>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </View>
    </DrawerCtx.Provider>
  );
}
