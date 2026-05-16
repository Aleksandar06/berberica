import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "./cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder-slate-400 shadow-sm",
          "focus:outline-none focus:ring-2 focus:ring-offset-1 brand-ring",
          "disabled:cursor-not-allowed disabled:bg-slate-50",
          className,
        )}
        {...rest}
      />
    );
  },
);
