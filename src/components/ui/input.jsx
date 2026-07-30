import * as React from "react";
import { cn } from "../../lib/utils";

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition file:border-0 file:bg-transparent file:text-sm file:font-semibold placeholder:text-slate-400 hover:border-slate-400 focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
