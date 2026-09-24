export function ProgressRing({
  value,
  max,
  size = 76,
  stroke = 8,
  caption,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  caption?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(1, Math.max(0, value / Math.max(1, max)));

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6a5cff" />
            <stop offset="100%" stopColor="#b18cff" />
          </linearGradient>
        </defs>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
        />
      </svg>
      <div className="ring-label">
        <b>{value}</b>
        {caption && <span>{caption}</span>}
      </div>
    </div>
  );
}
