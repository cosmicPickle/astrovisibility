/** SkSL shared by baking, runtime drawing and actual Skia pixel tests. */
export const cubeLookup = `
float2 cubePoint(float3 d, float faceSize) {
  float3 a = abs(d);
  float face; float2 uv; float major;
  if (a.x >= a.y && a.x >= a.z) {
    face = d.x >= 0.0 ? 0.0 : 1.0;
    uv = float2(d.x >= 0.0 ? -d.z : d.z, -d.y); major = a.x;
  } else if (a.y >= a.z) {
    face = d.y >= 0.0 ? 2.0 : 3.0;
    uv = float2(d.x, d.y >= 0.0 ? d.z : -d.z); major = a.y;
  } else {
    face = d.z >= 0.0 ? 4.0 : 5.0;
    uv = float2(d.z >= 0.0 ? d.x : -d.x, -d.y); major = a.z;
  }
  return float2(mod(face,3.0),floor(face/3.0))*(faceSize+4.0)
    + 2.0 + (uv/major*0.5+0.5)*faceSize;
}
float2 sourcePoint(float3 d, float2 size, float celestial) {
  d = normalize(d);
  if (celestial > 0.5) {
    // Source atlas starts at RA 6 h; RA decreases toward the right.
    return float2(fract(0.25-atan(d.y,d.x)/6.28318530718), acos(clamp(d.z,-1.0,1.0))/3.14159265359)*size;
  }
  float radial = length(d.xz);
  float scale = radial > 0.000001 ? acos(clamp(d.y,0.0,1.0))/1.57079632679/radial : 0.63661977237;
  return size*0.5 + float2(d.x,-d.z)*scale*min(size.x,size.y)*0.5;
}
`;

export const cubeBakeShader = `
uniform shader sourceImage;
uniform float2 sourceSize;
uniform float faceSize;
uniform float celestial;
${cubeLookup}
half4 main(float2 position) {
  float stride=faceSize+4.0;
  float2 tile=floor(position/stride);
  float face=tile.y*3.0+tile.x;
  float2 uv=((position-tile*stride-2.0)/faceSize)*2.0-1.0;
  float3 d;
  if(face<0.5) d=float3(1.0,-uv.y,-uv.x);
  else if(face<1.5) d=float3(-1.0,-uv.y,uv.x);
  else if(face<2.5) d=float3(uv.x,1.0,uv.y);
  else if(face<3.5) d=float3(uv.x,-1.0,-uv.y);
  else if(face<4.5) d=float3(uv.x,-uv.y,1.0);
  else d=float3(-uv.x,-uv.y,-1.0);
  if(celestial<0.5 && d.y<0.0) return half4(0.0);
  return sourceImage.eval(sourcePoint(d,sourceSize,celestial));
}
`;

export const cubeBackgroundShader = `
uniform shader image;
uniform shader maskImage;
uniform shader refractionTable;
uniform shader originalMask;
uniform float2 viewport;
uniform float inverseScale;
uniform float3 cameraRight;
uniform float3 cameraUp;
uniform float3 cameraForward;
uniform float3 eastJ2000;
uniform float3 upJ2000;
uniform float3 northJ2000;
uniform float celestial;
uniform float faceSize;
uniform float2 sourceSize;
uniform float maskFaceSize;
uniform float2 maskSourceSize;
// 0: image alone, 1: color through mask, 2: image through mask.
uniform float maskMode;
uniform float4 maskColor;
${cubeLookup}
half4 main(float2 position) {
  float2 p=(position-viewport*0.5)*float2(inverseScale,-inverseScale);
  float radiusSquared=dot(p,p);
  float3 local=float3(2.0*p,1.0-radiusSquared)/(1.0+radiusSquared);
  float3 d=cameraRight*local.x+cameraUp*local.y+cameraForward*local.z;
  if(celestial<0.5 && d.y<0.0) return half4(0.0);
  if(celestial>0.5) {
    float lookup=clamp((d.y+1.0)*0.5,0.0,1.0)*4095.0+0.5;
    float2 horizontal=refractionTable.eval(float2(lookup,0.5)).rg;
    float2 vertical=refractionTable.eval(float2(lookup,1.5)).rg;
    float h=(dot(horizontal,float2(65280.0,255.0))/65535.0*2.0-1.0)*0.02;
    float v=(dot(vertical,float2(65280.0,255.0))/65535.0*2.0-1.0)*0.02;
    d=float3(d.x*(1.0+h),d.y+v,d.z*(1.0+h));
    d=eastJ2000*d.x+upJ2000*d.y+northJ2000*d.z;
  }
  half alpha=1.0;
  if(maskMode>0.5) {
    float2 maskPoint=maskFaceSize>0.0 ? cubePoint(d,maskFaceSize) : sourcePoint(d,maskSourceSize,0.0);
    alpha=maskImage.eval(maskPoint).a;
    // Most mask pixels are constant blocked/visible regions. Only a boundary
    // needs the original raster lookup, avoiding a second resampling of thin
    // branches and keeping the mask authoritative at maximum zoom.
    if(maskFaceSize>0.0 && alpha>0.0 && alpha<1.0) {
      alpha=originalMask.eval(sourcePoint(d,maskSourceSize,0.0)).a;
    }
    if(alpha<=0.0) return half4(0.0);
    if(maskMode<1.5) return half4(maskColor.rgb*maskColor.a,maskColor.a)*alpha;
  }
  float2 texturePoint=faceSize>0.0 ? cubePoint(d,faceSize) : sourcePoint(d,sourceSize,celestial);
  return image.eval(texturePoint)*alpha;
}
`;
