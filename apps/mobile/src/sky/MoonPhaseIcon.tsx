import { Circle, Path, Svg } from 'react-native-svg';

import { colors } from '../theme/tokens';

const createIlluminatedPath = (phaseDegrees: number, size: number) => {
  const normalizedPhase = ((phaseDegrees % 360) + 360) % 360;
  const waxing = normalizedPhase <= 180;
  const symmetricPhaseDegrees = waxing
    ? normalizedPhase
    : 360 - normalizedPhase;
  const radius = size * 0.39;
  const center = size / 2;
  const terminatorScale = Math.cos((symmetricPhaseDegrees * Math.PI) / 180);
  const sampleCount = 24;
  const edge: string[] = [];
  const terminator: string[] = [];
  for (let index = 0; index <= sampleCount; index += 1) {
    const y = -radius + (index / sampleCount) * radius * 2;
    const halfWidth = Math.sqrt(Math.max(0, radius * radius - y * y));
    const edgeX = waxing ? halfWidth : -halfWidth;
    const terminatorX = waxing
      ? terminatorScale * halfWidth
      : -terminatorScale * halfWidth;
    edge.push(`${center + edgeX} ${center + y}`);
    terminator.unshift(`${center + terminatorX} ${center + y}`);
  }
  return `M ${edge.join(' L ')} L ${terminator.join(' L ')} Z`;
};

export function MoonPhaseIcon({
  phaseDegrees,
  size = 42,
}: Readonly<{ phaseDegrees: number; size?: number }>) {
  const radius = size * 0.39;
  return (
    <Svg
      accessibilityLabel="Moon phase"
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
    >
      <Circle
        cx={size / 2}
        cy={size / 2}
        fill="#060912"
        r={radius}
        stroke={colors.mutedText}
        strokeWidth={1.5}
      />
      <Path d={createIlluminatedPath(phaseDegrees, size)} fill="#dbe8ff" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={radius}
        stroke={colors.mutedText}
        strokeWidth={1.5}
      />
    </Svg>
  );
}
