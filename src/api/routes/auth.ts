import { login, logout, me } from '../auth'
import { register } from '../client'
import { endpoints } from '../endpoints'

register('POST', endpoints.auth.login, ({ body }) => {
  const payload = body as { email?: string; password?: string }
  return login(payload.email ?? '', payload.password ?? '')
})

register('POST', endpoints.auth.logout, () => {
  logout()
})

register('GET', endpoints.auth.me, () => me())
