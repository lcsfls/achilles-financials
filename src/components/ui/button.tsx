import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-[#e9cd6f] via-[#d4af37] to-[#b8912e] text-[#1a1405] font-semibold shadow-[0_8px_24px_-8px_rgba(212,175,55,0.5),0_1px_0_rgba(255,255,255,0.4)_inset] hover:brightness-110 hover:shadow-[0_12px_32px_-8px_rgba(212,175,55,0.65)] active:scale-[0.98]",
        glass:
          "glass text-foreground hover:border-white/20 hover:bg-white/[0.07] active:scale-[0.98]",
        ghost: "text-muted hover:text-foreground hover:bg-white/[0.06] active:scale-[0.98]",
        outline:
          "border border-white/12 text-foreground hover:bg-white/[0.05] hover:border-white/20 active:scale-[0.98]",
        destructive:
          "border border-rose-soft/30 text-rose-soft hover:bg-rose-soft/10 active:scale-[0.98]",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-3 text-xs rounded-lg",
        lg: "h-12 px-7 text-base rounded-2xl",
        icon: "h-9 w-9 rounded-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
