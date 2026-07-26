import { useEffect, useRef } from "react";

// B1: data freshness. One truth for "load on mount + reload when the user comes back".
// Cure for the stale-render class (blank Dashboard, phantom not-born-yet, manager-only ghost).
// Usage: useFreshData(loadFn, [deps]) - loadFn is your existing async loader.
// Focus/visibility refetches are throttled to one per 10s and paused while `hold` is true
// (pass a ref or boolean for mid-save dialogs).
export function useFreshData(loadFn, deps = [], opts = {}) {
  const { minGapMs = 10000, hold = false } = opts;
  const lastRun = useRef(0);
  const holdRef = useRef(hold);
  holdRef.current = typeof hold === "object" && hold !== null ? hold.current : hold;

  useEffect(() => {
    lastRun.current = Date.now();
    loadFn();

    const maybeReload = () => {
      if (holdRef.current) return;
      if (Date.now() - lastRun.current < minGapMs) return;
      lastRun.current = Date.now();
      loadFn();
    };
    const onVis = () => { if (document.visibilityState === "visible") maybeReload(); };

    window.addEventListener("focus", maybeReload);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", maybeReload);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
