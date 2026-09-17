import { Circle, Path, Svg } from 'react-native-svg';

import { colors } from '../../theme/tokens';

export type AppIconName =
  | 'brush'
  | 'eraser'
  | 'wand'
  | 'hand'
  | 'conditions'
  | 'eye'
  | 'filter'
  | 'info'
  | 'nextDay'
  | 'previousDay'
  | 'restore'
  | 'search'
  | 'telescope';

export const AppIcon = ({
  color = colors.text,
  name,
  size = 24,
}: Readonly<{
  color?: string;
  name: AppIconName;
  size?: number;
}>) => (
  <Svg
    fill="none"
    height={size}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={size}
  >
    {name === 'brush' ? (
      <Path d="m14 4 6 6M8 14 18 4a2 2 0 0 1 3 3L11 17M8 14c-4-1-5 2-5 6 4 0 7-1 6-5Z" />
    ) : name === 'eraser' ? (
      <Path d="m4 12 9-9a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-9 9H8l-4-4a3 3 0 0 1 0-4Zm5-5 8 8M12 20h9" />
    ) : name === 'wand' ? (
      <Path d="m4 20 13-13 3 3L7 23ZM14 10l3 3M6 2v4M4 4h4M19 1v4M17 3h4M3 10v4M1 12h4" />
    ) : name === 'hand' ? (
      <Path d="M8 12V5a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-6a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v7c0 5-3 7-6 7h-2c-2 0-3-1-4-3l-4-6c-1-2 1-3 2-2l2 2" />
    ) : name === 'conditions' ? (
      <>
        <Path d="M4 6h6m4 0h6" />
        <Circle cx="12" cy="6" r="2" />
        <Path d="M4 12h10m4 0h2" />
        <Circle cx="16" cy="12" r="2" />
        <Path d="M4 18h3m4 0h9" />
        <Circle cx="9" cy="18" r="2" />
      </>
    ) : name === 'eye' ? (
      <>
        <Path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <Circle cx="12" cy="12" r="3" />
      </>
    ) : name === 'filter' ? (
      <Path d="M3 4h18l-7 8v7l-4 2v-9L3 4Z" />
    ) : name === 'search' ? (
      <>
        <Circle cx="11" cy="11" r="6.5" />
        <Path d="m16 16 4.5 4.5" />
      </>
    ) : name === 'telescope' ? (
      <>
        <Path d="m3 9 12-4 2 6-12 4-2-6Z" />
        <Path d="m16 7 3-1 1 4-3 1" />
        <Path d="M10 13v3m0 0-3 5m3-5 3 5" />
      </>
    ) : name === 'restore' ? (
      <>
        <Path d="M4 4v6h6" />
        <Path d="M5.3 9.2A8 8 0 1 1 6 18" />
      </>
    ) : name === 'previousDay' ? (
      <>
        <Path d="M6 5v14" />
        <Path d="m18 5-9 7 9 7V5Z" />
      </>
    ) : name === 'nextDay' ? (
      <>
        <Path d="M18 5v14" />
        <Path d="m6 5 9 7-9 7V5Z" />
      </>
    ) : (
      <>
        <Circle cx="12" cy="12" r="9" />
        <Path d="M12 10.5v6" />
        <Path d="M12 7.5h.01" />
      </>
    )}
  </Svg>
);
