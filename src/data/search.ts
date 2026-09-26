import { docTypeMeta, type CRMDocument } from './documents';
import type { Lead } from './leads';
import type { Contact } from './contacts';
import type { BusinessEntity } from './businessEntities';
import type { Activity } from './activities';
import type { Meeting } from './meetings';
import { includesIgnoreCase } from '../utils/text';

export type SearchResultType = 'lead' | 'contact' | 'entity' | 'activity' | 'meeting' | 'document';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  meta: string;
  badge?: string;
  badgeBg?: string;
  badgeColor?: string;
  navigateId: string;
  /** for documents: the related record to open */
  relatedRecordId?: string;
  relatedRecordType?: 'lead' | 'entity';
  /** ISO-like date string for sort-by-date */
  sortDate?: string;
  /** Secondary badge (e.g. lead status alongside stage) */
  badge2?: string;
  badge2Bg?: string;
  badge2Color?: string;
}

export interface SearchGroup {
  type: SearchResultType;
  label: string;
  results: SearchResult[];
  total: number;
}

function match(text: string, q: string) {
  return includesIgnoreCase(text, q);
}

const STAGE_COLORS: Record<string, { bg: string; color: string }> = {
  'New':                       { bg: '#f0f4fb', color: '#4a5d82' },
  'Contacted':                 { bg: '#e8f5e9', color: '#2e7d32' },
  'Requirement Identified':    { bg: '#fff8e1', color: '#f57f17' },
  'Under Qualification':       { bg: '#fce4ec', color: '#c62828' },
  'Qualified':                 { bg: '#e3f2fd', color: '#1565c0' },
  'Converted to Opportunity':  { bg: '#ede7f6', color: '#4527a0' },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Open':          { bg: '#e8f5e9', color: '#2e7d32' },
  'On Hold':       { bg: '#fff8e1', color: '#f57f17' },
  'Cold':          { bg: '#eceff1', color: '#546e7a' },
  'Converted':     { bg: '#ede7f6', color: '#4527a0' },
  'Dropped/Lost':  { bg: '#fce4ec', color: '#c62828' },
};

export interface SearchCatalog {
  leads: Lead[];
  contacts: Contact[];
  entities: BusinessEntity[];
  activities: Activity[];
  meetings: Meeting[];
  documents: CRMDocument[];
}

export function searchAll(query: string, catalog: SearchCatalog, maxPerGroup = 5): SearchGroup[] {
  if (query.length < 2) return [];
  const q = query.toLowerCase();

  const leads = catalog.leads.filter(
    (l) =>
      match(l.companyName, q) ||
      match(l.contactPerson, q) ||
      match(l.productsRequired, q) ||
      match(l.id, q) ||
      match(l.leadSource, q) ||
      match(l.leadStage, q) ||
      match(l.leadStatus, q),
  );

  const contacts = catalog.contacts.filter(
    (c) =>
      match(c.name, q) ||
      match(c.businessEntityName, q) ||
      match(c.designation, q) ||
      match(c.department, q) ||
      match(c.email, q) ||
      match(c.mobile, q),
  );

  const entities = catalog.entities.filter(
    (e) =>
      match(e.name, q) ||
      match(e.type, q) ||
      (e.locations.length > 0 && match(e.locations[0].city, q)) ||
      match(e.status, q),
  );

  const activities = catalog.activities.filter(
    (a) =>
      match(a.subject, q) ||
      match(a.type, q) ||
      match(a.leadName, q) ||
      match(a.contactPerson, q) ||
      match(a.assignedTo, q) ||
      match(a.notes, q),
  );

  const meetings = catalog.meetings.filter(
    (m) =>
      match(m.subject, q) ||
      match(m.leadName, q) ||
      match(m.contactPerson, q) ||
      match(m.mode, q) ||
      match(m.location, q) ||
      match(m.notes, q),
  );

  const docs = catalog.documents.filter(
    (d) =>
      match(d.name, q) ||
      match(d.relatedName, q) ||
      match(d.category, q) ||
      match(d.fileType, q) ||
      match(d.uploadedBy, q),
  );

  const groups: SearchGroup[] = [];

  if (leads.length > 0) {
    groups.push({
      type: 'lead',
      label: 'Leads',
      total: leads.length,
      results: leads.slice(0, maxPerGroup).map((l) => {
        const stageCl = STAGE_COLORS[l.leadStage] ?? { bg: '#f0f4fb', color: '#4a5d82' };
        const statusCl = STATUS_COLORS[l.leadStatus] ?? { bg: '#f0f4fb', color: '#4a5d82' };
        return {
          id: l.id,
          type: 'lead' as const,
          navigateId: l.id,
          title: l.companyName,
          subtitle: `${l.contactPerson} · ${l.productsRequired}`,
          meta: l.id,
          badge: l.leadStage,
          badgeBg: stageCl.bg,
          badgeColor: stageCl.color,
          badge2: l.leadStatus,
          badge2Bg: statusCl.bg,
          badge2Color: statusCl.color,
          sortDate: l.createdAt,
        };
      }),
    });
  }

  if (contacts.length > 0) {
    groups.push({
      type: 'contact',
      label: 'Contacts',
      total: contacts.length,
      results: contacts.slice(0, maxPerGroup).map((c) => ({
        id: c.id,
        type: 'contact' as const,
        navigateId: c.id,
        title: c.name,
        subtitle: c.businessEntityName,
        meta: c.designation + (c.department ? ` · ${c.department}` : ''),
        badge: c.status,
        badgeBg: '#f1f5f9',
        badgeColor: '#64748b',
        sortDate: c.createdDate,
      })),
    });
  }

  if (entities.length > 0) {
    groups.push({
      type: 'entity',
      label: 'Business Entities',
      total: entities.length,
      results: entities.slice(0, maxPerGroup).map((e) => ({
        id: e.id,
        type: 'entity' as const,
        navigateId: e.id,
        title: e.name,
        subtitle: e.type + (e.locations.length > 0 ? ` · ${e.locations[0].city}` : ''),
        meta: e.id,
        badge: e.status,
        badgeBg: e.status === 'Customer' ? '#edfbf1' : e.status === 'Prospect' ? '#eef2fb' : '#f1f5f9',
        badgeColor: e.status === 'Customer' ? '#1a8040' : e.status === 'Prospect' ? '#2955a3' : '#64748b',
      })),
    });
  }

  if (activities.length > 0) {
    groups.push({
      type: 'activity',
      label: 'Activities',
      total: activities.length,
      results: activities.slice(0, maxPerGroup).map((a) => ({
        id: a.id,
        type: 'activity' as const,
        navigateId: a.leadId,
        title: a.subject,
        subtitle: `${a.leadName} · ${a.contactPerson}`,
        meta: `${a.scheduleDate}${a.scheduleTime ? ' · ' + a.scheduleTime : ''}`,
        badge: a.type,
        badgeBg: '#f5f3ff',
        badgeColor: '#7c3aed',
        badge2: a.status,
        badge2Bg: a.status === 'Completed' ? '#edfbf1' : a.status === 'Cancelled' ? '#fce4ec' : '#fff8e1',
        badge2Color: a.status === 'Completed' ? '#1a8040' : a.status === 'Cancelled' ? '#c62828' : '#f57f17',
        sortDate: a.scheduleDate,
      })),
    });
  }

  if (meetings.length > 0) {
    groups.push({
      type: 'meeting',
      label: 'Meetings',
      total: meetings.length,
      results: meetings.slice(0, maxPerGroup).map((m) => ({
        id: m.id,
        type: 'meeting' as const,
        navigateId: m.leadId,
        title: m.subject,
        subtitle: `${m.leadName} · ${m.mode}`,
        meta: `${m.date}${m.time ? ' · ' + m.time : ''}`,
        badge: m.mode,
        badgeBg: '#f0f4fb',
        badgeColor: '#4a5d82',
        badge2: m.status,
        badge2Bg: m.status === 'Scheduled' ? '#eef2fb' : m.status === 'Completed' ? '#edfbf1' : '#fff0f0',
        badge2Color: m.status === 'Scheduled' ? '#2955a3' : m.status === 'Completed' ? '#1a8040' : '#c41e1e',
        sortDate: m.date,
      })),
    });
  }

  if (docs.length > 0) {
    groups.push({
      type: 'document',
      label: 'Documents',
      total: docs.length,
      results: docs.slice(0, maxPerGroup).map((d) => {
        const dtm = docTypeMeta(d.fileType);
        return {
          id: d.id,
          type: 'document' as const,
          navigateId: d.relatedId,
          relatedRecordId: d.relatedId,
          relatedRecordType: d.relatedType,
          title: d.name,
          subtitle: `${d.relatedName} · ${d.category}`,
          meta: `${d.fileType} · ${d.size} · ${d.uploadedDate}`,
          badge: d.fileType,
          badgeBg: dtm.bg,
          badgeColor: dtm.color,
          sortDate: d.uploadedDate.replace(/(\d+)\s(\w+)\s(\d+)/, '$3-$2-$1'), // crude parse
        };
      }),
    });
  }

  return groups;
}

export function getTotalResults(groups: SearchGroup[]): number {
  return groups.reduce((s, g) => s + g.total, 0);
}

export function searchByType(query: string, type: SearchResultType, catalog: SearchCatalog): SearchResult[] {
  const groups = searchAll(query, catalog, 1000);
  return groups.find((g) => g.type === type)?.results ?? [];
}
