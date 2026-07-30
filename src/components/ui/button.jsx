import * as React from "react";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";

const Button = React.forwardRef(({ 
  className, 
  variant = "default", 
  size = "default", 
  loading = false,
  children,
  disabled,
  ...props 
}, ref) => {
  const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99]";
  
  const variants = {
    default: "bg-[#0d7676] text-white hover:bg-[#0a5c5c] shadow-2xs",
    secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200",
    outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    destructive: "bg-rose-600 text-white hover:bg-rose-700 shadow-2xs",
    emerald: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
  };

  const sizes = {
    default: "h-9 px-3.5 py-2 text-xs",
    sm: "h-8 px-3 text-xs",
    lg: "h-10 px-5",
    icon: "h-9 w-9 p-0"
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      ref={ref}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />}
      {children}
    </button>
  );
});
Button.displayName = "Button";

export { Button };
