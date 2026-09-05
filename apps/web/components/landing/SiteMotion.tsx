"use client";

import { useEffect } from "react";
import Lenis from "lenis";

export default function SiteMotion() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.documentElement.classList.add("js");

    // ── Sticky nav scroll state ─────────────────────────────────────────────
    const navEl = document.querySelector("[data-nav]");
    const onNavScroll = () => {
      navEl?.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onNavScroll();
    window.addEventListener("scroll", onNavScroll, { passive: true });

    // ── Lenis smooth scroll ────────────────────────────────────────────────
    let lenis: Lenis | undefined;
    let rafId: number | undefined;

    if (!prefersReducedMotion) {
      lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });

      const raf = (time: number) => {
        lenis!.raf(time);
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);
    }

    // ── Anchor smooth scroll ───────────────────────────────────────────────
    const anchorHandlers: Array<() => void> = [];
    document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
      const onClick = (event: MouseEvent) => {
        const targetId = link.getAttribute("href");
        if (!targetId || targetId === "#") return;
        const target = document.querySelector(targetId);
        if (!target) return;
        event.preventDefault();
        if (lenis) {
          lenis.scrollTo(target as HTMLElement, { offset: 0 });
        } else {
          target.scrollIntoView({ behavior: "auto", block: "start" });
        }
      };
      link.addEventListener("click", onClick);
      anchorHandlers.push(() => link.removeEventListener("click", onClick));
    });

    // ── Reveal on scroll ──────────────────────────────────────────────────
    const revealItems = document.querySelectorAll<HTMLElement>(".reveal");

    if (!prefersReducedMotion && "IntersectionObserver" in window) {
      const revealObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const target = entry.target as HTMLElement;
            const delay = Number(target.dataset.delay || 0);
            window.setTimeout(() => target.classList.add("is-visible"), delay);
            observer.unobserve(target);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
      );

      revealItems.forEach((item, index) => {
        item.style.setProperty("--reveal-index", String(index % 6));
        revealObserver.observe(item);
      });

      const steps = document.querySelectorAll(".step");
      const nodes = document.querySelectorAll(".loop-node");
      let interval: number | undefined;

      if (steps.length && nodes.length) {
        let activeStep = 0;
        const setActiveStep = () => {
          steps.forEach((step, index) => step.classList.toggle("is-active", index === activeStep));
          nodes.forEach((node, index) => node.classList.toggle("is-active", index === activeStep));
          activeStep = (activeStep + 1) % steps.length;
        };

        const loopObserver = new IntersectionObserver(
          (entries) => {
            const visible = entries.some((entry) => entry.isIntersecting);
            if (!visible) return;
            setActiveStep();
            interval = window.setInterval(setActiveStep, 2000);
            loopObserver.disconnect();
          },
          { threshold: 0.3 }
        );

        const loopSection = document.querySelector("#loop");
        if (loopSection) loopObserver.observe(loopSection);
      }

      return () => {
        window.removeEventListener("scroll", onNavScroll);
        if (rafId) cancelAnimationFrame(rafId);
        lenis?.destroy();
        anchorHandlers.forEach((cleanup) => cleanup());
        revealObserver.disconnect();
        if (interval) window.clearInterval(interval);
      };
    }

    revealItems.forEach((item) => item.classList.add("is-visible"));

    return () => {
      window.removeEventListener("scroll", onNavScroll);
      if (rafId) cancelAnimationFrame(rafId);
      lenis?.destroy();
      anchorHandlers.forEach((cleanup) => cleanup());
    };
  }, []);

  return null;
}
