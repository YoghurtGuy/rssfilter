"use client";

import { Input, Label, Switch, TextArea, TextField } from "@heroui/react";
import type { ReactNode } from "react";

/** Single-line labelled text field. */
export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  isRequired,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  isRequired?: boolean;
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
      <Input placeholder={placeholder} variant="secondary" />
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
