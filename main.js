// main.js
let video = document.getElementById('video');
let canvas = document.getElementById('output');
let startBtn = document.getElementById('start-btn');

let renderer, scene, camera3D, faceMesh, analyser, dataArray;
const coreCubes = [];
const shellCubes = [];

let time = 0;

function startApp() {
  startBtn.style.transition = 'opacity 0.5s';
  startBtn.style.opacity = '0';
  setTimeout(() => startBtn.style.display = 'none', 500);

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  scene = new THREE.Scene();

  camera3D = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera3D.position.z = 2;

  scene.add(new THREE.AmbientLight(0x88ccff, 0.7));
  const dirLight = new THREE.DirectionalLight(0x88ccff, 1);
  dirLight.position.set(0, 1, 1);
  scene.add(dirLight);

  navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then((stream) => {
    video.srcObject = stream;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);

    faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 3,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    faceMesh.onResults(onResults);

    const cam = new Camera(video, {
      onFrame: async () => {
        await faceMesh.send({ image: video });
        time += 0.02;
      },
      width: 640,
      height: 480
    });
    cam.start();
  });
}

function getAudioData() {
  if (!analyser) return { volume: 0, treble: 0 };
  analyser.getByteFrequencyData(dataArray);
  const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
  const high = dataArray.slice(-10).reduce((a, b) => a + b, 0) / 10;
  return { volume: avg / 255, treble: high / 255 };
}

function hsvToRgb(h, s, v) {
  let f = (n, k = (n + h / 60) % 6) =>
    v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  return new THREE.Color(f(5), f(3), f(1));
}

function getRandomGeometry() {
  const r = Math.floor(Math.random() * 6);
  switch (r) {
    case 0: return new THREE.SphereGeometry(0.5, 16, 16);
    case 1: return new THREE.ConeGeometry(0.5, 1, 4);
    case 2: return new THREE.CylinderGeometry(0.3, 0.3, 0.7, 12);
    case 3: return new THREE.TorusGeometry(0.3, 0.1, 8, 16);
    case 4: return new THREE.IcosahedronGeometry(0.5, 0);
    default: return new THREE.BoxGeometry(0.5, 0.5, 0.5);
  }
}

function onResults(results) {
  const faces = results.multiFaceLandmarks;
  if (!faces || faces.length === 0) {
    while (coreCubes.length > 0) {
      scene.remove(coreCubes.pop());
      scene.remove(shellCubes.pop());
    }
    renderer.render(scene, camera3D);
    return;
  }

  const { volume, treble } = getAudioData();
  const jitterAmount = Math.min(volume * 0.1, 0.12);
  const baseColor = hsvToRgb(200 + volume * 40, 0.8, 1);

  while (coreCubes.length < faces.length) {
    const geometry = getRandomGeometry();
    const coreMat = new THREE.MeshStandardMaterial({
      color: baseColor,
      emissive: baseColor,
      metalness: 0.4,
      roughness: 0.2,
      emissiveIntensity: 0.6
    });
    const core = new THREE.Mesh(geometry, coreMat);
    scene.add(core);
    coreCubes.push(core);

    const shellMat = new THREE.MeshStandardMaterial({
      color: baseColor.clone().multiplyScalar(1.5),
      emissive: baseColor,
      opacity: 0.12,
      transparent: true,
      metalness: 0.8,
      roughness: 0.1,
      emissiveIntensity: 0.4
    });
    const shell = new THREE.Mesh(geometry.clone(), shellMat);
    scene.add(shell);
    shellCubes.push(shell);
  }

  for (let i = 0; i < faces.length; i++) {
    const lm = faces[i];
    const core = coreCubes[i];
    const shell = shellCubes[i];

    const toVec = (pt) => new THREE.Vector3(pt.x - 0.5, -(pt.y - 0.5), -pt.z);
    const left = toVec(lm[33]);
    const right = toVec(lm[263]);
    const top = toVec(lm[10]);
    const bottom = toVec(lm[152]);
    const center = toVec(lm[168]);

    const width = left.distanceTo(right);
    center.x += (Math.random() - 0.5) * jitterAmount;
    center.y += (Math.random() - 0.5) * jitterAmount;
    center.z += (Math.random() - 0.5) * jitterAmount;

    core.position.copy(center);
    shell.position.copy(center);

    const breath = Math.sin(time * 2 + i) * 0.03;
    const scaleY = width * 6 * (1 + volume * 3.5 + breath);
    const scaleXZ = width * 5 * (1 + volume * 2.5 + breath);
    core.scale.set(scaleXZ, scaleY, scaleXZ);
    shell.scale.set(scaleXZ * 1.3, scaleY * 1.3, scaleXZ * 1.3);

    const flicker = Math.max(-0.5, Math.min(Math.sin(time * 30 + i * 1.2) * (treble + volume) * 0.8, 0.5));
    core.rotation.y += flicker;
    shell.rotation.x += flicker;

    core.material.emissive = baseColor;
    shell.material.emissive = baseColor;
    core.material.emissiveIntensity = 0.6 + Math.pow(volume, 2.2) * 5;
    shell.material.emissiveIntensity = 0.2 + Math.pow(volume, 2.5) * 3;

    const xAxis = new THREE.Vector3().subVectors(right, left).normalize();
    const yAxis = new THREE.Vector3().subVectors(top, bottom).normalize();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    yAxis.crossVectors(zAxis, xAxis).normalize();
    const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix);
    core.quaternion.copy(quaternion);
    shell.quaternion.copy(quaternion);

    if (volume > 0.3 && Math.random() < volume * 0.4) {
      const newGeo = getRandomGeometry();
      core.geometry.dispose();
      core.geometry = newGeo;
      shell.geometry.dispose();
      shell.geometry = newGeo.clone();
    }
  }

  while (coreCubes.length > faces.length) {
    scene.remove(coreCubes.pop());
    scene.remove(shellCubes.pop());
  }

  renderer.render(scene, camera3D);
}
