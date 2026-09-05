"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useReducedMotion } from "motion/react";

/**
 * A real WebGL background (Three.js, not a CSS approximation) behind the
 * hero — the category of thing ThreeUI's own catalog specializes in (hero
 * backgrounds, shader/particle fields). ThreeUI's own component source
 * isn't retrievable (it's a client-rendered catalog with no fetchable
 * registry, unlike beUI/Vengeance UI/Magic UI's actual JSON registries), so
 * this is a from-scratch scene in the same spirit, not a literal port.
 *
 * Drifting points in the brand's own saffron/indigo palette, low enough
 * particle count to stay cheap on a marketing page. Renders nothing (a
 * static, motionless canvas) under prefers-reduced-motion, and no-ops
 * entirely if WebGL isn't available rather than throwing.
 */
export function ParticleField({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return; // no WebGL support — leave the container empty, not broken
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 12;

    const COUNT = 260;
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    // Two brand hues, split across the field — matches globals.css's own
    // --accent-saffron / --accent-indigo tokens rather than an arbitrary pick.
    const colors = new Float32Array(COUNT * 3);
    const saffron = new THREE.Color("#e8650a");
    const indigo = new THREE.Color("#3b3bdc");
    for (let i = 0; i < COUNT; i++) {
      const c = i % 3 === 0 ? indigo : saffron;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    function resize() {
      if (!container) return;
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let frameId: number;
    const start = performance.now();
    function animate(now: number) {
      const t = (now - start) / 1000;
      if (!reduceMotion) {
        points.rotation.y = t * 0.03;
        points.rotation.x = Math.sin(t * 0.1) * 0.05;
      }
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [reduceMotion]);

  return <div ref={containerRef} aria-hidden className={className} />;
}
