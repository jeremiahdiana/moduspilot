import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Icon } from '@/components/Icon';
import { ProviderLogo } from '@/components/BrandLogo';
import { useThemeColors } from '@/lib/theme';
import { PLATFORM_MODELS, effectivePlan, modelName } from '@/lib/models';

interface Props {
  /** 'auto' | a model id | 'default' (BYOK) */
  value: string;
  onChange: (value: string) => void;
  plan: string;
}

function label(value: string): string {
  if (value === 'auto' || !value) return 'Auto';
  if (value === 'default') return 'Default';
  return modelName(value);
}

export function ModelSwitcher({ value, onChange, plan }: Props) {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);
  const ep = effectivePlan(plan);
  const isAuto = value === 'auto' || !value;

  function select(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full border border-border bg-surface"
      >
        {isAuto && <Icon name="auto-awesome" size={13} color={c.brand} />}
        <Text className={`text-xs font-medium ${isAuto ? 'text-brand' : 'text-text'}`} numberOfLines={1} style={{ maxWidth: 120 }}>
          {label(value)}
        </Text>
        <Icon name="expand-more" size={15} color={c.muted} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View className="flex-1 bg-black/40">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setOpen(false)} />
          <View className="bg-bg rounded-t-3xl border-t border-border" style={{ maxHeight: '75%' }}>
            <View className="px-5 pt-4 pb-3 border-b border-border">
              <Text className="text-text font-bold text-lg">Model</Text>
              <Text className="text-muted text-xs mt-0.5">Pick a model, or let MODUS choose per task.</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding: 12, gap: 6 }}>
              {/* Auto */}
              <TouchableOpacity
                onPress={() => select('auto')}
                activeOpacity={0.7}
                className={`flex-row items-center gap-3 px-4 py-3 rounded-2xl border ${isAuto ? 'bg-brand/10 border-brand/30' : 'bg-surface border-border'}`}
              >
                <Icon name="auto-awesome" size={18} color={c.brand} />
                <View className="flex-1">
                  <Text className={`text-sm font-semibold ${isAuto ? 'text-brand' : 'text-text'}`}>Auto</Text>
                  <Text className="text-muted text-xs">MODUS picks the best model for each task</Text>
                </View>
                {isAuto && <Icon name="check" size={18} color={c.brand} />}
              </TouchableOpacity>

              {PLATFORM_MODELS.map(m => {
                const locked = !m.plans.includes(ep);
                const selected = value === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    disabled={locked}
                    onPress={() => select(m.id)}
                    activeOpacity={locked ? 1 : 0.7}
                    className={`flex-row items-center gap-3 px-4 py-3 rounded-2xl border ${
                      locked ? 'bg-surface border-border opacity-50' :
                      selected ? 'bg-brand/10 border-brand/30' : 'bg-surface border-border'
                    }`}
                  >
                    <View className="w-8 h-8 rounded-lg bg-surface-2 border border-border items-center justify-center">
                      <ProviderLogo provider={m.provider} size={16} />
                    </View>
                    <View className="flex-1">
                      <Text className={`text-sm font-semibold ${selected ? 'text-brand' : 'text-text'}`}>{m.name}</Text>
                      <Text className="text-muted text-xs">{m.provider}</Text>
                    </View>
                    {locked ? (
                      <View className="px-2 py-0.5 rounded-full bg-surface-2 border border-border">
                        <Text className="text-muted text-[10px] font-semibold">
                          {m.plans.includes('modus') ? 'MODUS+' : 'PILOT'}
                        </Text>
                      </View>
                    ) : selected ? (
                      <Icon name="check" size={18} color={c.brand} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
