// The main admin accounts. They are always admins, even if their Identity account has no `admin` role
// (for example when it was created before the role was assigned automatically).
export const ADMIN_EMAILS = ['fedysaady@gmail.com']

export const isAdminEmail = (email?: string | null) =>
  !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase())
