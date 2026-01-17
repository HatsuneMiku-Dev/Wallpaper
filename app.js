import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const sceneStatus = document.getElementById("scene-status");
const materialsStatus = document.getElementById("materials-status");
const shadersStatus = document.getElementById("shaders-status");
const particlesStatus = document.getElementById("particles-status");
const assetList = document.getElementById("asset-list");
const overlayDetail = document.getElementById("scene-detail");
const canvas = document.getElementById("scene-canvas");

const state = {
  materials: new Map(),
  particles: new Map(),
  shaders: new Map(),
  models: new Map(),
};

const parseVector = (value, fallback = [0, 0, 0]) => {
  if (!value) return fallback;
  if (typeof value === "string") {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .map((entry) => Number(entry));
  }
  if (typeof value === "object" && typeof value.value === "string") {
    return value.value
      .split(/\s+/)
      .filter(Boolean)
      .map((entry) => Number(entry));
  }
  return fallback;
};

const formatCount = (count) => `${count.toLocaleString()} loaded`;

const addListItem = (label, detail) => {
  const item = document.createElement("div");
  item.className = "list-item";
  item.textContent = `${label}: ${detail}`;
  assetList.appendChild(item);
};

const fetchJson = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
};

const fetchText = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.text();
};

const loadManifestAssets = async (manifest) => {
  const materialPromises = manifest.materials.map(async (path) => {
    const data = await fetchJson(path);
    state.materials.set(path, data);
    return path;
  });

  const particlePromises = manifest.particles.map(async (path) => {
    const data = await fetchJson(path);
    state.particles.set(path, data);
    return path;
  });

  const shaderPromises = manifest.shaders.map(async (path) => {
    const data = await fetchText(path);
    state.shaders.set(path, data);
    return path;
  });

  const [materials, particles, shaders] = await Promise.all([
    Promise.all(materialPromises),
    Promise.all(particlePromises),
    Promise.all(shaderPromises),
  ]);

  materialsStatus.textContent = formatCount(materials.length);
  shadersStatus.textContent = formatCount(shaders.length);
  particlesStatus.textContent = formatCount(particles.length);

  addListItem("Materials", materials.length);
  addListItem("Shaders", shaders.length);
  addListItem("Particles", particles.length);
};

const loadModel = async (path) => {
  if (state.models.has(path)) {
    return state.models.get(path);
  }
  const data = await fetchJson(path);
  state.models.set(path, data);
  return data;
};

const createRenderer = (canvasWidth, canvasHeight) => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070f);

  const camera = new THREE.OrthographicCamera(
    -canvasWidth / 2,
    canvasWidth / 2,
    canvasHeight / 2,
    -canvasHeight / 2,
    0.1,
    5000
  );
  camera.position.set(0, 0, 1000);

  const light = new THREE.AmbientLight(0xffffff, 1);
  scene.add(light);

  return { renderer, scene, camera };
};

const createPlane = (width, height, color) => {
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
  });
  return new THREE.Mesh(geometry, material);
};

const buildScene = async (sceneData) => {
  const canvasWidth = sceneData.general?.orthogonalprojection?.width ?? 3840;
  const canvasHeight = sceneData.general?.orthogonalprojection?.height ?? 2160;

  const { renderer, scene, camera } = createRenderer(canvasWidth, canvasHeight);

  const palette = [0x5fa8d3, 0x7f7fd5, 0xffd166, 0x7bd389, 0xf28482];

  for (const [index, object] of sceneData.objects.entries()) {
    if (!object.image) {
      continue;
    }

    const sizeVector = parseVector(object.size, [220, 220]);
    const originVector = parseVector(object.origin, [0, 0, 0]);

    const width = sizeVector[0] || 220;
    const height = sizeVector[1] || 220;

    const mesh = createPlane(width, height, palette[index % palette.length]);

    const x = originVector[0] - canvasWidth / 2;
    const y = canvasHeight / 2 - originVector[1];
    const z = originVector[2] || 0;

    mesh.position.set(x, y, z);
    scene.add(mesh);

    if (object.image) {
      const modelPath = `output/${object.image}`;
      loadModel(modelPath).then((model) => {
        if (model.material) {
          const materialPath = `output/${model.material}`;
          state.materials.get(materialPath);
        }
      });
    }
  }

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    renderer.setSize(clientWidth, clientHeight, false);
  };

  const animate = () => {
    resize();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  animate();
  overlayDetail.textContent = `${sceneData.objects.length} scene objects rendered`;
};

const init = async () => {
  sceneStatus.textContent = "Loading…";
  materialsStatus.textContent = "Loading…";
  shadersStatus.textContent = "Loading…";
  particlesStatus.textContent = "Loading…";

  const manifest = await fetchJson("./asset-manifest.json");
  await loadManifestAssets(manifest);

  const sceneData = await fetchJson("./output/scene.json");
  sceneStatus.textContent = "Loaded";
  addListItem("Scene objects", sceneData.objects.length);
  await buildScene(sceneData);
};

init().catch((error) => {
  overlayDetail.textContent = "Failed to load scene.";
  sceneStatus.textContent = "Error";
  materialsStatus.textContent = "Error";
  shadersStatus.textContent = "Error";
  particlesStatus.textContent = "Error";
  const errorItem = document.createElement("div");
  errorItem.className = "list-item";
  errorItem.textContent = error.message;
  assetList.appendChild(errorItem);
});
