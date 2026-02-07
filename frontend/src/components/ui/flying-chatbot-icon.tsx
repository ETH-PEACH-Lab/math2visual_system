import { cn } from "@/lib/utils";

interface FlyingChatbotIconProps {
  className?: string;
  size?: number;
  animated?: boolean;
  /** Enable responsive scaling that grows on large screens (e.g., TVs). */
  responsive?: boolean;
  minSize?: number;
  maxSize?: number;
  mouthAnimated?: boolean;
}

export function FlyingChatbotIcon({
  className,
  size = 48,
  animated = true,
  responsive = false,
  minSize = 32,
  maxSize = 140,
  mouthAnimated = false,
}: FlyingChatbotIconProps) {
  const dimensionStyle = responsive
    ? {
        width: `clamp(${minSize}px, 3vw, ${maxSize}px)`,
        height: `clamp(${minSize}px, 3vw, ${maxSize}px)`,
      }
    : { width: size, height: size };

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center text-sky-500",
        animated && "animate-fly",
        className
      )}
      style={dimensionStyle}
    >
      <div
        className={cn("relative", animated && "animate-float")}
        style={{
          animationDelay: "0.2s",
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-lg relative z-10"
          style={{
            filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.12))",
          }}
        >
          {/* Ears / side panels */}
          <rect
            x="6"
            y="22"
            width="10"
            height="20"
            rx="3"
            fill="#f8fafc"
            stroke="currentColor"
            strokeWidth="3"
          />
          <rect
            x="48"
            y="22"
            width="10"
            height="20"
            rx="3"
            fill="#f8fafc"
            stroke="currentColor"
            strokeWidth="3"
          />

          {/* Head */}
          <rect
            x="14"
            y="10"
            width="36"
            height="40"
            rx="8"
            fill="#f8fafc"
            stroke="currentColor"
            strokeWidth="3"
          />

          {/* Antenna */}
          <line
            x1="32"
            y1="6"
            x2="32"
            y2="10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="32" cy="6" r="2.5" fill="currentColor" />

          {/* Eyes */}
          <circle cx="24" cy="24" r="4" fill="#111827" />
          <circle cx="40" cy="24" r="4" fill="#111827" />

          {/* Mouth */}
          <path
            d="M22 34 Q32 38 42 34"
            stroke="#111827"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            className={cn(mouthAnimated && "animate-mouth-talk")}
            style={{
              transformOrigin: "center",
              transformBox: "fill-box",
            }}
          />

          {/* Cheek highlights */}
          <circle cx="20" cy="30" r="2" fill="#60a5fa" opacity="0.8" />
          <circle cx="44" cy="30" r="2" fill="#60a5fa" opacity="0.8" />
        </svg>

        {/* Subtle glow effect */}
        <div
          className={cn(
            "absolute inset-0 rounded-full bg-sky-500/20 blur-md -z-0",
            animated && "animate-glow-pulse"
          )}
          style={{
            width: "100%",
            height: "100%",
          }}
        />
      </div>
    </div>
  );
}

