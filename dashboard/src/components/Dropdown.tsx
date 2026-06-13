"use client";

import { useState, useRef, useEffect } from "react";
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
}

export default function Dropdown({ options, value, onChange, placeholder, icon, className = "" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className={`relative ${className} ${open ? "z-40" : "z-10"}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full h-11 ${icon ? "pl-10" : "pl-4"} pr-9 rounded-xl text-sm text-left flex items-center transition-all border border-slate-250 hover:border-[var(--secondary)]/40 focus:outline-none`}
        style={{ background: "#ffffff", color: selected && selected.value ? "var(--foreground)" : "var(--muted)" }}
      >
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>}
        <span className="truncate font-medium">{selected?.label || placeholder}</span>
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "var(--muted)" }} />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-2 w-full min-w-[200px] max-h-[280px] overflow-y-auto rounded-xl border border-slate-200 py-1 bg-white shadow-xl shadow-slate-100"
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full px-4 py-2.5 text-sm text-left flex items-center justify-between transition-colors hover:bg-slate-50"
              style={{ color: opt.value === value ? "var(--secondary)" : "var(--foreground)" }}
            >
              <span className={opt.value === value ? "font-bold" : "font-medium"}>{opt.label}</span>
              {opt.value === value && <Check className="w-4 h-4 shrink-0 text-[var(--secondary)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
