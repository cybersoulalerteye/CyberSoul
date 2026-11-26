import type { HTMLAttributes } from "react";

type AvatarProps = HTMLAttributes<HTMLSpanElement> & {
  name: string;
  imageUrl?: string;
  size?: "sm" | "md" | "lg";
};

export function Avatar({ name, imageUrl, size = "md", className = "", ...props }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span
      className={`avatar avatar--${size} ${className}`.trim()}
      role="img"
      aria-label={name}
      {...props}
    >
      {imageUrl ? <img src={imageUrl} alt="" /> : initials}
    </span>
  );
}
