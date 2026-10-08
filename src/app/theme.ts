import { useSyncExternalStore } from 'react'

/**
 * Light / dark theme — the same switch and storage key as Task Management (`steelmont-theme`,
 * `html.dark`), so both apps on this origin always show the same theme. CRM starts light when
 * nothing is stored yet.
 */
export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'steelmont-theme'
const listeners = new Set<() => void>()

export function getTheme(): ThemeMode {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function apply(theme: ThemeMode) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  root.setAttribute('data-theme', theme)
  listeners.forEach((notify) => notify())
}

export function setTheme(theme: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* storage blocked — the class still changes for this page */
  }
  apply(theme)
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark')
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  // Another tab / the Task app changed it.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && (event.newValue === 'light' || event.newValue === 'dark')) apply(event.newValue)
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(notify)
    window.removeEventListener('storage', onStorage)
  }
}

export function useTheme(): ThemeMode {
  return useSyncExternalStore(subscribe, getTheme, () => 'light')
}
