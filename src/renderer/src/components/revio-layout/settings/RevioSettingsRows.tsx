import type React from 'react'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

/** One page of the settings: a title, an optional line under it, then rows. */
export function RevioSettingsPage({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section data-revio-settings-page="">
      <h1 data-revio-settings-title="">{title}</h1>
      {description ? <p data-revio-settings-lede="">{description}</p> : null}
      <div>{children}</div>
    </section>
  )
}

/** A small heading inside a page, for pages that group rows. */
export function RevioSettingsGroup({ title }: { title: string }): React.JSX.Element {
  return <h2 data-revio-settings-group="">{title}</h2>
}

/**
 * The row: label and description on the left, the control on the right, a rule below.
 * `below` holds content that needs the full width, such as a text area or a list.
 */
export function RevioSettingRow({
  label,
  description,
  hint,
  control,
  below
}: {
  label: string
  description?: React.ReactNode
  hint?: React.ReactNode
  control?: React.ReactNode
  below?: React.ReactNode
}): React.JSX.Element {
  return (
    <div data-revio-setting-row="">
      <div data-revio-setting-main="">
        <div data-revio-setting-text="">
          <div data-revio-setting-label="">{label}</div>
          {description ? <div data-revio-setting-description="">{description}</div> : null}
          {hint ? <div data-revio-setting-hint="">{hint}</div> : null}
        </div>
        {control ? <div data-revio-setting-control="">{control}</div> : null}
      </div>
      {below ? <div data-revio-setting-below="">{below}</div> : null}
    </div>
  )
}

export function RevioSwitch({
  checked,
  onChange,
  label,
  disabled
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}): React.JSX.Element {
  return (
    <Switch checked={checked} onCheckedChange={onChange} aria-label={label} disabled={disabled} />
  )
}

export type RevioSelectOption<T extends string> = { value: T; label: string }

export function RevioSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  placeholder
}: {
  /** '' shows the placeholder: nothing picked yet. */
  value: T | ''
  options: readonly RevioSelectOption<T>[]
  onChange: (value: T) => void
  label: string
  placeholder?: string
}): React.JSX.Element {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const match = options.find((option) => option.value === next)
        if (match) {
          onChange(match.value)
        }
      }}
    >
      <SelectTrigger size="sm" aria-label={label} data-revio-select="">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** The inline key glyphs, as in "Use ⇧↵ for new lines". */
export function RevioKeys({ keys }: { keys: string }): React.JSX.Element {
  return <kbd data-revio-keys="">{keys}</kbd>
}
