import { describe, expect, it } from 'vitest'
import { isAdmin, verifyLogin } from './users'

describe('verifyLogin', () => {
  it('accepts the sales manager demo account', async () => {
    const user = await verifyLogin('priya.mehta@forceintellect.com', 'Force@123')
    expect(user?.role).toBe('Sales Manager')
    expect(user).not.toHaveProperty('password')
    expect(user).not.toHaveProperty('passwordHash')
  })

  it('accepts the admin demo account', async () => {
    const user = await verifyLogin('rajiv.anand@forceintellect.com', 'Admin@123')
    expect(user?.role).toBe('Admin')
    expect(isAdmin(user?.role)).toBe(true)
  })

  it('rejects a bad password', async () => {
    expect(await verifyLogin('priya.mehta@forceintellect.com', 'wrongpass')).toBeNull()
  })
})
