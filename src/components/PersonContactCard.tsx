import { ContactHoverCard, type ContactHoverCardProps } from '../ui'
import { SALESPERSONS } from '../data/businessEntities'
import type { Contact } from '../data/contacts'
import { normalizeOrgName, type Lead } from '../data/leads'

export type PersonContactFields = Pick<
  ContactHoverCardProps,
  'name' | 'email' | 'phone' | 'company' | 'designation' | 'primary'
>

export type PersonContactCardProps = PersonContactFields & {
  /** Optional catalog used to fill missing details when only a name is known. */
  contacts?: Contact[]
  placement?: ContactHoverCardProps['placement']
  layer?: ContactHoverCardProps['layer']
}

/** Builds a Force Intellect mailbox from a salesperson display name. */
export function salespersonEmail(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .join('.')
  return slug ? `${slug}@forceintellect.com` : ''
}

/** Match a person against the contacts catalog by email, then name + org. */
export function findContactForLead(
  contacts: Contact[],
  options: { name: string; email?: string; companyName?: string },
): Contact | undefined {
  const email = options.email?.trim()
  const emailHit = email
    ? contacts.find((item) => item.email.toLowerCase() === email.toLowerCase())
    : undefined
  if (emailHit) return emailHit

  const byName = contacts.filter((item) => item.name === options.name)
  if (byName.length === 0) return undefined
  if (!options.companyName) return byName[0]

  return (
    byName.find(
      (item) =>
        normalizeOrgName(item.businessEntityName) === normalizeOrgName(options.companyName!),
    ) ?? byName[0]
  )
}

/** Resolve a person by name against sales roster and/or contacts catalog. */
export function resolvePersonContact(
  name: string,
  options: {
    contacts?: Contact[]
    email?: string
    phone?: string
    company?: string
    designation?: string
    primary?: boolean
  } = {},
): PersonContactFields {
  const contacts = options.contacts ?? []
  const catalog = findContactForLead(contacts, {
    name,
    email: options.email,
    companyName: options.company,
  })

  if (SALESPERSONS.includes(name)) {
    return {
      name,
      email: options.email || catalog?.email || salespersonEmail(name),
      phone: options.phone || catalog?.mobile || '',
      company: options.company || catalog?.businessEntityName || 'Force Intellect',
      designation: options.designation || catalog?.designation || 'Sales',
      primary: options.primary ?? false,
    }
  }

  if (catalog) {
    return {
      name: catalog.name,
      email: options.email || catalog.email,
      phone: options.phone || catalog.mobile,
      company: options.company || catalog.businessEntityName,
      designation: options.designation || catalog.designation,
      primary: options.primary ?? Boolean(catalog.isPrimary),
    }
  }

  return {
    name,
    email: options.email || '',
    phone: options.phone || '',
    company: options.company || '',
    designation: options.designation,
    primary: options.primary ?? false,
  }
}

/** Resolve the primary contact shown for a lead row/card. */
export function resolveLeadPrimaryContact(lead: Lead, contacts: Contact[] = []): PersonContactFields {
  const catalog = findContactForLead(contacts, {
    name: lead.contactPerson,
    email: lead.email,
    companyName: lead.companyName,
  })

  return {
    name: catalog?.name ?? lead.contactPerson,
    email: catalog?.email ?? lead.email,
    phone: catalog?.mobile ?? lead.phone,
    company: catalog?.businessEntityName ?? lead.companyName,
    designation: catalog?.designation,
    primary: catalog?.isPrimary ?? true,
  }
}

/**
 * Shared contact-name trigger used across lists, kanban, activities, and timeline.
 * Wraps the UI `ContactHoverCard` and fills missing details from sales/contacts data.
 */
export function PersonContactCard({
  name,
  email,
  phone,
  company,
  designation,
  primary,
  contacts,
  placement,
  layer,
}: PersonContactCardProps) {
  const resolved = resolvePersonContact(name, {
    contacts,
    email,
    phone,
    company,
    designation,
    primary,
  })
  return <ContactHoverCard {...resolved} placement={placement} layer={layer} />
}

/** Lead primary contact card — resolves catalog details when available. */
export function LeadPrimaryContactCard({
  lead,
  contact,
  contacts = [],
  placement,
  layer,
}: {
  lead: Lead
  contact?: Contact
  contacts?: Contact[]
  placement?: ContactHoverCardProps['placement']
  layer?: ContactHoverCardProps['layer']
}) {
  const resolved = contact
    ? {
        name: contact.name,
        email: contact.email || lead.email,
        phone: contact.mobile || lead.phone,
        company: contact.businessEntityName || lead.companyName,
        designation: contact.designation,
        primary: contact.isPrimary ?? true,
      }
    : resolveLeadPrimaryContact(lead, contacts)

  return <ContactHoverCard {...resolved} placement={placement} layer={layer} />
}
