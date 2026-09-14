import { useEffect, useMemo } from 'react';
import {
  AlphaType,
  ColorType,
  Fill,
  Group,
  ImageShader,
  Paint,
  Path,
  Shader,
  Skia,
  type SkRuntimeEffect,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { cubeLookup } from '../sky/backgroundCubeShaders';
import { createPlanetariumProjectionContext } from '../sky/planetariumProjection';
import type { CanvasSizePixels } from '../sky/projection';
import { colors } from '../theme/tokens';
import type { MaskTouchState } from './maskEditorTouch';

const overlayShader = `
uniform shader maskImage;
uniform float2 viewport;
uniform float2 sourceSize;
uniform float inverseScale;
uniform float3 cameraRight;
uniform float3 cameraUp;
uniform float3 cameraForward;
uniform float4 maskColor;
${cubeLookup}
half4 main(float2 position) {
  float2 p=(position-viewport*0.5)*float2(inverseScale,-inverseScale);
  float r=dot(p,p);
  float3 local=float3(2.0*p,1.0-r)/(1.0+r);
  float3 d=cameraRight*local.x+cameraUp*local.y+cameraForward*local.z;
  if(d.y<0.0) return half4(0.0);
  half alpha=maskImage.eval(sourcePoint(d,sourceSize,0.0)).a;
  return half4(maskColor.rgb*alpha,alpha);
}`;
let effect: SkRuntimeEffect | null = null;

/** Frequently edited masks use the original raster; only the photo is cube-baked. */
export function MaskEditorOverlay({
  blockedBitset,
  coverageBitset,
  width,
  height,
  canvas,
  touchState,
  brush,
}: {
  blockedBitset: Uint8Array;
  coverageBitset: Uint8Array;
  width: number;
  height: number;
  canvas: CanvasSizePixels;
  touchState: SharedValue<MaskTouchState>;
  brush: SharedValue<{ draw: boolean; diameter: number }>;
}) {
  const image = useMemo(() => {
    const alpha = new Uint8Array(width * height);
    for (let pixel = 0; pixel < alpha.length; pixel++)
      alpha[pixel] =
        blockedBitset[pixel >> 3]! &
        coverageBitset[pixel >> 3]! &
        (1 << (pixel & 7))
          ? 255
          : 0;
    const data = Skia.Data.fromBytes(alpha);
    try {
      return Skia.Image.MakeImage(
        {
          alphaType: AlphaType.Premul,
          colorType: ColorType.Alpha_8,
          width,
          height,
        },
        data,
        width,
      );
    } finally {
      data.dispose();
    }
  }, [blockedBitset, coverageBitset, width, height]);
  useEffect(() => () => image?.dispose(), [image]);
  const color = useMemo(() => Array.from(Skia.Color(colors.danger)), []);
  const uniforms = useDerivedValue(() => {
    const camera = touchState.value.camera;
    return {
      viewport: [canvas.widthPixels, canvas.heightPixels],
      sourceSize: [width, height],
      inverseScale:
        1 /
        createPlanetariumProjectionContext(camera, canvas)
          .projectionScalePixels,
      cameraRight: [camera.right.x, camera.right.y, camera.right.z],
      cameraUp: [camera.up.x, camera.up.y, camera.up.z],
      cameraForward: [camera.forward.x, camera.forward.y, camera.forward.z],
      maskColor: color,
    };
  });
  const path = useDerivedValue(() => {
    const result = Skia.PathBuilder.Make();
    const points = touchState.value.points;
    if (points[0]) {
      result.moveTo(points[0].xPixels, points[0].yPixels);
      if (points.length === 1)
        result.lineTo(points[0].xPixels + 0.001, points[0].yPixels);
      else
        for (let index = 1; index < points.length; index++)
          result.lineTo(points[index]!.xPixels, points[index]!.yPixels);
    }
    return result.detach();
  });
  const diameter = useDerivedValue(() => brush.value.diameter);
  const blendMode = useDerivedValue(() =>
    brush.value.draw ? ('srcOver' as const) : ('dstOut' as const),
  );
  effect ??= Skia.RuntimeEffect.Make(overlayShader);
  if (!image || !effect) return null;
  return (
    <Group opacity={0.62} layer={<Paint />}>
      <Fill>
        <Shader source={effect} uniforms={uniforms}>
          <ImageShader image={image} tx="clamp" ty="clamp" />
        </Shader>
      </Fill>
      <Path
        path={path}
        color={colors.danger}
        style="stroke"
        strokeWidth={diameter}
        strokeCap="round"
        strokeJoin="round"
        blendMode={blendMode}
      />
    </Group>
  );
}
