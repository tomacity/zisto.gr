import { useEffect, useRef } from "react";
import { startLiveRefresh } from "../lib/live-refresh.js";

export type LiveRefreshContext = { initial: boolean; signal: AbortSignal };

export function useLiveRefresh(
  refresh: (context: LiveRefreshContext) => Promise<void>,
  scope: string,
  enabled = true,
) {
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; });
  useEffect(() => {
    if (!enabled) return;
    return startLiveRefresh((context: LiveRefreshContext) => refreshRef.current(context));
  }, [scope, enabled]);
}
