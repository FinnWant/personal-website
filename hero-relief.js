// Hero "relief": the hero's dot field redrawn in 3D. The dots swell slowly, the camera drifts
// and leans toward the pointer, the pointer makes a ripple, and every 2.6s (the header logo's
// heartbeat) a ripple rolls out from the point of the field under the header logo, so the
// logo's pulse visibly travels across the background. Plain WebGL, no library, one draw call
// per frame.
//
// Progressive enhancement only. It runs when: the hero exists, the viewport is wider than
// the 720px hero breakpoint, the visitor allows motion, and WebGL is available. Otherwise
// the CSS motion field (drifting 2D dots) stays as it is. It starts after page load and
// pauses while the hero is off-screen or the tab is hidden.
(() => {
  const field = document.querySelector(".hero--dark .motion-field");
  if (!field) return;
  if (!matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
  if (!matchMedia("(min-width: 721px)").matches) return;

  // World: the field is the z = 0 plane, +y runs away from the viewer; the camera looks
  // down at it at roughly 55°.
  const EYE = [0, -60, 190], TARGET = [8, 70, 0], FOV = 0.62;
  const FIELD_STEP = 7;      // dot spacing (~24 px on screen, like the 2D grid)
  const PERIOD = 2.6;        // seconds, = the header logo's heartbeat
  const WAVE_REACH = 260;    // world units the heartbeat ripple travels per beat

  // ---- Minimal mat4 helpers (column-major) ------------------------------------------------
  const perspective = (fovy, aspect, near, far) => {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  };
  const lookAt = (e, c, u) => {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
  };
  const mul = (a, b) => {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  };

  const VERT = `
    attribute vec2 aPos;
    uniform mat4 uMVP; uniform float uTime; uniform float uPhase; uniform float uReach;
    uniform vec2 uOrigin; uniform vec2 uMouse; uniform vec2 uRes; uniform float uDpr;
    varying float vLit; varying float vWarm; varying float vFog;
    void main() {
      vec4 flat0 = uMVP * vec4(aPos, 0.0, 1.0);
      vec2 scr = (flat0.xy / flat0.w * 0.5 + 0.5) * uRes;
      float pr = distance(scr, uMouse);
      float rip = exp(-pr * pr / 18000.0);
      float swell = sin(aPos.x * 0.05 + uTime * 0.8) * cos(aPos.y * 0.06 + uTime * 0.6) * 1.6;
      float rr = distance(aPos, uOrigin);
      float wave = exp(-pow(rr - uPhase * uReach, 2.0) / 120.0) * (1.0 - uPhase);
      vec4 p = uMVP * vec4(aPos, swell + wave * 4.0 + rip * 5.0, 1.0);
      gl_Position = p;
      gl_PointSize = uDpr * 2.6 * (230.0 / p.w);
      vLit = max(wave * 0.6, rip * 0.6);
      vWarm = max(wave, rip * 0.5);
      vFog = clamp(1.0 - (p.w - 200.0) / 320.0, 0.25, 1.0);
    }`;
  const FRAG = `
    precision mediump float;
    uniform vec3 uRed;
    varying float vLit; varying float vWarm; varying float vFog;
    void main() {
      float r = length(gl_PointCoord - 0.5);
      if (r > 0.5) discard;
      float edge = smoothstep(0.5, 0.4, r);
      vec3 col = mix(vec3(1.0), uRed, vWarm * 0.6);
      float a = mix(0.13, 0.78, vLit) * vFog * edge;
      gl_FragColor = vec4(col * a, a);
    }`;

  const token = (name, fallback) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const m = /^#?([0-9a-f]{6})$/i.exec(v) || /^#?([0-9a-f]{6})$/i.exec(fallback);
    return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  };

  const start = () => {
    const canvas = document.createElement("canvas");
    canvas.className = "relief-canvas";
    canvas.setAttribute("aria-hidden", "true");
    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "low-power" });
    if (!gl) return;

    const compile = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    // ---- The field: a flat grid of dots, displaced in the vertex shader ------------------
    const data = [];
    for (let y = -90; y <= 330; y += FIELD_STEP) {
      for (let x = -260; x <= 260; x += FIELD_STEP) data.push(x, y);
    }
    const count = data.length / 2;
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = {};
    for (const n of ["uMVP", "uTime", "uPhase", "uReach", "uOrigin", "uMouse", "uRes", "uDpr", "uRed"]) U[n] = gl.getUniformLocation(prog, n);
    gl.uniform3fv(U.uRed, token("--logo-head", "#f05252")); // same red as the logo's HEAD
    gl.uniform1f(U.uReach, WAVE_REACH);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    // Above the colour glows, in place of the 2D dot layers it replaces.
    field.insertBefore(canvas, field.querySelector(".motion-dots"));
    field.classList.add("has-relief");

    let w = 0, h = 0;

    // Screen point (px from the canvas's top-left) -> world point on the field plane, using
    // the un-swayed camera.
    const unproject = (sx, sy) => {
      const f = [TARGET[0] - EYE[0], TARGET[1] - EYE[1], TARGET[2] - EYE[2]];
      let l = Math.hypot(...f); f[0] /= l; f[1] /= l; f[2] /= l;
      const r = [f[1], -f[0], 0];
      l = Math.hypot(...r); r[0] /= l; r[1] /= l;
      const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
      const th = Math.tan(FOV / 2), nx = (sx / w) * 2 - 1, ny = 1 - (sy / h) * 2;
      const d = [0, 1, 2].map((i) => f[i] + r[i] * nx * th * (w / h) + u[i] * ny * th);
      const t = -EYE[2] / d[2];
      return [EYE[0] + d[0] * t, EYE[1] + d[1] * t];
    };
    // The heartbeat starts from the field directly under the header logo.
    const placeOrigin = () => {
      const mark = document.querySelector(".site-header .brand-mark");
      const fr = field.getBoundingClientRect();
      if (!mark || !w || !h) { gl.uniform2f(U.uOrigin, -120, 200); return; }
      const mr = mark.getBoundingClientRect();
      gl.uniform2f(U.uOrigin, ...unproject(mr.left + mr.width / 2 - fr.left, mr.top + mr.height / 2 - fr.top));
    };

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = field.clientWidth; h = field.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.uRes, w, h);
      gl.uniform1f(U.uDpr, dpr);
      placeOrigin();
    };
    resize();
    new ResizeObserver(resize).observe(field);

    // Pointer, in canvas pixels with y up (matches the shader's screen space). Listening on
    // the window covers the transparent header, which sits over the hero.
    let mx = -1e4, my = -1e4, sway = 0, swayTarget = 0;
    addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) { mx = my = -1e4; swayTarget = 0; return; }
      mx = x; my = r.height - y;
      swayTarget = (x / r.width) * 2 - 1;
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => { mx = my = -1e4; swayTarget = 0; });

    let running = false, raf = 0, onScreen = true;
    const t0 = performance.now();
    const frame = (now) => {
      raf = 0;
      if (!running) return;
      if (w > 0 && h > 0) {
        const t = (now - t0) / 1000;
        sway += (swayTarget - sway) * 0.04;
        const eye = [EYE[0] + Math.sin(t * 0.15) * 6 + sway * 8, EYE[1], EYE[2]];
        gl.uniformMatrix4fv(U.uMVP, false, new Float32Array(mul(perspective(FOV, w / h, 1, 1200), lookAt(eye, TARGET, [0, 0, 1]))));
        gl.uniform1f(U.uTime, t);
        gl.uniform1f(U.uPhase, (t % PERIOD) / PERIOD);
        gl.uniform2f(U.uMouse, mx, my);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.POINTS, 0, count);
      }
      raf = requestAnimationFrame(frame);
    };
    const setRunning = () => {
      const want = onScreen && document.visibilityState === "visible";
      if (want === running) return;
      running = want;
      if (running && !raf) raf = requestAnimationFrame(frame);
    };
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; setRunning(); }).observe(field);
    document.addEventListener("visibilitychange", setRunning);
    setRunning();

    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault(); running = false;
      field.classList.remove("has-relief"); canvas.remove();
    });
  };

  // Don't compete with the page's own load: start once it's loaded and the browser is idle.
  const later = () => ("requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 300));
  if (document.readyState === "complete") later();
  else addEventListener("load", later, { once: true });
})();
