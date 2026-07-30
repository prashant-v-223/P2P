import React from 'react';
import { AlertCircle } from 'lucide-react';

export function FieldError({ children }) {
  if (!children) return null;
  return <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-600"><AlertCircle className="h-3.5 w-3.5" />{children}</p>;
}
