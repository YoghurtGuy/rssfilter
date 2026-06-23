"use client";

import { Input, Label, Switch, TextArea, TextField } from "@heroui/react";
import type { FocusEventHandler, ReactNode } from "react";

/** Single-line labelled text field. */
export function Field({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  isRequired,
  endContent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  placeholder?: string;
  type?: string;
  isRequired?: boolean;
  endContent?: ReactNode;
}) {
  return (
    <TextField
      value={value}
      onChange={onChange}
      type={type}
      isRequired={isRequired}
      className="flex flex-col gap-1.5"
    >
      <Label>{label}</Label>
      <div className="relative">
        <Input
          placeholder={placeholder}
          variant="secondary"
          onBlur={onBlur}
          className={endContent ? "pr-10" : undefined}
        />
        {endContent ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            {endContent}
          </span>
        ) : null}
      </div>
    </TextField>
  );
}

/** Multi-line labelled text field. */
export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <TextField
      value={value}
      onChange={onChange}
      className="flex flex-col gap-1.5"
    >
      <Label>{label}</Label>
      <TextArea placeholder={placeholder} rows={3} variant="secondary" />
    </TextField>
  );
}

/**
 * Toggle-only switch (no inline label) for settings rows where a heading
 * elsewhere names the control. Correct HeroUI v3 structure: Control nests
 * inside Content (the clickable label).
 */
export function Toggle({
  isSelected,
  onChange,
  ariaLabel,
}: {
  isSelected: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <Switch isSelected={isSelected} onChange={onChange} aria-label={ariaLabel}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  );
}

/** Switch with an inline text label to its right. */
export function ToggleRow({
  label,
  isSelected,
  onChange,
}: {
  label: ReactNode;
  isSelected: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Switch isSelected={isSelected} onChange={onChange}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        {label}
      </Switch.Content>
    </Switch>
  );
}
