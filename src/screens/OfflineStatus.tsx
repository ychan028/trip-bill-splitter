import { useEffect, useState } from "react";

type State = "ready" | "preparing" | "unsupported";

function standalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Tells people whether the app will open with no connection. The service
 * worker only takes control after it has downloaded every file, so a
 * controlling worker means the offline copy is complete.
 */
export function OfflineStatus() {
  const sw = "serviceWorker" in navigator;
  const [state, setState] = useState<State>(() =>
    !sw ? "unsupported" : navigator.serviceWorker.controller ? "ready" : "preparing",
  );

  useEffect(() => {
    if (!sw) return;
    const on = () => navigator.serviceWorker.controller && setState("ready");
    navigator.serviceWorker.addEventListener("controllerchange", on);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", on);
  }, [sw]);

  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const installHint = isIos
    ? "Open this page in Safari, tap Share → Add to Home Screen, then use the home-screen icon."
    : "Open this page in Chrome, tap ⋮ → Install app (or Add to Home screen), then use that icon.";

  if (state === "unsupported") {
    return (
      <p className="warn">
        This browser can't keep the app for offline use (in-app browsers from messaging or email apps usually
        can't). {installHint}
      </p>
    );
  }
  if (state === "preparing") {
    return (
      <p className="warn">
        Downloading the offline copy… keep this open on Wi-Fi until this says "Ready offline". If it never
        changes, you're probably in an in-app browser. {installHint}
      </p>
    );
  }
  return (
    <p className="ok small">
      Ready offline on this {standalone() ? "home-screen app" : "browser"}.
      {!standalone() && ` For the best experience, add it to your home screen and open it from there. ${installHint}`}
    </p>
  );
}
