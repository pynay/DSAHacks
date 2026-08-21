'use client';

import type { Material, Mesh as ThreeMesh } from 'three';
import { useEffect, useRef, useState } from 'react';
import {
  Check,
  CirclePause,
  CirclePlay,
  Crosshair,
  PackageCheck,
  Radar,
  Route,
  ScanLine,
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
    icon: ScanLine,
    eyebrow: '02 · Verify',
    title: 'Observe current conditions',
    body: 'A camera pass produces an aggregate visible-person count for operator review. No identity or face data is required.',
    sceneLabel: 'Reviewing field signal',
  },
  {
    icon: Radar,
    eyebrow: '03 · Update',
    title: 'Move the hotspot with evidence',
    body: 'If the observation is accepted, the local intensity surface and all six hotspot centers are recomputed.',
    sceneLabel: 'Updating hotspot surface',
  },
  {
    icon: PackageCheck,
    eyebrow: '04 · Allocate',
    title: 'Stage a safe handoff and return',
    body: 'Available food is allocated with FEFO rules. A person approves the mission, handoff, and inventory record.',
    sceneLabel: 'Allocation ready for approval',
  },
];

function easeInOut(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

export default function DroneMissionStory() {
  const mountRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const seekRef = useRef<number | null>(null);
  const [activeStage, setActiveStage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

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
              'Animated three-dimensional concept showing a drone route from a food depot to a field verification zone and back.',
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

            const packageGroup = new THREE.Group();
            const packageBox = new THREE.Mesh(
              new THREE.BoxGeometry(0.48, 0.36, 0.48),
              new THREE.MeshStandardMaterial({ color: '#f4b860', emissive: '#9b551b', emissiveIntensity: 0.35 }),
            );
            packageBox.castShadow = true;
            packageGroup.add(packageBox);
            const packageBand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.38, 0.5), droneMaterial);
            packageGroup.add(packageBand);
            packageGroup.position.set(verifiedHotspot.x, -0.9, verifiedHotspot.z);
            packageGroup.visible = false;
            scene.add(packageGroup);

            const resize = () => {
              const { width, height } = mount.getBoundingClientRect();
              if (width === 0 || height === 0) return;
              renderer.setSize(width, height, false);
              camera.aspect = width / height;
              camera.updateProjectionMatrix();
            };
            const resizeObserver = new ResizeObserver(resize);
            resizeObserver.observe(mount);
            resize();

            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (reducedMotion) {
              pausedRef.current = true;
              setIsPaused(true);
            }

            let timeline = reducedMotion ? 0.3 : 0;
            let previousTime = performance.now();
            let animationFrame = 0;
            let previousStage = -1;
            const currentPosition = new THREE.Vector3();
            const hotspotPosition = new THREE.Vector3();

            const animate = (time: number) => {
              const deltaSeconds = Math.min((time - previousTime) / 1000, 0.05);
              previousTime = time;
              if (seekRef.current !== null) {
                timeline = seekRef.current;
                seekRef.current = null;
              } else if (!pausedRef.current) {
                timeline = (timeline + deltaSeconds / 15) % 1;
              }

              const stage = Math.min(3, Math.floor(timeline * 4));
              const stageProgress = timeline * 4 - stage;
              if (stage !== previousStage) {
                previousStage = stage;
                setActiveStage(stage);
              }

              if (stage === 0) {
                route.getPoint(easeInOut(stageProgress), currentPosition);
              } else if (stage < 3 || stageProgress < 0.46) {
                currentPosition.copy(targetPoint);
              } else {
                const returnProgress = easeInOut((stageProgress - 0.46) / 0.54);
                route.getPoint(1 - returnProgress, currentPosition);
              }

              const motionTime = time / 1000;
              const hover = reducedMotion ? 0 : Math.sin(motionTime * 2.8) * 0.07;
              drone.position.copy(currentPosition);
              drone.position.y += hover;
              drone.rotation.z = reducedMotion ? 0 : Math.sin(motionTime * 1.7) * 0.035;
              if (!reducedMotion && !pausedRef.current) rotors.rotation.y += deltaSeconds * 8.5;

              const scanStrength = stage === 1
                ? Math.sin(Math.min(stageProgress * 1.7, 1) * Math.PI / 2)
                : stage === 2 && stageProgress < 0.18
                  ? 1 - stageProgress / 0.18
                  : 0;
              scanMaterial.opacity = scanStrength * 0.16;
              scanCone.scale.x = scanCone.scale.z = 0.85 + scanStrength * 0.35;

              const hotspotProgress = stage < 2 ? 0 : stage === 2 ? easeInOut(stageProgress) : 1;
              hotspotPosition.copy(oldHotspot).lerp(verifiedHotspot, hotspotProgress);
              hotspotGroup.position.copy(hotspotPosition);
              hotspotGroup.rotation.y = reducedMotion ? 0 : motionTime * 0.22;
              hotspotGroup.scale.setScalar(1 + (stage === 2 ? Math.sin(stageProgress * Math.PI) * 0.18 : 0));

              packageGroup.visible = stage === 3 && stageProgress > 0.13;
              if (packageGroup.visible) {
                packageGroup.position.y = -0.9 + (reducedMotion ? 0 : Math.sin(motionTime * 3.2) * 0.045);
                packageGroup.rotation.y = reducedMotion ? 0 : motionTime * 0.55;
              }

              if (!reducedMotion) {
                camera.position.x = 9.6 + Math.sin(motionTime * 0.12) * 0.35;
                camera.position.z = 11.5 + Math.cos(motionTime * 0.12) * 0.3;
                camera.lookAt(0, 0.25, 0);
              }

              renderer.render(scene, camera);
              animationFrame = requestAnimationFrame(animate);
            };

            animationFrame = requestAnimationFrame(animate);
            setIsReady(true);

            disposeScene = () => {
              cancelAnimationFrame(animationFrame);
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

  const chooseStage = (index: number) => {
    seekRef.current = (index + 0.08) / stages.length;
    setActiveStage(index);
  };

  const active = stages[activeStage];

  return (
    <section id="drone-concept" className="scroll-mt-8 overflow-hidden bg-[#071a2b] py-20 text-white sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#76d6a7]/35 bg-[#54b889]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-[#76d6a7]">
              <Crosshair size={14} /> 3D mission concept
            </div>
            <h2 className="mt-5 max-w-xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              See how field feedback closes the loop.
            </h2>
          </div>
          <p className="max-w-2xl text-lg leading-8 text-slate-300">
            This animation shows the intended operator workflow—from planning a verification
            route to staging a food handoff. It is an explainer, not live flight telemetry.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#0b2538] shadow-2xl shadow-black/25 lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,.55fr)]">
          <div className="relative min-h-[31rem] overflow-hidden border-b border-white/10 lg:min-h-[39rem] lg:border-b-0 lg:border-r">
            <div ref={mountRef} className="absolute inset-0" />
            {!isReady && !loadFailed && (
              <div className="absolute inset-0 grid place-items-center bg-[#071a2b] text-sm text-slate-400">
                Preparing 3D mission…
              </div>
            )}
            {loadFailed && (
              <div className="absolute inset-0 grid place-items-center bg-[#071a2b] p-8 text-center">
                <div>
                  <Radar size={34} className="mx-auto text-[#76d6a7]" />
                  <p className="mt-4 font-semibold">3D preview is unavailable in this browser.</p>
                  <p className="mt-2 text-sm text-slate-400">Use the four mission steps beside the scene to review the workflow.</p>
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 bg-gradient-to-b from-[#071a2b]/90 to-transparent p-5 sm:p-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#76d6a7]">Illustrative sequence</p>
                <p className="mt-1 text-sm font-semibold">Depot → field check → depot</p>
              </div>
              <span className="rounded-full border border-white/15 bg-[#071a2b]/75 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-300 backdrop-blur">
                No autopilot
              </span>
            </div>

            <div className="pointer-events-none absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-6">
              <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-[#071a2b]/88 p-4 shadow-xl backdrop-blur-md sm:max-w-sm">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#54b889] text-[#071a2b]">
                  <active.icon size={19} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#76d6a7]">Mission status</p>
                  <p className="mt-1 truncate text-sm font-semibold">{active.sceneLabel}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-[#0a2031] p-5 sm:p-7">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Mission loop</p>
                <p className="mt-1 text-sm text-slate-300">Select a step to inspect it</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaused((value) => !value)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-[#76d6a7]/60 hover:text-white"
                aria-label={isPaused ? 'Play mission animation' : 'Pause mission animation'}
              >
                {isPaused ? <CirclePlay size={16} /> : <CirclePause size={16} />}
                {isPaused ? 'Play' : 'Pause'}
              </button>
            </div>

            <ol className="mt-3 flex-1">
              {stages.map((stage, index) => {
                const Icon = stage.icon;
                const selected = activeStage === index;
                return (
                  <li key={stage.eyebrow}>
                    <button
                      type="button"
                      onClick={() => chooseStage(index)}
                      aria-current={selected ? 'step' : undefined}
                      className={`group grid w-full grid-cols-[2.5rem_1fr] gap-3 border-b border-white/10 py-5 text-left transition-colors ${selected ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      <span className={`grid h-9 w-9 place-items-center rounded-full border transition-colors ${selected ? 'border-[#76d6a7] bg-[#54b889] text-[#071a2b]' : 'border-white/15 text-slate-500 group-hover:border-white/30'}`}>
                        <Icon size={17} />
                      </span>
                      <span>
                        <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${selected ? 'text-[#76d6a7]' : ''}`}>{stage.eyebrow}</span>
                        <span className="mt-1 block text-base font-semibold">{stage.title}</span>
                        <span className={`mt-2 block text-xs leading-5 transition-all ${selected ? 'max-h-20 opacity-100 text-slate-400' : 'max-h-0 overflow-hidden opacity-0'}`}>
                          {stage.body}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs leading-5 text-slate-400">
              <Check size={15} className="mt-0.5 shrink-0 text-amber-300" />
              <p>Future hardware still requires site approval, aviation review, a safe handoff design, and human control.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
