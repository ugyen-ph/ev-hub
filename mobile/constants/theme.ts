/**
 * EV Hub brand palette — light & dark mode.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0E9F6E';
const tintColorDark = '#34D399';

export const Colors = {
  light: {
    text: '#0F1A17',
    background: '#F7FAF9',
    tint: tintColorLight,
    icon: '#5C6B66',
    tabIconDefault: '#8A9B95',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#E8F5F0',
    background: '#0C1512',
    tint: tintColorDark,
    icon: '#7E8F89',
    tabIconDefault: '#5C6B66',
    tabIconSelected: tintColorDark,
  },
};

/** Core brand colors shared across screens. */
export const Brand = {
  primary: '#0E9F6E',
  primaryLight: '#34D399',
  dark: '#0C1512',
  card: '#FFFFFF',
  accent: '#14B8A6',
};

/**
 * Charger status colors — deliberately mirrors OCPP 1.6 ChargePointStatus
 * (Available / Occupied / Faulted / Unavailable) so Phase 2 maps 1:1.
 */
export const StatusColors = {
  available: '#10B981',
  reserved: '#F59E0B',
  busy: '#EF4444',
  faulted: '#DC2626',
  offline: '#9CA3AF',
} as const;

export type ChargerStatus = keyof typeof StatusColors;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
