import type { UserLoginEvent, UserSignupEvent, UserValidateEvent } from '@netlify/functions'

import { isAdminEmail } from '../../src/lib/admin-emails'

// Only admin emails may create an account; they get the `admin` role for the dashboard

function withAdminRole<U extends { appMetadata?: Record<string, unknown> }>(user: U): U {
  const roles = Array.isArray(user.appMetadata?.roles) ? (user.appMetadata.roles as string[]) : []
  return {
    ...user,
    appMetadata: { ...user.appMetadata, roles: [...new Set([...roles, 'admin'])] },
  }
}

export default {
  userValidate(event: UserValidateEvent) {
    if (!isAdminEmail(event.user.email)) return event.deny()
  },
  userSignup(event: UserSignupEvent) {
    if (!isAdminEmail(event.user.email)) return event.deny()
    return { user: withAdminRole(event.user) }
  },
  userLogin(event: UserLoginEvent) {
    if (isAdminEmail(event.user.email)) return { user: withAdminRole(event.user) }
  },
}
