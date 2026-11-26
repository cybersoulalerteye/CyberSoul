type SkeletonProps = {
  width?: string;
  height?: string;
  className?: string;
};

export function Skeleton({ width = "100%", height = "16px", className = "" }: SkeletonProps) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-rows" aria-label="Loading content">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <Skeleton width="30%" />
          <Skeleton width="20%" />
          <Skeleton width="14%" />
        </div>
      ))}
    </div>
  );
}
