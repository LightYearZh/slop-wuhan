import * as THREE from 'three/webgpu';
import {modelBuilder} from './landmark-craft.js';

// 1985 Yellow Crane Tower. Documented basis: 51.4m total, five visible storeys
// (nine internal), folded-square plan 30m -> 22m -> 22m -> 22m -> 18m, 72 documented
// columns, 60 upturned eave corners (12 per tier), yellow glazed tiles, ochre-red
// columns/beams, blue-green under-eave painting, central pyramidal roof with four
// projecting gabled dormers and a gourd-shaped finial.
// Ornament sizes, exact column spacing and interior partitions remain visual estimates.

const FACES = [
  {nx: 0, nz: 1, tx: 1, tz: 0, ry: 0, top: '南维高拱', entry: '势连衡岳'},
  {nx: 1, nz: 0, tx: 0, tz: -1, ry: Math.PI / 2, top: '楚天极目', entry: '帘卷乾坤'},
  {nx: 0, nz: -1, tx: -1, tz: 0, ry: Math.PI, top: '北斗平临', entry: '云横九派'},
  {nx: -1, nz: 0, tx: 0, tz: 1, ry: -Math.PI / 2, top: '黄鹤楼', entry: '气吞云梦'}
];

function glazedTileTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.fillStyle = '#8a581c';
  c.fillRect(0, 0, 512, 512);
  // Barrel-tile ribs run down the slope (texture Y), in eight 0.4m bays.
  for (let x = 0; x < 512; x += 64) {
    c.fillStyle = '#53320f';
    c.fillRect(x, 0, 9, 512);
    const g = c.createLinearGradient(x + 9, 0, x + 62, 0);
    g.addColorStop(0, '#754714');
    g.addColorStop(.22, '#bd8730');
    g.addColorStop(.5, '#dbaa4d');
    g.addColorStop(.78, '#ad7624');
    g.addColorStop(1, '#663d10');
    c.fillStyle = g;
    c.fillRect(x + 9, 0, 53, 512);
  }
  for (let y = 0; y < 512; y += 64) {
    c.fillStyle = 'rgba(84,50,12,.52)';
    c.fillRect(0, y, 512, 5);
    c.fillStyle = 'rgba(255,224,150,.22)';
    c.fillRect(0, y + 5, 512, 2);
  }
  for (let i = 0; i < 420; i++) {
    const x = (i * 73 + 31) % 512, y = (i * 151 + 67) % 512;
    c.fillStyle = i % 3 ? 'rgba(255,225,160,.10)' : 'rgba(70,40,10,.12)';
    c.fillRect(x, y, 2, 2);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function underEaveTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.fillStyle = '#203f3a';
  c.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 128) {
    for (let x = 0; x < 512; x += 128) {
      c.fillStyle = '#17332f';
      c.fillRect(x + 6, y + 6, 116, 116);
      c.strokeStyle = '#c39a48';
      c.lineWidth = 4;
      c.strokeRect(x + 10, y + 10, 108, 108);
      c.strokeStyle = '#2f6b60';
      c.lineWidth = 3;
      c.strokeRect(x + 22, y + 22, 84, 84);
      // Painted bracket arms and a rosette, in the blue-green tradition.
      c.strokeStyle = '#d3ac59';
      c.lineWidth = 5;
      c.beginPath();
      c.arc(x + 64, y + 60, 24, Math.PI * 1.05, Math.PI * 1.95);
      c.stroke();
      c.fillStyle = '#3f7b6d';
      c.beginPath();
      c.arc(x + 64, y + 64, 13, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#c9a24b';
      c.lineWidth = 3;
      c.stroke();
      c.fillStyle = '#c9a24b';
      c.beginPath();
      c.arc(x + 64, y + 64, 4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#8e3d31';
      c.fillRect(x + 30, y + 96, 68, 7);
      c.fillStyle = '#d3ac59';
      c.fillRect(x + 30, y + 104, 68, 2);
    }
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function railingTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.clearRect(0, 0, 256, 128);
  c.strokeStyle = '#5f2a22';
  c.lineWidth = 4;
  for (let x = 0; x <= 256; x += 16) {
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 128); c.stroke();
  }
  for (const y of [2, 62, 124]) {
    c.beginPath(); c.moveTo(0, y); c.lineTo(256, y); c.stroke();
  }
  c.strokeStyle = '#8f4031';
  c.lineWidth = 2;
  for (let x = 0; x < 256; x += 16) {
    c.beginPath(); c.moveTo(x, 64); c.lineTo(x + 8, 70); c.lineTo(x + 16, 64); c.stroke();
    c.beginPath(); c.moveTo(x, 122); c.lineTo(x + 8, 128); c.lineTo(x + 16, 122); c.stroke();
  }
  c.strokeStyle = '#5f2a22';
  c.lineWidth = 5;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(256, 0); c.stroke();
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function plaqueMaterial(text) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.fillStyle = '#11100d';
  c.fillRect(0, 0, 1024, 512);
  c.strokeStyle = '#c9a24b';
  c.lineWidth = 18;
  c.strokeRect(18, 18, 988, 476);
  c.strokeStyle = '#6e5424';
  c.lineWidth = 4;
  c.strokeRect(38, 38, 948, 436);
  const chars = Array.from(text).reverse();
  const fontSize = text.length > 3 ? 150 : 178;
  c.font = `bold ${fontSize}px "Songti SC","STSong","Noto Serif SC",serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const step = Math.min(230, 820 / chars.length);
  const start = 512 - (chars.length - 1) * step / 2;
  chars.forEach((ch, i) => {
    const x = start + i * step;
    c.shadowColor = 'rgba(0,0,0,.85)';
    c.shadowBlur = 8;
    c.shadowOffsetY = 5;
    c.fillStyle = '#e0b95b';
    c.fillText(ch, x, 268);
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
    c.fillStyle = 'rgba(255,236,178,.62)';
    c.fillText(ch, x - 2, 263);
  });
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return new THREE.MeshStandardNodeMaterial({map: t, roughness: .62, metalness: .12});
}

const _v = new THREE.Vector3();
function pointOn(face, u, d, y) {
  return [face.nx * d + face.tx * u, y, face.nz * d + face.tz * u];
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// A shallow hip-roof skirt with twelve flying corners: four at the square corners
// and two at each of the four projecting porch roofs. The inner plateau is hidden
// under the storey above; only the outer slope is read from outside.
function eaveRoof(b, o) {
  const {
    inner, outer, yTop, yEave, porchHalf, porchDepth = 0,
    cornerLift = 1.6, porchLift = .95, cornerExt = .5,
    tileMat, greenMat, ridgeMat, goldMat, creamMat, bronzeMat, soffitMat, ochreMat,
    segments = 20, rows = 5
  } = o;
  const rise = yTop - yEave;
  const slopeLen = Math.hypot(outer - inner, rise) || 1;
  const porchN = porchHalf / outer;
  const cornerW = s => smoothstep(.55, 1, Math.abs(s));
  const porchBump = s => Math.abs(s) <= porchN ? 1 : 0;
  const porchW = s => Math.exp(-Math.pow((Math.abs(s) - porchN) / .085, 2));

  const surf = (face, s, t) => {
    const cw = cornerW(s);
    const pb = porchBump(s);
    const pw = porchW(s) * (t > .75 ? 1 : 0);
    const u0 = s * inner, u1 = s * (outer + cornerExt * cw);
    const d0 = inner, d1 = outer + porchDepth * pb + cornerExt * cw;
    const u = u0 + (u1 - u0) * t;
    const d = d0 + (d1 - d0) * t;
    const drop = rise * (1 - Math.pow(1 - t, 1.6));
    const y = yTop - drop - .07 * (1 - s * s) * t
      + (cornerLift * cw + porchLift * pw) * Math.pow(t, 3)
      + .10 * Math.pow(t, 10);
    return [face.nx * d + face.tx * u, y, face.nz * d + face.tz * u];
  };

  for (const face of FACES) {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      for (let i = 0; i <= segments; i++) {
        const s = -1 + 2 * i / segments;
        const p = surf(face, s, t);
        pos.push(...p);
        uv.push(s * outer / 3.2, t * slopeLen / 3.2);
      }
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i, b2 = a + 1, c = a + segments + 1, d = c + 1;
      idx.push(a, c, b2, b2, c, d);
    }
    const roof = new THREE.BufferGeometry();
    roof.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    roof.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    roof.setIndex(idx);
    roof.computeVertexNormals();
    b.add(roof, tileMat);

    // Blue-green soffit, so the underside is not a yellow plane.
    const soffit = new THREE.BufferGeometry();
    soffit.setAttribute('position', new THREE.Float32BufferAttribute(pos.map((v, k) => k % 3 === 1 ? v - .16 : v), 3));
    soffit.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    soffit.setIndex(idx.slice().reverse());
    soffit.computeVertexNormals();
    b.add(soffit, soffitMat);

    // Vertical eave fascia and the round tile ends.
    const fpos = [], fidx = [];
    for (let i = 0; i <= segments; i++) {
      const s = -1 + 2 * i / segments;
      const p = surf(face, s, 1);
      fpos.push(p[0], p[1], p[2], p[0], p[1] - .46, p[2]);
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 2, b2 = a + 1, c = a + 2, d = c + 1;
      fidx.push(a, b2, c, c, b2, d);
    }
    const fascia = new THREE.BufferGeometry();
    fascia.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
    fascia.setIndex(fidx);
    fascia.computeVertexNormals();
    b.add(fascia, ochreMat);

    const ends = Math.max(10, Math.round(outer * 2 / 1.25));
    for (let i = 0; i <= ends; i++) {
      const s = -1 + 2 * i / ends;
      const p = surf(face, s, 1);
      const len = Math.hypot(p[0], p[2]) || 1;
      const ox = p[0] / len, oz = p[2] / len;
      b.box(.13, .13, .13, p[0] + ox * .025, p[1] - .2, p[2] + oz * .025, creamMat);
    }

    // Hip ridge along the right-hand corner of this face (one per building corner).
    let last = null;
    for (let k = 0; k <= 8; k++) {
      const p = surf(face, 1, k / 8);
      if (last) b.beam(last, p, Math.max(.07, outer * .007), ridgeMat);
      last = p;
    }

    for (const s of [1, -porchN, porchN]) {
      const p = surf(face, s, 1);
      const inner = surf(face, s * .88, 1);
      b.beam(inner, p, .11, goldMat);
      const len = Math.hypot(p[0], p[2]) || 1;
      const ox = p[0] / len, oz = p[2] / len;
      const yaw = Math.atan2(ox, oz);
      const horn = new THREE.ConeGeometry(.13, .62, 5);
      horn.rotateX(-.28);
      horn.rotateY(yaw);
      horn.translate(p[0] + ox * .06, p[1] + .34, p[2] + oz * .06);
      b.add(horn, goldMat);
      b.box(.30, .24, .30, p[0], p[1] + .05, p[2], goldMat, yaw);
      // Bronze wind bell under the flying corner.
      b.cyl(.055, .11, .30, p[0], p[1] - .74, p[2], bronzeMat, 6);
      b.box(.05, .18, .05, p[0], p[1] - .95, p[2], bronzeMat);
    }

    // Gold ridge-end ornament where the hip meets the storey above.
    const top = surf(face, 1, .04);
    const tLen = Math.hypot(top[0], top[2]) || 1;
    b.add((() => {
      const g = new THREE.ConeGeometry(.1, .55, 5);
      g.rotateX(-.45);
      g.rotateY(Math.atan2(top[0] / tLen, top[2] / tLen));
      g.translate(top[0], top[1] + .22, top[2]);
      return g;
    })(), goldMat);
  }
}

// Four-sided pyramidal crown roof with concave profile and lifted corners.
function crownRoof(b, o) {
  const {base, yBase, yApex, tileMat, greenMat, ridgeMat, goldMat, soffitMat, segments = 22, rows = 9} = o;
  for (const face of FACES) {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= rows; j++) {
      const t = .985 * j / rows;
      const a = base * Math.pow(1 - t, .82);
      for (let i = 0; i <= segments; i++) {
        const s = -1 + 2 * i / segments;
        const u = s * a;
        const lift = 1.45 * Math.pow(Math.abs(s), 6) * Math.pow(1 - t, 2.2);
        const y = yBase + (yApex - yBase) * t + lift;
        pos.push(face.nx * a + face.tx * u, y, face.nz * a + face.tz * u);
        uv.push(s * base / 3.2, t * (yApex - yBase) / 3.2);
      }
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i, b2 = a + 1, c = a + segments + 1, d = c + 1;
      idx.push(a, c, b2, b2, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    b.add(g, tileMat);
    const soffit = new THREE.BufferGeometry();
    soffit.setAttribute('position', new THREE.Float32BufferAttribute(pos.map((v, k) => k % 3 === 1 ? v - .12 : v), 3));
    soffit.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    soffit.setIndex(idx.slice().reverse());
    soffit.computeVertexNormals();
    b.add(soffit, soffitMat);

    let last = null;
    for (let k = 0; k <= 8; k++) {
      const t = .985 * k / 8, a = base * Math.pow(1 - t, .82);
      const p = [face.nx * a + face.tx * a, yBase + (yApex - yBase) * t + 1.45 * Math.pow(1 - t, 2.2), face.nz * a + face.tz * a];
      if (last) b.beam(last, p, .12, ridgeMat);
      last = p;
    }
    const tip = [face.nx * base + face.tx * base, yBase + 1.45, face.nz * base + face.tz * base];
    b.add((() => {
      const g = new THREE.ConeGeometry(.14, .7, 5);
      g.rotateX(-.3);
      g.rotateY(face.ry);
      g.translate(tip[0], tip[1] + .3, tip[2]);
      return g;
    })(), goldMat);
  }
  // Small gold lotus plate where the gourd finial is seated.
  b.cyl(1.0, 1.25, .35, 0, yApex + .05, 0, goldMat, 16);
}

// A projecting gabled dormer ("骑楼") on each side of the crown. Its eave is a
// shallow trapezoid with turned-up corners and a short ridge, so the four upper
// roofs read as hip-and-gable pavilions rather than boxes.
function dormer(b, o) {
  const {face, back, front, eaveY, ridgeY, halfW, tileMat, ridgeMat, goldMat, ochreMat} = o;
  const ridgeU = halfW * .12;
  const ridgeD = front - .55;
  
  const eaveLift = 1.2;
  const eaveYAt = (u) => {
    const rel = Math.abs(u) / halfW;
    return eaveY + eaveLift * Math.pow(rel, 6) - .09 * (1 - rel * rel);
  };
  const eavePoint = (u, d = front) => pointOn(face, u, d, eaveYAt(u));

  // Front slope: a trapezoid from the upturned eave up to a short ridge.
  const pos = [], uv = [], idx = [];
  const cols = 8, rows = 3;
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    for (let i = 0; i <= cols; i++) {
      const s = -1 + 2 * i / cols;
      const u = s * halfW * (1 - .88 * t);
      const d = front + (ridgeD - front) * t;
      const y = eaveYAt(s * halfW) * (1 - t) + ridgeY * t;
      pos.push(...pointOn(face, u, d, y));
      uv.push(s * halfW / 3.2, t * (ridgeY - eaveY) / 3.2);
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b2 = a + 1, c = a + cols + 1, d = c + 1;
    idx.push(a, c, b2, b2, c, d);
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  fg.setIndex(idx);
  fg.computeVertexNormals();
  b.add(fg, tileMat);

  // Side slopes, each between the short ridge and the side eave.
  for (const side of [-1, 1]) {
    const sp = [], suv = [], sidx = [];
    for (let j = 0; j <= 4; j++) {
      const t = j / 4;
      const r = ridgeD + (back - ridgeD) * t;
      const lift = eaveLift * Math.pow(1 - t, 1.6);
      const ridgePoint = pointOn(face, side * ridgeU, r, ridgeY);
      const eavePointSide = pointOn(face, side * halfW, r, eaveY + lift);
      sp.push(...ridgePoint, ...eavePointSide);
      suv.push(t * (ridgeD - back) / 3.2, 0, t * (ridgeD - back) / 3.2, (ridgeY - eaveY) / 3.2);
    }
    for (let j = 0; j < 4; j++) {
      const a = j * 2, b2 = a + 1, c = a + 2, d = c + 1;
      if (side > 0) sidx.push(a, b2, c, c, b2, d); else sidx.push(a, c, b2, b2, c, d);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sg.setAttribute('uv', new THREE.Float32BufferAttribute(suv, 2));
    sg.setIndex(sidx);
    sg.computeVertexNormals();
    b.add(sg, tileMat);
  }

  // Tile-capped short ridge, gold bargeboards and upturned corner ornaments.
  b.box(ridgeU * 2 + .26, .18, ridgeD - (back - .5) + .4, ...pointOn(face, 0, (ridgeD + back - .5) / 2, ridgeY + .05), ridgeMat, face.ry);
  b.box(ridgeU * 2 + .36, .08, ridgeD - (back - .5) + .3, ...pointOn(face, 0, (ridgeD + back - .5) / 2, ridgeY + .16), goldMat, face.ry);
  const eavePts = [];
  for (let i = 0; i <= cols; i++) eavePts.push(eavePoint(-halfW + 2 * halfW * i / cols));
  for (let i = 0; i < eavePts.length - 1; i += 2) b.beam(eavePts[i], eavePts[Math.min(i + 2, eavePts.length - 1)], .07, goldMat);
  // Thick ochre fascia under the front eave, otherwise the tile slope is paper-thin.
  const fpos = [], fidx = [];
  for (let i = 0; i <= cols; i++) {
    const p = eavePts[i];
    fpos.push(p[0], p[1], p[2], p[0], p[1] - .32, p[2]);
  }
  for (let i = 0; i < cols; i++) {
    const a = i * 2, b2 = a + 1, c = a + 2, d = c + 1;
    fidx.push(a, b2, c, c, b2, d);
  }
  const fascia = new THREE.BufferGeometry();
  fascia.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
  fascia.setIndex(fidx);
  fascia.computeVertexNormals();
  b.add(fascia, ochreMat);
  for (const s of [-1, 1]) {
    const p = eavePts[s > 0 ? eavePts.length - 1 : 0];
    const len = Math.hypot(p[0], p[2]) || 1;
    b.add((() => {
      const g = new THREE.ConeGeometry(.13, .62, 5);
      g.rotateX(-.3);
      g.rotateY(Math.atan2(p[0] / len, p[2] / len));
      g.translate(p[0], p[1] + .3, p[2]);
      return g;
    })(), goldMat);
    b.cyl(.05, .1, .28, p[0], p[1] - .62, p[2], ridgeMat, 6);
  }
  b.add((() => {
    const g = new THREE.ConeGeometry(.1, .6, 5);
    g.rotateX(-.35);
    g.rotateY(face.ry);
    const rp = pointOn(face, 0, ridgeD, ridgeY);
    g.translate(rp[0], rp[1] + .3, rp[2]);
    return g;
  })(), goldMat);
}

let redCore;

export function buildYellowCrane(root) {
  const mat = (color, extra = {}) => new THREE.MeshStandardNodeMaterial({color, roughness: .76, ...extra});
  const red = mat(0x823d32, {roughness: .72, emissive: 0x5a1a0e, emissiveIntensity: 0});
  const redDark = mat(0x572721, {roughness: .7, emissive: 0x3a0f08, emissiveIntensity: 0});
  const redBeam = mat(0x6f332a, {roughness: .66, emissive: 0x4a160c, emissiveIntensity: 0});
  redCore = mat(0x622e28, {roughness: .82, emissive: 0x2a0a05, emissiveIntensity: 0});
  const stone = mat(0xc3bdb0, {roughness: .9, emissive: 0x6b5a3a, emissiveIntensity: 0});
  const stoneDark = mat(0xa9a294, {roughness: .92, emissive: 0x4a3a22, emissiveIntensity: 0});
  const green = mat(0x2a4742, {roughness: .64, side: THREE.DoubleSide, emissive: 0x1f6b5e, emissiveIntensity: 0});
  const teal = mat(0x42665c, {roughness: .62, emissive: 0x1f6b5e, emissiveIntensity: 0});
  const dark = mat(0x241c18, {roughness: .62, emissive: 0xffc46a, emissiveIntensity: 0});
  const gold = mat(0xc7a14f, {metalness: .5, roughness: .38, emissive: 0xffb84d, emissiveIntensity: 0});
  const bronze = mat(0x8b6b38, {metalness: .55, roughness: .44, emissive: 0xffa040, emissiveIntensity: 0});
  const cream = mat(0xe3d8ba, {roughness: .76, emissive: 0xffe0a0, emissiveIntensity: 0});
  const ridge = mat(0x4a3320, {roughness: .58, metalness: .18, emissive: 0x2a1a0e, emissiveIntensity: 0});
  const ochre = mat(0xa97830, {roughness: .58, metalness: .08, emissive: 0xffb347, emissiveIntensity: 0});
  const tileTexture = glazedTileTexture();
  const tile = new THREE.MeshStandardNodeMaterial({
    color: 0xe6c88f, map: tileTexture, emissive: 0xffb347, emissiveMap: tileTexture,
    emissiveIntensity: 0, roughness: .52, metalness: .05, side: THREE.DoubleSide
  });
  const soffitMat = new THREE.MeshStandardNodeMaterial({
    color: 0xffffff, map: underEaveTexture(), roughness: .72, side: THREE.DoubleSide
  });
  const railingMat = new THREE.MeshStandardNodeMaterial({
    color: 0xffffff, map: railingTexture(), alphaTest: .4, side: THREE.DoubleSide, roughness: .72
  });
  const windowTexture = railingTexture();
  if (windowTexture) windowTexture.repeat.set(2.5, 2.5);
  const windowLatticeMat = new THREE.MeshStandardNodeMaterial({
    color: 0xffffff, map: windowTexture, emissive: 0xffc46a, emissiveMap: windowTexture,
    emissiveIntensity: 0, alphaTest: .4, side: THREE.DoubleSide, roughness: .74
  });
  const lanternMat = new THREE.MeshStandardNodeMaterial({
    color: 0xa72d25, emissive: 0x4d0d08, emissiveIntensity: .22, roughness: .58
  });
  const aviationMat = new THREE.MeshStandardNodeMaterial({
    color: 0xc73128, emissive: 0x7d0d08, emissiveIntensity: .45, roughness: .42
  });

  const b = modelBuilder(root);
  const {box, cyl, beam, add, finish} = b;
  const P = 1.5;

  // ---- Three-tier granite platform, balustrade and stairs -------------------
  const tier = [[16.9, .5], [16.15, .5], [15.9, .5]];
  tier.forEach(([half, h], i) => {
    box(half * 2, h, half * 2, 0, h / 2 + i * .5, 0, stone);
    box(half * 2 + .16, .12, half * 2 + .16, 0, (i + 1) * .5 - .06, 0, stoneDark);
  });
  for (let i = 0; i < 3; i++) {
    const y = .5 + i * .5;
    for (const face of FACES) {
      box(30 - i * 2.2, .035, .07, ...pointOn(face, 0, 16.6 - i * .45, y + .02), stoneDark, face.ry);
    }
  }
  // Stone balustrade around the top platform, with stair openings on all four sides.
  const bd = 15.55;
  for (const face of FACES) {
    for (let side = -1; side <= 1; side += 2) {
      for (let u = 3.95; u < bd; u += 1.45) {
        const [x, y, z] = pointOn(face, side * u, bd, 1.5 + .53);
        box(.16, 1.06, .16, x, y, z, stone);
        cyl(.1, .13, .12, x, y + .58, z, stone, 6);
      }
      const railHalf = (bd - 3.95) / 2;
      const [rx, ry2, rz] = pointOn(face, side * (3.95 + railHalf), bd, 1.5 + 1.0);
      box(railHalf * 2, .13, .22, rx, ry2, rz, stone, face.ry);
    }
    // Low curb on the top tier edge.
    box(30.4, .16, .24, ...pointOn(face, 0, bd + .55, 1.56), stoneDark, face.ry);
    // Grand stair: six risers, no geometry outside the eave envelope.
    for (let st = 0; st < 6; st++) {
      const y = (st + 1) * .25;
      const d = 17.7 - st * .3;
      box(7.4, y, .3, ...pointOn(face, 0, d, y / 2), stone, face.ry);
      box(7.4, .07, .34, ...pointOn(face, 0, d, y + .02), stoneDark, face.ry);
    }
    for (const side of [-1, 1]) {
      for (let st = 0; st < 6; st++) {
        const h = (st + 1) * .25 + .95;
        box(.22, h, .32, ...pointOn(face, side * 3.85, 17.7 - st * .3, h / 2 + .01), stone, face.ry);
      }
    }
  }

  // ---- Gallery helper --------------------------------------------------------
  function addColumns(radius, count, r, y0, y1, seen) {
    const half = radius - .35;
    for (const face of FACES) for (let i = 0; i < count; i++) {
      const u = -half + 2 * half * i / (count - 1);
      const [x, , z] = pointOn(face, u, half, 0);
      const key = x.toFixed(2) + ',' + z.toFixed(2);
      if (seen.has(key)) continue;
      seen.add(key);
      cyl(r * 1.04, r, y1 - y0, x, (y0 + y1) / 2, z, red, 10);
      box(r * 2.7, .22, r * 2.7, x, y0 + .11, z, stone);
      box(r * 2.45, .26, r * 2.45, x, y1 - .13, z, redDark);
      box(r * 4.2, .34, r * 4.2, x, y1 + .12, z, green);
      box(r * 3.2, .16, r * 3.2, x, y1 + .30, z, gold);
    }
  }

  function addRailing(face, d, y) {
    const half = d - .12;
    box(half * 2, .13, .14, ...pointOn(face, 0, d, y + 1.18), redBeam, face.ry);
    box(half * 2, .09, .10, ...pointOn(face, 0, d, y + .62), redBeam, face.ry);
    box(half * 2, .10, .12, ...pointOn(face, 0, d, y + .16), redBeam, face.ry);
    add(new THREE.PlaneGeometry(half * 2, 1.05), railingMat, ...pointOn(face, 0, d, y + .64), face.ry);
    for (let u = -half + .1; u <= half; u += 4.3) {
      box(.2, 1.3, .2, ...pointOn(face, u, d, y + .64), redBeam, face.ry);
      box(.30, .12, .30, ...pointOn(face, u, d, y + 1.32), gold, face.ry);
    }
  }

  function addWindow(face, u, y, w, h, d) {
    box(w, h, .1, ...pointOn(face, u, d, y), dark, face.ry);
    box(w + .3, .14, .2, ...pointOn(face, u, d + .045, y + h / 2 + .02), redBeam, face.ry);
    box(w + .3, .14, .2, ...pointOn(face, u, d + .045, y - h / 2 - .02), redBeam, face.ry);
    box(.14, h + .2, .2, ...pointOn(face, u - w / 2 - .08, d + .045, y), redBeam, face.ry);
    box(.14, h + .2, .2, ...pointOn(face, u + w / 2 + .08, d + .045, y), redBeam, face.ry);
    for (const k of [-1, 1]) {
      box(.055, h - .22, .16, ...pointOn(face, u + k * w / 6, d + .085, y), redDark, face.ry);
    }
    box(w - .26, .055, .16, ...pointOn(face, u, d + .085, y), redDark, face.ry);
    box(w - .1, .06, .18, ...pointOn(face, u, d + .1, y + h / 2 - .35), teal, face.ry);
    add(new THREE.PlaneGeometry(w - .12, h - .12), windowLatticeMat, ...pointOn(face, u, d + .125, y), face.ry);
  }

  function addLantern(x, y, z) {
    const g = new THREE.SphereGeometry(.31, 8, 6);
    g.scale(1, 1.18, 1);
    g.translate(x, y, z);
    add(g, lanternMat);
    cyl(.1, .1, .09, x, y + .37, z, gold, 6);
    cyl(.1, .1, .09, x, y - .37, z, gold, 6);
    cyl(.018, .018, .45, x, y + .57, z, dark, 4);
  }

  // ---- Ground storey: two eave tiers, wide veranda --------------------------
  const groundHalf = 15, groundCore = 12.2, mezzHalf = 14.45;
  box(groundCore * 2, 12.2, groundCore * 2, 0, P + 6.1, 0, redCore);
  box(mezzHalf * 2, .35, mezzHalf * 2, 0, 7.95, 0, stoneDark);
  // Ground veranda floor / edge beam.
  for (const face of FACES) {
    box(29.4, .7, .34, ...pointOn(face, 0, 14.55, P - .2), redBeam, face.ry);
    box(29.4, .16, .44, ...pointOn(face, 0, 14.55, P - .58), gold, face.ry);
    // Central doors and flanking openings, centred in the three middle bays.
    for (const u of [-4.18, 0, 4.18]) {
      const w = u === 0 ? 3.6 : 2.9, h = u === 0 ? 3.4 : 3.1, cy = P + .08 + h / 2;
      box(w, h, .14, ...pointOn(face, u, groundCore + .08, cy), dark, face.ry);
      box(w + .35, .16, .24, ...pointOn(face, u, groundCore + .14, cy + h / 2 + .02), redBeam, face.ry);
      box(.16, h + .2, .24, ...pointOn(face, u - w / 2 - .1, groundCore + .14, cy), redBeam, face.ry);
      box(.16, h + .2, .24, ...pointOn(face, u + w / 2 + .1, groundCore + .14, cy), redBeam, face.ry);
      for (let k = -1; k <= 1; k++) box(.05, h - .4, .18, ...pointOn(face, u + k * w / 5, groundCore + .17, cy), redDark, face.ry);
    }
    // Mezzanine glazing.
    for (const u of [-11.28, -5.64, 0, 5.64, 11.28]) addWindow(face, u, 9.7, 2.5, 2.9, groundCore + .05);
    // Entrance plaque.
    const plaque = plaqueMaterial(face.entry);
    if (plaque) {
      box(3.85, 1.85, .16, ...pointOn(face, 0, 14.35, 5.75), gold, face.ry);
      const [x, y, z] = pointOn(face, 0, 14.46, 5.75);
      add(new THREE.PlaneGeometry(3.5, 1.5), plaque, x, y, z, face.ry);
    }
    for (const u of [-12.55, -8.37, 8.37, 12.55]) addLantern(...pointOn(face, u, 15.4, 5.55), 0);
  }
  const groundSeen = new Set();
  addColumns(groundHalf, 8, .42, P, 6.75, groundSeen);
  addColumns(mezzHalf, 6, .32, 7.95, 11.9, groundSeen);
  // Blue-green friezes beneath both base-storey eaves.
  for (const face of FACES) {
    box(29.6, .48, .22, ...pointOn(face, 0, 14.75, 6.32), green, face.ry);
    box(29.0, .48, .22, ...pointOn(face, 0, 14.25, 11.55), green, face.ry);
    for (let u = -13.7; u < 14; u += 2.0) {
      box(.24, .5, .28, ...pointOn(face, u, 14.7, 6.1), green, face.ry);
      box(.28, .12, .32, ...pointOn(face, u, 14.72, 6.38), gold, face.ry);
    }
    for (let u = -13.2; u < 14; u += 2.2) {
      box(.24, .5, .28, ...pointOn(face, u, 14.2, 11.32), green, face.ry);
      box(.28, .12, .32, ...pointOn(face, u, 14.22, 11.6), gold, face.ry);
    }
  }
  // Lower mezzanine eave and the main first-storey eave.
  eaveRoof(b, {
    inner: 10.0, outer: 15.0, yTop: 8.0, yEave: 6.7,
    porchHalf: 6.6, porchDepth: .8, cornerLift: 1.7, porchLift: 1.05, cornerExt: .38,
    tileMat: tile, greenMat: green, ridgeMat: ridge, goldMat: gold, creamMat: cream, bronzeMat: bronze,
    soffitMat, ochreMat: ochre
  });
  eaveRoof(b, {
    inner: 7.7, outer: 16.8, yTop: 13.8, yEave: 11.9,
    porchHalf: 7.4, porchDepth: .95, cornerLift: 2.1, porchLift: 1.3, cornerExt: .45,
    tileMat: tile, greenMat: green, ridgeMat: ridge, goldMat: gold, creamMat: cream, bronzeMat: bronze,
    soffitMat, ochreMat: ochre
  });

  // ---- Storeys two to four: 22m square, open verandas -----------------------
  const colonnade = [
    {a: 11, core: 8.4, y0: 13.8, y1: 20.9, eave: 19.0, col: 6, r: .31},
    {a: 11, core: 8.4, y0: 20.9, y1: 27.5, eave: 25.6, col: 6, r: .30},
    {a: 11, core: 8.4, y0: 27.5, y1: 34.1, eave: 32.2, col: 6, r: .30}
  ];
  for (const f of colonnade) {
    box(f.core * 2, f.y1 - f.y0 - .2, f.core * 2, 0, (f.y0 + f.y1) / 2 - .1, 0, redCore);
    box(f.a * 2, .36, f.a * 2, 0, f.y0 - .18, 0, stoneDark);
    for (const face of FACES) {
      box(f.a * 2, .78, .3, ...pointOn(face, 0, f.a - .12, f.y0 - .42), redBeam, face.ry);
      box(f.a * 2, .13, .4, ...pointOn(face, 0, f.a - .12, f.y0 - .86), gold, face.ry);
      addRailing(face, f.a - .12, f.y0);
      const bay = (f.a - .35) * 2 / (f.col - 1);
      for (let k = -2; k <= 2; k++) {
        addWindow(face, k * bay, (f.y0 + f.eave) / 2 - .3, 1.95, 2.75, f.core + .05);
      }
      // Blue-green frieze with bracket rhythm.
      box(f.a * 2, .5, .22, ...pointOn(face, 0, f.a - .08, f.eave - .18), green, face.ry);
      for (let u = -f.a + .8; u < f.a; u += 2.0) {
        box(.26, .55, .3, ...pointOn(face, u, f.a - .12, f.eave - .5), green, face.ry);
        box(.3, .14, .34, ...pointOn(face, u, f.a - .14, f.eave - .2), gold, face.ry);
      }
      for (const u of [-6.5, 6.5]) addLantern(...pointOn(face, u, f.a + .9, f.y0 + 5.15), 0);
    }
    const seen = new Set();
    addColumns(f.a, f.col, f.r, f.y0, f.eave + .62, seen);
    eaveRoof(b, {
      inner: 7.7, outer: 14.0, yTop: f.y1, yEave: f.eave,
      porchHalf: 5.45, porchDepth: 1.0, cornerLift: 1.95, porchLift: 1.2, cornerExt: .42,
      tileMat: tile, greenMat: green, ridgeMat: ridge, goldMat: gold, creamMat: cream, bronzeMat: bronze,
      soffitMat, ochreMat: ochre
    });
  }

  // ---- Fifth storey and the five-roof crown ---------------------------------
  const f5a = 9, f5core = 6.6, f5y = 34.1;
  box(f5core * 2, 5.9, f5core * 2, 0, f5y + 3, 0, redCore);
  box(f5a * 2, .36, f5a * 2, 0, f5y - .18, 0, stoneDark);
  for (const face of FACES) {
    box(f5a * 2, .78, .3, ...pointOn(face, 0, f5a - .12, f5y - .42), redBeam, face.ry);
    box(f5a * 2, .13, .4, ...pointOn(face, 0, f5a - .12, f5y - .86), gold, face.ry);
    addRailing(face, f5a - .12, f5y);
    const f5bay = (f5a - .35) * 2 / 3;
    for (const k of [-1, 1]) addWindow(face, k * f5bay, 36.1, 1.95, 2.7, f5core + .05);
    const topPlaque = plaqueMaterial(face.top);
    if (topPlaque) {
      const d = f5core + .14;
      box(5.9, 2.85, .2, ...pointOn(face, 0, d, 37.35), gold, face.ry);
      const [px, py, pz] = pointOn(face, 0, d + .11, 37.35);
      add(new THREE.PlaneGeometry(5.45, 2.45), topPlaque, px, py, pz, face.ry);
    }
    box(f5a * 2, .5, .22, ...pointOn(face, 0, f5a - .08, 38.15), green, face.ry);
    for (let u = -f5a + .8; u < f5a; u += 2.2) {
      box(.26, .55, .3, ...pointOn(face, u, f5a - .12, 37.85), green, face.ry);
      box(.3, .14, .34, ...pointOn(face, u, f5a - .14, 38.15), gold, face.ry);
    }
  }
  const f5seen = new Set();
  addColumns(f5a, 4, .28, f5y, 39.25, f5seen);
  eaveRoof(b, {
    inner: 6.3, outer: 12.45, yTop: 40.2, yEave: 38.7,
    porchHalf: 4.45, porchDepth: 1.0, cornerLift: 1.8, porchLift: 1.1, cornerExt: .38,
    tileMat: tile, greenMat: green, ridgeMat: ridge, goldMat: gold, creamMat: cream, bronzeMat: bronze,
    soffitMat, ochreMat: ochre
  });

  // Crown pyramid and the four dormer pavilions.
  crownRoof(b, {
    base: 11.9, yBase: 40.15, yApex: 46.4,
    tileMat: tile, greenMat: green, ridgeMat: ridge, goldMat: gold, soffitMat
  });
  for (const face of FACES) {
    dormer(b, {
      face, back: 9.0, front: 14.6, eaveY: 40.55, ridgeY: 44.6, halfW: 5.4,
      tileMat: tile, ridgeMat: ridge, goldMat: gold, ochreMat: ochre
    });
  }

  // ---- Gourd-shaped ceramic finial, 5m from crown apex to 51.4m ------------
  const finialBase = 46.4;
  const profile = [
    [0.00, 0.00], [0.95, .12], [1.02, .30], [0.78, .55], [0.52, .72],
    [0.72, .95], [0.92, 1.35], [0.86, 1.85], [0.60, 2.15], [0.36, 2.35],
    [0.58, 2.62], [0.68, 3.02], [0.58, 3.38], [0.33, 3.62], [0.22, 3.82],
    [0.34, 3.94], [0.26, 4.06]
  ].map(([r, y]) => new THREE.Vector2(r, finialBase + y));
  const lathe = new THREE.LatheGeometry(profile, 20);
  add(lathe, gold);
  cyl(.32, .32, .16, 0, finialBase + 4.16, 0, gold, 12);
  const light = new THREE.SphereGeometry(.5, 12, 8);
  light.translate(0, finialBase + 4.5, 0);
  add(light, aviationMat);

  // Record the reference basis on the group.
  root.userData.modelReference = {
    visibleFloors: 5,
    internalLevels: 9,
    totalHeightM: 51.4,
    planM: {ground: 30, upper: 22, crown: 18},
    documentedColumns: 72,
    upturnedEaveCorners: 60,
    roofForm: 'folded-square hip skirts, 12 flying corners per tier, pyramidal crown with four dormer roofs',
    detail: 'procedural-photo-reference-not-survey'
  };
  root.userData.update = night => {
    lanternMat.emissiveIntensity = .22 + night * 2.2;
    aviationMat.emissiveIntensity = .45 + night * 2.2;
    red.emissiveIntensity = night * .45;
    redDark.emissiveIntensity = night * .3;
    redBeam.emissiveIntensity = night * .35;
    redCore.emissiveIntensity = night * .16;
    stone.emissiveIntensity = night * .08;
    stoneDark.emissiveIntensity = night * .06;
    green.emissiveIntensity = night * .25;
    teal.emissiveIntensity = night * .25;
    dark.emissiveIntensity = night * .55;
    gold.emissiveIntensity = night * .8;
    bronze.emissiveIntensity = night * .25;
    cream.emissiveIntensity = night * .3;
    ridge.emissiveIntensity = night * .2;
    ochre.emissiveIntensity = night * .45;
    tile.emissiveIntensity = night * .7;
    windowLatticeMat.emissiveIntensity = night * .6;
  };

  finish();
  return root;
}
