/*  Nachtabfahrt – die 3D-Szene hinter der Seite.
 *
 *  Der Scrollfortschritt (0 … 1) ist die einzige Eingabe: er wird auf eine
 *  Strecke von RUN Metern abgebildet. Oben der Gipfel, dann die Abfahrt mit
 *  dem Skifahrer, unten das Tal mit Hütte und Feuerwehrauto.
 *
 *  Alles ist prozedural gebaut – keine Modelle, keine Texturen von der Platte.
 *  Geladen wird das Modul nur, wenn WebGL da ist und niemand "weniger
 *  Bewegung" eingestellt hat; siehe unten am Ende der Datei.
 */

import * as THREE from '/vendor/three-0.185.1/three.module.min.js';

/* ------------------------------------------------------------------ *
 *  Stellschrauben – hier zuerst drehen, wenn etwas anders aussehen soll
 * ------------------------------------------------------------------ */
const TUNE = {
  RUN:        520,   // Länge der Abfahrt in Metern
  DROP:       150,   // Höhenunterschied Gipfel → Tal
  PISTE_W:     16,   // halbe Pistenbreite
  CARVE_AMP:  7.5,   // wie weit der Skifahrer aus der Falllinie schwingt
  CARVE_FREQ: 0.052, // wie eng die Schwünge sind
  LEAD:        38,   // Abstand Kamera → Skifahrer
  DAMP:         5,   // Trägheit des Scrollens (kleiner = weicher)
};

const COL = {
  himmelOben:  new THREE.Color('#0b0a1c'),
  himmelMitte: new THREE.Color('#1b1440'),
  horizont:    new THREE.Color('#3a1f4a'),
  glut:        new THREE.Color('#c9558f'), // Restlicht am Horizont
  schnee:      new THREE.Color('#aeb6e8'),
  schneeHell:  new THREE.Color('#d6dcff'),
  fels:        new THREE.Color('#1a1826'),
  tanne:       new THREE.Color('#0d1524'),
  nebel:       new THREE.Color('#12102a'),
  jacke:       new THREE.Color('#7c6fff'),
  blaulicht:   new THREE.Color('#4d7dff'),
  fenster:     new THREE.Color('#ffb865'),
};

/* ------------------------------------------------------------------ *
 *  Gelände – reine Mathematik, davon hängt alles andere ab
 * ------------------------------------------------------------------ */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Höhenprofil der Falllinie: oben steil, unten flach ins Tal auslaufend.
function fallinieY(z) {
  const t = clamp01(-z / TUNE.RUN);
  return -TUNE.DROP * (2 * t - t * t);
}

// Seitliche Lage der Piste – zwei überlagerte Wellen, damit sie nicht
// wie ein Lineal wirkt.
function pisteX(z) {
  return Math.sin(z * 0.013) * 16 + Math.sin(z * 0.031 + 1.7) * 6;
}

// Der Schwung des Skifahrers um die Pistenmitte herum.
function carve(z) {
  return Math.sin(z * TUNE.CARVE_FREQ) * TUNE.CARVE_AMP;
}

// Geländehöhe an einem beliebigen Punkt: Piste als Mulde, außen Hänge.
function bodenY(x, z) {
  const d = Math.abs(x - pisteX(z));
  const rand = smoothstep(TUNE.PISTE_W, TUNE.PISTE_W + 46, d);
  const buckel =
    Math.sin(x * 0.08 + z * 0.05) * 1.2 +
    Math.sin(z * 0.11) * 0.8 +
    Math.cos(x * 0.05 - z * 0.033) * 1.5;
  const talBoden = smoothstep(TUNE.RUN - 90, TUNE.RUN, -z); // unten wird's eben
  return (
    fallinieY(z) +
    rand * 30 * (1 - talBoden * 0.55) +
    buckel * (0.35 + 0.9 * rand) * (1 - talBoden * 0.7)
  );
}

// Punkt auf der Abfahrt nach `strecke` Metern ab Gipfel.
const _p = new THREE.Vector3();
function pfadPunkt(strecke, out = _p) {
  const z = 10 - strecke;
  const x = pisteX(z) + carve(z);
  return out.set(x, bodenY(x, z), z);
}

/* ------------------------------------------------------------------ *
 *  Aufbau
 * ------------------------------------------------------------------ */

const canvas = document.getElementById('scene');
const mobil = window.matchMedia('(max-width: 700px)').matches;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !mobil,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobil ? 1.25 : 1.6));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(COL.nebel, 0.0040);

const camera = new THREE.PerspectiveCamera(52, 1, 0.5, 1400);
scene.add(camera);

/* --- Licht: Mond von schräg hinten, dazu kaltes Umgebungslicht --- */
const mond = new THREE.DirectionalLight('#cfd6ff', 1.15);
mond.position.set(-70, 90, 40);
scene.add(mond, mond.target);

scene.add(new THREE.HemisphereLight('#5f5cc4', '#0a0a16', 0.75));

/* --- Himmel, Sterne, Mond: hängen an der Kamera wie eine Kuppel --- */
const himmel = new THREE.Group();
scene.add(himmel);

const himmelMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: {
    oben:  { value: COL.himmelOben },
    mitte: { value: COL.himmelMitte },
    unten: { value: COL.horizont },
    glut:  { value: COL.glut },
    uTal:  { value: 0 }, // wächst zum Tal hin: mehr Restlicht am Horizont
  },
  vertexShader: `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 oben, mitte, unten, glut;
    uniform float uTal;
    varying vec3 vDir;
    void main() {
      float h = vDir.y * 0.5 + 0.5;
      vec3 c = mix(unten, mitte, smoothstep(0.42, 0.62, h));
      c = mix(c, oben, smoothstep(0.6, 1.0, h));
      // Restlicht dicht über dem Horizont, im Tal etwas kräftiger
      float saum = pow(1.0 - abs(vDir.y), 20.0) * (0.06 + 0.14 * uTal);
      c += glut * saum * max(0.0, -vDir.z * 0.5 + 0.5);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
});
himmel.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 20), himmelMat));

// Weiche runde Punkt-Textur, einmal gemalt, für Sterne + Schnee.
function punktTextur() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d').createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  const ctx = c.getContext('2d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const punktTex = punktTextur();

// Sterne, jeder mit eigener Phase – dadurch funkeln sie unterschiedlich.
const sterneMat = (() => {
  const n = mobil ? 420 : 900;
  const pos = new Float32Array(n * 3);
  const phase = new Float32Array(n);
  const size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // nur die obere Halbkugel, unten steht ja der Berg
    const u = Math.random() * Math.PI * 2;
    const v = Math.acos(Math.random() * 0.92);
    const r = 850;
    pos[i * 3]     = Math.sin(v) * Math.cos(u) * r;
    pos[i * 3 + 1] = Math.cos(v) * r;
    pos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * r;
    phase[i] = Math.random() * Math.PI * 2;
    size[i] = 1.6 + Math.pow(Math.random(), 3) * 7;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uTex: { value: punktTex } },
    vertexShader: `
      attribute float aPhase, aSize;
      uniform float uTime;
      varying float vHell;
      void main() {
        vHell = 0.55 + 0.45 * sin(uTime * 1.1 + aPhase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vHell;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        gl_FragColor = vec4(vec3(0.85, 0.88, 1.0), t.a * vHell * 0.9);
      }
    `,
  });
  himmel.add(new THREE.Points(g, mat));
  return mat;
})();

// Sternschnuppe: alle paar Sekunden zieht eine über den Grat. Der Schweif
// sind einfach 18 Punkte hintereinander, vorn hell, hinten aus.
const sternschnuppe = (() => {
  const N = 18;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const h = Math.pow(1 - i / (N - 1), 2);
    col[i * 3] = h; col[i * 3 + 1] = h * 0.96; col[i * 3 + 2] = h * 0.86;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const punkte = new THREE.Points(g, new THREE.PointsMaterial({
    map: punktTex, size: 5.5, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0, depthWrite: false, fog: false,
    blending: THREE.AdditiveBlending,
  }));
  punkte.frustumCulled = false;
  himmel.add(punkte);

  const start = new THREE.Vector3();
  const rich  = new THREE.Vector3();
  let wartet = 2 + Math.random() * 5;
  let t = -1;                                   // < 0 heißt: gerade fliegt keine

  return function (dt) {
    if (t < 0) {
      punkte.material.opacity = 0;
      wartet -= dt;
      if (wartet > 0) return;
      // Grob in Blickrichtung und flach über dem Grat: die Kamera schaut
      // die ganze Abfahrt über rund 20° nach unten, viel mehr Himmel als
      // ein schmales Band über den Gipfeln ist nie im Bild.
      const w = (Math.random() - 0.5) * 2.2;
      const hoch = (0.035 + Math.random() * 0.09) * Math.PI / 2;
      const r = 800, rh = Math.cos(hoch) * r;
      start.set(Math.sin(w) * rh, Math.sin(hoch) * r, -Math.cos(w) * rh);
      // quer zur Blickrichtung, mit leichtem Gefälle – so bleibt sie den
      // ganzen Flug über in diesem Band
      const seite = Math.random() < 0.5 ? -1 : 1;
      rich.set(Math.cos(w) * seite, -0.18 - Math.random() * 0.17, Math.sin(w) * seite)
          .normalize().multiplyScalar(360);
      t = 0;
    }

    t += dt / 0.85;                             // eine Schnuppe dauert 0,85 s
    if (t >= 1) { t = -1; wartet = 4 + Math.random() * 9; return; }
    punkte.material.opacity = Math.sin(t * Math.PI) * 0.95;

    const a = g.attributes.position;
    for (let i = 0; i < N; i++) {
      const k = t - i * 0.009;                  // enger, sonst wirkt es gepunktet
      a.setXYZ(i, start.x + rich.x * k, start.y + rich.y * k, start.z + rich.z * k);
    }
    a.needsUpdate = true;
  };
})();

// Mond mit Hof
{
  const mondKugel = new THREE.Mesh(
    new THREE.SphereGeometry(26, 24, 16),
    new THREE.MeshBasicMaterial({ color: '#eef0ff', fog: false })
  );
  mondKugel.position.set(-330, 300, -640);
  himmel.add(mondKugel);

  const hof = new THREE.Sprite(new THREE.SpriteMaterial({
    map: punktTex, color: '#8f9dff', transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.32,
  }));
  hof.scale.setScalar(150);
  hof.position.copy(mondKugel.position);
  himmel.add(hof);
}

/* --- Das Gelände --- */
{
  const BREITE = 300;
  const LAENGE = TUNE.RUN + 160;
  const g = new THREE.PlaneGeometry(BREITE, LAENGE, mobil ? 60 : 96, mobil ? 170 : 270);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, 30 - LAENGE / 2);

  const pos = g.attributes.position;
  const farben = new Float32Array(pos.count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = bodenY(x, z);
    pos.setY(i, y);

    // Steilheit numerisch abgreifen: steil = Fels schaut durch den Schnee
    const gx = (bodenY(x + 1.5, z) - bodenY(x - 1.5, z)) / 3;
    const gz = (bodenY(x, z + 1.5) - bodenY(x, z - 1.5)) / 3;
    const steil = Math.min(1, Math.hypot(gx, gz) / 1.1);

    const d = Math.abs(x - pisteX(z));
    // Die präparierte Piste ist heller als der Tiefschnee daneben
    c.copy(COL.schnee).lerp(COL.schneeHell, 1 - smoothstep(0, TUNE.PISTE_W + 6, d));
    c.lerp(COL.fels, smoothstep(0.5, 1.0, steil));

    farben[i * 3] = c.r; farben[i * 3 + 1] = c.g; farben[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  g.computeVertexNormals();

  scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({
    vertexColors: true, flatShading: true,
  })));
}

/* --- Tannen links und rechts der Piste --- */
{
  const anzahl = mobil ? 150 : 340;
  const geo = new THREE.ConeGeometry(1.7, 8, 6);
  geo.translate(0, 4, 0);
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshLambertMaterial({ color: COL.tanne, flatShading: true }),
    anzahl
  );
  const dummy = new THREE.Object3D();
  let n = 0;
  for (let i = 0; i < anzahl * 3 && n < anzahl; i++) {
    const z = 20 - Math.random() * (TUNE.RUN + 100);
    const seite = Math.random() < 0.5 ? -1 : 1;
    const d = TUNE.PISTE_W + 12 + Math.pow(Math.random(), 0.7) * 105;
    const x = pisteX(z) + seite * d;
    if (Math.abs(x) > 140) continue;
    // auf zu steilem Fels wächst nichts
    const steil = Math.abs(bodenY(x + 2, z) - bodenY(x - 2, z)) / 4;
    if (steil > 0.75) continue;

    dummy.position.set(x, bodenY(x, z) - 0.4, z);
    dummy.rotation.y = Math.random() * Math.PI;
    const s = 0.7 + Math.random() * 1.6;
    dummy.scale.set(s * (0.85 + Math.random() * 0.3), s, s * (0.85 + Math.random() * 0.3));
    dummy.updateMatrix();
    mesh.setMatrixAt(n++, dummy.matrix);
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
}

/* --- Fernkulisse: ein paar Grate hinter dem Tal, damit der Horizont
       nicht leer ist. Reine Silhouetten, sie werden nie nah gesehen. --- */
{
  // Ein Kegel der Höhe 1, dessen Ecken von unten (Fels) nach oben (Schnee)
  // eingefärbt sind – skaliert ergibt das beliebig viele Gipfel.
  const geo = new THREE.ConeGeometry(1, 1, 5);
  const pos = geo.attributes.position;
  const farben = new Float32Array(pos.count * 3);
  const fels = new THREE.Color('#141329');
  const firn = new THREE.Color('#3c3a66');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(fels).lerp(firn, smoothstep(0.02, 0.34, pos.getY(i) + 0.5));
    farben[i * 3] = c.r; farben[i * 3 + 1] = c.g; farben[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));

  const grate = new THREE.InstancedMesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false }),
    18
  );
  const dummy = new THREE.Object3D();
  const zufall = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < 18; i++) {
    const h = zufall(160, 380);
    const r = zufall(130, 260);
    // Fächer weit hinter dem Tal – so steht nie ein Gipfel neben der Kamera
    const winkel = zufall(-1.05, 1.05);
    const dist = zufall(450, 950);
    dummy.position.set(
      Math.sin(winkel) * dist,
      -TUNE.DROP - 70 + h / 2,
      -(TUNE.RUN + 120) - Math.cos(winkel) * dist
    );
    dummy.rotation.set(0, zufall(0, 6.28), 0);
    dummy.scale.set(r * zufall(0.8, 1.5), h, r);
    dummy.updateMatrix();
    grate.setMatrixAt(i, dummy.matrix);
  }
  grate.instanceMatrix.needsUpdate = true;
  scene.add(grate);
}

/* --- Pistenstangen: geben der Abfahrt Kanten und beim Scrollen Tempo --- */
{
  const abstand = 26;                        // Meter zwischen zwei Stangen
  const paare = Math.floor((TUNE.RUN + 60) / abstand);
  const stangeGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.6, 5);
  stangeGeo.translate(0, 1.3, 0);
  const kappeGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.5, 6);
  kappeGeo.translate(0, 2.5, 0);

  const stangen = new THREE.InstancedMesh(
    stangeGeo, new THREE.MeshLambertMaterial({ color: '#d9dcf0', flatShading: true }), paare * 2);
  const kappen = new THREE.InstancedMesh(
    kappeGeo, new THREE.MeshBasicMaterial({ color: '#ff7a3d' }), paare * 2);

  const dummy = new THREE.Object3D();
  let n = 0;
  for (let i = 0; i < paare; i++) {
    const z = 10 - i * abstand;
    for (const seite of [-1, 1]) {
      const x = pisteX(z) + seite * (TUNE.PISTE_W - 1.5);
      dummy.position.set(x, bodenY(x, z), z);
      dummy.rotation.set(0, 0, seite * 0.06);   // leicht schief, wie im Schnee
      dummy.updateMatrix();
      stangen.setMatrixAt(n, dummy.matrix);
      kappen.setMatrixAt(n, dummy.matrix);
      n++;
    }
  }
  stangen.count = kappen.count = n;
  stangen.instanceMatrix.needsUpdate = true;
  kappen.instanceMatrix.needsUpdate = true;
  scene.add(stangen, kappen);
}

/* ------------------------------------------------------------------ *
 *  Der Skifahrer
 * ------------------------------------------------------------------ */
const skifahrer = new THREE.Group();
scene.add(skifahrer);

const haltung = (() => {
  const stoecke = [];
  const dunkel  = new THREE.MeshLambertMaterial({ color: '#14141f', flatShading: true });
  const jacke   = new THREE.MeshLambertMaterial({ color: COL.jacke, flatShading: true });
  const helm    = new THREE.MeshLambertMaterial({ color: '#e8e8f0', flatShading: true });

  const koerper = new THREE.Group();          // Blickrichtung ist +Z
  koerper.scale.setScalar(1.7);

  for (const s of [-1, 1]) {
    const ski = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 2.4), dunkel);
    ski.position.set(s * 0.3, 0.05, 0.2);
    koerper.add(ski);

    const bein = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.3), dunkel);
    bein.position.set(s * 0.28, 0.5, 0.05);
    koerper.add(bein);

    // Stöcke, leicht nach hinten gestreckt
    const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.15, 5), dunkel);
    stock.position.set(s * 0.52, 0.75, -0.5);
    stock.rotation.x = 0.55;
    koerper.add(stock);
    stoecke.push(stock);
  }

  const rumpf = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.5, 3, 8), jacke);
  rumpf.position.set(0, 1.35, -0.06);
  rumpf.rotation.x = -0.32;                    // in der Hocke, nach vorn gebeugt
  koerper.add(rumpf);

  const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), helm);
  kopf.position.set(0, 1.92, 0.14);
  koerper.add(kopf);

  skifahrer.add(koerper);

  // Unten im Tal geht er aus der Hocke: `t` läuft von 0 (Abfahrtshocke)
  // auf 1 (steht aufrecht, Stöcke unten).
  return function aufrichten(t) {
    rumpf.rotation.x = -0.32 + t * 0.30;
    rumpf.position.y = 1.35 + t * 0.20;
    kopf.position.y  = 1.92 + t * 0.28;
    kopf.position.z  = 0.14 - t * 0.14;
    for (const stock of stoecke) {
      stock.rotation.x = 0.55 - t * 0.48;
      stock.position.y = 0.75 - t * 0.14;
    }
  };
})();

/* --- Schneefahne hinter den Skiern --- */
const fahne = (() => {
  const n = 150;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({
    map: punktTex, color: '#e6ebff', size: 0.5, sizeAttenuation: true,
    transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  skifahrer.add(p);                            // erbt Lage und Drehung

  return {
    punkte: p,
    aktualisiere(zeit, staerke) {
      p.material.opacity = staerke * 0.85;
      if (staerke < 0.02) return;
      const a = g.attributes.position;
      for (let i = 0; i < n; i++) {
        const ph = ((zeit * 1.35 + i * 0.0137) % 1);
        const seite = i % 2 ? 1 : -1;
        const streu = ((i * 37) % 11) / 11 - 0.5;
        a.setXYZ(
          i,
          seite * (0.25 + ph * 1.9) + streu * ph * 1.4,
          ph * (1 - ph) * 4.2 + 0.05,
          -ph * 5.5 - 0.6                       // nach hinten weg
        );
      }
      a.needsUpdate = true;
    },
  };
})();

/* ------------------------------------------------------------------ *
 *  Das Tal: Hütte und Feuerwehrauto
 * ------------------------------------------------------------------ */
const talMitte = (() => {
  // Die Kamera hält bei z = 10 - RUN an; das Auto steht ein Stück davor,
  // seitlich neben der Piste – so steht es am Ende schön im Bild.
  const z = -(TUNE.RUN + 20);
  const x = pisteX(z) + 13;
  return new THREE.Vector3(x, bodenY(x, z), z);
})();

// Wo die Drohne einschlägt: 25 m vor der Stelle, an der die Kamera stehen
// bleibt, fast auf ihrer Linie. Am Auto ausgerichtet wäre der Punkt auf
// schmalen Displays aus dem Bild gewandert. Steht hier oben, weil auch der
// Skifahrer am Ende dorthin schaut.
const einschlag = (() => {
  const z = (10 - TUNE.RUN) - 25;
  const x = pisteX(z) + carve(z) * 0.4 + 3.5;
  return new THREE.Vector3(x, bodenY(x, z), z);
})();

/* --- Anklickbare Stellen im Tal ---------------------------------------
   Drohne und Auto sind zu filigran, um sie direkt zu treffen. Jedes
   bekommt deshalb eine unsichtbare Kugel als Trefferfläche: sie rendert
   nichts (kein Farb-, kein Tiefenschreiben), lässt sich aber raycasten. */
const klickbar = [];
function trefferflaeche(eltern, radius, tun) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 8, 6),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
  );
  m.userData.tun = tun;
  eltern.add(m);
  klickbar.push(m);
}

/* --- Namensschilder -----------------------------------------------------
   Wer ein Osterei anklickt, bekommt daneben ein kleines Schild mit dem
   echten Link. Bewusst zweistufig: ein Klick irgendwo in die Landschaft
   soll niemanden ungefragt von der Seite werfen, und als richtiges <a>
   zeigt der Browser beim Draufhalten auch, wohin es geht. */
const schild = (() => {
  const alle = [];
  const pos = new THREE.Vector3();

  function verstecken(e) {
    e.rest = 0;
    e.a.classList.remove('da');
    e.a.tabIndex = -1;
    e.a.setAttribute('aria-hidden', 'true');
  }

  /* `beiKlick` ist optional. Wer eine Funktion mitgibt, bekommt das Schild
     als Link auf dieselbe Seite und darf den Klick selbst behandeln – nur
     der schlichte Linksklick, damit Mittelklick und Cmd-Klick weiter das
     tun, was der Browser sonst tut. Ohne die Funktion bleibt es wie gehabt
     ein Link in einen neuen Tab. */
  function neu(text, url, objekt, hoehe, beiKlick) {
    const a = document.createElement('a');
    a.className = 'szene-schild';
    a.href = url;
    if (beiKlick) {
      a.addEventListener('click', (ev) => {
        if (ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        ev.preventDefault();
        beiKlick();
      });
    } else {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    a.textContent = text;
    a.tabIndex = -1;
    a.setAttribute('aria-hidden', 'true');
    document.body.appendChild(a);

    const e = { a, objekt, hoehe, rest: 0 };
    alle.push(e);
    return () => {
      e.rest = 9;                               // Sekunden, dann geht es wieder
      a.classList.add('da');
      a.tabIndex = 0;
      a.removeAttribute('aria-hidden');
    };
  }

  function schritt(dt, imTal) {
    let rechteck = null;
    for (const e of alle) {
      if (e.rest <= 0) continue;
      e.rest -= dt;
      if (e.rest <= 0 || !imTal) { verstecken(e); continue; }

      rechteck = rechteck || canvas.getBoundingClientRect();
      pos.set(e.objekt.position.x, e.objekt.position.y + e.hoehe, e.objekt.position.z)
         .project(camera);
      if (pos.z > 1) { verstecken(e); continue; }   // hinter der Kamera
      e.a.style.left = Math.round(rechteck.left + (pos.x + 1) / 2 * rechteck.width) + 'px';
      e.a.style.top  = Math.round(rechteck.top + (-pos.y + 1) / 2 * rechteck.height) + 'px';
    }
  }

  return { neu, schritt };
})();

/* --- Der Vorhang für den Übergang zur Lernwerkstatt ---------------------
   Dieselbe Nachtfarbe, mit der drüben die Straße anfängt: das Bild zieht
   sich zu, während das Auto davonfährt, und geht auf jf.veerka.mp wieder
   auf. Er entsteht hier und nicht im HTML – ohne Szene gibt es auch nichts
   zu überblenden. */
const blende = (() => {
  const d = document.createElement('div');
  d.className = 'szene-blende';
  d.setAttribute('aria-hidden', 'true');
  document.body.appendChild(d);
  return d;
})();

/* --- Berghütte mit warmem Fensterlicht --- */
{
  const huette = new THREE.Group();
  const holz = new THREE.MeshLambertMaterial({ color: '#241c1c', flatShading: true });
  const schnee = new THREE.MeshLambertMaterial({ color: COL.schneeHell, flatShading: true });

  const wand = new THREE.Mesh(new THREE.BoxGeometry(9, 4.2, 7), holz);
  wand.position.y = 2.1;
  huette.add(wand);

  const dach = new THREE.Mesh(new THREE.ConeGeometry(7.6, 3.4, 4), schnee);
  dach.position.y = 5.9;
  dach.rotation.y = Math.PI / 4;
  huette.add(dach);

  for (const x of [-2.2, 2.2]) {
    const fenster = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.2),
      new THREE.MeshBasicMaterial({ color: COL.fenster })
    );
    fenster.position.set(x, 2.4, 3.52);
    huette.add(fenster);
  }

  const lampe = new THREE.PointLight(COL.fenster, 40, 34, 2);
  lampe.position.set(0, 2.6, 5.5);
  huette.add(lampe);

  const hz = -(TUNE.RUN + 35);
  huette.position.set(pisteX(hz) - 27, 0, hz);
  huette.position.y = bodenY(huette.position.x, huette.position.z) - 0.3;
  huette.rotation.y = 0.6;
  scene.add(huette);
}

/* --- Feuerwehrauto: Kasten auf Rädern, aber es liest sich sofort --- */
const blaulichter = [];
const feuerwehr = (() => {
  const auto = new THREE.Group();
  const rot     = new THREE.MeshLambertMaterial({ color: '#c8202a', flatShading: true });
  const weiss   = new THREE.MeshLambertMaterial({ color: '#e9e9f2', flatShading: true });
  const dunkel  = new THREE.MeshLambertMaterial({ color: '#15151f', flatShading: true });
  const glas    = new THREE.MeshLambertMaterial({ color: '#2b3550', flatShading: true });
  const chrom   = new THREE.MeshLambertMaterial({ color: '#8a8fa6', flatShading: true });

  const teil = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    auto.add(m);
    return m;
  };

  // Fahrtrichtung ist +X
  teil(new THREE.BoxGeometry(7.6, 0.9, 2.6), dunkel, 0, 0.95, 0);      // Rahmen
  teil(new THREE.BoxGeometry(4.6, 2.0, 2.6), rot,   -1.4, 2.4, 0);     // Aufbau
  teil(new THREE.BoxGeometry(2.6, 1.9, 2.55), rot,   2.4, 2.35, 0);    // Fahrerhaus
  teil(new THREE.BoxGeometry(0.12, 1.0, 2.45), glas, 3.66, 2.7, 0);    // Frontscheibe
  teil(new THREE.BoxGeometry(7.7, 0.34, 2.66), weiss, 0, 1.55, 0);     // weißer Streifen

  // Rollladenkästen an der Seite
  for (const x of [-2.8, -1.4, 0]) {
    teil(new THREE.BoxGeometry(1.1, 1.1, 2.68), chrom, x, 2.3, 0);
  }

  // Leiter aufs Dach: zwei Holme, ein paar Sprossen
  for (const z of [-0.5, 0.5]) {
    teil(new THREE.BoxGeometry(5.6, 0.12, 0.14), chrom, -1.4, 3.5, z);
  }
  for (let i = 0; i < 8; i++) {
    teil(new THREE.BoxGeometry(0.09, 0.09, 1.0), chrom, -3.9 + i * 0.72, 3.5, 0);
  }

  // Räder. Die Achse zeigt nach dem Drehen entlang Z, gerollt wird also
  // um die lokale Z-Achse – siehe `raeder` weiter unten.
  const raeder = [];
  const rad = new THREE.CylinderGeometry(0.68, 0.68, 0.42, 12);
  rad.rotateX(Math.PI / 2);
  for (const x of [2.3, -1.4, -2.6]) {
    for (const z of [-1.25, 1.25]) raeder.push(teil(rad, dunkel, x, 0.68, z));
  }

  // Scheinwerfer
  for (const z of [-0.85, 0.85]) {
    teil(new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshBasicMaterial({ color: '#fff0c8' }), 3.72, 1.75, z);
  }

  // Blaulichtbalken – zwei Leuchten, die abwechselnd doppelt blitzen
  for (const z of [-0.8, 0.8]) {
    const kappe = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.24, 0.34),
      new THREE.MeshBasicMaterial({ color: COL.blaulicht })
    );
    kappe.position.set(2.4, 3.44, z);
    auto.add(kappe);

    const licht = new THREE.PointLight(COL.blaulicht, 0, 70, 2);
    licht.position.set(2.4, 3.6, z);
    auto.add(licht);

    const schein = new THREE.Sprite(new THREE.SpriteMaterial({
      map: punktTex, color: COL.blaulicht, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    schein.scale.setScalar(3.4);
    schein.position.set(2.4, 3.5, z);
    auto.add(schein);

    blaulichter.push({ kappe, licht, schein, versatz: z < 0 ? 0 : 0.5 });
  }

  auto.position.copy(talMitte);
  auto.position.y = bodenY(auto.position.x, auto.position.z);
  // YXZ: y ist der Kurs, x die Wank- und z die Nickachse. Das Modell schaut
  // nach +X, deshalb sitzt das Wanken auf x und nicht wie üblich auf z.
  auto.rotation.order = 'YXZ';
  auto.rotation.y = -2.2;                       // Dreiviertelansicht von vorn
  auto.scale.setScalar(1.2);
  scene.add(auto);

  // Fahrlicht – aus, solange es steht. Zwei Lichter: der Punkt macht den
  // Schein um die Scheinwerfer herum, der Kegel die Pfütze auf dem Schnee.
  const fahrlicht = new THREE.PointLight('#fff0c8', 0, 42, 2);
  fahrlicht.position.set(5.4, 2.4, 0);
  auto.add(fahrlicht);

  const kegel = new THREE.SpotLight('#fff2cf', 0, 95, 0.40, 0.45, 1.1);
  kegel.position.set(3.9, 1.9, 0);
  kegel.target.position.set(34, -3.4, 0);       // nach vorn und leicht nach unten
  auto.add(kegel, kegel.target);

  return { auto, fahrlicht, kegel, raeder };
})();

/* --- Osterei: Einsatz für 19/43 --------------------------------------
   Anklicken lässt das Auto losfahren – Fahrlicht an, eine Runde durch den
   Talkessel, wieder auf denselben Fleck. Die Runde ist ein voller Kreis,
   deshalb endet sie von selbst genau dort, wo sie angefangen hat: Anfangs-
   und Endwinkel sind derselbe, und `smoothstep` sorgt dafür, dass es an
   beiden Enden aus dem Stand anfährt und wieder ausrollt.

   Dazu erscheint das Schild mit dem Link zur Lernwerkstatt. Wer das
   anklickt, schickt es wirklich weg: es beschleunigt geradeaus, das Bild
   zieht sich auf die Nachtfarbe zu – und drüben auf jf.veerka.mp rollt
   dasselbe Fahrzeug wieder ins Bild (`?einfahrt=1`). --- */
const LERNWERKSTATT = 'https://jf.veerka.mp/';

const einsatz = (() => {
  const { auto, fahrlicht, kegel, raeder } = feuerwehr;

  const RUNDE  = 7;       // Sekunden für eine Runde
  // Eng gewählt: die Kamera steht nur rund 30 m entfernt, und nach vorn kommt
  // das Auto auf einem Kreis genau um R näher. Mit mehr Radius liefe es einem
  // ins Objektiv, mit weniger wäre es hinter den Kacheln kaum zu sehen.
  const R      = 6;       // Radius der Schleife in Metern
  const WEG_MS = 820;     // vom Klick aufs Schild bis zum Seitenwechsel
  const WEITE  = 34;      // Meter, die es dabei zurücklegt
  const HELL   = 62;      // Fahrlicht bei voller Fahrt

  const stand = auto.position.clone();
  const kurs  = auto.rotation.y;
  // Fahrtrichtung ist +X, also zeigt der Kurs in der Ebene hierhin:
  const vorn  = new THREE.Vector3(Math.cos(kurs), 0, -Math.sin(kurs));

  // Der Kreismittelpunkt liegt links vom Auto: die Runde geht dann nach rechts
  // durchs Bild und bleibt dort, wo die Landschaft frei ist – nach der anderen
  // Seite verschwände sie hinter den Kacheln.
  const mitte  = new THREE.Vector3(stand.x + vorn.z * R, 0, stand.z - vorn.x * R);
  const startW = Math.atan2(stand.z - mitte.z, stand.x - mitte.x);

  // Das Schild bleibt am Parkplatz stehen, statt mit auf die Runde zu gehen:
  // an einem Fahrzeug in Fahrt wäre es nicht zu treffen.
  const pflock = new THREE.Object3D();
  pflock.position.copy(stand);
  scene.add(pflock);

  let b = -1;             // < 0 steht, 0 … 1 die Runde
  let weg = 0;            // > 0: unterwegs zur Lernwerkstatt, in Sekunden
  const abfahrt = new THREE.Vector3();   // wo die Abfahrt losging
  const richtung = new THREE.Vector3();  // und wohin sie zeigt

  function raederDrehen(strecke) {
    // Radhalbmesser 0.68 im Modell, das Ganze steht auf Maßstab 1.2
    const w = strecke / (1.2 * 0.68);
    for (const r of raeder) r.rotation.z -= w;
  }

  function licht(v) {
    fahrlicht.intensity = HELL * v;
    kegel.intensity = 230 * v;
  }

  /* Beim ersten Klick schon einmal die Verbindung nach jf.veerka.mp
     aufbauen. Vorher spricht diese Seite mit niemandem dort. */
  let vorgewarnt = false;
  function vorwarnen() {
    if (vorgewarnt) return;
    vorgewarnt = true;
    const l = document.createElement('link');
    l.rel = 'preconnect';
    l.href = 'https://jf.veerka.mp';
    document.head.appendChild(l);
  }

  /* Klick aufs Schild: raus aus der Runde, geradeaus davon, Bild zu. */
  function abfahren() {
    if (weg) return;
    weg = 1e-4;
    abfahrt.copy(auto.position);
    richtung.set(Math.cos(auto.rotation.y), 0, -Math.sin(auto.rotation.y));
    blende.classList.add('da');
    setTimeout(() => { location.href = LERNWERKSTATT + '?einfahrt=1'; }, WEG_MS);
  }

  const zeigen = schild.neu('Jugendfeuerwehr Harheim · Lernwerkstatt',
    LERNWERKSTATT, pflock, 8, abfahren);

  trefferflaeche(auto, 4.2, () => {
    if (weg) return;
    if (b < 0) b = 0;     // eine zweite Runde nachlegen geht nicht
    zeigen();
    vorwarnen();
  });

  /* Zurück-Knopf: der Browser holt die Seite aus dem Cache – mitsamt dem
     zugezogenen Vorhang und einem Auto, das ein Stück weiter steht. Beides
     gehört zurück auf Anfang. */
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    weg = 0;
    b = -1;
    auto.position.copy(stand);
    auto.rotation.set(0, kurs, 0);
    licht(0);
    blende.classList.remove('da');
  });

  return function (dt) {
    if (weg) {
      weg += dt;
      const t = clamp01(weg / (WEG_MS / 1000));
      // gleichmäßig beschleunigt statt weich – es geht zum Einsatz
      const s = WEITE * t * t;
      auto.position.copy(abfahrt).addScaledVector(richtung, s);
      auto.position.y = bodenY(auto.position.x, auto.position.z);
      auto.rotation.x = 0;
      auto.rotation.z = 0.05 * (1 - t * 0.4);      // Nase hoch beim Anfahren
      licht(1);
      raederDrehen(2 * WEITE * t / (WEG_MS / 1000) * dt);
      return;
    }

    if (b < 0) return;
    b += dt / RUNDE;
    if (b >= 1) {                                  // wieder eingeparkt
      b = -1;
      auto.position.copy(stand);
      auto.rotation.set(0, kurs, 0);
      licht(0);
      return;
    }

    // Rueckwaerts um den Kreis, weil der Mittelpunkt links liegt: fuer eine
    // Linkskurve laeuft der Winkel fallend. Der Kurs ist die Tangente daran.
    const w = startW - smoothstep(0, 1, b) * Math.PI * 2;
    auto.position.set(mitte.x + Math.cos(w) * R, 0, mitte.z + Math.sin(w) * R);
    auto.position.y = bodenY(auto.position.x, auto.position.z);
    auto.rotation.y = Math.atan2(Math.cos(w), Math.sin(w));

    // Bahngeschwindigkeit: die Ableitung von smoothstep ist 6b(1-b)
    const tempo = (6 * b * (1 - b)) / RUNDE * 2 * Math.PI * R;
    const v = clamp01(tempo / 15);
    auto.rotation.x = 0.06 * v;                    // wankt nach außen
    auto.rotation.z = 0.035 * v * (b < 0.5 ? 1 : -1);   // anfahren, bremsen
    licht(smoothstep(0, 0.05, b) * (1 - smoothstep(0.93, 1, b)));
    raederDrehen(tempo * dt);
  };
})();

/* ------------------------------------------------------------------ *
 *  Die Drohne – eine SpeedyBee-artige 5-Zoll-Quad, die im Tal einschlägt
 *
 *  Der Ablauf hängt am Scrollfortschritt, nicht an der Uhr: zurückscrollen
 *  spult den Absturz wieder zurück. Nur die Propeller drehen sich nach der
 *  Zeit, damit es auch im Stillstand surrt.
 * ------------------------------------------------------------------ */
const drohne = (() => {
  const gruppe = new THREE.Group();
  const props = [];

  const schwarz = new THREE.MeshLambertMaterial({ color: '#191921', flatShading: true });
  // etwas Eigenleuchten, sonst säuft das Gelb in der Nacht ab
  const gelb    = new THREE.MeshLambertMaterial({ color: '#ffc21a', emissive: '#4a3400', flatShading: true });
  const grau    = new THREE.MeshLambertMaterial({ color: '#3c3c4a', flatShading: true });

  // Rahmen: zwei Platten, vier Arme über Kreuz
  const platte = (b, h, t, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, t), schwarz);
    m.position.y = y;
    gruppe.add(m);
  };
  platte(0.62, 0.05, 0.56, 0);
  platte(0.56, 0.04, 0.50, 0.32);

  for (let i = 0; i < 4; i++) {
    const w = Math.PI / 4 + i * Math.PI / 2;
    const cx = Math.cos(w), cz = Math.sin(w);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.16), schwarz);
    arm.position.set(cx * 0.45, 0.02, cz * 0.45);
    arm.rotation.y = -w;
    gruppe.add(arm);

    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.17, 8), grau);
    motor.position.set(cx * 0.82, 0.11, cz * 0.82);
    gruppe.add(motor);

    // Propeller: zwei Blätter plus eine fast durchsichtige Scheibe, die
    // den Kreis andeutet, solange er sich dreht
    const prop = new THREE.Group();
    prop.position.set(cx * 0.82, 0.22, cz * 0.82);
    for (const dreh of [0, Math.PI / 2]) {
      const blatt = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.015, 0.1), grau);
      blatt.rotation.y = dreh;
      prop.add(blatt);
    }
    const scheibe = new THREE.Mesh(
      new THREE.CircleGeometry(0.33, 16),
      new THREE.MeshBasicMaterial({
        color: '#a6adcf', transparent: true, opacity: 0.14,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    scheibe.rotation.x = -Math.PI / 2;
    prop.add(scheibe);
    gruppe.add(prop);
    props.push({ prop, scheibe, richtung: i % 2 ? 1 : -1 });
  }

  // Akku oben drauf – das Gelb ist das, woran man die Marke erkennt
  const akku = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.34), gelb);
  akku.position.set(-0.02, 0.45, 0);
  gruppe.add(akku);

  // Kamera vorn, leicht nach oben geneigt
  const kam = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.15), schwarz);
  kam.position.set(0.3, 0.2, 0);
  kam.rotation.z = 0.42;
  gruppe.add(kam);
  const linse = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 8, 6),
    new THREE.MeshBasicMaterial({ color: '#6f7bd6' })
  );
  linse.position.set(0.39, 0.26, 0);
  gruppe.add(linse);

  // Antennen nach hinten, mit gelben Enden
  for (const z of [-0.14, 0.14]) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 5), schwarz);
    ant.position.set(-0.32, 0.36, z);
    ant.rotation.z = 0.9;
    gruppe.add(ant);
    const spitze = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 6), gelb);
    spitze.position.set(-0.45, 0.45, z);
    spitze.rotation.z = 0.9;
    gruppe.add(spitze);
  }

  // rote Kontrollleuchte hinten
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.05, 0.09),
    new THREE.MeshBasicMaterial({ color: '#ff4d5e' })
  );
  led.position.set(-0.31, 0.2, 0);
  gruppe.add(led);

  gruppe.scale.setScalar(2.4);
  gruppe.visible = false;
  scene.add(gruppe);

  // Osterei: anklicken, dann heult sie nochmal auf, hebt kurz ab und
  // kippt wieder weg. `belebung` < 0 heißt: liegt einfach da.
  let belebung = -1;
  const zeigen = schild.neu('KI-Drohne · Uniprojekt',
    'https://ai-drone-fra-uas.github.io/ai-drone/', gruppe, 3.4);
  trefferflaeche(gruppe, 1.1, () => { if (belebung < 0) belebung = 0; zeigen(); });

  // Ein Propeller, der beim Aufschlag wegfliegt
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.035, 0.19), grau);
  splitter.visible = false;
  scene.add(splitter);

  // Schneewolke am Einschlagpunkt
  const wolke = (() => {
    const n = 110;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const w = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.5);
      pos[i * 3]     = Math.cos(w) * r;
      pos[i * 3 + 1] = Math.pow(Math.random(), 1.6) * 0.9;
      pos[i * 3 + 2] = Math.sin(w) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({
      map: punktTex, color: '#eaeeff', size: 0.95, sizeAttenuation: true,
      transparent: true, opacity: 0, depthWrite: false,
    }));
    m.visible = false;
    scene.add(m);
    return m;
  })();

  const aufschlag = einschlag;
  wolke.position.copy(aufschlag);

  // Anflug: sie kommt aus dem Tal auf uns zu, oben rechts ins Bild, und
  // geht dann vor der Kamera in den Schnee
  const abflug = new THREE.Vector3(aufschlag.x + 10, aufschlag.y + 16, aufschlag.z - 34);

  /* --- Die Ehrenrunde beim Anklicken -----------------------------------
     Nur hier fliegt sie einen Kreis, nicht im Anflug. Der Kreis hängt an
     der Blickachse und sein Radius am tatsächlichen Bildwinkel, sonst
     verschwindet sie im Hochformat seitlich aus dem Bild. */
  const START_W = -Math.PI * 0.4;
  const _b = new THREE.Vector3(), _c = new THREE.Vector3();
  const vorn = new THREE.Vector3();
  const qRuhe = new THREE.Quaternion(), qFlug = new THREE.Quaternion();

  const kreisPunkt = (w, mitte, r, out) =>
    out.set(mitte.x + Math.cos(w) * r, mitte.y, mitte.z + Math.sin(w) * r);

  // Wo sie während der Runde ist. b läuft von 0 (liegt noch) bis 1 (liegt
  // wieder): bis 0.26 steigt sie auf, bis 0.84 einmal herum, dann zurück.
  const AUF = 0.26, AB = 0.84;
  function flugPunkt(b, mitte, r, out) {
    if (b < AUF) {
      kreisPunkt(START_W, mitte, r, _b);
      return out.lerpVectors(aufschlag, _b, smoothstep(0.09, AUF, b));
    }
    if (b < AB) {
      const u = (b - AUF) / (AB - AUF);
      kreisPunkt(START_W + u * Math.PI * 2, mitte, r, out);
      out.y += Math.sin(u * Math.PI * 2) * 1.6;       // leicht auf und ab
      return out;
    }
    const u = (b - AB) / (1 - AB);
    kreisPunkt(START_W, mitte, r, _b);
    return out.lerpVectors(_b, aufschlag, smoothstep(0, 1, u));
  }

  const ruhe = new THREE.Vector3();
  let propWinkel = 0;

  function setzen(d, dt, zeit, mitte) {
    if (d <= 0.001) {
      gruppe.visible = splitter.visible = wolke.visible = false;
      return;
    }
    gruppe.visible = true;

    const TREFFER = 0.52;
    let tempo;

    if (d < TREFFER) {
      // Anflug
      const t = d / TREFFER;
      const e = t * t * (3 - 2 * t);
      gruppe.position.lerpVectors(abflug, aufschlag, e);
      gruppe.position.y += Math.sin(t * Math.PI) * 3.4;          // Bogen
      gruppe.position.x += Math.sin(t * 11) * 0.7 * (1 - t);     // Zappeln
      gruppe.position.z += Math.cos(t * 9) * 0.5 * (1 - t);
      gruppe.rotation.set(
        -0.2 - t * 0.6,
        -0.5 - t * 1.3,                       // dreht sich weg, verliert die Lage
        Math.sin(t * 8) * 0.45 * (1 - t) + t * 0.6
      );
      tempo = 1;
      splitter.visible = false;
      wolke.visible = false;
    } else {
      // Aufschlag, Überschlag, liegen bleiben
      const t = (d - TREFFER) / (1 - TREFFER);
      const abkling = Math.exp(-t * 4.5);
      const huepfer = Math.abs(Math.sin(t * Math.PI * 2.3)) * abkling * 1.9;
      const dreh = (1 - abkling) * 8;

      gruppe.position.copy(aufschlag);
      gruppe.position.x += (1 - abkling) * 2.6;
      gruppe.position.z += (1 - abkling) * 0.8;
      gruppe.position.y += huepfer + 0.14;
      gruppe.rotation.set(-0.8 - dreh, 3.4 + dreh * 0.35, 1.2 + dreh * 0.55);

      // die letzten Grad ausrollen: sie bleibt auf dem Rücken liegen
      const still = smoothstep(0.45, 1, t);
      ruhe.set(0.16, 2.35, 1.72);
      gruppe.rotation.x = THREE.MathUtils.lerp(gruppe.rotation.x, ruhe.x, still);
      gruppe.rotation.y = THREE.MathUtils.lerp(gruppe.rotation.y, ruhe.y, still);
      gruppe.rotation.z = THREE.MathUtils.lerp(gruppe.rotation.z, ruhe.z, still);
      gruppe.position.y = THREE.MathUtils.lerp(gruppe.position.y, aufschlag.y + 0.16, still);

      tempo = abkling * 0.55;

      // abgerissener Propeller
      splitter.visible = true;
      const st = Math.min(1, t * 2.4);
      splitter.position.set(
        aufschlag.x - 1.1 - st * 2.4,
        aufschlag.y + 0.1 + Math.sin(st * Math.PI) * 1.6,
        aufschlag.z + 0.6 + st * 1.3
      );
      splitter.rotation.set(st * 9, st * 14, st * 6);

      // Schneewolke: geht auf und verzieht sich
      wolke.visible = true;
      const wt = Math.min(1, t * 1.1);
      wolke.scale.setScalar(1.4 + wt * 7);
      wolke.material.opacity = (1 - wt) * 0.95;
    }

    // --- Osterei: sie rappelt sich auf und dreht eine Ehrenrunde ---
    let b = 0;
    if (belebung >= 0) {
      belebung += dt / 7;                       // die Runde dauert 7 Sekunden
      if (belebung >= 1) belebung = -1; else b = belebung;
    }
    if (b > 0 && d >= TREFFER) {
      // Kreis über dem Wrack, aber Richtung Blickachse gerückt und nur so
      // weit, wie er ins Bild passt.
      const halbHoch = THREE.MathUtils.degToRad(camera.fov) / 2;
      const halbBreit = Math.atan(Math.tan(halbHoch) * camera.aspect);
      const r = Math.min(10, Math.tan(halbBreit * 0.55) * 28);
      _c.copy(aufschlag).lerp(mitte, 0.5);
      _c.y = aufschlag.y + 7.5;

      // Vor dem Abheben zittert sie nur; danach zählt die Bahn.
      const luft = smoothstep(0.09, 0.3, b) * (1 - smoothstep(0.9, 1, b));
      flugPunkt(b, _c, r, vorn);
      gruppe.position.lerp(vorn, luft);
      if (b < 0.12) gruppe.position.y += Math.sin(b * 150) * 0.05;

      // Nase in Flugrichtung: ein Stück weiter auf der Bahn peilen und die
      // Differenz als Richtung nehmen.
      flugPunkt(Math.min(1, b + 0.006), _c, r, _b).sub(vorn);
      if (_b.lengthSq() > 1e-8) {
        qRuhe.copy(gruppe.quaternion);          // die Lage aus dem Absturz
        gruppe.rotation.set(0, Math.atan2(-_b.z, _b.x), 0);
        gruppe.rotateZ(Math.atan2(_b.y, Math.hypot(_b.x, _b.z)) * 0.7);
        // in die Kurve legen, am Anfang und Ende der Runde weich
        gruppe.rotateX(-0.5 * smoothstep(AUF, AUF + 0.08, b) * (1 - smoothstep(AB - 0.08, AB, b)));
        qFlug.copy(gruppe.quaternion);
        gruppe.quaternion.slerpQuaternions(qRuhe, qFlug, luft);
      }

      tempo = Math.max(tempo, smoothstep(0, 0.08, b) * (1 - smoothstep(0.92, 1, b)) * 1.25);
    } else {
      b = 0;
    }

    // Nach dem Aufschlag blinkt nur noch die Kontrollleuchte – während des
    // Startversuchs steht sie auf Grün.
    led.material.color.setHex(
      b > 0 && b < 0.94 ? 0x4dff8a
        : d < TREFFER || (zeit % 1.6) < 0.9 ? 0xff4d5e : 0x3a1218);

    // Propeller drehen – aufgesammelt, damit ein Tempowechsel nicht springt
    propWinkel += dt * tempo * 46;
    for (const p of props) {
      p.prop.rotation.y = propWinkel * p.richtung;
      p.scheibe.material.opacity = 0.14 * tempo;
    }
  }

  return setzen;
})();

/* ------------------------------------------------------------------ *
 *  Schneeflocken – laufen immer, damit die Szene auch im Stillstand lebt
 * ------------------------------------------------------------------ */
const flocken = (() => {
  const n = mobil ? 380 : 800;
  const B = 200, H = 110, T = 300;              // Box um die Kamera herum
  const pos = new Float32Array(n * 3);
  const speed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * B;
    pos[i * 3 + 1] = Math.random() * H;
    pos[i * 3 + 2] = (Math.random() - 0.5) * T;
    speed[i] = 1.6 + Math.random() * 3.4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  const p = new THREE.Points(g, new THREE.PointsMaterial({
    map: punktTex, color: '#dfe4ff', size: 0.11, sizeAttenuation: true,
    transparent: true, opacity: 0.5, depthWrite: false,
  }));
  scene.add(p);

  return function (dt, zeit, kamPos) {
    const a = g.attributes.position;
    for (let i = 0; i < n; i++) {
      let y = a.getY(i) - speed[i] * dt;
      let x = a.getX(i) + Math.sin(zeit * 0.6 + i) * dt * 0.8;
      let z = a.getZ(i);
      // Box mitziehen: was hinten rausfällt, kommt vorne wieder rein
      if (y < kamPos.y - H * 0.35) y += H;
      if (x < kamPos.x - B / 2) x += B; else if (x > kamPos.x + B / 2) x -= B;
      if (z < kamPos.z - T / 2) z += T; else if (z > kamPos.z + T / 2) z -= T;
      // Was direkt vor der Linse landet, wird zu einem weißen Fleck –
      // solche Flocken nach vorn schieben.
      const dx = x - kamPos.x, dy = y - kamPos.y, dz = z - kamPos.z;
      if (dx * dx + dy * dy + dz * dz < 100) z -= 60;
      a.setXYZ(i, x, y, z);
    }
    a.needsUpdate = true;
  };
})();

/* ------------------------------------------------------------------ *
 *  Scrollen → Kamerafahrt
 * ------------------------------------------------------------------ */
let ziel = 0, jetzt = 0, vorher = 0;

function scrollFortschritt() {
  const h = document.documentElement.scrollHeight - window.innerHeight;
  return h > 0 ? clamp01(window.scrollY / h) : 0;
}
addEventListener('scroll', () => { ziel = scrollFortschritt(); }, { passive: true });

// Maus-Parallaxe, nur am Desktop und sehr dezent
let mausX = 0, mausY = 0;
if (!mobil) {
  addEventListener('pointermove', (e) => {
    mausX = (e.clientX / window.innerWidth - 0.5) * 2;
    mausY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
}

/* ------------------------------------------------------------------ *
 *  Ostereier anklicken
 *
 *  Das Canvas selbst hört keine Zeigerereignisse (pointer-events: none,
 *  sonst schluckt es die Links). Der Listener hängt deshalb am Fenster
 *  und prüft selbst, ob wirklich ins Leere geklickt wurde. Aktiv ist er
 *  nur ganz unten im Tal – oben soll ein Klick nichts auslösen.
 * ------------------------------------------------------------------ */
let unten = 0;                                  // 0 = oben am Berg, 1 = im Tal

{
  const strahl = new THREE.Raycaster();
  const zeiger = new THREE.Vector2();

  // Ein Ziel zählt nur, wenn es und alle seine Eltern sichtbar sind –
  // das ausgerückte Feuerwehrauto lässt sich sonst im Nichts anklicken.
  const sichtbar = (o) => { for (let e = o; e; e = e.parent) if (!e.visible) return false; return true; };

  function ziel(e) {
    if (unten < 0.35) return null;
    if (e.target && e.target.closest && e.target.closest('a, button, input, label')) return null;
    // Am Canvas-Rechteck messen, nicht am Fenster: das stimmt auch dann,
    // wenn die Leinwand mal nicht das ganze Fenster ausfüllt.
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    zeiger.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    strahl.setFromCamera(zeiger, camera);
    for (const t of strahl.intersectObjects(klickbar, false)) {
      if (sichtbar(t.object)) return t.object;
    }
    return null;
  }

  addEventListener('click', (e) => {
    const o = ziel(e);
    if (o) o.userData.tun();
  });

  // Zeiger nur umschalten, wenn sich wirklich etwas ändert – sonst
  // schreibt jede Mausbewegung in den Stil und überschreibt fremde Cursor.
  if (!mobil) {
    let zeigt = false;
    addEventListener('pointermove', (e) => {
      const drauf = !!ziel(e);
      if (drauf === zeigt) return;
      zeigt = drauf;
      document.body.style.cursor = drauf ? 'pointer' : '';
    }, { passive: true });
  }
}

const posSki = new THREE.Vector3();
const drohnenMitte = new THREE.Vector3();
const posKam = new THREE.Vector3();
const blick  = new THREE.Vector3();
const fern   = new THREE.Vector3();
const hilfs  = new THREE.Vector3();

function bildAufbauen(dt, zeit) {
  // Scroll weich nachziehen
  jetzt += (ziel - jetzt) * (1 - Math.exp(-dt * TUNE.DAMP));
  const tempo = Math.abs(jetzt - vorher) / Math.max(dt, 1 / 120);
  vorher = jetzt;

  const strecke = jetzt * TUNE.RUN;

  // Am Anfang schwebt die Kamera hoch über dem Gipfel, dann fällt sie
  // hinter den Skifahrer zurück. Ganz unten hebt sie sich wieder und
  // dreht zum Feuerwehrauto.
  const start = smoothstep(0, 0.13, jetzt);
  const ende  = smoothstep(0.84, 1, jetzt);

  const hoehe   = THREE.MathUtils.lerp(34, 11, start) + ende * 3;
  const abstand = THREE.MathUtils.lerp(60, TUNE.LEAD, start);

  pfadPunkt(strecke + abstand, posSki);
  posSki.y += 0.08;

  const kamZ = 10 - strecke;
  const kamX = pisteX(kamZ) + carve(kamZ) * 0.4 + (mobil ? 0 : mausX * 2.6);
  posKam.set(kamX, bodenY(kamX, kamZ) + hoehe + (mobil ? 0 : mausY * -1.6), kamZ);
  posKam.y += Math.sin(zeit * 0.7) * 0.25;        // ganz leichtes Wiegen
  camera.position.copy(posKam);

  // Der Blick geht weit die Piste hinunter, nicht auf den Skifahrer –
  // sonst kippt das Bild nach unten und man sieht nur noch Hang.
  // Ganz am Ende schwenkt er zum Feuerwehrauto.
  // Am Gipfel geht der Blick fast waagerecht über die Bergkette; sobald es
  // losgeht, kippt er die Piste hinunter hinter den Skifahrer.
  pfadPunkt(strecke + 170, fern);
  fern.y += 10 + (1 - start) * 46;
  fern.lerp(hilfs.copy(posSki).setY(posSki.y + 2), 0.3 * start);
  blick.copy(fern).lerp(hilfs.copy(talMitte).setY(talMitte.y + 2.2), ende);
  camera.lookAt(blick);

  // Am Ende zielt die Kamera aufs Auto – dann steht es aber mittig hinter
  // der Überschrift. Deshalb wird sie anschließend um einen Bruchteil des
  // Bildwinkels gedreht: das Auto rutscht nach rechts unten, und zwar auf
  // jedem Seitenverhältnis gleich weit.
  // Im Hochformat ist der Ausschnitt so schmal, dass der Skifahrer aus dem
  // Finale fällt. Dort geht der Bildwinkel zum Schluss etwas auf; ab einem
  // Seitenverhältnis von 0.85 bleibt alles wie gehabt.
  const wunschFov = 52 + ende * clamp01((0.85 - camera.aspect) / 0.35) * 13;
  if (camera.fov !== wunschFov) {
    camera.fov = wunschFov;
    camera.updateProjectionMatrix();
  }

  if (ende > 0) {
    const halbHoch = THREE.MathUtils.degToRad(camera.fov) / 2;
    const halbBreit = Math.atan(Math.tan(halbHoch) * camera.aspect);
    camera.rotateY(ende * halbBreit * 0.34);
    camera.rotateX(ende * halbHoch * 0.24);
  }

  // Skifahrer aufs Ziel ausrichten (Vorderseite ist +Z) und in die
  // Kurve legen
  skifahrer.position.copy(posSki);
  pfadPunkt(strecke + abstand + 6, hilfs);
  skifahrer.lookAt(hilfs);

  // Unten kommt er zum Stehen, richtet sich auf und dreht sich zu dem
  // Wrack um, das er sich gerade eingefangen hat. Gedreht wird über den
  // kürzeren Weg – sonst schraubt er sich einmal falschherum herum.
  const halt = smoothstep(0.9, 1, jetzt);
  if (halt > 0) {
    let d = Math.atan2(einschlag.x - posSki.x, einschlag.z - posSki.z) - skifahrer.rotation.y;
    d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
    skifahrer.rotateY(d * halt);
  }
  const kruemmung = Math.sin(kamZ * TUNE.CARVE_FREQ) * TUNE.CARVE_AMP * TUNE.CARVE_FREQ;
  skifahrer.rotateZ(THREE.MathUtils.clamp(kruemmung * 2.2, -0.5, 0.5) * (1 - halt));
  haltung(halt);

  fahne.aktualisiere(zeit, clamp01(tempo * 3.2) * 0.9 + (tempo > 0.001 ? 0.1 : 0));

  // Himmelskuppel und Schnee wandern mit
  himmel.position.copy(posKam);
  himmelMat.uniforms.uTal.value = jetzt;
  flocken(dt, zeit, posKam);

  // Mondlicht hinter der Kamera halten, sonst wird es unten stockdunkel
  mond.position.set(posKam.x - 70, posKam.y + 90, posKam.z + 40);
  mond.target.position.copy(posKam);

  sternschnuppe(dt);

  // Die Drohne kommt auf dem letzten Viertel der Seite angeflogen
  // Ein Punkt auf der Blickachse. Die Ehrenrunde beim Anklicken orientiert
  // sich daran, damit sie auch im Hochformat im Bild bleibt – die Kamera
  // schaut nicht genau die Piste entlang.
  camera.getWorldDirection(drohnenMitte);
  drohnenMitte.y = 0;
  drohnenMitte.normalize().multiplyScalar(30).add(posKam);
  drohnenMitte.y = bodenY(drohnenMitte.x, drohnenMitte.z);
  drohne(smoothstep(0.74, 1, jetzt), dt, zeit, drohnenMitte);

  // Ostereier: erst im Tal anklickbar
  unten = ende;
  einsatz(dt);
  schild.schritt(dt, unten >= 0.35);

  // Blaulicht: deutsches Doppelblitz-Muster, links und rechts versetzt
  for (const b of blaulichter) {
    const t = (zeit * 1.1 + b.versatz) % 1;
    const an = (t < 0.06 || (t > 0.12 && t < 0.18)) ? 1 : 0;
    b.licht.intensity = an * 140;
    b.kappe.material.color.copy(COL.blaulicht).multiplyScalar(an ? 2.6 : 0.5);
    b.schein.material.opacity = an ? 0.85 : 0;
  }
}

/* ------------------------------------------------------------------ *
 *  Schleife
 * ------------------------------------------------------------------ */
function groesse(w = window.innerWidth, h = window.innerHeight) {
  // Notfalls 1 px: ein verstecktes Fenster meldet 0 und würde das
  // Seitenverhältnis auf NaN setzen – danach rendert gar nichts mehr.
  w = Math.max(1, w); h = Math.max(1, h);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', () => groesse());
groesse();

let zuletzt = performance.now(), laufzeit = 0;

function einzelbild(dt) {
  laufzeit += dt;
  sterneMat.uniforms.uTime.value = laufzeit;
  bildAufbauen(dt, laufzeit);
  renderer.render(scene, camera);
}

function schleife(now) {
  const dt = Math.min((now - zuletzt) / 1000, 0.05);
  zuletzt = now;
  einzelbild(dt);
}
renderer.setAnimationLoop(schleife);

// Im Hintergrundtab nicht rechnen
document.addEventListener('visibilitychange', () => {
  renderer.setAnimationLoop(document.hidden ? null : schleife);
});

ziel = jetzt = vorher = scrollFortschritt();
document.documentElement.dataset.scene = 'an';

/* Nur lokal: von der Konsole aus an eine Stelle der Abfahrt springen und
   Einzelbilder rendern. Auf veerka.mp existiert der Haken nicht. */
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  window.szene = {
    springe(p) { ziel = jetzt = vorher = clamp01(p); },
    bild(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) einzelbild(dt); },
    // klickbar[0] = Feuerwehrauto, klickbar[1] = Drohne; .userData.tun()
    // löst das jeweilige Osterei aus, ohne wirklich klicken zu müssen.
    masse: groesse,
    klickbar, THREE, scene, camera,
  };
}
