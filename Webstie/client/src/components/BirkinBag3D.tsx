import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { setupBirkinScene } from '../three/birkinScene';
import { createBirkinModel } from '../three/createBirkinModel';

interface BirkinBag3DProps {
  className?: string;
  /** Slow turntable rotation; disabled automatically for prefers-reduced-motion. */
  autoRotate?: boolean;
  /** Starting view angle around the bag, in degrees (0 = straight front). */
  initialAzimuth?: number;
}

/** Interactive Birkin 25 on a transparent canvas; fills its parent element. */
export function BirkinBag3D({ className, autoRotate = true, initialAzimuth = 28 }: BirkinBag3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    // Leather maps are generated in a worker; the canvas fades in once the model is ready.
    createBirkinModel({ maxAnisotropy: 16 }).then((model) => {
      if (disposed) {
        model.dispose();
        return;
      }
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.touchAction = 'pan-y';
      host.appendChild(renderer.domElement);
      const view = setupBirkinScene(renderer, model, { azimuth: initialAzimuth });      const controls = new OrbitControls(view.camera, renderer.domElement);
      controls.target.copy(view.target);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.rotateSpeed = 0.6;
      controls.minPolarAngle = Math.PI / 2 - 0.55;
      controls.maxPolarAngle = Math.PI / 2 + 0.05;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      controls.autoRotate = autoRotate && !reduceMotion;
      controls.autoRotateSpeed = 1.1;

      const resize = () => {
        const w = Math.max(1, host.clientWidth);
        const h = Math.max(1, host.clientHeight);
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        view.frame(w, h);
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      let visible = true;
      const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
      });
      io.observe(host);
      // The charms swing from how fast the view turns (the camera orbits, so the bag's spin is -Δazimuth).
      const clock = new THREE.Clock();
      let lastAzimuth = controls.getAzimuthalAngle();
      renderer.setAnimationLoop(() => {
        const dt = Math.min(clock.getDelta(), 1 / 30);
        if (!visible || document.hidden) return;
        controls.update();
        const azimuth = controls.getAzimuthalAngle();
        const turned = Math.atan2(Math.sin(azimuth - lastAzimuth), Math.cos(azimuth - lastAzimuth));
        lastAzimuth = azimuth;
        if (!reduceMotion) model.animate(dt, dt > 0 ? -turned / dt : 0);
        renderer.render(view.scene, view.camera);
      });
      setReady(true);

      cleanup = () => {
        renderer.setAnimationLoop(null);
        ro.disconnect();
        io.disconnect();
        controls.dispose();
        view.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [autoRotate, initialAzimuth]);

  return (
    <div
      ref={hostRef}
      className={className}
      role="img"
      aria-label="Mô hình 3D túi Hermès Birkin 25 da cá sấu thật (alligator mờ), màu xanh Bleu Paon, khóa vàng"
      style={{ width: '100%', height: '100%', opacity: ready ? 1 : 0, transition: 'opacity .6s ease' }}
    />
  );
}
