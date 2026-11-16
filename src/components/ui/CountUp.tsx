import { useEffect, useMemo, useRef, useState } from "react";
import { countUpValue } from "../../lib/count-up.js";

export function CountUp({ value, fractionDigits = 0, suffix = "" }: {
  value: number; fractionDigits?: number; suffix?: string;
}) {
  const target = Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState(0);
  const current = useRef(0);
  const formatter = useMemo(() => new Intl.NumberFormat("el-GR", {
    maximumFractionDigits: fractionDigits,
  }), [fractionDigits]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const finish = () => {
      window.cancelAnimationFrame(frame);
      current.current = target;
      setDisplay(target);
    };
    const from = current.current;
    const start = performance.now();
    const tick = (now: number) => {
      const next = countUpValue(from, target, now - start);
      current.current = next;
      setDisplay(next);
      if (now - start < 800) frame = window.requestAnimationFrame(tick);
      else finish();
    };
    const motionChange = () => { if (media.matches) finish(); };
    media.addEventListener("change", motionChange);
    if (media.matches || from === target) finish();
    else frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      media.removeEventListener("change", motionChange);
    };
  }, [target]);

  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      <span aria-hidden="true">{formatter.format(display)}{suffix}</span>
      <span className="sr-only">{formatter.format(target)}{suffix}</span>
    </span>
  );
}

/** Keeps times, names and empty placeholders as text; animates Greek-formatted metrics. */
export function MetricValue({ value }: { value: number | string }) {
  if (typeof value === "number") return <CountUp value={value} />;
  const match = /^(-?[\d.]+(?:,\d+)?)\s*(%)?$/.exec(value);
  if (!match) return <>{value}</>;
  const numeric = Number(match[1].replaceAll(".", "").replace(",", "."));
  if (!Number.isFinite(numeric)) return <>{value}</>;
  return <CountUp value={numeric} fractionDigits={match[1].includes(",") ? 1 : 0} suffix={match[2] || ""} />;
}
