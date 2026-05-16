import { forwardRef, type LabelHTMLAttributes } from "react";

import { cn } from "./cn";

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  function Label({ className, ...rest }, ref) {
    return (
      <label
        ref={ref}
        className={cn(
          "block text-sm font-medium text-slate-700 mb-1",
          className,
        )}
        {...rest}
      />
    );
  },
);
