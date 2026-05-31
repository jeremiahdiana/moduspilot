import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColors } from '@/lib/theme';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];
type Tone = 'text' | 'muted' | 'brand' | 'white';

export function Icon({
  name,
  size = 24,
  tone = 'text',
  color,
}: {
  name: IconName;
  size?: number;
  tone?: Tone;
  color?: string;
}) {
  const c = useThemeColors();
  const toneColor =
    tone === 'muted' ? c.muted : tone === 'brand' ? c.brand : tone === 'white' ? c.white : c.text;
  return <MaterialIcons name={name} size={size} color={color ?? toneColor} />;
}

export type { IconName };
