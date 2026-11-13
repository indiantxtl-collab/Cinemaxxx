"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import Logo from "./Logo";
import { AgeDeclarationContext } from "./AgeDeclarationContext";
import CinematicButton from "./CinematicButton";

const ACCEPT_KEY = "cinemaxxx:age-declaration:v1";
const DECLINE_KEY = "cinemaxxx:age-declined:v1";
const EVENT = "cinemaxxx:age-declaration-change";
type Decision = "pending" | "accepted" | "declined";
let memoryAccepted = false;
let memoryDeclined = false;

function snapshot(): Decision {
  try {
    if (memoryDeclined || sessionStorage.getItem(DECLINE_KEY) === "1") return "declined";
    if (memoryAccepted || localStorage.getItem(ACCEPT_KEY) === "accepted") return "accepted";
  } catch { /* Storage can be unavailable; the in-memory decision still blocks this mount. */ }
  return memoryDeclined ? "declined" : memoryAccepted ? "accepted" : "pending";
}
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener("storage", callback); };
}
function exitApplication() {
  const bridge = (window as typeof window & { CinemaxNative?: { exitApp?: () => void } }).CinemaxNative;
  if (typeof bridge?.exitApp === "function") bridge.exitApp();
  else window.close(); // Browsers only permit this for script-opened windows; the blocked screen remains.
}

/**
 * First-entry self-declaration, not an age-verification service. The streaming
 * chrome is hidden and inert until Yes; No keeps it blocked for this browser session.
 * No date of birth, identity document or third-party verification is collected.
 */
export default function AgeDeclaration({ children }: { children: ReactNode }) {
  const decision = useSyncExternalStore(subscribe, snapshot, () => "pending");
  const dialog = useRef<HTMLDivElement>(null);
  const visible = decision !== "accepted";
  useEffect(() => {
    if (!visible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (event.key !== "Tab" || !dialog.current) return;
      const buttons = [...dialog.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      if (!buttons.length) { event.preventDefault(); dialog.current.focus(); return; }
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKey, true); };
  }, [visible]);

  const answer = (yes: boolean) => {
    memoryAccepted = yes;
    memoryDeclined = !yes;
    try {
      if (yes) { localStorage.setItem(ACCEPT_KEY, "accepted"); sessionStorage.removeItem(DECLINE_KEY); }
      else { localStorage.removeItem(ACCEPT_KEY); sessionStorage.setItem(DECLINE_KEY, "1"); }
    } catch { /* Fail closed in memory when persistent storage is blocked. */ }
    window.dispatchEvent(new Event(EVENT));
    if (!yes) exitApplication();
  };

  return <>
    <AgeDeclarationContext.Provider value={decision === "accepted"}>
      <div hidden={visible} inert={visible} aria-hidden={visible}>{children}</div>
    </AgeDeclarationContext.Provider>
    {visible && <div ref={dialog} className="studio-login age-declaration" role="dialog" aria-modal="true" aria-labelledby="age-declaration-title" tabIndex={-1}>
      <div className="studio-login-card">
        <Logo />
        <h1 id="age-declaration-title">{decision === "declined" ? "Access blocked" : "Are you 18 or older?"}</h1>
        {decision === "declined" ? <p>You must be 18 or older to use cinemaxxx. Access remains blocked. You can safely close this window.</p> : <>
          <p>This application is intended for adults and non-explicit channel streaming.</p>
          <div className="age-declaration-actions">
            <CinematicButton onClick={() => answer(true)}>Yes</CinematicButton>
            <CinematicButton variant="secondary" onClick={() => answer(false)}>No</CinematicButton>
          </div>
          <p className="age-declaration-note">This is a self-declaration, not verified proof of age. Your answer is stored only on this device; no identity or birth-date information is collected.</p>
        </>}
      </div>
    </div>}
  </>;
}
