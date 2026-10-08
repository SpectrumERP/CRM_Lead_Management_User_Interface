import type { ApiErrorCode } from '../api/errors'

export interface ErrorCopy {
  title: string
  message: string
}

/**
 * User-facing copy for every API error. Screens look this up by code —
 * they never hardcode these strings or show the code itself.
 */
export const ERROR_COPY: Record<ApiErrorCode, ErrorCopy> = {
  UNAUTHENTICATED: {
    title: 'Session expired',
    message: 'Please sign in to continue.',
  },
  INVALID_CREDENTIALS: {
    title: 'Sign in failed',
    message: 'Invalid email or password.',
  },
  FORBIDDEN: {
    title: 'Access denied',
    message: 'You do not have permission to do that.',
  },
  VALIDATION: {
    title: 'Check your input',
    message: 'Please check the highlighted fields.',
  },
  NOT_FOUND: {
    title: 'Not found',
    message: 'That record was not found.',
  },
  METHOD_NOT_ALLOWED: {
    title: 'Not supported',
    message: 'This action is not supported.',
  },
  CONFLICT: {
    title: 'Already exists',
    message: 'This record already exists.',
  },
  PAYLOAD_TOO_LARGE: {
    title: 'Too large',
    message: 'This request is too large.',
  },
  RATE_LIMIT: {
    title: 'Too many attempts',
    message: 'Too many attempts. Try again in a few minutes.',
  },
  TIMEOUT: {
    title: 'Timed out',
    message: 'The request timed out. Try again.',
  },
  NETWORK: {
    title: 'Connection problem',
    message: 'Network error. Try again.',
  },
  SERVER: {
    title: 'Server error',
    message: 'The server could not complete that request.',
  },
  UNKNOWN: {
    title: 'Something went wrong',
    message: 'This page hit an unexpected error. Retry to continue, or refresh if it keeps happening.',
  },
}

/** Templates with `{placeholders}` — filled by getErrorMessage / interpolate. */
export const ERROR_TEMPLATES = {
  notFoundResource: '{resource} was not found.',
} as const

export const PAGE_COPY = {
  forbidden: {
    title: "You don’t have access",
    body: 'This area is limited to administrators. Ask your admin if you need access.',
    action: 'Back to Dashboard',
  },
  login: {
    product: 'Spectrum ERP CRM',
    phase: 'Lead management · Phase 1',
    brandLead: 'One platform for Finance, Inventory, Sales, Production and more — built for modern enterprises.',
    heroBadge: 'Secure access for Spectrum ERP',
    heroTitle: 'Sign in to your',
    heroTitleAccent: 'ERP workspace',
    rights: 'Force Intellect Pvt. Ltd. All rights reserved.',
    idLabel: 'Email or Login ID',
    idPlaceholder: 'e.g. edp or name@company.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    capsLock: 'Caps Lock is on',
    help: 'Trouble signing in? Contact your Spectrum ERP administrator.',
    secure: 'Encrypted connection · Same account as Spectrum ERP',
    headline: 'Welcome back',
    subtitle: 'Sign in with your Spectrum ERP account',
    submit: 'Sign in',
    pending: 'Signing in…',
    emailRequired: 'Enter your email or login ID.',
    passwordRequired: 'Enter your password.',
    emailInvalid: 'Enter a valid email address.',
    highlights: [
      { title: 'Finance & Inventory', body: 'Accounts, stock and purchasing in one place.' },
      { title: 'Sales & CRM', body: 'Leads, opportunities and customers through to close.' },
      { title: 'Tasks & Meetings', body: 'Plan work, track follow-ups and meeting minutes.' },
    ],
  },
  errorState: {
    title: ERROR_COPY.UNKNOWN.title,
    fallback: 'Unable to load data. Check your connection and try again.',
  },
  leadLoadFailed: 'Lead {id} could not be loaded. It may have been removed or the ID is invalid.',
  pageLoading: 'Loading',
  clearFilters: 'Clear filters',
  pagination: {
    showing: 'Showing {start}–{end} of {total}',
    first: 'First page',
    previous: 'Previous page',
    next: 'Next page',
    last: 'Last page',
    page: 'Page {page}',
  },
} as const

export function interpolate(template: string, vars?: Record<string, string>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => vars[key] ?? `{${key}}`)
}

export function getErrorCopy(code: ApiErrorCode): ErrorCopy {
  return ERROR_COPY[code] ?? ERROR_COPY.UNKNOWN
}

export function getErrorTitle(code: ApiErrorCode): string {
  return getErrorCopy(code).title
}

export function getErrorMessage(code: ApiErrorCode, vars?: Record<string, string>): string {
  return interpolate(getErrorCopy(code).message, vars)
}

export function getNotFoundMessage(resource?: string): string {
  if (!resource) return getErrorMessage('NOT_FOUND')
  return interpolate(ERROR_TEMPLATES.notFoundResource, { resource })
}
