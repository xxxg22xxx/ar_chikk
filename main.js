let video = document.getElementById('video');
let canvas = document.getElementById('output');

let renderer, scene, camera3D, cube, faceMesh;

function startApp() {
  document.getElementById('start-btn').style.display = 'none';

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  scene = new THREE.Scene();
  camera3D = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera3D.position.z = 2;

  const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const material = new THREE.MeshNormalMaterial();
  cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

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

  cube.position.set(
    (forehead.x - 0.5) * 2,
    -(forehead.y - 0.5) * 2,
    -forehead.z
  );

  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;

  renderer.render(scene, camera3D);
}
