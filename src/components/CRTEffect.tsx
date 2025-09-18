// TransparentCRTOverlay.tsx
import * as THREE from "three";
import React, { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";

/**
 * Transparent, pointer-events:none overlay that draws animated CRT artifacts
 * over the whole viewport: scanlines, flicker, RGB mask, vignette, wobble, grain.
 * NOTE: This does not distort your DOM; it draws a transparent shader on top.
 */
export default function TransparentCRTOverlay(props: {
  opacity?: number;          // overall opacity of the overlay (0..1)
  scanlineDensity?: number;  // lines per screen height (e.g. 1200..2000)
  scanlineIntensity?: number;// how dark the lines are (0..0.25)
  vignette?: number;         // corner darkening (0..1)
  noise?: number;            // film grain amplitude (0..0.15)
  flicker?: number;          // brightness flicker (0..0.05)
  rgbOffset?: number;        // tiny color mask shimmer amount (0..2)
}) {
  const {
    opacity = 0.6,
    scanlineDensity = 1500,
    scanlineIntensity = 0.14,
    vignette = 0.4,
    noise = 0.05,
    flicker = 0.02,
    rgbOffset = 1.0,
  } = props;

  return (
    <Canvas
      // Transparent, full-screen, click-through.
      gl={{ antialias: true, alpha: true }}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0); // fully transparent clear
      }}
      orthographic
      camera={{ position: [0, 0, 1], zoom: 1 }}
    >
      <FullScreenCRTEffect
        opacity={opacity}
        scanlineDensity={scanlineDensity}
        scanlineIntensity={scanlineIntensity}
        vignette={vignette}
        noise={noise}
        flicker={flicker}
        rgbOffset={rgbOffset}
      />
    </Canvas>
  );
}

function FullScreenCRTEffect({
  opacity,
  scanlineDensity,
  scanlineIntensity,
  vignette,
  noise,
  flicker,
  rgbOffset,
}: {
  opacity: number;
  scanlineDensity: number;
  scanlineIntensity: number;
  vignette: number;
  noise: number;
  flicker: number;
  rgbOffset: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null!);
  const { size, viewport } = useThree();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      uOpacity: { value: opacity },
      uScanlineDensity: { value: scanlineDensity },
      uScanlineIntensity: { value: scanlineIntensity },
      uVignette: { value: vignette },
      uNoise: { value: noise },
      uFlicker: { value: flicker },
      uRGBOffset: { value: rgbOffset },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Keep uniforms synced with props and resize
  if (matRef.current) {
    matRef.current.uniforms.uOpacity.value = opacity;
    matRef.current.uniforms.uScanlineDensity.value = scanlineDensity;
    matRef.current.uniforms.uScanlineIntensity.value = scanlineIntensity;
    matRef.current.uniforms.uVignette.value = vignette;
    matRef.current.uniforms.uNoise.value = noise;
    matRef.current.uniforms.uFlicker.value = flicker;
    matRef.current.uniforms.uRGBOffset.value = rgbOffset;
  }

  useFrame(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = performance.now() / 1000;
    matRef.current.uniforms.uResolution.value.set(size.width, size.height);
  });

  // Cover the viewport with a plane from -1..1
  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.NormalBlending}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          precision highp float;
          varying vec2 vUv;

          uniform vec2 uResolution;
          uniform float uTime;
          uniform float uOpacity;
          uniform float uScanlineDensity;
          uniform float uScanlineIntensity;
          uniform float uVignette;
          uniform float uNoise;
          uniform float uFlicker;
          uniform float uRGBOffset;

          // Fast hash noise
          float hash(vec2 p){
            p = fract(p*vec2(123.34, 345.45));
            p += dot(p, p+34.345);
            return fract(p.x * p.y);
          }

          // Vignette 0..1
          float vignette(vec2 uv, float str){
            float d = distance(uv, vec2(0.5));
            return smoothstep(0.95, 0.4, d * (1.0 + str*0.9));
          }

          // Slight time-based wobble (no DOM distortion; purely visual shimmer)
          vec2 wobble(vec2 uv){
            float y = uv.y + sin((uv.y + uTime*0.2)*30.0) * 0.001;
            float x = uv.x + sin((uv.y*2.0 + uTime*0.4)*6.0) * 0.0015;
            return vec2(x, y);
          }

          void main(){
            vec2 uv = wobble(vUv);
            float resY = max(uResolution.y, 1.0);

            // Horizontal scanlines
            float sl = sin(uv.y * uScanlineDensity) * 0.5 + 0.5; // 0..1
            float scanlineDarken = 1.0 - uScanlineIntensity * (1.0 - sl);

            // Phosphor subpixel hint (vertical RGB phase stripes)
            float mask = fract(uv.x * uResolution.x / 3.0);
            vec3 phosphor = vec3(
              0.04 * smoothstep(0.0, 1.0, mask),
              0.04 * smoothstep(0.0, 1.0, 1.0 - mask),
              0.04 * smoothstep(0.0, 1.0, mask * 0.5)
            );

            // Base is neutral grey with scanlines; we’re an overlay, not sampling DOM
            vec3 col = vec3(0.9) * scanlineDarken + phosphor;

            // Fake tiny chromatic shimmer by phase shifting scanlines per channel
            float ca = uRGBOffset * 0.003;
            col.r *= (sin((uv.y + ca) * uScanlineDensity) * 0.5 + 0.5) * 0.15 + 0.925;
            col.g *= (sin((uv.y)      * uScanlineDensity) * 0.5 + 0.5) * 0.15 + 0.925;
            col.b *= (sin((uv.y - ca) * uScanlineDensity) * 0.5 + 0.5) * 0.15 + 0.925;

            // Vignette
            col *= vignette(uv, uVignette);

            // Film grain
            float n = hash(uv * uResolution + uTime * 60.0) - 0.5;
            col += n * uNoise;

            // Flicker
            float f = 1.0 - uFlicker * (sin(uTime * 120.0) * 0.5 + 0.5);
            col *= f;

            // Output with overlay opacity; alpha controls how much page shows through
            gl_FragColor = vec4(clamp(col, 0.0, 1.0), clamp(uOpacity, 0.0, 1.0));
          }
        `}
      />
    </mesh>
  );
}
