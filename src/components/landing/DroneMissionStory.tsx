'use client';

import type { Material, Mesh as ThreeMesh } from 'three';
import { useEffect, useRef, useState } from 'react';
import {
  BrainCircuit,
  Camera as CameraIcon,
  Check,
  Crosshair,
  Radar,
  Route,
} from 'lucide-react';

const stages = [
  {
    icon: Route,
    eyebrow: '01 · Plan',
    title: 'Route to a priority zone',
    body: 'The historical hotspot surface suggests where a field check may be useful. It does not authorize a delivery.',
    sceneLabel: 'Planning route',
  },
  {
    icon: CameraIcon,
    eyebrow: '02 · Capture',
    title: 'Take a downward area picture',
    body: 'At the delivery zone, the drone holds position and points its camera down. One area frame produces an aggregate visible-person count for operator review.',
    sceneLabel: 'Camera down · capturing area frame',
  },
  {
    icon: Radar,
    eyebrow: '03 · Update',
    title: 'Move the hotspot with evidence',
    body: 'If the observation is accepted, the local intensity surface and all six hotspot centers are recomputed.',
    sceneLabel: 'Updating hotspot surface',
  },
  {
    icon: BrainCircuit,
    eyebrow: '04 · Optimize',
    title: 'Improve the response plan and return',
    body: 'The reviewed signal helps rank locations and recommend food allocation. Distribution remains a separate, human-controlled operation.',
    sceneLabel: 'Sending evidence to the planner',
  },
];

function easeInOut(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

export default function DroneMissionStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const renderSceneRef = useRef<(() => void) | null>(null);
  const [activeStage, setActiveStage] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let frame = 0;

    const updateFromScroll = () => {
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const scrollDistance = Math.max(section.offsetHeight - window.innerHeight, 1);
      const nextProgress = Math.min(1, Math.max(0, -rect.top / scrollDistance));
      const nextStage = Math.min(stages.length - 1, Math.floor(nextProgress * stages.length));

      progressRef.current = nextProgress;
      setScrollProgress(nextProgress);
      setActiveStage((current) => current === nextStage ? current : nextStage);
      renderSceneRef.current?.();
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateFromScroll);
    };

    updateFromScroll();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposeScene: (() => void) | undefined;
    let cancelled = false;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();

        void (async () => {
          try {
            const THREE = await import('three');
            if (cancelled) return;

            const scene = new THREE.Scene();
            scene.background = new THREE.Color('#071a2b');
            scene.fog = new THREE.Fog('#071a2b', 13, 27);

            const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
            camera.position.set(9.6, 7.5, 11.5);
            camera.lookAt(0, 0.25, 0);

            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.1;
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFShadowMap;
            renderer.domElement.setAttribute('role', 'img');
            renderer.domElement.setAttribute(
              'aria-label',
              'Animated three-dimensional concept showing a drone sensing route from an operations base to a field verification zone and back.',
            );
            renderer.domElement.className = 'block h-full w-full';
            mount.appendChild(renderer.domElement);

            scene.add(new THREE.HemisphereLight('#b8e9ff', '#06121d', 2.2));
            const keyLight = new THREE.DirectionalLight('#ffffff', 3.4);
            keyLight.position.set(5, 10, 7);
            keyLight.castShadow = true;
            scene.add(keyLight);

            const greenLight = new THREE.PointLight('#54b889', 18, 10, 2);
            greenLight.position.set(-4.3, 2, 2.5);
            scene.add(greenLight);

            const ground = new THREE.Mesh(
              new THREE.PlaneGeometry(22, 16),
              new THREE.MeshStandardMaterial({ color: '#0b2538', roughness: 0.94, metalness: 0.05 }),
            );
            ground.rotation.x = -Math.PI / 2;
            ground.position.y = -1.2;
            ground.receiveShadow = true;
            scene.add(ground);

            const grid = new THREE.GridHelper(22, 22, '#37627a', '#17384c');
            grid.position.y = -1.17;
            grid.material.opacity = 0.42;
            grid.material.transparent = true;
            scene.add(grid);

            const buildings = [
              [-6.7, -4.5, 1.5, 1.8], [-4.8, -4.2, 1.2, 2.7], [-2.5, -4.6, 1.7, 1.4],
              [0.2, -4.4, 1.5, 3.2], [2.6, -4.7, 1.2, 1.8], [5.1, -4.3, 1.8, 2.3],
              [-6.7, -1.8, 1.3, 2.2], [-2.1, -1.5, 1.5, 2.8], [0.5, -1.7, 1.15, 1.4],
              [6.4, -1.4, 1.4, 2.9], [-6.3, 1.2, 1.7, 2.5], [-2.4, 1.7, 1.2, 1.6],
              [0.4, 1.6, 1.65, 2.4], [6.2, 1.6, 1.4, 1.8], [-6.1, 4.1, 1.4, 1.7],
              [-2.7, 4.2, 1.8, 2.4], [0.3, 4.4, 1.2, 1.9], [2.8, 4.1, 1.6, 2.8], [5.5, 4.4, 1.25, 1.6],
            ] as const;

            const buildingMaterial = new THREE.MeshStandardMaterial({
              color: '#173a50',
              roughness: 0.72,
              metalness: 0.12,
            });
            buildings.forEach(([x, z, width, height], index) => {
              const building = new THREE.Mesh(
                new THREE.BoxGeometry(width, height, width * (index % 3 === 0 ? 0.72 : 0.9)),
                buildingMaterial,
              );
              building.position.set(x, height / 2 - 1.18, z);
              building.castShadow = true;
              building.receiveShadow = true;
              scene.add(building);
            });

            const depot = new THREE.Group();
            const depotBody = new THREE.Mesh(
              new THREE.BoxGeometry(2.25, 1.05, 1.7),
              new THREE.MeshStandardMaterial({ color: '#245b49', roughness: 0.75 }),
            );
            depotBody.position.y = -0.65;
            depotBody.castShadow = true;
            depot.add(depotBody);
            const depotRoof = new THREE.Mesh(
              new THREE.BoxGeometry(2.5, 0.13, 1.95),
              new THREE.MeshStandardMaterial({ color: '#76d6a7', emissive: '#1c6848', emissiveIntensity: 0.6 }),
            );
            depotRoof.position.y = -0.07;
            depot.add(depotRoof);
            const depotMark = new THREE.Mesh(
              new THREE.BoxGeometry(0.42, 0.42, 0.05),
              new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#54b889', emissiveIntensity: 0.35 }),
            );
            depotMark.position.set(0, -0.56, 0.88);
            depot.add(depotMark);
            depot.position.set(-4.8, 0, 2.6);
            scene.add(depot);

            const oldHotspot = new THREE.Vector3(2.55, -1.09, -0.75);
            const verifiedHotspot = new THREE.Vector3(4.2, -1.09, -2.05);
            const hotspotGroup = new THREE.Group();
            const hotspotMaterials = ['#f4b860', '#54b889', '#76d6a7'].map(
              (color, index) => new THREE.MeshStandardMaterial({
                color,
                emissive: color,
                emissiveIntensity: 0.85 - index * 0.12,
                transparent: true,
                opacity: 0.72 - index * 0.13,
              }),
            );
            [0.56, 0.91, 1.27].forEach((radius, index) => {
              const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.035, 10, 64), hotspotMaterials[index]);
              ring.rotation.x = Math.PI / 2;
              hotspotGroup.add(ring);
            });
            hotspotGroup.position.copy(oldHotspot);
            scene.add(hotspotGroup);

            const aggregatePins = new THREE.Group();
            [[-0.38, -0.18], [0.05, 0.12], [0.48, -0.06], [-0.08, -0.48], [0.42, -0.5]].forEach(
              ([x, z], index) => {
                const pin = new THREE.Mesh(
                  new THREE.CapsuleGeometry(0.075, 0.18, 4, 8),
                  new THREE.MeshStandardMaterial({
                    color: index % 2 ? '#d7e2e7' : '#ffffff',
                    emissive: '#9fc4d2',
                    emissiveIntensity: 0.2,
                  }),
                );
                pin.position.set(x, -0.83, z);
                aggregatePins.add(pin);
              },
            );
            aggregatePins.position.set(verifiedHotspot.x, 0, verifiedHotspot.z);
            scene.add(aggregatePins);

            const depotPoint = new THREE.Vector3(-4.8, 0.35, 2.6);
            const targetPoint = new THREE.Vector3(verifiedHotspot.x, 1.05, verifiedHotspot.z);
            const route = new THREE.CatmullRomCurve3([
              depotPoint,
              new THREE.Vector3(-3.2, 3.0, 2.1),
              new THREE.Vector3(-0.3, 4.1, 0.6),
              new THREE.Vector3(2.4, 3.0, -1.25),
              targetPoint,
            ]);
            const routeGeometry = new THREE.BufferGeometry().setFromPoints(route.getPoints(90));
            const routeLine = new THREE.Line(
              routeGeometry,
              new THREE.LineDashedMaterial({ color: '#76d6a7', dashSize: 0.28, gapSize: 0.18, opacity: 0.7, transparent: true }),
            );
            routeLine.computeLineDistances();
            scene.add(routeLine);

            const drone = new THREE.Group();
            const droneMaterial = new THREE.MeshStandardMaterial({ color: '#effbff', roughness: 0.3, metalness: 0.7 });
            const droneAccent = new THREE.MeshStandardMaterial({ color: '#54b889', emissive: '#54b889', emissiveIntensity: 1.2 });
            const droneBody = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 12), droneMaterial);
            droneBody.scale.set(1.45, 0.55, 0.9);
            droneBody.castShadow = true;
            drone.add(droneBody);
            const cameraEye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), droneAccent);
            cameraEye.position.set(0.37, -0.14, 0);
            drone.add(cameraEye);

            const downwardCamera = new THREE.Group();
            const gimbalBody = new THREE.Mesh(
              new THREE.BoxGeometry(0.3, 0.2, 0.28),
              new THREE.MeshStandardMaterial({ color: '#dbe8ec', roughness: 0.28, metalness: 0.7 }),
            );
            const downwardLens = new THREE.Mesh(
              new THREE.CylinderGeometry(0.08, 0.11, 0.13, 18),
              new THREE.MeshStandardMaterial({ color: '#071a2b', emissive: '#54b889', emissiveIntensity: 0.55, metalness: 0.8 }),
            );
            downwardLens.position.y = -0.15;
            downwardCamera.add(gimbalBody, downwardLens);
            downwardCamera.position.set(0, -0.3, 0);
            drone.add(downwardCamera);

            const armGeometry = new THREE.BoxGeometry(1.72, 0.07, 0.09);
            [Math.PI / 4, -Math.PI / 4].forEach((rotation) => {
              const arm = new THREE.Mesh(armGeometry, droneMaterial);
              arm.rotation.y = rotation;
              drone.add(arm);
            });

            const rotors = new THREE.Group();
            [[-0.62, -0.62], [-0.62, 0.62], [0.62, -0.62], [0.62, 0.62]].forEach(([x, z]) => {
              const rotor = new THREE.Mesh(
                new THREE.TorusGeometry(0.28, 0.025, 8, 32),
                new THREE.MeshStandardMaterial({ color: '#9adfc0', emissive: '#54b889', emissiveIntensity: 0.7 }),
              );
              rotor.rotation.x = Math.PI / 2;
              rotor.position.set(x, 0.03, z);
              rotors.add(rotor);
              const blade = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.018, 0.055), droneMaterial);
              blade.position.set(x, 0.04, z);
              rotors.add(blade);
            });
            drone.add(rotors);
            drone.position.copy(depotPoint);
            drone.scale.setScalar(0.82);
            scene.add(drone);

            const scanMaterial = new THREE.MeshBasicMaterial({
              color: '#76d6a7',
              transparent: true,
              opacity: 0,
              depthWrite: false,
              side: THREE.DoubleSide,
            });
            const scanCone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.15, 36, 1, true), scanMaterial);
            scanCone.rotation.z = Math.PI;
            scanCone.position.y = -1.1;
            drone.add(scanCone);

            const photoReticleMaterial = new THREE.MeshBasicMaterial({
              color: '#f7fff9',
              transparent: true,
              opacity: 0,
              depthWrite: false,
              side: THREE.DoubleSide,
            });
            const photoReticle = new THREE.Mesh(
              new THREE.RingGeometry(0.5, 0.56, 40),
              photoReticleMaterial,
            );
            photoReticle.rotation.x = -Math.PI / 2;
            photoReticle.position.set(verifiedHotspot.x, -1.05, verifiedHotspot.z);
            scene.add(photoReticle);

            const photoFlashMaterial = new THREE.MeshBasicMaterial({
              color: '#ffffff',
              transparent: true,
              opacity: 0,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
              side: THREE.DoubleSide,
            });
            const photoFlash = new THREE.Mesh(new THREE.CircleGeometry(0.78, 40), photoFlashMaterial);
            photoFlash.rotation.x = -Math.PI / 2;
            photoFlash.position.set(verifiedHotspot.x, -1.04, verifiedHotspot.z);
            scene.add(photoFlash);

            const dataPacketGroup = new THREE.Group();
            const dataCore = new THREE.Mesh(
              new THREE.OctahedronGeometry(0.24),
              new THREE.MeshStandardMaterial({
                color: '#76d6a7',
                emissive: '#54b889',
                emissiveIntensity: 1.6,
                roughness: 0.25,
                metalness: 0.45,
              }),
            );
            dataPacketGroup.add(dataCore);
            [0, Math.PI / 2].forEach((rotation) => {
              const orbit = new THREE.Mesh(
                new THREE.TorusGeometry(0.39, 0.018, 8, 40),
                new THREE.MeshBasicMaterial({ color: '#b8f3d2', transparent: true, opacity: 0.72 }),
              );
              orbit.rotation.x = rotation;
              dataPacketGroup.add(orbit);
            });
            dataPacketGroup.position.copy(targetPoint);
            dataPacketGroup.visible = false;
            scene.add(dataPacketGroup);

            const resize = () => {
              const { width, height } = mount.getBoundingClientRect();
              if (width === 0 || height === 0) return;
              renderer.setSize(width, height, false);
              camera.aspect = width / height;
              camera.updateProjectionMatrix();
              renderSceneRef.current?.();
            };
            const resizeObserver = new ResizeObserver(resize);
            resizeObserver.observe(mount);

            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const currentPosition = new THREE.Vector3();
            const hotspotPosition = new THREE.Vector3();
            const dataPacketPosition = new THREE.Vector3();

            const renderScene = () => {
              const rawTimeline = progressRef.current;
              const timeline = reducedMotion
                ? (Math.min(3, Math.floor(rawTimeline * 4)) + 0.08) / 4
                : rawTimeline;
              const stage = Math.min(3, Math.floor(timeline * 4));
              const stageProgress = timeline * 4 - stage;

              if (stage === 0) {
                route.getPoint(easeInOut(stageProgress), currentPosition);
              } else if (stage < 3 || stageProgress < 0.46) {
                currentPosition.copy(targetPoint);
              } else {
                const returnProgress = easeInOut((stageProgress - 0.46) / 0.54);
                route.getPoint(1 - returnProgress, currentPosition);
              }

              drone.position.copy(currentPosition);
              drone.rotation.set(0, 0, 0);
              rotors.rotation.set(0, 0, 0);

              const scanStrength = stage === 1
                ? Math.sin(Math.min(stageProgress * 1.7, 1) * Math.PI / 2)
                : stage === 2 && stageProgress < 0.18
                  ? 1 - stageProgress / 0.18
                  : 0;
              scanMaterial.opacity = scanStrength * 0.16;
              scanCone.scale.x = scanCone.scale.z = 0.85 + scanStrength * 0.35;

              const photoPulse = stage === 1 && stageProgress >= 0.16 && stageProgress <= 0.42
                ? Math.sin(((stageProgress - 0.16) / 0.26) * Math.PI)
                : 0;
              photoReticleMaterial.opacity = stage === 1 ? 0.3 + Math.sin(stageProgress * Math.PI) * 0.55 : 0;
              photoReticle.rotation.z = reducedMotion ? 0 : timeline * Math.PI * 1.7;
              photoReticle.scale.setScalar(stage === 1 ? 1.45 - Math.min(stageProgress * 1.8, 0.45) : 1);
              photoFlashMaterial.opacity = photoPulse * 0.78;
              photoFlash.scale.setScalar(0.75 + photoPulse * 1.5);
              downwardCamera.position.y = -0.3 - (stage === 1 ? Math.sin(Math.min(stageProgress * 2, 1) * Math.PI / 2) * 0.11 : 0);
              downwardLens.rotation.y = reducedMotion ? 0 : timeline * Math.PI * 3;

              const hotspotProgress = stage < 2 ? 0 : stage === 2 ? easeInOut(stageProgress) : 1;
              hotspotPosition.copy(oldHotspot).lerp(verifiedHotspot, hotspotProgress);
              hotspotGroup.position.copy(hotspotPosition);
              hotspotGroup.rotation.y = reducedMotion ? 0 : timeline * 1.25;
              hotspotGroup.scale.setScalar(1 + (stage === 2 ? Math.sin(stageProgress * Math.PI) * 0.18 : 0));

              dataPacketGroup.visible = stage === 3;
              if (dataPacketGroup.visible) {
                const relayProgress = easeInOut(Math.min(stageProgress / 0.42, 1));
                route.getPoint(1 - relayProgress, dataPacketPosition);
                dataPacketGroup.position.copy(dataPacketPosition);
                dataPacketGroup.rotation.y = reducedMotion ? 0 : stageProgress * Math.PI * 2;
                dataPacketGroup.scale.setScalar(0.8 + Math.sin(Math.min(stageProgress * 5, 1) * Math.PI / 2) * 0.25);
              }

              if (!reducedMotion) {
                camera.position.x = 9.6 + Math.sin(timeline * Math.PI) * 0.35;
                camera.position.z = 11.5 + Math.cos(timeline * Math.PI) * 0.3;
                camera.lookAt(0, 0.25, 0);
              }

              renderer.render(scene, camera);
            };

            renderSceneRef.current = renderScene;
            resize();
            renderScene();
            setIsReady(true);

            disposeScene = () => {
              renderSceneRef.current = null;
              resizeObserver.disconnect();
              scene.traverse((object) => {
                const mesh = object as ThreeMesh;
                mesh.geometry?.dispose();
                if (Array.isArray(mesh.material)) {
                  mesh.material.forEach((material: Material) => material.dispose());
                } else {
                  mesh.material?.dispose();
                }
              });
              renderer.dispose();
              renderer.domElement.remove();
            };
          } catch {
            if (!cancelled) setLoadFailed(true);
          }
        })();
      },
      { rootMargin: '280px 0px' },
    );

    observer.observe(mount);
    return () => {
      cancelled = true;
      observer.disconnect();
      disposeScene?.();
    };
  }, []);

  const active = stages[activeStage];
  const ActiveIcon = active.icon;
  const activeStageProgress = scrollProgress * stages.length - activeStage;
  const photoUiPulse = activeStage === 1 && activeStageProgress >= 0.16 && activeStageProgress <= 0.42
    ? Math.sin(((activeStageProgress - 0.16) / 0.26) * Math.PI)
    : 0;

  return (
    <section
      ref={sectionRef}
      id="drone-concept"
      aria-label="Scroll-controlled drone sensing mission"
      tabIndex={-1}
      className="relative h-[420svh] scroll-mt-8 bg-[#071a2b] text-white"
    >
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-5 sm:gap-8 sm:px-8 sm:py-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-12">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#76d6a7]/35 bg-[#54b889]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-[#76d6a7]">
              <Crosshair size={14} /> Scroll-controlled mission
            </div>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-[1.02] tracking-[-0.04em] sm:mt-5 sm:text-4xl lg:text-5xl">
              The drone observes. The model adapts.
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-400 sm:mt-4 sm:text-base sm:leading-7">
              Scroll to move through the sensing loop. The scene advances only with your position on the page.
            </p>

            <div className="mt-5 border-l-2 border-[#54b889] pl-4 sm:mt-8 sm:pl-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#76d6a7]">
                <ActiveIcon size={15} /> {active.eyebrow}
              </div>
              <h3 className="mt-2 text-xl font-semibold sm:text-2xl">{active.title}</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{active.body}</p>
            </div>

            <div className="mt-5 sm:mt-8" aria-label={`${Math.round(scrollProgress * 100)} percent through the mission story`}>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                <span>Scroll progress</span>
                <span className="tabular-nums">{String(Math.round(scrollProgress * 100)).padStart(2, '0')}%</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full bg-[#54b889]" style={{ width: `${scrollProgress * 100}%` }} />
              </div>
              <ol className="mt-3 grid grid-cols-4 gap-2" aria-label="Mission stages">
                {stages.map((stage, index) => (
                  <li key={stage.eyebrow} className={`text-[10px] font-bold uppercase tracking-[0.1em] ${index === activeStage ? 'text-[#76d6a7]' : 'text-slate-600'}`}>
                    {String(index + 1).padStart(2, '0')}
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-5 hidden items-start gap-2.5 text-xs leading-5 text-slate-500 sm:flex lg:mt-8">
              <Check size={15} className="mt-0.5 shrink-0 text-amber-300" />
              <p>Sensing concept only. Human review remains required before the model changes an operational plan.</p>
            </div>
          </div>

          <div className="relative h-[44vh] min-h-[19rem] overflow-hidden rounded-[1.35rem] border border-white/15 bg-[#0b2538] shadow-2xl shadow-black/25 sm:h-[52vh] sm:min-h-[22rem] lg:h-[72vh] lg:max-h-[44rem]">
            <div ref={mountRef} className="absolute inset-0" />
            {!isReady && !loadFailed && (
              <div className="absolute inset-0 grid place-items-center bg-[#071a2b] text-sm text-slate-400">
                Preparing 3D mission...
              </div>
            )}
            {loadFailed && (
              <div className="absolute inset-0 grid place-items-center bg-[#071a2b] p-8 text-center">
                <div>
                  <Radar size={34} className="mx-auto text-[#76d6a7]" />
                  <p className="mt-4 font-semibold">3D preview is unavailable in this browser.</p>
                  <p className="mt-2 text-sm text-slate-400">The text beside the scene still explains each stage.</p>
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 bg-gradient-to-b from-[#071a2b]/90 to-transparent p-5 sm:p-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#76d6a7]">Illustrative sequence</p>
                <p className="mt-1 text-sm font-semibold">Operations base → sensing pass → model update</p>
              </div>
              <span className="rounded-full border border-white/15 bg-[#071a2b]/75 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-300 backdrop-blur">
                No autopilot
              </span>
            </div>

            {activeStage === 1 && (
              <div className="pointer-events-none absolute right-5 top-24 flex items-center gap-3 rounded-xl border border-white/15 bg-[#071a2b]/82 px-3 py-2.5 shadow-xl backdrop-blur-md sm:right-6">
                <span className="relative grid h-9 w-9 place-items-center rounded-full bg-[#54b889] text-[#071a2b]">
                  <CameraIcon size={17} />
                  <span className="absolute inset-0 animate-ping rounded-full border border-[#76d6a7]/70" />
                </span>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#76d6a7]">Downward camera</p>
                  <p className="mt-0.5 text-xs font-semibold">Area picture captured</p>
                </div>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-white" style={{ opacity: photoUiPulse * 0.34 }} aria-hidden="true" />

            <div className="pointer-events-none absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-6">
              <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-[#071a2b]/88 p-4 shadow-xl backdrop-blur-md sm:max-w-sm">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#54b889] text-[#071a2b]">
                  <ActiveIcon size={19} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#76d6a7]">Mission status</p>
                  <p className="mt-1 truncate text-sm font-semibold">{active.sceneLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
