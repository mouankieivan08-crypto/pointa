import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-white text-brand-700 border border-border hover:bg-surface-2",
  outline: "border border-white/30 text-white hover:bg-white/10",
  ghost: "text-foreground hover:bg-surface-2",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-13 px-7 text-base",
};

function classes(variant: Variant, size: Size, className?: string) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className ?? ""}`;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link href={href} className={classes(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: {
  variant?: Variant;
  size?: Size;
} & ComponentProps<"button">) {
  return (
    <button className={classes(variant, size, className)} {...props}>
      {children}
    </button>
  );
}
