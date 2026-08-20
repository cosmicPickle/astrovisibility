import { StyleSheet, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import type {
  CapturedProofTile,
  OrientationSnapshot,
} from '../../capture/captureSession';
import {
  CAPTURE_HORIZONTAL_FIELD_OF_VIEW_DEGREES,
  CAPTURE_VERTICAL_FIELD_OF_VIEW_DEGREES,
  createGuidedCapturePlacement,
  guidedCaptureAltitudeStatus,
} from '../../capture/captureSession';
import { colors } from '../../theme/tokens';
import {
  captureCoverageXForAzimuth,
  captureCoverageYForAltitude,
  createCaptureCoverageFootprints,
  getCaptureCardinals,
} from './captureCoverageGeometry';

const WIDTH = 360;
const HEIGHT = 90;
const MAP_SIZE = { heightPixels: HEIGHT, widthPixels: WIDTH };
const FOOTPRINT_PADDING =
  Math.hypot(
    CAPTURE_HORIZONTAL_FIELD_OF_VIEW_DEGREES,
    CAPTURE_VERTICAL_FIELD_OF_VIEW_DEGREES,
  ) / 2;
const VIEW_HEIGHT = HEIGHT + FOOTPRINT_PADDING * 2;
const CAPTURED_FOOTPRINT_COLOR = '#47D16C';

const capturedFootprints = (tile: CapturedProofTile) =>
  createCaptureCoverageFootprints(tile.reviewedPlacement, MAP_SIZE);

const liveFootprints = (orientation: OrientationSnapshot) =>
  createCaptureCoverageFootprints(
    createGuidedCapturePlacement(orientation),
    MAP_SIZE,
  );

const liveFootprintColor = (orientation: OrientationSnapshot) =>
  guidedCaptureAltitudeStatus(createGuidedCapturePlacement(orientation)) ===
  'allowed'
    ? colors.primary
    : colors.danger;

const liveFootprintDescription = (orientation: OrientationSnapshot) =>
  guidedCaptureAltitudeStatus(createGuidedCapturePlacement(orientation)) ===
  'allowed'
    ? 'a blue live capture footprint'
    : 'a red out-of-range live capture footprint';

export const CaptureCoverageMap = ({
  orientation,
  tiles,
}: {
  orientation: OrientationSnapshot;
  tiles: readonly CapturedProofTile[];
}) => (
  <View
    accessibilityLabel={`Unfolded sky map with red cardinal directions, ${tiles.length} green captured footprints, and ${liveFootprintDescription(orientation)}`}
    style={styles.container}
  >
    <Svg
      height="100%"
      viewBox={`0 ${-FOOTPRINT_PADDING} ${WIDTH} ${VIEW_HEIGHT}`}
      width="100%"
    >
      {[0, 30, 60, 90].map((altitudeDegrees) => (
        <Line
          key={`alt-${altitudeDegrees}`}
          stroke={colors.outline}
          strokeWidth={1}
          x1={0}
          x2={WIDTH}
          y1={captureCoverageYForAltitude(altitudeDegrees, MAP_SIZE)}
          y2={captureCoverageYForAltitude(altitudeDegrees, MAP_SIZE)}
        />
      ))}
      {Array.from({ length: 9 }, (_, index) => index * 45).map(
        (azimuthDegrees) => (
          <Line
            key={`az-${azimuthDegrees}`}
            stroke={colors.outline}
            strokeWidth={1}
            x1={captureCoverageXForAzimuth(azimuthDegrees, MAP_SIZE)}
            x2={captureCoverageXForAzimuth(azimuthDegrees, MAP_SIZE)}
            y1={0}
            y2={HEIGHT}
          />
        ),
      )}
      {tiles.map((tile) => {
        return capturedFootprints(tile).map((footprint, index) => (
          <Rect
            fill={CAPTURED_FOOTPRINT_COLOR}
            fillOpacity={0.28}
            height={footprint.height}
            key={`${tile.id}-${index}`}
            stroke={CAPTURED_FOOTPRINT_COLOR}
            strokeWidth={2}
            transform={`rotate(${footprint.rotationDegrees} ${footprint.centerX} ${footprint.centerY})`}
            width={footprint.width}
            x={footprint.x}
            y={footprint.y}
          />
        ));
      })}
      {liveFootprints(orientation).map((footprint, index) => (
        <Rect
          fill={liveFootprintColor(orientation)}
          fillOpacity={0.14}
          height={footprint.height}
          key={`live-${index}`}
          stroke={liveFootprintColor(orientation)}
          strokeDasharray="5 3"
          strokeOpacity={0.9}
          strokeWidth={2}
          transform={`rotate(${footprint.rotationDegrees} ${footprint.centerX} ${footprint.centerY})`}
          width={footprint.width}
          x={footprint.x}
          y={footprint.y}
        />
      ))}
      {getCaptureCardinals(MAP_SIZE).map(({ label, x, y }) => (
        <SvgText
          fill={colors.danger}
          fontSize={14}
          fontWeight="800"
          key={label}
          textAnchor={label === 'N' ? 'start' : 'middle'}
          x={x}
          y={y}
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
    height: VIEW_HEIGHT,
    overflow: 'hidden',
    width: '100%',
  },
});
