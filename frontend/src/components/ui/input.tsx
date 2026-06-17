import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  icon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-green-light">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex h-11 w-full rounded-lg border bg-white px-4 py-3 text-sm transition-all duration-200",
            "text-brand-green-dark placeholder:text-brand-green-light/50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta/30 focus-visible:border-brand-terracotta",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-brand-cream",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            error
              ? "border-red-500 focus-visible:ring-red-500/30 focus-visible:border-red-500"
              : "border-brand-cream-dark hover:border-brand-green-light",
            icon && "pl-10",
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
