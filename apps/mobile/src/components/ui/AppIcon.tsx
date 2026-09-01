import { Circle, Path, Svg } from 'react-native-svg';

import { colors } from '../../theme/tokens';

export type AppIconName =
  | 'conditions'
  | 'eye'
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
    {name === 'conditions' ? (
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
