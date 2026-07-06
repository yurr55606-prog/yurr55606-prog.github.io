import * as THREE from 'three';

// 四维超立方体：16 个顶点，任意只相差一个坐标的两点构成一条边。
const vertices4D = Array.from({ length: 16 }, (_, index) => [
  index & 1 ? 1 : -1,
  index & 2 ? 1 : -1,
  index & 4 ? 1 : -1,
  index & 8 ? 1 : -1
]);

const edges = [];
for (let i = 0; i < 16; i += 1) {
  for (let axis = 0; axis < 4; axis += 1) {
    const j = i ^ (1 << axis);
    if (i < j) edges.push([i, j]);
  }
}

function rotatePlane(point, axisA, axisB, angle) {
  const result = [...point];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  result[axisA] = point[axisA] * c - point[axisB] * s;
  result[axisB] = point[axisA] * s + point[axisB] * c;
  return result;
}

function project4D(point, distance = 3.35) {
  const scale = distance / (distance - point[3]);
  return new THREE.Vector3(point[0] * scale, point[1] * scale, point[2] * scale);
}

export function createTesseract({ color = 0xd79a52, scale = 1, opacity = 0.35 } = {}) {
  const positions = new Float32Array(edges.length * 2 * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const object = new THREE.LineSegments(geometry, material);
  object.userData.tesseract = { scale, phase: Math.random() * Math.PI * 2 };
  updateTesseract(object, 0);
  return object;
}

export function updateTesseract(object, time) {
  const { scale, phase } = object.userData.tesseract;
  const projected = vertices4D.map((vertex) => {
    let p = rotatePlane(vertex, 0, 3, time * 0.29 + phase);
    p = rotatePlane(p, 1, 3, time * 0.18 + phase * 0.37);
    p = rotatePlane(p, 0, 2, time * 0.11);
    return project4D(p).multiplyScalar(scale);
  });

  const attribute = object.geometry.attributes.position;
  edges.forEach(([a, b], index) => {
    attribute.setXYZ(index * 2, projected[a].x, projected[a].y, projected[a].z);
    attribute.setXYZ(index * 2 + 1, projected[b].x, projected[b].y, projected[b].z);
  });
  attribute.needsUpdate = true;
}
