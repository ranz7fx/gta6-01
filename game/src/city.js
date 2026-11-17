// city.js — builds Solmar: streets, blocks, buildings, palms, beach, pier, sky and
// neon. Everything is procedural geometry + canvas textures; no external assets.
import * as THREE from 'three';
import { CITY, PALETTE, PLACES } from './config.js';
import { mulberry32 } from './state.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Facade texture: warm wall + a grid of windows, some lit.
function facadeTexture(base, litRatio, rng) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#' + base.toString(16).padStart(6, '0');
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, h - 10, w, 10);
    for (let y = 14; y < h - 18; y += 26) {
      for (let x = 12; x < w - 12; x += 24) {
        const lit = rng() < litRatio;
        g.fillStyle = lit ? '#ffd98a' : 'rgba(20,26,34,0.72)';
        g.fillRect(x, y, 14, 18);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(x, y, 14, 3);
      }
    }
  });
}

function billboardTexture(text, bg, fg) {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = '900 64px Arial Black, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 - 10);
    g.font = '700 28px Trebuchet MS, sans-serif';
    g.fillText('S O L M A R', w / 2, h / 2 + 52);
  });
}

export function buildCity(state) {
  const scene = state.scene;
  const rng = mulberry32(777);
  const city = { buildings: [], colliders: [], windowMats: [], lampMats: [], neonMats: [], lights: [] };
  state.city = city;

  // --- sky dome (shader: warm horizon, teal-blue zenith, sun glow) ---
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x7ec8d8) },
      mid: { value: new THREE.Color(0xffc98a) },
      bot: { value: new THREE.Color(0xff9e57) },
      sunDir: { value: new THREE.Vector3(0.4, 0.25, 0.6).normalize() },
      sunCol: { value: new THREE.Color(0xffe9a8) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; uniform vec3 top,mid,bot,sunDir,sunCol;
      void main(){ vec3 d = normalize(vP); float h = clamp(d.y*1.6+0.12,0.0,1.0);
        vec3 col = mix(bot, mid, smoothstep(0.0,0.35,h)); col = mix(col, top, smoothstep(0.35,0.9,h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunCol * (pow(s, 220.0)*1.4 + pow(s, 10.0)*0.28);
        gl_FragColor = vec4(col, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), skyMat);
  scene.add(sky);
  state.skyMesh = sky; state.skyMat = skyMat;

  // --- lights ---
  const hemi = new THREE.HemisphereLight(0xffe0b3, 0x3d4a55, 0.9);
  scene.add(hemi); state.hemi = hemi;
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700; sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target); state.sun = sun;
  // moon: a cool fill light that wakes up at night so the city never goes black
  const moon = new THREE.DirectionalLight(0x8fa8d8, 0);
  moon.position.set(120, 220, -80);
  scene.add(moon); scene.add(moon.target); state.moon = moon;

  // --- ground: asphalt city slab, sand strip, sea ---
  const half = CITY.half + 30;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 300, half * 2 + 300),
    new THREE.MeshLambertMaterial({ color: PALETTE.asphalt }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 40);
  ground.receiveShadow = true; scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 300, 60),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, CITY.half + 42);
  sand.receiveShadow = true; scene.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 600, 500),
    new THREE.MeshPhongMaterial({ color: PALETTE.sea, shininess: 90, specular: 0x99ddff }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.4, CITY.half + 72 + 250);
  scene.add(sea); state.seaMesh = sea;
  // foam lines along the shore
  for (let i = 0; i < 3; i++) {
    const foam = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 280, 1.6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 - i * 0.12 }));
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(0, 0.05 + i * 0.01, CITY.half + 70 + i * 5);
    scene.add(foam);
  }

  // --- sidewalks + road markings ---
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const curbMat = new THREE.MeshLambertMaterial({ color: PALETTE.curb });
  const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.asphaltLine });
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf2ede2 });
  for (const b of CITY.blockCentres()) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(CITY.block + 4, 0.3, CITY.block + 4), walkMat);
    walk.position.set(b.x, 0.15, b.z); walk.receiveShadow = true; scene.add(walk);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(CITY.block + 5, 0.32, CITY.block + 5), curbMat);
    curb.position.set(b.x, 0.1, b.z); scene.add(curb);
  }
  // centre dashes along every street
  const lines = CITY.streetLines();
  for (const s of lines) {
    for (let t = -CITY.half; t < CITY.half; t += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 5), lineMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(s, 0.06, t); scene.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.7), lineMat);
      dash2.rotation.x = -Math.PI / 2; dash2.position.set(t, 0.06, s); scene.add(dash2);
    }
    // crosswalk stripes at the two ends of each street
    for (const c of [-CITY.half + 8, CITY.half - 8]) {
      for (let k = -5; k <= 5; k += 2.4) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 7), whiteMat);
        stripe.rotation.x = -Math.PI / 2; stripe.position.set(s + k, 0.06, c); scene.add(stripe);
      }
    }
  }

  // --- buildings ---
  const downtown = (x, z) => Math.hypot(x, z) < 110;
  for (const b of CITY.blockCentres()) {
    const n = downtown(b.x, b.z) ? 1 + Math.floor(rng() * 2) : 1 + Math.floor(rng() * 3);
    const slots = n === 1 ? [[0, 0, 0.86]] : n === 2
      ? [[-0.22, -0.2, 0.42], [0.22, 0.22, 0.42]]
      : [[-0.24, -0.24, 0.4], [0.24, -0.24, 0.4], [0, 0.26, 0.44]];
    for (const [ox, oz, sc] of slots) {
      const w = CITY.block * sc * (0.9 + rng() * 0.2);
      const d = CITY.block * sc * (0.9 + rng() * 0.2);
      const tall = downtown(b.x, b.z) ? 18 + rng() * 34 : 8 + rng() * 14;
      const h = tall;
      const col = PALETTE.building[Math.floor(rng() * PALETTE.building.length)];
      const tex = facadeTexture(col, 0.28, rng);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 16)));
      const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffc36b, emissiveMap: tex, emissiveIntensity: 0 });
      city.windowMats.push(mat);
      const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a4a3a });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mat, mat, roofMat, roofMat, mat, mat]);
      const x = b.x + ox * CITY.block, z = b.z + oz * CITY.block;
      mesh.position.set(x, h / 2 + 0.3, z);
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh);
      city.buildings.push({ x, z, hw: w / 2, hd: d / 2, h });
      city.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      // rooftop box (AC unit / water tank) for silhouette variety
      if (rng() < 0.6) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 3),
          new THREE.MeshLambertMaterial({ color: 0x8a7a66 }));
        box.position.set(x + (rng() - 0.5) * w * 0.4, h + 1.4, z + (rng() - 0.5) * d * 0.4);
        box.castShadow = true; scene.add(box);
      }
    }
  }

  // --- downtown towers (skyline anchors) ---
  const towers = [
    { x: -30, z: -30, w: 26, d: 26, h: 74, col: 0xe87a5d },
    { x: 36, z: 24, w: 22, d: 22, h: 62, col: 0x7fb8a4 },
    { x: -6, z: 42, w: 20, d: 20, h: 54, col: 0xf5d76e },
  ];
  for (const t of towers) {
    const tex = facadeTexture(t.col, 0.4, rng);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 4);
    const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffc36b, emissiveMap: tex, emissiveIntensity: 0 });
    city.windowMats.push(mat);
    const m = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h, t.d), mat);
    m.position.set(t.x, t.h / 2 + 0.3, t.z); m.castShadow = true; scene.add(m);
    city.colliders.push({ minX: t.x - t.w / 2, maxX: t.x + t.w / 2, minZ: t.z - t.d / 2, maxZ: t.z + t.d / 2 });
    city.buildings.push({ x: t.x, z: t.z, hw: t.w / 2, hd: t.d / 2, h: t.h });
  }

  // --- billboards ---
  const boards = [
    { x: -120, z: -150, ry: Math.PI / 4, text: 'COMET GT', bg: '#ff6b35', fg: '#fff7ec' },
    { x: 132, z: -60, ry: -Math.PI / 2, text: 'SOLMAR', bg: '#0f8b8d', fg: '#ffe9c4' },
    { x: 60, z: 150, ry: Math.PI, text: "MAMA ROSA'S", bg: '#f5a623', fg: '#1d1a16' },
  ];
  for (const b of boards) {
    const g = new THREE.Group();
    const tex = billboardTexture(b.text, b.bg, b.fg);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(24, 12),
      new THREE.MeshBasicMaterial({ map: tex }));
    face.position.y = 16; g.add(face);
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.6, 16, 1.6),
      new THREE.MeshLambertMaterial({ color: 0x4a4038 }));
    post.position.y = 8; g.add(post);
    g.position.set(b.x, 0, b.z); g.rotation.y = b.ry;
    scene.add(g);
  }

  // --- palms along the beach road and scattered in blocks ---
  const palmSpots = [];
  for (let x = -CITY.half + 10; x <= CITY.half - 10; x += 18) palmSpots.push([x, CITY.half - 4]);
  for (let i = 0; i < 26; i++) {
    const b = CITY.blockCentres()[Math.floor(rng() * CITY.blockCentres().length)];
    palmSpots.push([b.x + (rng() - 0.5) * 34, b.z + (rng() - 0.5) * 34]);
  }
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
  const leafMat2 = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf2 });
  for (const [x, z] of palmSpots) {
    if (city.colliders.some(c => x > c.minX - 2 && x < c.maxX + 2 && z > c.minZ - 2 && z < c.maxZ + 2)) continue;
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 7, 6), trunkMat);
    trunk.position.y = 3.5; trunk.rotation.z = (rng() - 0.5) * 0.16; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.4, 4), i % 2 ? leafMat : leafMat2);
      leaf.position.y = 7.1;
      leaf.rotation.z = Math.PI / 2.6;
      leaf.rotation.y = (i / 7) * Math.PI * 2;
      leaf.translateY(0.6);
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    scene.add(g);
  }

  // --- street lamps (heads glow at night) ---
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2e2a26 });
  for (const s of lines) {
    for (let t = -CITY.half + 20; t < CITY.half; t += 60) {
      for (const side of [-1, 1]) {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.4, 6), poleMat);
        pole.position.y = 3.2; g.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 0.14), poleMat);
        arm.position.set(side * 0.8, 6.3, 0); g.add(arm);
        const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
        city.lampMats.push(headMat);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), headMat);
        head.position.set(side * 1.6, 6.2, 0); g.add(head);
        g.position.set(s + side * 8.4, 0, t);
        scene.add(g);
      }
    }
  }

  // --- traffic lights at the four central intersections ---
  for (const ix of [-30, 30]) for (const iz of [-30, 30]) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 5.4, 6), poleMat);
    pole.position.y = 2.7; g.add(pole);
    const boxMat = new THREE.MeshLambertMaterial({ color: 0x1d1a16 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.9, 0.7), boxMat);
    box.position.y = 5.4; g.add(box);
    const lampCols = [0xff3b30, 0xffcc00, 0x34c759];
    const lampMeshes = lampCols.map((c, i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshBasicMaterial({ color: c }));
      m.position.set(0, 6.05 - i * 0.55, 0.4); g.add(m); return m;
    });
    g.position.set(ix + 8.4, 0, iz + 8.4);
    scene.add(g);
    city.lights.push({ x: ix, z: iz, lamps: lampMeshes, phase: (ix + iz) / 60 });
  }

  // --- neon signs (downtown, glow at night) ---
  const neonSpots = [
    { x: -30, z: -16.5, text: 'HOTEL SOL', col: 0xff6b35 },
    { x: 36, z: 12.5, text: 'CASINO', col: 0xff5d8f },
    { x: -6, z: 31.5, text: 'TACOS 24H', col: 0x2ec4b6 },
  ];
  for (const n of neonSpots) {
    const tex = canvasTexture(256, 64, (g, w, h) => {
      g.fillStyle = '#140f0c'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#' + n.col.toString(16).padStart(6, '0');
      g.font = '900 40px Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(n.text, w / 2, h / 2);
    });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    city.neonMats.push(mat);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), mat);
    m.position.set(n.x, 12, n.z); m.rotation.y = n.z < 0 ? 0 : Math.PI;
    scene.add(m);
  }

  // --- pier (planks + posts, out into the sea) ---
  const plankMat = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
  for (let z = CITY.half + 40; z < CITY.half + 108; z += 2.2) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 2), plankMat);
    plank.position.set(PLACES.pier.x, 1.2, z); plank.castShadow = true; scene.add(plank);
  }
  for (const dz of [44, 76, 104]) {
    for (const dx of [-4.6, 4.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4, 6), poleMat);
      post.position.set(PLACES.pier.x + dx, 0, CITY.half + dz); scene.add(post);
    }
  }
  // beach umbrellas
  const umbCols = [0xff6b35, 0xf5d76e, 0x2ec4b6, 0xff5d8f];
  for (let i = 0; i < 8; i++) {
    const x = -170 + i * 42 + rng() * 10, z = CITY.half + 26 + rng() * 14;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 5), poleMat);
    pole.position.set(x, 1.5, z); scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.1, 8),
      new THREE.MeshLambertMaterial({ color: umbCols[i % 4] }));
    top.position.set(x, 3.1, z); top.castShadow = true; scene.add(top);
  }

  // --- distant skyline ring (silhouette beyond the city) ---
  const farMat = new THREE.MeshLambertMaterial({ color: 0xb09a80 });
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const r = 420 + rng() * 60;
    const w = 18 + rng() * 22, h = 26 + rng() * 60;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), farMat);
    m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r + 40);
    scene.add(m);
  }

  // --- Pay 'n Spray garage (repair + wanted clear) ---
  const spray = new THREE.Group();
  const sprayBase = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 14),
    new THREE.MeshLambertMaterial({ color: 0x2ec4b6 }));
  sprayBase.position.y = 4; sprayBase.castShadow = true; spray.add(sprayBase);
  const spraySign = new THREE.Mesh(new THREE.PlaneGeometry(16, 3),
    new THREE.MeshBasicMaterial({ map: billboardTexture("PAY 'N SPRAY", '#1d1a16', '#ffb347') }));
  spraySign.position.set(0, 9.6, 7.2); spray.add(spraySign);
  spray.position.set(PLACES.spray.x, 0, PLACES.spray.z);
  scene.add(spray);
  state.spray = { x: PLACES.spray.x, z: PLACES.spray.z, r: 12 };

  return city;
}

// Push a circle (x,z,r) out of every building collider. Returns corrected {x,z}.
export function collideBuildings(state, x, z, r) {
  for (const c of state.city.colliders) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 < 0.0001) { x = c.maxX + r; continue; }
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r; z = cz + (dz / d) * r;
    }
  }
  // city bounds + sea: never drive into the ocean past the pier line
  const lim = CITY.half + 34;
  x = Math.max(-CITY.half - 26, Math.min(CITY.half + 26, x));
  z = Math.max(-CITY.half - 26, Math.min(lim, z));
  return { x, z };
}

export function onRoad(x, z) {
  const lines = CITY.streetLines();
  const halfRoad = CITY.road / 2 + 1;
  for (const s of lines) {
    if (Math.abs(x - s) < halfRoad || Math.abs(z - s) < halfRoad) return true;
  }
  return false;
}

// Nearest street centre + heading (0=east, PI/2=south...) for traffic spawning.
export function nearestStreet(x, z, rng) {
  const lines = CITY.streetLines();
  let best = null, bestD = 1e9, vertical = false;
  for (const s of lines) {
    const d = Math.abs(x - s);
    if (d < bestD) { bestD = d; best = s; vertical = false; }
    const d2 = Math.abs(z - s);
    if (d2 < bestD) { bestD = d2; best = s; vertical = true; }
  }
  if (!vertical) return { x: best + (rng() < 0.5 ? -3.2 : 3.2), z, heading: rng() < 0.5 ? 0 : Math.PI, vertical: false };
  return { x, z: best + (rng() < 0.5 ? -3.2 : 3.2), heading: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2, vertical: true };
}
