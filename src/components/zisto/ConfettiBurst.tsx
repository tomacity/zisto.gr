import { createPortal } from "react-dom";
import type { CSSProperties } from "react";

export function ConfettiBurst() {
  if (typeof document === "undefined") {
    return null;
  }

  const pieces = Array.from({ length: 70 }, (_, index) => index);

  const colors = [
    "#DC2727",
    "#222222",
    "#FFFFFF",
    "#FFB800",
    "#FF6B6B",
  ];

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 h-screen w-screen overflow-hidden"
      style={{ zIndex: 2147483647 }}
      aria-hidden="true"
    >
      {pieces.map((piece) => {
        const isLeft = piece % 2 === 0;

        const horizontalDistance = isLeft
          ? 180 + Math.random() * 650
          : -180 - Math.random() * 650;

        return (
          <span
            key={piece}
            className="absolute block rounded-sm"
            style={
              {
                width: `${6 + Math.random() * 7}px`,
                height: `${10 + Math.random() * 10}px`,

                left: isLeft ? `${Math.random() * 10}%` : "auto",
                right: isLeft ? "auto" : `${Math.random() * 10}%`,

                top: `${35 + Math.random() * 55}%`,

                backgroundColor: colors[piece % colors.length],
                opacity: 0,

                animation: `zisto-confetti ${
                  1.2 + Math.random() * 0.8
                }s cubic-bezier(0.2, 0.7, 0.3, 1) ${
                  Math.random() * 0.18
                }s forwards`,

                "--confetti-x": `${horizontalDistance}px`,
                "--confetti-y": `${-300 - Math.random() * 600}px`,
                "--confetti-rotation": `${
                  (isLeft ? 1 : -1) * (360 + Math.random() * 900)
                }deg`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>,
    document.body,
  );
}
