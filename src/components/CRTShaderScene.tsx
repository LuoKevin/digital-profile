import React, { useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, extend } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

extend({ EffectComposer, RenderPass, ShaderPass });

const CRTShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uCurvature: { value: 0.12 },
    uScanlineIntensity: { value: 0.12 },
    uScanlineDensity: { value: 1400.0 },
    uVignette: { value: 0.35 },
    uNoiseStrength: { value: 0.04 },
    uRGBOffset: { value: 1.0 },
    uBloom: { value: 0.08 },
    uFlicker: { value: 0.015 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }
  `,
  fragmentShader: `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uCurvature;
    uniform float uScanlineIntensity;
    uniform float uScanlineDensity;
    uniform float uVignette;
    uniform float uNoiseStrength;
    uniform float uRGBOffset;
    uniform float uBloom;
    uniform float uFlicker;

    float hash(vec2 p){ p = fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
    vec2 barrel(vec2 uv, float amt){ vec2 cc = uv-0.5; float d = dot(cc,cc); return uv + cc * d * amt; }
    float vignette(vec2 uv, float str){ float d = distance(uv, vec2(0.5)); return smoothstep(0.9, 0.4, d*(1.0+str*0.8)); }
    vec3 bloomSample(sampler2D tex, vec2 uv){ float off = 1.5/uResolution.y; vec3 c = texture2D(tex, uv).rgb*0.4; c+=texture2D(tex, uv+vec2(0.0,off)).rgb*0.15; c+=texture2D(tex, uv-vec2(0.0,off)).rgb*0.15; c+=texture2D(tex, uv+vec2(0.0,2.0*off)).rgb*0.1; c+=texture2D(tex, uv-vec2(0.0,2.0*off)).rgb*0.1; return c; }

    void main(){
      float wobble = sin(uTime*0.8)*0.002;
      float lineJitter = sin((vUv.y + uTime*0.2)*30.0)*0.001;
      vec2 uv = vUv; uv.y += lineJitter; uv = barrel(uv, uCurvature + wobble);
      float ca = uRGBOffset*0.0015;
      vec3 r = texture2D(tDiffuse, barrel(uv, uCurvature + wobble + ca)).rgb;
      vec3 g = texture2D(tDiffuse, barrel(uv, uCurvature + wobble)).rgb;
      vec3 b = texture2D(tDiffuse, barrel(uv, uCurvature + wobble - ca)).rgb;
      vec3 col = vec3(r.r, g.g, b.b);
      float sl = sin(uv.y*uScanlineDensity)*0.5 + 0.5;
      col *= 1.0 - uScanlineIntensity*(1.0 - sl);
      float mask = smoothstep(0.0,1.0, fract(uv.x*uResolution.x/3.0));
      col += vec3(0.015*mask, 0.015*(1.0-mask), 0.015*(mask*0.5));
      vec3 glow = bloomSample(tDiffuse, uv) * uBloom; col += glow;
      col *= vignette(uv, uVignette);
      float n = (hash(uv*uResolution + uTime*60.0) - 0.5); col += n*uNoiseStrength;
      float flick = 1.0 - uFlicker*(sin(uTime*120.0)*0.5+0.5); col *= flick;
      gl_FragColor = vec4(clamp(col,0.0,1.0), 1.0);
    }
  `
};

function CRTEffect() {
  const { gl, scene, camera, size } = useThree();
  const composer = useRef<EffectComposer>(null!);
  const shaderPass = useRef<ShaderPass>(null!);
  const start = useRef(performance.now());

  React.useEffect(() => {
    composer.current = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    shaderPass.current = new ShaderPass(CRTShader);
    composer.current.addPass(renderPass);
    composer.current.addPass(shaderPass.current);
    composer.current.setSize(size.width, size.height);
    shaderPass.current.uniforms.uResolution.value.set(size.width, size.height);
    return () => composer.current?.dispose();
  }, [gl, scene, camera, size]);

  useFrame(() => {
    const t = (performance.now() - start.current) / 1000;
    shaderPass.current.uniforms.uTime.value = t;
    composer.current?.render();
  }, 1);

  return null;
}

function SpinningMesh() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    ref.current.rotation.y += 0.01;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.2, 2]} />
      <meshStandardMaterial color={0x66ccff} metalness={0.4} roughness={0.3} />
    </mesh>
  );
}

export default function CRTSceneR3F() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
      <color attach="background" args={["#0a0a0a"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 3, 4]} intensity={1.2} />
      <SpinningMesh />
      <OrbitControls enableDamping />
      <CRTEffect />
    </Canvas>
  );
}
