/**
 * Input limits from the CRM database design (Lead_Database / Opportunity_Database):
 *   CRM.LeadMain, LeadNotesDetail, LeadActivityDetail, OpportunityMain, OpportunityActivityDetail.
 */
export const FIELD_LIMITS = {
  /** LeadMain.LeadName varchar(200) */
  leadName: 200,
  /** LeadMain.Description varchar(1000) */
  leadDescription: 1000,
  /** OpportunityMain.OpportunityName varchar(200) */
  opportunityName: 200,
  /** Lead / OpportunityActivityDetail.Subject varchar(200) */
  activitySubject: 200,
  /** Lead / OpportunityActivityDetail.NotesOutcome varchar(1000) */
  activityNotesOutcome: 1000,
  /** LeadNotesDetail.Discussion varchar(1000) */
  noteDiscussion: 1000,
  /** LeadNotesDetail.OriginatedBy varchar(200) */
  noteOriginatedBy: 200,
  /** In-app note title (not a server column) — kept to the same 200 as other titles. */
  noteTitle: 200,
  /**
   * EstimatedValue / OpportunityValue are `money` (up to 922,337,203,685,477.5807): at most 15 whole
   * digits; the forms allow 2 decimals.
   */
  moneyIntegerDigits: 15,
  moneyDecimals: 2,
} as const

/** Keeps a typed amount within `money`: 15 whole digits, 2 decimals. Returns the trimmed value. */
export function clampMoneyInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '')
  const [whole = '', ...rest] = cleaned.split('.')
  const decimals = rest.join('').slice(0, FIELD_LIMITS.moneyDecimals)
  const wholeDigits = whole.slice(0, FIELD_LIMITS.moneyIntegerDigits)
  return rest.length ? `${wholeDigits}.${decimals}` : wholeDigits
}
