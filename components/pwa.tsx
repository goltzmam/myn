"use client";
import { useEffect, useState, useRef } from "react";
export function PWA() {
  const updateRequested = useRef(false);
  const [waiting, setWaiting] = useState<ServiceWorker>();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let active = true;
    const controllerChanged = () => {
      if (updateRequested.current) location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      controllerChanged,
    );
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (!active) return;
        if (reg.waiting) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller &&
              active
            )
              setWaiting(worker);
          });
        });
      })
      .catch(() => {
        /* Offline support is optional; online use remains available. */
      });
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        controllerChanged,
      );
    };
  }, []);
  return waiting ? (
    <div className="update-banner" role="status">
      A fresh version of MYN is ready.{" "}
      <button
        onClick={() => {
          updateRequested.current = true;
          waiting.postMessage("ACTIVATE_UPDATE");
        }}
      >
        Update when you’re ready
      </button>
    </div>
  ) : null;
}
