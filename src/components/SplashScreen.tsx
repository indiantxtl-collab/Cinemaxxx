/* eslint-disable @next/next/no-img-element -- small local brand PNGs; next/image would add nothing here */
"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import useReducedMotion from "@/hooks/useReducedMotion";
import { useAgeDeclared } from "./AgeDeclarationContext";

/*
 * The launch reveal: the cinemaxxx logo alone, on a dark-red light, once per
 * browser session. There is no text anywhere in it. The layout's head script
 * sets `data-cinemax-intro-pending` before first paint so the app shell stays
 * hidden until this overlay is mounted, which means no page content flashes
 * before the reveal.
 */

const SESSION_KEY = "cinemax:prism-intro:v1";
const PENDING_ATTR = "cinemaxIntroPending";
const EVENT = "cinemax:intro-phase";
type Phase = "open" | "closing" | "done";
let currentPhase: Phase = "open";

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener("storage", callback); };
}
function getSnapshot(): Phase {
  try { if (window.sessionStorage.getItem(SESSION_KEY) === "1") return "done"; } catch { /* Private browsing. */ }
  return currentPhase;
}
function setPhase(phase: Phase) {
  currentPhase = phase;
  if (phase === "done") {
    try { window.sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* In-memory guard still works. */ }
    document.documentElement.dataset.cinemaxIntro = "seen";
    delete document.documentElement.dataset[PENDING_ATTR];
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Mirrors the head script's test: age accepted and not declined this session. */
function storedAcceptance(): boolean {
  try {
    return window.localStorage.getItem("cinemaxxx:age-declaration:v1") === "accepted"
      && window.sessionStorage.getItem("cinemaxxx:age-declined:v1") !== "1";
  } catch {
    return false;
  }
}

export default function SplashScreen() {
  const pathname = usePathname();
  const ageDeclared = useAgeDeclared();
  const phase = useSyncExternalStore(subscribe, getSnapshot, (): Phase => "open");
  const reducedMotion = useReducedMotion();
  const dialog = useRef<HTMLDivElement>(null);
  const visible = ageDeclared && pathname === "/" && phase !== "done";

  useEffect(() => {
    // Never leave the shell hidden when there is no reveal to show. The age gate
    // reports "pending" until hydration finishes, so while the stored acceptance
    // says a reveal is due on "/", keep the shell hidden until the reveal mounts.
    if (visible) return;
    if (pathname === "/" && phase !== "done" && storedAcceptance()) return;
    delete document.documentElement.dataset[PENDING_ATTR];
  }, [visible, pathname, phase]);

  useEffect(() => {
    if (!visible) return;
    const app = document.getElementById("cinemax-app");
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const splash = dialog.current;
    if (app) app.inert = true;
    document.body.style.overflow = "hidden";
    dialog.current?.focus({ preventScroll: true });
    return () => {
      if (app) app.inert = false;
      document.body.style.overflow = previousOverflow;
      if (splash?.contains(document.activeElement)) {
        if (previousFocus && previousFocus !== document.body && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
        else document.getElementById("main-content")?.focus({ preventScroll: true });
      }
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const delay = phase === "closing" ? (reducedMotion ? 0 : 460) : (reducedMotion ? 180 : 2150);
    const timer = window.setTimeout(() => setPhase(phase === "open" ? "closing" : "done"), delay);
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion, visible]);

  if (!visible) return null;
  return (
    <div ref={dialog} className={`splash-screen ${phase === "closing" ? "is-closing" : ""}`} role="dialog" aria-modal="true" aria-label="Opening cinemaxxx" tabIndex={-1}>
      <div className="splash-glow" aria-hidden="true" />
      <div className="splash-lockup">
        {/* The uploaded logo, unmodified. Its own alt text names the app for assistive tech. */}
        <img className="splash-logo" src="/brand/cinemaxxx-logo-512.png" width={512} height={512} alt="cinemaxxx" decoding="sync" fetchPriority="high" draggable={false} />
        <span className="splash-sheen" aria-hidden="true" />
      </div>
      {/* The whole screen skips the reveal. It has no visible label. */}
      <button className="splash-skip" type="button" aria-label="Skip intro" onClick={() => setPhase("closing")} />
    </div>
  );
}
