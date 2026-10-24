import { useEffect } from 'react'
import { BootLogin } from '../ui'

/** CRM sign-in is owned by Spectrum ERP in every environment. */
export default function Login() {
  const shellUrl = String(import.meta.env.VITE_SPECTRUM_URL ?? '').replace(/\/+$/, '')
  const loginUrl = `${shellUrl}/login`

  useEffect(() => {
    window.location.replace(loginUrl)
  }, [loginUrl])

  return <BootLogin label="Opening Spectrum ERP sign-in" />
}
