import { useMemo } from 'react';
import {
  Canvas,
  Circle,
  DashPathEffect,
  Fill,
  Group,
  ImageShader,
  matchFont,
  Oval,
  Path,
  Skia,
  Text,
  Vertices,
  useImage,
  vec,
  type SkFont,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { SelectedTargetTrajectory } from '../astronomy/trajectory';
import type { TargetDiurnalOrbit } from '../astronomy/diurnalTrajectory';
import type { VisibilityMask } from '../mask/visibilityMask';
import type { EquipmentRecord } from '../storage/equipmentRepository';
import type { ActivePanoramaTile } from '../storage/panoramaDraftRepository';
import { colors } from '../theme/tokens';
import type { ViewportCatalogueTarget } from './catalogueViewport';
import {
  angularSizeDegreesToPixelsAtDirection,
  densifyHorizontalPath,
  getPlanetariumCameraCenter,
  projectHorizontalDirection,
  type PlanetariumCamera,
} from './planetariumProjection';
import { createPlanetariumPanoramaMesh } from './planetariumPanoramaGeometry';
import { createScreenCenteredFieldOfViewFrame } from './fieldOfViewGeometry';
import {
  CARDINAL_LABEL_FONT_SIZE_PIXELS,
  CARDINAL_LABELS,
  createHorizonDirections,
  shouldInvertGroundClip,
} from './planetariumGround';
import type {
  CanvasSizePixels,
  HorizontalDirectionDegrees,
} from './projection';
import { createProjectedTrajectoryGroups } from './planetariumTrajectory';

const targetFont = matchFont({
  fontFamily: 'sans-serif',
  fontSize: 11,
  fontWeight: '700',
});
const secondaryFont = matchFont({ fontFamily: 'sans-serif', fontSize: 9 });
const guideFont = matchFont({
  fontFamily: 'sans-serif',
  fontSize: 11,
  fontWeight: '700',
});
const markerFont = matchFont({
  fontFamily: 'sans-serif',
  fontSize: 9,
  fontWeight: '700',
});
const cardinalFont = matchFont({
  fontFamily: 'sans-serif',
  fontSize: CARDINAL_LABEL_FONT_SIZE_PIXELS,
  fontWeight: '900',
});

const angularSizeToPixels = (
  angularSizeDegrees: number,
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
) => {
  'worklet';
  return (
    (angularSizeDegrees / camera.fieldOfViewDegrees) *
    Math.min(canvas.widthPixels, canvas.heightPixels)
  );
};

const createPath = (
  directions: readonly HorizontalDirectionDegrees[],
  camera: PlanetariumCamera,
  canvas: CanvasSizePixels,
  closed: boolean,
) => {
  'worklet';
  const builder = Skia.PathBuilder.Make();
  let drawing = false;
  let previousX = 0;
  let previousY = 0;
  const discontinuityPixels = Math.hypot(
    canvas.widthPixels,
    canvas.heightPixels,
  );
  for (const direction of directions) {
    const point = projectHorizontalDirection(direction, camera, canvas);
    const discontinuity =
      drawing &&
      Math.hypot(point.xPixels - previousX, point.yPixels - previousY) >
        discontinuityPixels;
    if (!drawing || discontinuity) {
      builder.moveTo(point.xPixels, point.yPixels);
      drawing = true;
    } else {
      builder.lineTo(point.xPixels, point.yPixels);
    }
    previousX = point.xPixels;
    previousY = point.yPixels;
  }
  if (closed && drawing) builder.close();
  return builder.build();
};

function ProjectedPath({
  camera,
  canvas,
  closed = false,
  color,
  dash,
  directions,
  fillOpacity,
  strokeOpacity = 1,
  strokeWidth = 1,
}: {
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
  closed?: boolean;
  color: string;
  dash?: readonly number[];
  directions: readonly HorizontalDirectionDegrees[];
  fillOpacity?: number;
  strokeOpacity?: number;
  strokeWidth?: number | SharedValue<number>;
}) {
  const path = useDerivedValue(() =>
    createPath(directions, camera.value, canvas, closed),
  );
  return (
    <>
      {fillOpacity === undefined ? null : (
        <Path color={color} opacity={fillOpacity} path={path} style="fill" />
      )}
      <Path
        color={color}
        opacity={strokeOpacity}
        path={path}
        strokeCap="round"
        strokeJoin="round"
        strokeWidth={strokeWidth}
        style="stroke"
      >
        {dash ? <DashPathEffect intervals={[...dash]} /> : null}
      </Path>
    </>
  );
}

function ProjectedMultiPath({
  camera,
  canvas,
  color,
  dash,
  lines,
  strokeOpacity = 1,
}: {
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
  color: string;
  dash?: readonly number[];
  lines: readonly (readonly HorizontalDirectionDegrees[])[];
  strokeOpacity?: number;
}) {
  const path = useDerivedValue(() => {
    const builder = Skia.PathBuilder.Make();
    const discontinuityPixels = Math.hypot(
      canvas.widthPixels,
      canvas.heightPixels,
    );
    for (const directions of lines) {
      let first = true;
      let previousX = 0;
      let previousY = 0;
      for (const direction of directions) {
        const point = projectHorizontalDirection(
          direction,
          camera.value,
          canvas,
        );
        const discontinuity =
          !first &&
          Math.hypot(point.xPixels - previousX, point.yPixels - previousY) >
            discontinuityPixels;
        if (first || discontinuity) {
          builder.moveTo(point.xPixels, point.yPixels);
          first = false;
        } else {
          builder.lineTo(point.xPixels, point.yPixels);
        }
        previousX = point.xPixels;
        previousY = point.yPixels;
      }
    }
    return builder.build();
  });
  return (
    <Path
      color={color}
      opacity={strokeOpacity}
      path={path}
      strokeCap="round"
      strokeJoin="round"
      strokeWidth={1}
      style="stroke"
    >
      {dash ? <DashPathEffect intervals={[...dash]} /> : null}
    </Path>
  );
}

function ProjectedText({
  camera,
  canvas,
  color,
  direction,
  font,
  text,
  verticalOffsetPixels = 0,
}: {
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
  color: string;
  direction: HorizontalDirectionDegrees;
  font: SkFont;
  text: string;
  verticalOffsetPixels?: number;
}) {
  const point = useDerivedValue(() =>
    projectHorizontalDirection(direction, camera.value, canvas),
  );
  const x = useDerivedValue(
    () => point.value.xPixels - font.measureText(text).width / 2,
  );
  const y = useDerivedValue(
    () => point.value.yPixels + verticalOffsetPixels + font.getSize(),
  );
  const opacity = useDerivedValue(() => (point.value.visible ? 1 : 0));
  return (
    <Text color={color} font={font} opacity={opacity} text={text} x={x} y={y} />
  );
}

const horizontalGrid = (() => {
  const lines: HorizontalDirectionDegrees[][] = [];
  for (const altitudeDegrees of [0, 15, 30, 45, 60, 75]) {
    lines.push(
      Array.from({ length: 73 }, (_, index) => ({
        altitudeDegrees,
        azimuthDegrees: index * 5,
      })),
    );
  }
  for (let azimuthDegrees = 0; azimuthDegrees < 360; azimuthDegrees += 30) {
    lines.push(
      Array.from({ length: 19 }, (_, index) => ({
        altitudeDegrees: index * 5,
        azimuthDegrees,
      })),
    );
  }
  return lines;
})();

const gridLabels = [15, 30, 45, 60, 75].flatMap((altitudeDegrees) =>
  [0, 180].map((azimuthDegrees) => ({
    direction: { altitudeDegrees, azimuthDegrees },
    label: `${altitudeDegrees}°`,
  })),
);

const horizonDirections = createHorizonDirections(5);

function PlanetariumGrid({
  camera,
  canvas,
  celestialEquatorDirections,
}: {
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
  celestialEquatorDirections: readonly HorizontalDirectionDegrees[];
}) {
  return (
    <Group opacity={0.72}>
      <ProjectedMultiPath
        camera={camera}
        canvas={canvas}
        color={colors.outline}
        dash={[3, 8]}
        lines={horizontalGrid}
      />
      <ProjectedPath
        camera={camera}
        canvas={canvas}
        color={colors.spaceViolet}
        directions={celestialEquatorDirections}
        strokeOpacity={0.9}
        strokeWidth={1.5}
      />
      {gridLabels.map(({ direction, label }, index) => (
        <ProjectedText
          camera={camera}
          canvas={canvas}
          color={colors.mutedText}
          direction={direction}
          font={guideFont}
          key={`${label}-${index}`}
          text={label}
        />
      ))}
    </Group>
  );
}

function GroundLayer({
  camera,
  canvas,
}: {
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
}) {
  const path = useDerivedValue(() => {
    return createPath(horizonDirections, camera.value, canvas, true);
  });
  const invertClip = useDerivedValue(() =>
    shouldInvertGroundClip(
      getPlanetariumCameraCenter(camera.value).altitudeDegrees,
    ),
  );
  return (
    <Group clip={path} invertClip={invertClip}>
      <Fill color={colors.ground} />
    </Group>
  );
}

function HorizonAndCardinals({
  camera,
  canvas,
}: {
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
}) {
  return (
    <>
      <ProjectedPath
        camera={camera}
        canvas={canvas}
        color={colors.outline}
        directions={horizonDirections}
        strokeOpacity={1}
        strokeWidth={2}
      />
      {CARDINAL_LABELS.map(({ direction, label }) => (
        <ProjectedText
          camera={camera}
          canvas={canvas}
          color={colors.danger}
          direction={direction}
          font={cardinalFont}
          key={label}
          text={label}
          verticalOffsetPixels={-CARDINAL_LABEL_FONT_SIZE_PIXELS / 2}
        />
      ))}
    </>
  );
}

function PlanetariumTarget({
  camera,
  canvas,
  item,
  selected,
}: {
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
  item: ViewportCatalogueTarget;
  selected: boolean;
}) {
  const direction = {
    altitudeDegrees: item.altitudeDegrees,
    azimuthDegrees: item.azimuthDegrees,
  };
  const point = useDerivedValue(() =>
    projectHorizontalDirection(direction, camera.value, canvas),
  );
  const opacity = useDerivedValue(() => (point.value.visible ? 1 : 0));
  const transform = useDerivedValue(() => [
    { translateX: point.value.xPixels },
    { translateY: point.value.yPixels },
  ]);
  const outline = useDerivedValue(() => {
    const maximumOutlinePixels = Math.hypot(
      canvas.widthPixels,
      canvas.heightPixels,
    );
    const width = Math.max(
      2,
      Math.min(
        maximumOutlinePixels,
        angularSizeDegreesToPixelsAtDirection(
          (item.target.majorAxisArcminutes ?? 3) / 60,
          direction,
          camera.value,
          canvas,
        ),
      ),
    );
    const height = Math.max(
      2,
      Math.min(
        maximumOutlinePixels,
        angularSizeDegreesToPixelsAtDirection(
          (item.target.minorAxisArcminutes ??
            item.target.majorAxisArcminutes ??
            3) / 60,
          direction,
          camera.value,
          canvas,
        ),
      ),
    );
    return {
      x: -width / 2,
      y: -height / 2,
      width,
      height,
    };
  });
  return (
    <Group opacity={opacity} transform={transform}>
      <Oval
        color={selected ? colors.spaceViolet : colors.primary}
        opacity={selected ? 0.25 : 0.1}
        rect={outline}
        style="fill"
      />
      <Oval
        color={selected ? colors.spaceViolet : colors.primary}
        rect={outline}
        strokeWidth={selected ? 2 : 1.2}
        style="stroke"
      />
      {item.labelVisible ? (
        <Text
          color={selected ? colors.spaceViolet : colors.text}
          font={targetFont}
          text={item.label}
          x={-targetFont.measureText(item.label).width / 2}
          y={32}
        />
      ) : null}
      {item.labelVisible && item.secondaryLabel ? (
        <Text
          color={colors.mutedText}
          font={secondaryFont}
          text={item.secondaryLabel}
          x={-secondaryFont.measureText(item.secondaryLabel).width / 2}
          y={43}
        />
      ) : null}
    </Group>
  );
}

function TrajectoryLayer({
  camera,
  canvas,
  diurnalOrbit,
  trajectory,
}: {
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
  diurnalOrbit: TargetDiurnalOrbit | null;
  trajectory: SelectedTargetTrajectory | null;
}) {
  const groups = useMemo(
    () => createProjectedTrajectoryGroups(trajectory),
    [trajectory],
  );
  const diurnalDirections = useMemo(
    () =>
      diurnalOrbit?.samples.map((sample) => ({
        altitudeDegrees: sample.refractedAltitudeDegrees,
        azimuthDegrees: sample.azimuthDegreesClockwiseFromNorth,
      })) ?? [],
    [diurnalOrbit],
  );
  return (
    <>
      {diurnalDirections.length > 1 ? (
        <ProjectedPath
          camera={camera}
          canvas={canvas}
          color={colors.mutedText}
          dash={[4, 6]}
          directions={diurnalDirections}
          strokeOpacity={0.48}
          strokeWidth={1.5}
        />
      ) : null}
      {groups.map((group, index) => (
        <ProjectedPath
          camera={camera}
          canvas={canvas}
          color={
            group.assessment === 'visible'
              ? colors.primary
              : group.assessment === 'blocked'
                ? colors.blocked
                : colors.spaceViolet
          }
          dash={group.assessment === 'visible' ? undefined : [7, 5]}
          directions={group.directions}
          key={`${group.assessment}-${index}`}
          strokeOpacity={group.assessment === 'blocked' ? 0.72 : 1}
          strokeWidth={group.assessment === 'visible' ? 3 : 2.5}
        />
      ))}
      {trajectory?.transitions.map((transition) => (
        <ProjectedText
          camera={camera}
          canvas={canvas}
          color={colors.text}
          direction={{
            altitudeDegrees: transition.refractedAltitudeDegrees,
            azimuthDegrees: transition.azimuthDegreesClockwiseFromNorth,
          }}
          font={markerFont}
          key={`${transition.kind}-${transition.timestampUtc}`}
          text={transition.displayLabel}
          verticalOffsetPixels={-18}
        />
      ))}
      {trajectory?.markers.map((marker) =>
        marker.assessment === 'belowHorizon' ? null : (
          <Group key={marker.timestampUtc}>
            <ProjectedMarker
              camera={camera}
              canvas={canvas}
              color={
                marker.assessment === 'visible'
                  ? colors.primary
                  : marker.assessment === 'blocked'
                    ? colors.blocked
                    : colors.spaceViolet
              }
              direction={{
                altitudeDegrees: marker.refractedAltitudeDegrees,
                azimuthDegrees: marker.azimuthDegreesClockwiseFromNorth,
              }}
            />
            <ProjectedText
              camera={camera}
              canvas={canvas}
              color={colors.text}
              direction={{
                altitudeDegrees: marker.refractedAltitudeDegrees,
                azimuthDegrees: marker.azimuthDegreesClockwiseFromNorth,
              }}
              font={markerFont}
              text={marker.localTimeLabel}
              verticalOffsetPixels={-20}
            />
          </Group>
        ),
      )}
    </>
  );
}

function ProjectedMarker({
  camera,
  canvas,
  color,
  direction,
}: {
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
  color: string;
  direction: HorizontalDirectionDegrees;
}) {
  const point = useDerivedValue(() => {
    const projected = projectHorizontalDirection(
      direction,
      camera.value,
      canvas,
    );
    return vec(projected.xPixels, projected.yPixels);
  });
  const opacity = useDerivedValue(() => {
    const projected = projectHorizontalDirection(
      direction,
      camera.value,
      canvas,
    );
    return projected.visible ? 1 : 0;
  });
  return (
    <Circle
      c={point}
      color={color}
      opacity={opacity}
      r={4}
      strokeWidth={2}
      style="stroke"
    />
  );
}

function PanoramaTileLayer({
  camera,
  canvas,
  opacity,
  tile,
}: {
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
  opacity: number;
  tile: ActivePanoramaTile;
}) {
  const image = useImage(tile.uri);
  const mesh = useMemo(() => createPlanetariumPanoramaMesh(tile), [tile]);
  const textures = useMemo(
    () => mesh.texturePointsPixels.map((point) => vec(point.x, point.y)),
    [mesh.texturePointsPixels],
  );
  const vertices = useDerivedValue(() =>
    mesh.directions.map((direction) => {
      const point = projectHorizontalDirection(direction, camera.value, canvas);
      return vec(point.xPixels, point.yPixels);
    }),
  );
  if (!image) return null;
  return (
    <Group opacity={opacity}>
      <ImageShader image={image} tx="decal" ty="decal" />
      <Vertices
        indices={mesh.indices}
        mode="triangles"
        textures={textures}
        vertices={vertices}
      />
    </Group>
  );
}

function MaskLayer({
  camera,
  canvas,
  mask,
  opacity,
}: {
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
  mask: VisibilityMask;
  opacity: number;
}) {
  return (
    <Group>
      <Fill color={colors.blocked} opacity={opacity * 0.2} />
      {mask.operations.map((operation) => {
        if (operation.kind === 'visiblePolygon') {
          const directions = densifyHorizontalPath(
            operation.points.map((point) => ({
              altitudeDegrees: point.altitudeDegrees,
              azimuthDegrees: point.azimuthDegrees,
            })),
            1,
            true,
          );
          return (
            <ProjectedPath
              camera={camera}
              canvas={canvas}
              closed
              color={colors.primary}
              directions={directions}
              fillOpacity={opacity * 0.3}
              key={operation.id}
              strokeOpacity={opacity}
              strokeWidth={2}
            />
          );
        }
        return (
          <MaskStroke
            camera={camera}
            canvas={canvas}
            key={operation.id}
            opacity={opacity}
            operation={operation}
          />
        );
      })}
    </Group>
  );
}

function MaskStroke({
  camera,
  canvas,
  opacity,
  operation,
}: {
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
  opacity: number;
  operation: Extract<
    VisibilityMask['operations'][number],
    { kind: 'blockedStroke' | 'visibleStroke' }
  >;
}) {
  const visible = operation.kind === 'visibleStroke';
  const strokeWidth = useDerivedValue(() =>
    Math.max(
      1,
      angularSizeToPixels(
        operation.angularRadiusDegrees * 2,
        camera.value,
        canvas,
      ),
    ),
  );
  return (
    <ProjectedPath
      camera={camera}
      canvas={canvas}
      color={visible ? colors.primary : colors.blocked}
      dash={visible ? undefined : [6, 4]}
      directions={operation.points.map((point) => ({
        altitudeDegrees: point.altitudeDegrees,
        azimuthDegrees: point.azimuthDegrees,
      }))}
      strokeOpacity={opacity * 0.7}
      strokeWidth={strokeWidth}
    />
  );
}

function FieldOfViewLayer({
  camera,
  canvas,
  equipment,
}: {
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
  equipment: EquipmentRecord;
}) {
  const path = useDerivedValue(() => {
    const frame = createScreenCenteredFieldOfViewFrame({
      cameraFieldOfViewDegrees: camera.value.fieldOfViewDegrees,
      canvas,
      equipment,
    });
    const builder = Skia.PathBuilder.Make();
    frame.corners.forEach((corner, index) => {
      if (index === 0) builder.moveTo(corner.xPixels, corner.yPixels);
      else builder.lineTo(corner.xPixels, corner.yPixels);
    });
    builder.close();
    return builder.build();
  });
  return (
    <>
      <Path color={colors.primary} opacity={0.06} path={path} style="fill" />
      <Path color={colors.primary} path={path} strokeWidth={2} style="stroke" />
    </>
  );
}

export function PlanetariumScene({
  camera,
  canvas,
  celestialEquatorDirections,
  diurnalOrbit,
  equipment,
  mask,
  maskOpacity,
  panoramaOpacity,
  panoramaTiles,
  selectedTargetId,
  targets,
  trajectory,
}: {
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
  celestialEquatorDirections: readonly HorizontalDirectionDegrees[];
  diurnalOrbit: TargetDiurnalOrbit | null;
  equipment: EquipmentRecord | null;
  mask: VisibilityMask | null;
  maskOpacity: number;
  panoramaOpacity: number;
  panoramaTiles: readonly ActivePanoramaTile[];
  selectedTargetId: string | null;
  targets: readonly ViewportCatalogueTarget[];
  trajectory: SelectedTargetTrajectory | null;
}) {
  return (
    <Canvas style={{ flex: 1 }}>
      <Fill color={colors.backdrop} />
      <PlanetariumGrid
        camera={camera}
        canvas={canvas}
        celestialEquatorDirections={celestialEquatorDirections}
      />
      {panoramaTiles.map((tile) => (
        <PanoramaTileLayer
          camera={camera}
          canvas={canvas}
          key={tile.id}
          opacity={panoramaOpacity}
          tile={tile}
        />
      ))}
      {mask ? (
        <MaskLayer
          camera={camera}
          canvas={canvas}
          mask={mask}
          opacity={maskOpacity}
        />
      ) : null}
      <TrajectoryLayer
        camera={camera}
        canvas={canvas}
        diurnalOrbit={diurnalOrbit}
        trajectory={trajectory}
      />
      {targets.map((item) => (
        <PlanetariumTarget
          camera={camera}
          canvas={canvas}
          item={item}
          key={item.target.id}
          selected={item.target.id === selectedTargetId}
        />
      ))}
      <GroundLayer camera={camera} canvas={canvas} />
      <HorizonAndCardinals camera={camera} canvas={canvas} />
      {equipment ? (
        <FieldOfViewLayer
          camera={camera}
          canvas={canvas}
          equipment={equipment}
        />
      ) : null}
    </Canvas>
  );
}
