"use client";
import React from "react";

export type Option = { label: string; value: string };

type Props = {
  label: string;
  placeholder?: string;
  value?: string;
  onChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
  name?: string;
};

export function Select({ label, placeholder = "Select...", value, onChange, options, disabled, name }: Props) {
  return (
    <label className="flex w-full flex-col gap-1">
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
      <select
        name={name}
        className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm shadow-sm outline-none ring-0 focus:border-zinc-400 dark:focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400/40 dark:focus:ring-zinc-500/40 text-zinc-900 dark:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
