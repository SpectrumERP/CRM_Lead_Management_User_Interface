export type AuthRole = 'Admin' | 'Sales Manager'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: AuthRole
  jobTitle: string
  initials: string
}
