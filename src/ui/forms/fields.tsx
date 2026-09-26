import { useId } from 'react'
import { Field, type FieldProps } from './Field'
import { TextInput, type TextInputProps } from './TextInput'
import { TextArea, type TextAreaProps } from './TextArea'
import { Select, type SelectProps } from './Select'
import { SearchSelect, type SearchSelectProps } from './SearchSelect'
import { TableSearchSelect, type TableSearchSelectProps } from './TableSearchSelect'
import { FileDrop, type FileDropProps } from './FileDrop'
import { ChoiceGroup, type ChoiceGroupProps } from './ChoiceGroup'

export type FieldLayoutProps = {
  label: string
  required?: boolean
  error?: string
  hint?: string
  layout?: FieldProps['layout']
  htmlFor?: string
  /** Wrapper class (grid column span, etc.). Control className stays on the input. */
  fieldClassName?: string
}

function useControlId(id?: string, htmlFor?: string) {
  const autoId = useId()
  return id ?? htmlFor ?? autoId
}

export type TextFieldProps = FieldLayoutProps & TextInputProps

export function TextField({
  label,
  required,
  error,
  hint,
  layout,
  htmlFor,
  fieldClassName,
  ...input
}: TextFieldProps) {
  const id = useControlId(input.id, htmlFor)
  return (
    <Field label={label} htmlFor={id} required={required} error={error} hint={hint} layout={layout} className={fieldClassName}>
      <TextInput {...input} id={id} invalid={Boolean(error) || input.invalid} />
    </Field>
  )
}

export type TextAreaFieldProps = FieldLayoutProps & TextAreaProps

export function TextAreaField({
  label,
  required,
  error,
  hint,
  layout,
  htmlFor,
  fieldClassName,
  ...input
}: TextAreaFieldProps) {
  const id = useControlId(input.id, htmlFor)
  return (
    <Field label={label} htmlFor={id} required={required} error={error} hint={hint} layout={layout} className={fieldClassName}>
      <TextArea {...input} id={id} invalid={Boolean(error) || input.invalid} />
    </Field>
  )
}

export type SelectFieldProps = FieldLayoutProps & SelectProps

export function SelectField({
  label,
  required,
  error,
  hint,
  layout,
  htmlFor,
  fieldClassName,
  ...input
}: SelectFieldProps) {
  const id = useControlId(input.id, htmlFor)
  return (
    <Field label={label} htmlFor={id} required={required} error={error} hint={hint} layout={layout} className={fieldClassName}>
      <Select {...input} id={id} invalid={Boolean(error) || input.invalid} />
    </Field>
  )
}

export type SearchSelectFieldProps<T> = FieldLayoutProps & SearchSelectProps<T>

export function SearchSelectField<T>({
  label,
  required,
  error,
  hint,
  layout,
  htmlFor,
  fieldClassName,
  ...input
}: SearchSelectFieldProps<T>) {
  const id = useControlId(input.id, htmlFor)
  return (
    <Field label={label} htmlFor={id} required={required} error={error} hint={hint} layout={layout} className={fieldClassName}>
      <SearchSelect {...input} id={id} invalid={Boolean(error) || input.invalid} />
    </Field>
  )
}

export type TableSearchSelectFieldProps<T> = FieldLayoutProps & TableSearchSelectProps<T>

export function TableSearchSelectField<T>({
  label,
  required,
  error,
  hint,
  layout,
  htmlFor,
  fieldClassName,
  ...input
}: TableSearchSelectFieldProps<T>) {
  const id = useControlId(input.id, htmlFor)
  return (
    <Field label={label} htmlFor={id} required={required} error={error} hint={hint} layout={layout} className={fieldClassName}>
      <TableSearchSelect {...input} id={id} invalid={Boolean(error) || input.invalid} />
    </Field>
  )
}

export type FileFieldProps = FieldLayoutProps & FileDropProps

export function FileField({
  label,
  required,
  error,
  hint,
  layout,
  htmlFor,
  fieldClassName,
  ...input
}: FileFieldProps) {
  const id = useControlId(input.id, htmlFor)
  return (
    <Field label={label} htmlFor={id} required={required} error={error} hint={hint} layout={layout} className={fieldClassName}>
      <FileDrop {...input} id={id} invalid={Boolean(error) || input.invalid} />
    </Field>
  )
}

export type ChoiceFieldProps<T extends string = string> = Omit<FieldLayoutProps, 'layout'> &
  ChoiceGroupProps<T> & {
    fieldLayout?: FieldProps['layout']
  }

export function ChoiceField<T extends string = string>({
  label,
  required,
  error,
  hint,
  fieldLayout,
  htmlFor,
  fieldClassName,
  ...input
}: ChoiceFieldProps<T>) {
  return (
    <Field label={label} htmlFor={htmlFor} required={required} error={error} hint={hint} layout={fieldLayout} className={fieldClassName}>
      <ChoiceGroup {...input} />
    </Field>
  )
}
