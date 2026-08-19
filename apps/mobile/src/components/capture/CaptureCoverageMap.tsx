import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';

import type {
  CapturedProofTile,
  OrientationSnapshot,
  TileCenterSuggestion,
} from '../../capture/captureSession';
import { normalizeAzimuthDegrees } from '../../sky/projection';
import { colors } from '../../theme/tokens';

const WIDTH = 320;
const HEIGHT = 92;

const xForAzimuth = (azimuthDegrees: number) =>
  (normalizeAzimuthDegrees(azimuthDegrees) / 360) * WIDTH;
const yForAltitude = (altitudeDegrees: number) =>
  ((90 - altitudeDegrees) / 90) * HEIGHT;

export const CaptureCoverageMap = ({
  orientation,
  suggestion,
  tiles,
}: {
  orientation: OrientationSnapshot;
  suggestion?: TileCenterSuggestion | null;
  tiles: readonly CapturedProofTile[];
}) => (
  <View
    accessibilityLabel={`${tiles.length} captured panorama tiles in angular coverage map`}
    style={styles.container}
  >
    <Svg height="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%">
      {[0, 30, 60, 90].map((altitudeDegrees) => (
        <Rect
          fill="transparent"
          height={0.5}
          key={altitudeDegrees}
          stroke={colors.outline}
          width={WIDTH}
          x={0}
          y={yForAltitude(altitudeDegrees)}
        />
      ))}
      {tiles.map((tile) => {
        const placement = tile.reviewedPlacement;
        const width = (placement.horizontalFieldOfViewDegrees / 360) * WIDTH;
        const height = (placement.verticalFieldOfViewDegrees / 90) * HEIGHT;
        return (
          <Rect
            fill={colors.primary}
            fillOpacity={0.22}
            height={height}
            key={tile.id}
            stroke={colors.primary}
            width={width}
            x={xForAzimuth(placement.centerAzimuthDegrees) - width / 2}
            y={yForAltitude(placement.centerAltitudeDegrees) - height / 2}
          />
        );
      })}
      {suggestion ? (
        <Circle
          cx={xForAzimuth(suggestion.azimuthDegrees)}
          cy={yForAltitude(suggestion.altitudeDegrees)}
          fill="transparent"
          r={6}
          stroke={colors.warning}
          strokeDasharray="3 2"
          strokeWidth={2}
        />
      ) : null}
      <Circle
        cx={xForAzimuth(orientation.trueHeadingDegrees)}
        cy={yForAltitude(orientation.estimatedAltitudeDegrees)}
        fill={colors.spaceViolet}
        r={4}
        stroke={colors.text}
      />
      {['N', 'E', 'S', 'W'].map((label, index) => (
        <SvgText
          fill={colors.mutedText}
          fontSize={8}
          key={label}
          textAnchor="middle"
          x={(index / 4) * WIDTH + (index === 0 ? 5 : 0)}
          y={10}
        >
          {label}
        </SvgText>
      ))}
    </Svg>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.backdrop,
    borderColor: colors.outline,
    borderRadius: 6,
    borderWidth: 1,
    height: HEIGHT,
    overflow: 'hidden',
    width: '100%',
  },
});
