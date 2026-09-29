// Real-time braai: a boerewors coil on a grid over live coals.
// Everything is procedural — no model files — so it loads fast and scales to any screen.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

/* ------------------------------------------------------------------ */
/* GLSL helpers                                                        */
/* ------------------------------------------------------------------ */
const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
// Derivative bump mapping from a procedural height (same maths as three's perturbNormalArb).
vec3 bumpNormal(vec3 surf_pos, vec3 surf_norm, float h, float s){
  vec3 sx=dFdx(surf_pos); vec3 sy=dFdy(surf_pos);
  vec3 r1=cross(sy,surf_norm); vec3 r2=cross(surf_norm,sx);
  float det=dot(sx,r1);
  vec2 dh=vec2(dFdx(h),dFdy(h))*s;
  vec3 grad=sign(det)*(dh.x*r1+dh.y*r2);
  return normalize(abs(det)*surf_norm-grad);
}
`;

/* ------------------------------------------------------------------ */
/* CPU noise for geometry displacement                                 */
/* ------------------------------------------------------------------ */
function hash3(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let xf = x - xi, yf = y - yi, zf = z - zi;
  xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf); zf = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf),
    l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf) * 2 - 1;
}
function fbm(x, y, z, oct = 4) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); a *= 0.5; f *= 2.03; }
  return s;
}
const rand = (() => { let s = 1337; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();

/* ------------------------------------------------------------------ */
export function createBraai(canvas, { reducedMotion = false, mobile = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance', alpha: false });
  const maxDpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
  let dpr = maxDpr;
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // nothing that casts shadows moves: bake once
  renderer.shadowMap.needsUpdate = true;

  const scene = new THREE.Scene();
  const BG = new THREE.Color(0x0c0806);
  scene.background = BG;
  scene.fog = new THREE.FogExp2(BG, 0.085);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.12;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);

  const U = {
    uTime: { value: 0 },
    uIgnite: { value: reducedMotion ? 1 : 0 },
  };

  /* ---------------- lights ---------------- */
  const key = new THREE.SpotLight(0xffd6ae, 70, 0, 0.42, 0.65, 2);
  key.position.set(-2.6, 5.4, 2.4);
  key.target.position.set(0.1, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.015;
  key.shadow.camera.near = 2; key.shadow.camera.far = 12;
  scene.add(key, key.target);

  const rim = new THREE.DirectionalLight(0xffc49a, 0.3);
  rim.position.set(1.5, 2.2, -5);
  scene.add(rim);

  const coalLights = [
    [0, -0.55, 0.1], [-1.1, -0.6, -0.5], [1.0, -0.6, 0.6], [0.4, -0.6, -1.0],
  ].map(([x, y, z]) => {
    const l = new THREE.PointLight(0xff5a14, 0, 4.5, 1.6);
    l.position.set(x, y, z);
    l.userData.base = new THREE.Vector3(x, y, z);
    scene.add(l);
    return l;
  });

  /* ---------------- boerewors coil ---------------- */
  const R = 0.15;               // wors radius
  const turns = 3.25;
  const r0 = 0.3;
  const pitch = 2 * R * 1.03;   // spacing between rings
  class Spiral extends THREE.Curve {
    getPoint(t, target = new THREE.Vector3()) {
      const a = t * turns * Math.PI * 2;
      const r = r0 + pitch * a / (Math.PI * 2);
      return target.set(Math.cos(a) * r, R, Math.sin(a) * r);
    }
  }
  const spiral = new Spiral();
  const worsGeo = new THREE.TubeGeometry(spiral, mobile ? 700 : 1300, R, mobile ? 20 : 30, false);
  {
    const pos = worsGeo.attributes.position, nor = worsGeo.attributes.normal;
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
      // lumpy mince under the casing
      const d = fbm(v.x * 7, v.y * 7, v.z * 7, 3) * 0.012 + fbm(v.x * 22, v.y * 22, v.z * 22, 2) * 0.004;
      v.addScaledVector(n, d);
      // sits heavy on the grid: flatten the underside
      if (v.y < 0.02) v.y = 0.02 + (v.y - 0.02) * 0.22;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  const worsMat = new THREE.MeshPhysicalMaterial({
    color: 0x7a2a18, roughness: 0.4, metalness: 0,
    clearcoat: 0.6, clearcoatRoughness: 0.28,
    sheen: 0.35, sheenColor: new THREE.Color(0xff9a6a), sheenRoughness: 0.5,
  });
  worsMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.uniforms.uIgnite = U.uIgnite;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjP; varying vec3 vWN; varying float vWorldZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjP = position; vWN = normalize(mat3(modelMatrix) * normal); vWorldZ = (modelMatrix * vec4(position, 1.0)).z;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjP; varying vec3 vWN; varying float vWorldZ; uniform float uTime; uniform float uIgnite;\n' + NOISE)
      .replace('#include <color_fragment>', /* glsl */`
        #include <color_fragment>
        vec3 wp = vObjP;
        float n1 = snoise(wp * 4.5) * 0.5 + 0.5;
        float n2 = snoise(wp * 13.0 + 3.1) * 0.5 + 0.5;
        float up = clamp(vWN.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 raw     = vec3(0.23, 0.035, 0.028);
        vec3 brown   = vec3(0.12, 0.038, 0.012);
        vec3 caramel = vec3(0.26, 0.085, 0.018);
        vec3 charC   = vec3(0.012, 0.005, 0.003);
        float cook = smoothstep(0.25, 0.95, n1 * 0.75 + (1.0 - up) * 0.55 + 0.1);
        vec3 col = mix(raw, brown, cook);
        col = mix(col, caramel, smoothstep(0.45, 0.85, n2) * 0.7);
        // grid marks from the first side: parallel to the rods, broken where the wors lifted off
        float gline = abs(fract(vWorldZ * 10.0) - 0.5);
        float mark = (1.0 - smoothstep(0.07, 0.17, gline)) * smoothstep(0.35, 0.75, up)
                   * smoothstep(0.35, 0.65, snoise(wp * 3.0 + 9.0) * 0.5 + 0.5);
        col = mix(col, charC, mark * 0.8);
        col = mix(col, charC * 2.0, (1.0 - up) * 0.6);
        float mince = 1.0 - abs(snoise(wp * 13.0));
        float fat = smoothstep(0.66, 0.78, snoise(wp * 30.0));
        float spice = smoothstep(0.72, 0.8, snoise(wp * 26.0 + 17.0));
        col = mix(col, vec3(0.55, 0.3, 0.2), fat * 0.35 * (1.0 - mark));
        col = mix(col, vec3(0.012, 0.006, 0.003), spice * 0.8);
        diffuseColor.rgb = col;
      `)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(mix(0.46, 0.36, fat) + mark * 0.35 - mince * 0.08, 0.05, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float hgt = mince * mince * 0.8 + snoise(wp * 5.0) * 0.4 + fat * 0.15 - mark * 0.5;
        normal = bumpNormal(-vViewPosition, normal, hgt, 0.006);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.28, 0.05) * 0.35 * pow(1.0 - up, 3.0) * uIgnite;`);
  };
  const wors = new THREE.Mesh(worsGeo, worsMat);
  wors.castShadow = true; wors.receiveShadow = true;
  // tied-off ends
  const capGeo = new THREE.SphereGeometry(R * 0.98, 24, 16);
  [0, 1].forEach((t) => {
    const cap = new THREE.Mesh(capGeo, worsMat);
    spiral.getPoint(t, cap.position);
    cap.position.y = R * 0.92;
    cap.scale.set(1, 0.9, 1);
    cap.castShadow = true;
    wors.add(cap);
  });
  const coil = new THREE.Group();
  coil.add(wors);
  coil.rotation.y = 0.4;
  scene.add(coil);

  /* ---------------- braai grid ---------------- */
  const steel = new THREE.MeshStandardMaterial({ color: 0x26221f, metalness: 0.85, roughness: 0.46 });
  const rodGeo = new THREE.CylinderGeometry(0.014, 0.014, 4.6, 10);
  rodGeo.rotateZ(Math.PI / 2);
  const rodCount = 35;
  const rods = new THREE.InstancedMesh(rodGeo, steel, rodCount);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < rodCount; i++) {
    m4.makeTranslation(0, -0.014, -1.7 + i * 0.1);
    rods.setMatrixAt(i, m4);
  }
  rods.castShadow = true; rods.receiveShadow = true;
  scene.add(rods);
  const frameGeo = new THREE.CylinderGeometry(0.03, 0.03, 3.5, 10);
  frameGeo.rotateX(Math.PI / 2);
  [-2.05, -0.7, 0.7, 2.05].forEach((x) => {
    const f = new THREE.Mesh(frameGeo, steel);
    f.position.set(x, -0.05, 0);
    f.castShadow = true;
    scene.add(f);
  });

  /* ---------------- fire bowl ---------------- */
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(2.55, 2.25, 1.0, 72, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x1a1512, metalness: 0.7, roughness: 0.62, side: THREE.DoubleSide })
  );
  bowl.position.y = -0.62;
  bowl.receiveShadow = true;
  scene.add(bowl);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.3, 48), new THREE.MeshStandardMaterial({ color: 0x0d0a08, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.1;
  scene.add(floor);

  /* ---------------- coals ---------------- */
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.92, metalness: 0, flatShading: true });
  coalMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.uniforms.uIgnite = U.uIgnite;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN2;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wpp = vec4(transformed, 1.0);
        vec3 wn = normal;
        #ifdef USE_INSTANCING
          wpp = instanceMatrix * wpp; wn = mat3(instanceMatrix) * wn;
        #endif
        vWP = (modelMatrix * wpp).xyz; vWN2 = normalize(mat3(modelMatrix) * wn);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN2; uniform float uTime; uniform float uIgnite;\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float ashN = snoise(vWP * 9.0) * 0.5 + 0.5;
        float top = smoothstep(0.15, 0.95, vWN2.y);
        float ashAmt = top * smoothstep(0.35, 0.8, ashN);
        diffuseColor.rgb = mix(vec3(0.022, 0.02, 0.018), vec3(0.40, 0.385, 0.37), ashAmt * 0.9);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float cn = snoise(vWP * 7.0 + vec3(0.0, uTime * 0.12, 0.0));
        float crack = pow(1.0 - abs(cn), 16.0);
        float zone = smoothstep(0.0, 0.75, snoise(vWP * 1.4 + vec3(uTime * 0.05, 0.0, -uTime * 0.03)));
        float flick = 0.72 + 0.28 * sin(uTime * 2.7 + vWP.x * 7.0 + vWP.z * 5.0);
        float heat = zone * flick * uIgnite;
        vec3 hot = mix(vec3(0.95, 0.13, 0.012), vec3(1.0, 0.52, 0.14), crack);
        float deep = (1.0 - smoothstep(-0.9, -0.6, vWP.y)) + (1.0 - top) * 0.6;
        totalEmissiveRadiance += hot * (crack * 2.6 + deep * 0.55 * zone) * heat * (1.0 - ashAmt * 0.9);`);
  };
  function coalGeometry(seed) {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const k = 1 + fbm(v.x * 1.7 + seed, v.y * 1.7, v.z * 1.7 - seed, 3) * 0.55;
      v.multiplyScalar(k);
      p.setXYZ(i, v.x, v.y * 0.72, v.z);
    }
    g.computeVertexNormals();
    return g;
  }
  const coalCount = mobile ? 210 : 420;
  const dummy = new THREE.Object3D();
  [3.1, 7.7, 12.9].forEach((seed, gi) => {
    const n = Math.floor(coalCount / 3);
    const inst = new THREE.InstancedMesh(coalGeometry(seed), coalMat, n);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 2.05;
      const s = 0.08 + rand() * 0.1;
      const mound = (1 - r / 2.2) * 0.22; // heaped in the middle
      dummy.position.set(Math.cos(a) * r, -0.98 + mound + rand() * 0.12 + (gi === 2 ? 0.07 : 0), Math.sin(a) * r);
      dummy.rotation.set(rand() * 6.3, rand() * 6.3, rand() * 6.3);
      dummy.scale.set(s * (0.8 + rand() * 0.5), s, s * (0.8 + rand() * 0.5));
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.receiveShadow = true;
    scene.add(inst);
  });

  /* ---------------- flames (flare-ups licking the grid) ---------------- */
  const flameMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uIgnite: U.uIgnite, uSeed: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime; uniform float uIgnite; uniform float uSeed;
      ${NOISE}
      void main(){
        vec2 p = vec2((vUv.x - 0.5) * 2.0, vUv.y);
        float t = uTime * 1.0 + uSeed * 13.0;
        float n = snoise(vec3(p.x * 2.2, p.y * 2.6 - t * 2.4, uSeed * 7.0)) * 0.5
                + snoise(vec3(p.x * 5.0, p.y * 6.0 - t * 4.0, uSeed)) * 0.25;
        float body = (1.0 - p.y) * (1.0 - pow(abs(p.x) * (1.2 + p.y * 1.6), 1.6));
        float f = smoothstep(0.08, 0.55, body + n * 0.55 - 0.1);
        float pulse = smoothstep(0.15, 0.9, sin(t * 0.35 + uSeed * 5.0) * 0.5 + 0.5);
        vec3 c = mix(vec3(0.9, 0.12, 0.01), vec3(1.0, 0.45, 0.08), smoothstep(0.2, 0.6, f));
        c = mix(c, vec3(1.0, 0.7, 0.3), smoothstep(0.8, 1.0, f));
        float edge = (1.0 - smoothstep(0.55, 0.95, abs(p.x))) * (1.0 - smoothstep(0.7, 0.98, vUv.y)) * smoothstep(0.0, 0.12, vUv.y);
        float a = f * pulse * uIgnite * edge;
        gl_FragColor = vec4(c * a * 1.25, a);
      }`,
  });
  const flames = [];
  const flameGeo = new THREE.PlaneGeometry(0.7, 1.1);
  flameGeo.translate(0, 0.55, 0);
  [[-0.9, 0.3], [0.6, -0.8], [1.2, 0.7], [-0.3, -1.1], [0.1, 0.9], [-1.4, -0.6]].forEach(([x, z], i) => {
    const m = flameMat.clone();
    m.uniforms.uTime = U.uTime; m.uniforms.uIgnite = U.uIgnite;
    m.uniforms.uSeed = { value: i * 0.73 + 0.2 };
    const f = new THREE.Mesh(flameGeo, m);
    f.position.set(x, -0.82, z);
    f.scale.setScalar(0.7 + (i % 3) * 0.2);
    f.renderOrder = 2;
    scene.add(f);
    flames.push(f);
  });

  /* ---------------- embers ---------------- */
  const EMBERS = reducedMotion ? 120 : (mobile ? 380 : 900);
  const eg = new THREE.BufferGeometry();
  const seeds = new Float32Array(EMBERS * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = rand();
  eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(EMBERS * 3), 3));
  eg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const emberMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uIgnite: U.uIgnite, uSize: { value: 46 }, uPR: { value: dpr } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec4 aSeed; uniform float uTime; uniform float uSize; uniform float uPR;
      varying float vLife; varying float vHot;
      void main(){
        float speed = 0.07 + aSeed.w * 0.13;
        float life = fract(uTime * speed + aSeed.x);
        vec3 p = vec3((aSeed.y - 0.5) * 3.4, -0.7, (aSeed.z - 0.5) * 3.0);
        p.y += life * 3.6 + life * life * 1.2;
        p.x += sin(uTime * 0.8 + aSeed.y * 30.0) * 0.28 * life + (aSeed.z - 0.5) * life * 1.4;
        p.z += cos(uTime * 0.6 + aSeed.x * 30.0) * 0.28 * life;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPR * (0.25 + aSeed.w * 0.9) * (1.0 - life * 0.6) / -mv.z;
        vLife = life; vHot = aSeed.w;
      }`,
    fragmentShader: `
      uniform float uIgnite; varying float vLife; varying float vHot;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float core = pow(1.0 - smoothstep(0.0, 0.5, d), 3.0);
        vec3 c = mix(vec3(1.0, 0.78, 0.4), vec3(1.0, 0.2, 0.03), smoothstep(0.0, 0.7, vLife));
        float a = core * smoothstep(0.0, 0.04, vLife) * (1.0 - smoothstep(0.45, 0.95, vLife)) * uIgnite;
        float halo = (1.0 - smoothstep(0.0, 0.5, d)) * 0.18;
        gl_FragColor = vec4(c * (a * (0.9 + vHot * 0.9) + halo * a), a);
      }`,
  });
  const embers = new THREE.Points(eg, emberMat);
  embers.frustumCulled = false;
  scene.add(embers);

  /* ---------------- smoke ---------------- */
  const smokeTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    for (let i = 0; i < 46; i++) {
      const x = 128 + (rand() - 0.5) * 110, y = 128 + (rand() - 0.5) * 110, r = 30 + rand() * 70;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,255,255,${0.05 + rand() * 0.06})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const smoke = [];
  const SMOKE = reducedMotion ? 0 : (mobile ? 14 : 26);
  for (let i = 0; i < SMOKE; i++) {
    const m = new THREE.SpriteMaterial({ map: smokeTex, color: 0x6e625a, transparent: true, depthWrite: false, opacity: 0 });
    const s = new THREE.Sprite(m);
    s.userData = { seed: rand(), x: (rand() - 0.5) * 2.2, z: (rand() - 0.5) * 2, spin: (rand() - 0.5) * 0.4 };
    scene.add(s);
    smoke.push(s);
  }

  /* ---------------- post ---------------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.9, 0.6, 0.78);
  composer.addPass(bloom);
  const haze = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: U.uTime, uAmt: { value: mobile ? 0.6 : 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uTime; uniform float uAmt; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 uv = vUv;
        float mask = (1.0 - smoothstep(0.25, 1.0, uv.y)) * uAmt;
        vec2 q = vec2(uv.x * 16.0, uv.y * 10.0 - uTime * 1.8);
        vec2 off = vec2(vn(q) - 0.5, vn(q + 7.3) - 0.5) * 0.0042 * mask;
        vec2 dir = uv - 0.5; float ca = dot(dir, dir) * 0.012;
        vec3 col;
        col.r = texture2D(tDiffuse, uv + off + dir * ca).r;
        col.g = texture2D(tDiffuse, uv + off).g;
        col.b = texture2D(tDiffuse, uv + off - dir * ca).b;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  haze.uniforms.uTime = U.uTime; // ShaderPass clones uniforms; re-link the shared clock
  composer.addPass(haze);
  composer.addPass(new OutputPass());
  // phones render without MSAA; FXAA smooths the grid and coil edges cheaply
  const fxaa = mobile ? new ShaderPass(FXAAShader) : null;
  if (fxaa) composer.addPass(fxaa);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: U.uTime },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        vec2 d = vUv - 0.5; d.x *= 1.3;
        c *= mix(1.0, 0.42, smoothstep(0.25, 0.95, length(d)));   // vignette
        c += vec3(0.012, 0.006, 0.0);                             // warm lift in the blacks
        c += (h(vUv * 1024.0 + fract(uTime) * 91.0) - 0.5) * 0.035; // film grain
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  grade.uniforms.uTime = U.uTime;
  composer.addPass(grade);

  /* ---------------- camera choreography ---------------- */
  const poses = {
    hero: { pos: new THREE.Vector3(0.4, 3.0, 5.3), look: new THREE.Vector3(0.0, -0.35, 0) },
    over: { pos: new THREE.Vector3(0.05, 6.4, 0.7), look: new THREE.Vector3(0, 0, 0) },
    low:  { pos: new THREE.Vector3(-3.9, 0.9, 3.1), look: new THREE.Vector3(0.35, 0.05, 0) },
  };
  const state = { heroP: 0, endP: 0, intro: reducedMotion ? 1 : 0, mx: 0, my: 0, tmx: 0, tmy: 0, active: true };
  const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3(), curLook = new THREE.Vector3();
  const ease = (t) => t * t * (3 - 2 * t);

  function updateCamera(t) {
    const hp = ease(Math.min(Math.max(state.heroP, 0), 1));
    const ep = ease(Math.min(Math.max(state.endP, 0), 1));
    tmpPos.copy(poses.hero.pos).lerp(poses.over.pos, hp);
    tmpLook.copy(poses.hero.look).lerp(poses.over.look, hp);
    if (ep > 0) {
      tmpPos.lerp(poses.low.pos, ep);
      tmpLook.lerp(poses.low.look, ep);
    }
    // intro dolly: start wider and higher, settle in
    const k = 1 - ease(state.intro);
    tmpPos.multiplyScalar(1 + k * 0.55);
    tmpPos.y += k * 0.8;
    // slow breathing orbit + pointer parallax
    const drift = reducedMotion ? 0 : Math.sin(t * 0.12) * 0.12;
    const ang = drift + state.mx * 0.14;
    const cs = Math.cos(ang), sn = Math.sin(ang);
    const x = tmpPos.x * cs - tmpPos.z * sn, z = tmpPos.x * sn + tmpPos.z * cs;
    tmpPos.x = x; tmpPos.z = z;
    tmpPos.y += state.my * 0.18;
    camera.position.copy(tmpPos);
    curLook.copy(tmpLook);
    camera.lookAt(curLook);
  }

  /* ---------------- sizing & framing ---------------- */
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    if (fxaa) fxaa.uniforms.resolution.value.set(1 / (w * dpr), 1 / (h * dpr));
    bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h;
    // push the coil right of the headline on wide screens, up above it on phones
    if (w > 900) camera.setViewOffset(w, h, -w * 0.17, 0, w, h);
    else if (w <= 700) camera.setViewOffset(w, h, 0, h * 0.2, w, h);
    else camera.clearViewOffset();
    camera.fov = w / h < 0.8 ? 50 : 32;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  window.addEventListener('pointermove', (e) => {
    state.tmx = (e.clientX / window.innerWidth) * 2 - 1;
    state.tmy = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  /* ---------------- loop ---------------- */
  const clock = new THREE.Clock();
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!state.active) return;
    tick(Math.min(clock.getDelta(), 0.05));
  }
  // adaptive quality on slow GPUs: first drop the heat haze, then step resolution down
  // to a floor that still looks sharp (1x on phones, whose screens are dense)
  const dprFloor = mobile ? Math.min(1, maxDpr) : 0.75;
  const slowFrame = mobile ? 1 / 28 : 1 / 40;
  let perfT = 0, perfN = 0, perfSettled = false;
  function adapt(dt) {
    if (perfSettled || state.intro < 1) return;
    perfT += dt; perfN++;
    if (perfT < 1.5) return;
    const avg = perfT / perfN; perfT = 0; perfN = 0;
    if (avg <= slowFrame) { perfSettled = true; return; }
    if (haze.enabled) { haze.enabled = false; return; }
    if (dpr > dprFloor) {
      dpr = Math.max(dprFloor, dpr - 0.15);
      renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr);
      emberMat.uniforms.uPR.value = dpr;
      if (fxaa) fxaa.uniforms.resolution.value.set(1 / (window.innerWidth * dpr), 1 / (window.innerHeight * dpr));
    } else perfSettled = true;
  }
  function tick(dt) {
    adapt(dt);
    const t = (U.uTime.value += reducedMotion ? dt * 0.25 : dt);

    state.mx += (state.tmx - state.mx) * 0.04;
    state.my += (state.tmy - state.my) * 0.04;
    updateCamera(t);

    const ig = U.uIgnite.value;
    coalLights.forEach((l, i) => {
      const f = 0.78 + 0.22 * Math.sin(t * (3.1 + i) + i * 2.0) * Math.sin(t * (1.7 + i * 0.3));
      l.intensity = 3.2 * f * ig;
      l.position.x = l.userData.base.x + Math.sin(t * 2.3 + i) * 0.05;
    });
    key.intensity = 48 * (0.35 + 0.65 * ig);

    flames.forEach((f) => f.quaternion.copy(camera.quaternion));

    for (const s of smoke) {
      const d = s.userData;
      const life = (t * 0.045 + d.seed) % 1;
      s.position.set(d.x + Math.sin(t * 0.2 + d.seed * 9) * 0.4 * life, 0.45 + life * 3.8, d.z - 0.4 + life * 0.5);
      s.scale.setScalar(0.9 + life * 3.2);
      s.material.rotation = d.seed * 6 + t * d.spin;
      s.material.opacity = Math.sin(life * Math.PI) * 0.075 * ig * Math.min(1, life * 3);
    }

    composer.render();
  }
  frame();

  return {
    setHero(p) { state.heroP = p; },
    setEnd(p) { state.endP = p; },
    setActive(a) { if (a && !state.active) clock.getDelta(); state.active = a; },
    get uniforms() { return U; },
    get state() { return state; },
    dispose() { cancelAnimationFrame(raf); renderer.dispose(); },
  };
}
