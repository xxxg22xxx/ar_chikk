let video = document.getElementById('video');
let canvas = document.getElementById('output');
let startBtn = document.getElementById('start-btn');

let renderer, scene, camera3D, cube, faceMesh, light;

function startApp() {
  // Hide button smoothly
  startBtn.style.transition = 'opacity 0.5s';
  startBtn.style.opacity = '0';
  setTimeout(() => startBtn.style.display = 'none', 500);

  // Setup renderer and scene
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  scene = new THREE.Scene();
  camera3D = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera3D.position.z = 2;

  // Cube with stylish material
  const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const material = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    metalness: 0.4,
    roughness: 0.2,
    emissive: 0x0088ff,
    emissiveIntensity: 0.5
  });
  cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(0, 1, 1);
  scene.add(ambientLight);
  scene.add(directionalLight);

  // FaceMesh setup
  faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  faceMesh.onResults(onResults);

  navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
    video.srcObject = stream;
    const camera = new Camera(video, {
      onFrame: async () => await faceMesh.send({ image: video }),
      width: 640,
      height: 480
    });
    camera.start();
  });
}

function onResults(results) {
  if (!results.multiFaceLandmarks[0]) return;
  const landmarks = results.multiFaceLandmarks[0];
  const forehead = landmarks[10];

  // Position cube
  cube.position.set(
    (forehead.x - 0.5) * 2,
    -(forehead.y - 0.5) * 2,
    -forehead.z
  );

  // Animate
  cube.rotation.x += 0.02;
  cube.rotation.y += 0.02;

  renderer.render(scene, camera3D);
}
