export function controlClass(options: {
  invalid?: boolean
  select?: boolean
  className?: string
} = {}): string {
  return [
    'form-input',
    options.select ? 'form-select' : '',
    options.invalid ? 'error' : '',
    options.className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
}
