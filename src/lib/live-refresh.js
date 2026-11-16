/** Refresh visible dashboards without overlapping requests or reloading the page. */
export function startLiveRefresh(refresh, {
  intervalMs = 5000,
  windowTarget = window,
  documentTarget = document,
} = {}) {
  let stopped = false, running = false, pending = false, completed = false;
  let timer = null, controller = null;
  const visible = () => documentTarget.visibilityState !== "hidden";
  const clearTimer = () => {
    if (timer !== null) windowTarget.clearTimeout(timer);
    timer = null;
  };
  async function run() {
    clearTimer();
    if (stopped || !visible()) return;
    if (running) { pending = true; return; }
    running = true;
    controller = new AbortController();
    const signal = controller.signal;
    const timeout = windowTarget.setTimeout(() => controller?.abort(), 20000);
    try {
      await refresh({ initial: !completed, signal });
    } catch (error) {
      if (!signal.aborted) console.error("Dashboard refresh failed", error);
    } finally {
      windowTarget.clearTimeout(timeout);
      if (!signal.aborted) completed = true;
      running = false;
      controller = null;
      if (!stopped && visible()) {
        if (pending) { pending = false; void run(); }
        else timer = windowTarget.setTimeout(run, intervalMs);
      }
    }
  }
  function resume() { if (visible()) void run(); }
  function visibilityChange() {
    if (visible()) resume();
    else { clearTimer(); pending = false; controller?.abort(); }
  }
  windowTarget.addEventListener("focus", resume);
  windowTarget.addEventListener("online", resume);
  documentTarget.addEventListener("visibilitychange", visibilityChange);
  void run();
  return () => {
    stopped = true;
    pending = false;
    clearTimer();
    controller?.abort();
    windowTarget.removeEventListener("focus", resume);
    windowTarget.removeEventListener("online", resume);
    documentTarget.removeEventListener("visibilitychange", visibilityChange);
  };
}
