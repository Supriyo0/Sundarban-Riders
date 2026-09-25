import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  orientation?: "horizontal" | "vertical";
  priority?: boolean;
}

const sizeMap = {
  sm: {
    imgSize: 34,
    titleText: "text-sm font-bold tracking-tight",
    subText: "text-[10px] text-teal-600 dark:text-teal-400 font-semibold tracking-wide",
  },
  md: {
    imgSize: 48,
    titleText: "text-base font-bold tracking-tight",
    subText: "text-xs text-teal-600 dark:text-teal-400 font-semibold tracking-wide",
  },
  lg: {
    imgSize: 72,
    titleText: "text-xl font-bold tracking-tight",
    subText: "text-sm text-teal-600 dark:text-teal-400 font-medium tracking-wide",
  },
  xl: {
    imgSize: 96,
    titleText: "text-2xl font-black tracking-tight",
    subText: "text-base text-teal-600 dark:text-teal-400 font-medium tracking-wide",
  },
};

export function BrandLogo({
  className,
  size = "md",
  orientation,
  showText = true,
  priority = false,
}: BrandLogoProps) {
  const config = sizeMap[size];
  const isHorizontal = orientation === "horizontal" || (orientation === undefined && (size === "sm" || size === "md"));

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center",
        isHorizontal ? "flex-row gap-2.5" : "flex-col gap-2",
        className,
      )}
    >
      {/* Official Sundarban Riders Logo Emblem */}
      <div className="relative flex shrink-0 items-center justify-center rounded-full overflow-hidden shadow-md ring-2 ring-emerald-500/30 bg-white dark:bg-slate-900 transition-transform duration-200 hover:scale-105">
        <Image
          src="/sundarban-logo.png"
          alt="Sundarban Riders Logo"
          width={config.imgSize}
          height={config.imgSize}
          priority={priority}
          className="object-cover rounded-full scale-[1.05]"
          style={{ width: `${config.imgSize}px`, height: `${config.imgSize}px` }}
        />
      </div>

      {/* Brand Text */}
      {showText && (
        <div className={cn("flex flex-col", !isHorizontal && "items-center text-center")}>
          <span className={cn("font-bold leading-tight text-foreground", config.titleText)}>
            Sundarban Riders
          </span>
          <span className={cn("leading-tight font-sans", config.subText)}>
            সুন্দরবন রাইডার
          </span>
        </div>
      )}
    </div>
  );
}

