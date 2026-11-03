import { cn } from "@/lib/utils";

export function Portrait({
  src,
  alt,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <img
      src={src}
      alt={alt}
      crossOrigin="anonymous"
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "low"}
      className={cn("h-full w-full object-cover object-top", className)}
    />
  );
}
