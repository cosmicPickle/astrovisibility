import { Circle, Path, Svg } from 'react-native-svg';

import { colors } from '../../theme/tokens';

export type AppIconName = 'eye' | 'info' | 'search';

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
    {name === 'eye' ? (
      <>
        <Path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <Circle cx="12" cy="12" r="3" />
      </>
    ) : name === 'search' ? (
      <>
        <Circle cx="11" cy="11" r="6.5" />
        <Path d="m16 16 4.5 4.5" />
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
