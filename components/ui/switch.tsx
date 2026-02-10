"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SwitchProps = {
  id?: string;
  className?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  value?: string;
  required?: boolean;
  form?: string;
};

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      id,
      className,
      checked = false,
      onCheckedChange,
      disabled,
      name,
      value,
      required,
      form,
    },
    ref
  ) => {
    const toggle = () => {
      if (disabled) return;
      onCheckedChange?.(!checked);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggle();
      }
    };

    return (
      <div className={cn("inline-flex items-center", className)}>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-disabled={disabled || undefined}
          aria-labelledby={id ? `${id}-label` : undefined}
          disabled={disabled}
          onClick={toggle}
          onKeyDown={onKeyDown}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300",
            "disabled:cursor-not-allowed disabled:opacity-50",
            checked ? "bg-gray-900" : "bg-gray-200"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition",
              checked ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>

        <input
          ref={ref}
          id={id}
          name={name}
          value={value}
          required={required}
          form={form}
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    );
  }
);

Switch.displayName = "Switch";

export { Switch };
