/**
 * Spectrum user search — options for owner / assignee / salesperson pickers.
 *
 *   GET /api/security/users?keywordSearch=priya
 */
import { spectrumEndpoints } from './endpoints'
import { assertSuccess, type SpectrumResponse, type UserOption } from './fillValues'
import { http } from './http'
import { withQuery } from './query'

export type { UserOption } from './fillValues'

/** The endpoint rejects an empty keyword (400), so an empty search asks for this instead. */
export const DEFAULT_USER_KEYWORD = 'a'

export async function searchUsers(keywordSearch = ''): Promise<UserOption[]> {
  const url = withQuery(spectrumEndpoints.users.search, { keywordSearch: keywordSearch.trim() || DEFAULT_USER_KEYWORD })
  const response = await http.get<SpectrumResponse<UserOption[] | null>>(url)
  assertSuccess(response)
  return response.data ?? []
}

/** Name shown and stored for a user — printing name, else login id. */
export function userDisplayName(user: Pick<UserOption, 'printingName' | 'loginId'>) {
  return user.printingName?.trim() || user.loginId
}
