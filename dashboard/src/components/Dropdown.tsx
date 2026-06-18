"use client";

import { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface DropdownProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: React.ReactNode;
  className?: string;
  /** Compact variant (e.g. inline filter rows). Defaults to the tall h-11 form variant. */
  size?: "default" | "sm";
  "aria-label"?: string;
}

export default function Dropdown({
  options,
  value,
  onChange,
  placeholder,
  icon,
  className = "",
  size = "default",
  "aria-label": ariaLabel,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // keyboard-highlighted index
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // when opening, highlight the currently selected option
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setActive(idx >= 0 ? idx : 0);
    } else {
      setActive(-1);
    }
  }, [open, options, value]);

  // keep the highlighted option scrolled into view
  useEffect(() => {
    if (!open || active < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const selected = options.find((o) => o.value === value);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) { setOpen(true); break; }
        setActive((a) => (a + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) { setOpen(true); break; }
        setActive((a) => (a - 1 + options.length) % options.length);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (!open) { setOpen(true); break; }
        if (active >= 0 && options[active]) choose(options[active].value);
        break;
      case "Escape":
        if (open) { e.preventDefault(); setOpen(false); }
        break;
      case "Home":
        if (open) { e.preventDefault(); setActive(0); }
        break;
      case "End":
        if (open) { e.preventDefault(); setActive(options.length - 1); }
        break;
      default:
        break;
    }
  }

  const sm = size === "sm";

  return (
    <div ref={ref} className={`relative ${className} ${open ? "z-40" : "z-10"}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        className={`w-full ${sm ? "h-[38px] rounded-lg" : "h-11 rounded-xl"} text-sm ${icon ? "pl-10" : "pl-4"} pr-9 text-left flex items-center transition-all border focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]/30`}
        style={{
          background: sm ? "var(--surface-low)" : "#ffffff",
          color: selected && selected.value ? "var(--foreground)" : "var(--muted)",
          borderColor: "var(--outline)",
        }}
      >
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>}
        <span className="truncate font-medium">{selected?.label || placeholder}</span>
        <ChevronDown
          className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--muted)" }}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className="absolute z-50 mt-2 w-full min-w-[200px] max-h-[280px] overflow-y-auto rounded-xl border border-slate-200 py-1 bg-white shadow-xl shadow-slate-100"
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isActive = i === active;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-idx={i}
                onClick={() => choose(opt.value)}
                onMouseEnter={() => setActive(i)}
                className="w-full px-4 py-2.5 text-sm text-left flex items-center justify-between transition-colors"
                style={{
                  color: isSelected ? "var(--secondary)" : "var(--foreground)",
                  background: isActive ? "rgb(248 250 252)" : "transparent",
                }}
              >
                <span className={isSelected ? "font-bold" : "font-medium"}>{opt.label}</span>
                {isSelected && <Check className="w-4 h-4 shrink-0 text-[var(--secondary)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
