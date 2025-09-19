// CRTAberrationWrap.tsx
import React, { type PropsWithChildren, useEffect, useId, useMemo, useRef } from "react";

type CRTAberrationWrapProps = {
  /** 0..1 – overall distortion strength */
  intensity?: number;
  /** px shift for RGB split (e.g., 1.5–3.5) */
  rgbOffset?: number;
  /** 0..1 – how glowy/bloomy */
  bloom?: number;
  /** animation speed multiplier */
  speed?: number;
  /** enable/disable the effect */
  enabled?: boolean;
  /** show overlays: scanlines, vignette, rolling bar, triad mask */
  overlays?: boolean;
  /** occasional jitter nudge */
  glitchJitter?: boolean;
  /** stable filter id (SSR/hydration safety) */
  filterId?: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function CRTAberrationWrap({
  children,
  intensity = 0.6,
  rgbOffset = 2.2,
  bloom = 0.35,
  speed = 1.0,
  enabled = true,
  overlays = true,
  glitchJitter = true,
  filterId,
  className,
  style,
}: PropsWithChildren<CRTAberrationWrapProps>) {
  const autoId = useId();
  const id = (filterId ?? autoId).replace(/:/g, "_");

  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);

  // Displacement “scale” mapped to intensity
  const dispScale = useMemo(() => Math.round(Math.max(0, Math.min(1, intensity)) * 55), [intensity]);
  const glowStd = useMemo(() => Math.max(0, Math.min(1, bloom)) * 2.4, [bloom]);

  useEffect(() => {
    if (!enabled) {
      if (containerRef.current) containerRef.current.style.transform = "none";
      return;
    }
    const turb = document.getElementById(`${id}-turb`) as SVGFETurbulenceElement | null;
    const disp = document.getElementById(`${id}-disp`) as SVGFEDisplacementMapElement | null;
    if (!turb || !disp) return;

    let t = 0;
    let jitterFrames = 0;

    const tick = () => {
      t += 0.016 * speed; // ~60fps
      // Subtle crawl
      const bx = 0.002 + 0.0023 * Math.sin(t * 1.17);
      const by = 0.004 + 0.0020 * Math.cos(t * 0.83);
      turb.setAttribute("baseFrequency", `${bx.toFixed(4)} ${by.toFixed(4)}`);

      // Random micro “glitch pops”
      const spike = Math.random() < 0.02 ? 1 + Math.random() * 1.6 : 1;
      disp.setAttribute("scale", String(Math.max(0, dispScale * spike)));

      // Screen nudge
      if (glitchJitter && containerRef.current) {
        jitterFrames -= 1;
        if (jitterFrames <= 0 && Math.random() < 0.03) {
          const dx = (Math.random() - 0.5) * 5;
          const dy = (Math.random() - 0.5) * 3;
          containerRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
          jitterFrames = 2;
        } else if (jitterFrames <= 0) {
          containerRef.current.style.transform = "translate(0, 0)";
        }
      }

      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (containerRef.current) containerRef.current.style.transform = "none";
    };
  }, [id, speed, dispScale, enabled, glitchJitter]);

  const filterUrl = enabled ? `url(#${id}-crt)` : "none";

  return (
    <div
      className={className}
      style={{
        position: "relative",
        display: "inline-block",
        filter: filterUrl,
        willChange: enabled ? "filter, transform" : undefined,
        ...style,
      }}
      ref={containerRef}
    >
      {/* content that gets distorted */}
      <div>{children}</div>

      {/* visual overlays sit above; clicks pass through */}
      {overlays && (
        <>
          {/* fine scanlines + subpixel triad texture + rolling bar */}
          <div
            aria-hidden
            style={{
              pointerEvents: "none",
              position: "absolute",
              inset: 0,
              // Layer 1: horizontal scanlines
              // Layer 2: faint RGB triad (vertical) for CRT subpixel feel
              // Layer 3: rolling highlight bar
              background: [
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.07), rgba(255,255,255,0.07) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 3px)",
                "repeating-linear-gradient(90deg, rgba(255,0,0,0.04) 0 1px, rgba(0,255,0,0.04) 1px 2px, rgba(0,0,255,0.04) 2px 3px, transparent 3px 4px)",
                "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.12) 48%, transparent 100%)",
              ].join(","),
              mixBlendMode: "overlay",
              animation: `${id}-roll 5s linear infinite`,
            }}
          />
          {/* soft vignette and slight glass reflection */}
          <div
            aria-hidden
            style={{
              pointerEvents: "none",
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.32) 100%)",
            }}
          />
        </>
      )}

      {/* filter defs */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          {/* animated noise field for displacement */}
          <feTurbulence
            id={`${id}-turb`}
            type="fractalNoise"
            baseFrequency="0.004 0.008"
            numOctaves={2}
            seed={3}
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="0.55" result="softNoise" />

          {/* First, warp the source a bit for “screen wobble” */}
          <feDisplacementMap
            id={`${id}-disp`}
            in="SourceGraphic"
            in2="softNoise"
            scale={dispScale}
            xChannelSelector="R"
            yChannelSelector="G"
            result="distortBase"
          />

          {/* Split channels for heavy chromatic aberration */}
          {/* isolate R/G/B from distorted source */}
          <feColorMatrix
            in="distortBase"
            type="matrix"
            values="
              1 0 0 0 0
              0 0 0 0 0
              0 0 0 0 0
              0 0 0 1 0"
            result="R"
          />
          <feColorMatrix
            in="distortBase"
            type="matrix"
            values="
              0 0 0 0 0
              0 1 0 0 0
              0 0 0 0 0
              0 0 0 1 0"
            result="G"
          />
          <feColorMatrix
            in="distortBase"
            type="matrix"
            values="
              0 0 0 0 0
              0 0 0 0 0
              0 0 1 0 0
              0 0 0 1 0"
            result="B"
          />

          {/* offset channels in opposite directions for RGB split */}
          <feOffset in="R" dx={rgbOffset} dy="0" result="Roff" />
          <feOffset in="G" dx="0" dy="0" result="Goff" />
          <feOffset in="B" dx={-rgbOffset} dy="0" result="Boff" />

          {/* merge the channels using screen blending */}
          <feBlend in="Roff" in2="Goff" mode="screen" result="RG" />
          <feBlend in="RG" in2="Boff" mode="screen" result="RGB" />

          {/* optional bloom glow */}
          <feGaussianBlur in="RGB" stdDeviation={glowStd} result="glow" />
          <feBlend in="RGB" in2="glow" mode="screen" result="finalRGB" />

          {/* final filter */}
          <filter id={`${id}-crt`} x="-15%" y="-15%" width="130%" height="130%">
            <feMerge>
              <feMergeNode in="finalRGB" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* keyframes: rolling bar (subtle brightness sweep) */}
      <style>{`
        @keyframes ${id}-roll {
          0% { background-position: 0 0, 0 0, 0 -120%; }
          100% { background-position: 0 0, 0 0, 0 220%; }
        }
      `}</style>
    </div>
  );
}
