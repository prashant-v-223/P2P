import * as React from "react";
import { cn } from "../../lib/utils";

function Badge({ className, variant = "default", ...props }) {
  const baseStyles = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400";
  
  const variants = {
    default: "bg-[#0d7676] text-white",
    secondary: "bg-slate-100 text-slate-700 border border-slate-200",
    outline: "text-slate-700 border border-slate-300 bg-white",
    emerald: "bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold",
    rose: "bg-rose-50 text-rose-700 border border-rose-200 font-bold",
    teal: "bg-teal-50 text-[#0d7676] border border-teal-200 font-bold",
    amber: "bg-amber-50 text-amber-800 border border-amber-200 font-bold"
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props} />
  );
}

export { Badge };
