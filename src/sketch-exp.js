// SketchWithEffects.js
import * as THREE from "three";
import fragment from "./shader/fragment.glsl";
import vertex from "./shader/vertex.glsl";
import GUI from "lil-gui";

function clamp(n, a, b) { return Math.max(a, Math.min(n, b)); }
function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

export default class Sketch {
  constructor(options) {
    this.scene = new THREE.Scene();
    this.container = options.dom;
    this.img = this.container.querySelector("img");
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0xeeeeee, 1);
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.container.appendChild(this.renderer.domElement);

    // Ortho camera for full-bleed plane
    const frustumSize = 1;
    this.camera = new THREE.OrthographicCamera(
      frustumSize / -2, frustumSize / 2,
      frustumSize / 2, frustumSize / -2,
      -1000, 1000
    );
    this.camera.position.set(0, 0, 2);

    this.time = 0;
    this.clock = (typeof performance !== "undefined" ? performance : Date);

    this.mouse = { x: 0, y: 0, prevX: 0, prevY: 0, vX: 0, vY: 0 };

    // NEW: effect emitters container
    this.emitters = []; // {type, ...params, t, life}

    this.isPlaying = true;
    this.settings();
    this.addObjects();
    this.resize();
    this.render();
    this.setupResize();
    this.bindEvents();
  }

  getValue(val) { return parseFloat(this.container.getAttribute("data-" + val)); }

  settings() {
    this.settings = {
      grid: this.getValue("grid") || 64,
      mouse: this.getValue("mouse") || 0.25,
      strength: this.getValue("strength") || 1,
      relaxation: this.getValue("relaxation") || 0.9,
      showGUI: true
    };

    this.gui = new GUI();
    this.gui.add(this.settings, "grid", 2, 256, 1).onFinishChange(() => this.regenerateGrid());
    this.gui.add(this.settings, "mouse", 0, 1, 0.01);
    this.gui.add(this.settings, "strength", 0, 2, 0.01);
    this.gui.add(this.settings, "relaxation", 0.7, 0.999, 0.001);
  }

  setupResize() { window.addEventListener("resize", this.resize.bind(this)); }

  bindEvents() {
    // Use container-relative coords (fixes offset issues)
    this.container.addEventListener("mousemove", (e) => {
      const { x, y } = this.clientToNorm(e.clientX, e.clientY);
      this.mouse.x = x; this.mouse.y = y;
      this.mouse.vX = this.mouse.x - this.mouse.prevX;
      this.mouse.vY = this.mouse.y - this.mouse.prevY;
      this.mouse.prevX = this.mouse.x; this.mouse.prevY = this.mouse.y;
    });

    // Click to demo on-demand ripples
    this.container.addEventListener("click", (e) => {
      const { x, y } = this.clientToNorm(e.clientX, e.clientY);
      this.presetCRTBlast({ x, y });
    });
  }

  clientToNorm(clientX, clientY) {
    const r = this.container.getBoundingClientRect();
    return {
      x: clamp((clientX - r.left) / r.width, 0, 1),
      y: clamp((clientY - r.top) / r.height, 0, 1),
    };
  }
  normToGrid(nx, ny) {
    const gx = nx * this.size;
    const gy = (1 - ny) * this.size; // flip Y (grid origin at top-left)
    return { gx, gy };
  }

  resize() {
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer.setSize(this.width, this.height);

    // image cover fit
    this.imageAspect = 1 / 1.5; // update if your image aspect differs
    let a1, a2;
    if (this.height / this.width > this.imageAspect) { a1 = (this.width / this.height) * this.imageAspect; a2 = 1; }
    else { a1 = 1; a2 = (this.height / this.width) / this.imageAspect; }

    this.material.uniforms.resolution.value.set(this.width, this.height, a1, a2);
    this.camera.updateProjectionMatrix();
    this.regenerateGrid();
  }

  regenerateGrid() {
    this.size = this.settings.grid | 0;
    const width = this.size, height = this.size;
    const size = width * height;
    const data = new Float32Array(3 * size);
    for (let i = 0; i < size; i++) {
      const stride = i * 3;
      data[stride] = (Math.random() - 0.5) * 50;
      data[stride + 1] = (Math.random() - 0.5) * 50;
      data[stride + 2] = 0;
    }

    this.texture = new THREE.DataTexture(
      data, width, height, THREE.RGBFormat, THREE.FloatType
    );
    this.texture.magFilter = this.texture.minFilter = THREE.NearestFilter;
    this.texture.needsUpdate = true;

    if (this.material) {
      this.material.uniforms.uDataTexture.value = this.texture;
      this.material.uniforms.uDataTexture.value.needsUpdate = true;
    }
  }

  addObjects() {
    this.regenerateGrid();
    const texture = new THREE.Texture(this.img);
    texture.needsUpdate = true;

    this.material = new THREE.ShaderMaterial({
      extensions: { derivatives: "#extension GL_OES_standard_derivatives : enable" },
      side: THREE.DoubleSide,
      uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector4() },
        uTexture: { value: texture },
        uDataTexture: { value: this.texture },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
    });

    this.geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    this.plane = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.plane);
  }

  // ---------- PUBLIC EFFECT API ----------

  triggerPulse({ x, y, radius = 8, strength = 120, dir = "out" }) {
    const { gx, gy } = this.normToGrid(x, y);
    this.emitters.push({
      type: "pulse", x: gx, y: gy, r: radius, s: strength * (dir === "in" ? -1 : 1),
      t: 0, life: 0.25, decay: 0.9,
    });
  }

  triggerRipple({ x, y, radius = 18, amplitude = 80, wavelength = 8, speed = 3, decay = 0.92 }) {
    const { gx, gy } = this.normToGrid(x, y);
    this.emitters.push({
      type: "ripple", x: gx, y: gy, r: radius, amp: amplitude, k: (Math.PI * 2) / wavelength,
      w: speed, t: 0, life: 2.0, decay,
    });
  }

  triggerSlice({ y, height = 4, offset = 180, duration = 0.15 }) {
    // y in [0,1] normalized
    const gy = (1 - clamp(y, 0, 1)) * this.size;
    this.emitters.push({
      type: "slice", y: gy, h: height, off: offset, t: 0, life: duration, decay: 0.9,
    });
  }

  triggerSwirl({ x, y, radius = 14, strength = 120, clockwise = true }) {
    const { gx, gy } = this.normToGrid(x, y);
    this.emitters.push({
      type: "swirl", x: gx, y: gy, r: radius, s: strength * (clockwise ? 1 : -1),
      t: 0, life: 0.6, decay: 0.92,
    });
  }

  presetCRTBlast({ x, y }) {
    this.triggerPulse({ x, y, radius: 9, strength: 140, dir: "out" });
    this.triggerRipple({ x, y, radius: 22, amplitude: 90, wavelength: 7, speed: 4.0 });
    this.triggerSlice({ y, height: 3, offset: 220, duration: 0.12 });
    // optional: quick swirl for drama
    this.triggerSwirl({ x, y, radius: 10, strength: 100, clockwise: Math.random() > 0.5 });
  }

  // ---------- FIELD UPDATE ----------

  updateDataTexture(dt) {
    const data = this.texture.image.data;
    const N = this.size;
    const aspect = this.height / this.width;

    // decay velocities
    const relax = this.settings.relaxation;
    for (let i = 0; i < data.length; i += 3) {
      data[i] *= relax;
      data[i + 1] *= relax;
    }

    // mouse push (kept from your original)
    if ((this.mouse.vX !== 0 || this.mouse.vY !== 0) && this.settings.mouse > 0) {
      const maxDist = N * this.settings.mouse;
      const maxDistSq = maxDist * maxDist;
      const gridMouseX = N * this.mouse.x;
      const gridMouseY = N * (1 - this.mouse.y);

      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const dx = gridMouseX - i;
          const dy = gridMouseY - j;
          const distSq = (dx * dx) / aspect + dy * dy;
          if (distSq < maxDistSq && distSq > 0.0001) {
            const idx = 3 * (i + N * j);
            let power = maxDist / Math.sqrt(distSq);
            power = clamp(power, 0, 10);
            data[idx] += this.settings.strength * 100 * this.mouse.vX * power;
            data[idx + 1] -= this.settings.strength * 100 * this.mouse.vY * power;
          }
        }
      }
      this.mouse.vX *= 0.9; this.mouse.vY *= 0.9;
    }

    // on-demand emitters
    if (this.emitters.length) {
      for (let e = this.emitters.length - 1; e >= 0; e--) {
        const em = this.emitters[e];
        em.t += dt;
        const r2 = em.r ? em.r * em.r : 0;

        if (em.type === "pulse" || em.type === "swirl" || em.type === "ripple") {
          for (let j = 0; j < N; j++) {
            for (let i = 0; i < N; i++) {
              const dx = i - em.x;
              const dy = j - em.y;
              const d2 = (dx * dx) / aspect + dy * dy;
              if (d2 > r2 || d2 < 0.0001) continue;

              const d = Math.sqrt(d2);
              const fall = 1 - (d / em.r);
              const idx = 3 * (i + N * j);

              if (em.type === "pulse") {
                // radial push/pull
                const ux = dx / (d + 1e-4);
                const uy = dy / (d + 1e-4);
                const f = em.s * smoothstep(0, 1, fall);
                data[idx] += f * ux;
                data[idx + 1] += f * uy;
              } else if (em.type === "swirl") {
                // tangential field
                const ux = -dy / (d + 1e-4);
                const uy = dx / (d + 1e-4);
                const f = em.s * smoothstep(0, 1, fall);
                data[idx] += f * ux;
                data[idx + 1] += f * uy;
              } else if (em.type === "ripple") {
                // outward traveling ring
                const phase = em.k * (d - em.w * em.t);
                const amp = em.amp * smoothstep(0, 1, fall) * Math.sin(phase);
                const ux = dx / (d + 1e-4);
                const uy = dy / (d + 1e-4);
                data[idx] += amp * ux;
                data[idx + 1] += amp * uy;
              }
            }
          }
          em.amp && (em.amp *= em.decay); // ripple amplitude decay
          em.s && (em.s *= em.decay);     // pulse/swirl strength decay
        } else if (em.type === "slice") {
          // horizontal band offset (glitch tear)
          const y0 = Math.max(0, Math.floor(em.y - em.h / 2));
          const y1 = Math.min(N - 1, Math.floor(em.y + em.h / 2));
          for (let j = y0; j <= y1; j++) {
            for (let i = 0; i < N; i++) {
              const idx = 3 * (i + N * j);
              data[idx] += em.off * (0.85 + 0.3 * Math.random()); // x shift
              // tiny vertical wobble
              data[idx + 1] += (em.off * 0.1) * (Math.random() - 0.5);
            }
          }
          em.off *= em.decay;
        }

        if (em.t > em.life || (Math.abs(em.s || 0) < 0.5 && Math.abs(em.amp || 0) < 0.5 && Math.abs(em.off || 0) < 1)) {
          this.emitters.splice(e, 1);
        }
      }
    }

    this.texture.needsUpdate = true;
  }

  render() {
    if (!this.isPlaying) return;
    this.time += 0.05;
    const dt = 1 / 60; // frame step for emitter evolution
    this.updateDataTexture(dt);
    this.material.uniforms.time.value = this.time;
    requestAnimationFrame(this.render.bind(this));
    this.renderer.render(this.scene, this.camera);
  }
}
