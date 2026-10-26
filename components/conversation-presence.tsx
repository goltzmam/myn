"use client";
import type { CSSProperties } from "react";

type PresenceState = "ready" | "listening" | "thinking" | "speaking";
// Deterministic positions keep the sky stable across hydration and conversation turns.
function scatter(seed: number) {
  let n = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  n ^= n >>> 13;
  n = Math.imul(n, 0xc2b2ae35);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
const stars = Array.from({ length: 220 }, (_, i) => ({
  x: scatter(i + 1) * 1000,
  y: scatter(i + 781) * 700,
  radius: i % 13 === 0 ? 1.7 : i % 4 === 0 ? 1.1 : 0.65,
  opacity: 0.18 + (i % 7) * 0.09,
}));
export function ConversationPresence({
  state,
  level,
}: {
  state: PresenceState;
  level: number;
}) {
  return (
    <div
      className={"conversation-presence state-" + state}
      aria-hidden="true"
      style={
        {
          "--voice-power": Math.max(0, Math.min(1, level / 100)),
        } as CSSProperties
      }
    >
      <svg
        className="presence-sky"
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid slice"
      >
        {stars.map((star, i) => (
          <circle
            key={i}
            cx={star.x}
            cy={star.y}
            r={star.radius}
            opacity={star.opacity}
            className={"star star-" + (i % 3)}
          />
        ))}
      </svg>
      <div className="presence-aura" />
      <div className="presence-orb">
        <span className="presence-orbit orbit-one" />
        <span className="presence-orbit orbit-two" />
        <span className="presence-orbit orbit-three" />
        <span className="presence-orbit orbit-four" />
        <span className="presence-core" />
      </div>
    </div>
  );
}
