import * as React from "react";
import { cn } from "@/lib/utils";
import { Select as RadixSelect, SelectTrigger, SelectContent, SelectItem, SelectValue } from "./select";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl glass-inset px-4 py-2 text-sm text-foreground placeholder:text-muted-2 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:border-gold/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("text-xs font-medium text-muted tracking-wide", className)} {...props} />
);

/**
 * Select — a compatibility layer over the Radix select in ./select.tsx.
 *
 * It keeps the native API (`value`, `onChange`, `<option>` children) that all
 * existing call sites use, but renders the Radix version underneath. A native
 * <select> hands its option list to the operating system, which paints it in
 * the system's colours — an unreadable white list on this dark theme that no
 * CSS of ours can reach.
 *
 * New code can use `SimpleSelect` or the Radix parts directly; this exists so
 * every existing form got the fix at once instead of sixteen rewrites.
 */
const Select = ({
  value,
  defaultValue,
  onChange,
  className,
  children,
  disabled,
  // Native-select habits the call sites rely on, mapped onto Radix:
  // autoFocus opens the list immediately, onBlur fires when it closes again.
  autoFocus,
  onBlur,
}: {
  value?: string | number | readonly string[];
  defaultValue?: string | number | readonly string[];
  onChange?: (e: { target: { value: string } }) => void;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
}) => {
  // Flatten children, including arrays produced by .map(), into plain options.
  const options: Array<{ value: string; label: string; disabled?: boolean }> = [];
  const walk = (node: React.ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === React.Fragment) {
        walk((child.props as { children?: React.ReactNode }).children);
        return;
      }
      if (child.type === "option") {
        const props = child.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean };
        const label = React.Children.toArray(props.children).filter((c) => typeof c === "string" || typeof c === "number").join("");
        options.push({ value: String(props.value ?? label), label, disabled: props.disabled });
      }
    });
  };
  walk(children);

  // An empty-string option is a valid placeholder in a native select, but Radix
  // reserves "" — map it to a sentinel and translate back on change.
  const EMPTY = "__all__";
  const enc = (v: string) => (v === "" ? EMPTY : v);

  return (
    <RadixSelect
      value={value !== undefined ? enc(String(value)) : undefined}
      defaultValue={defaultValue !== undefined ? enc(String(defaultValue)) : undefined}
      onValueChange={(v) => onChange?.({ target: { value: v === EMPTY ? "" : v } })}
      disabled={disabled}
      defaultOpen={autoFocus}
      onOpenChange={(o) => { if (!o) onBlur?.(); }}
    >
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={enc(o.value)} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </RadixSelect>
  );
};
Select.displayName = "Select";

export { Input, Label, Select };
