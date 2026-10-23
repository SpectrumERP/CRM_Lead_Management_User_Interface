import { describe, expect, it } from 'vitest'
import {
  closingStatusType,
  isConvertedStatus,
  leadStatusOptions,
  leadStatusStageError,
  opportunityStatusOptions,
  opportunityStatusStageError,
  statusRule,
  validateStatusChange,
} from './statusChange'

describe('status change rules', () => {
  it('requires the remark when the status has isRemarkRequired', () => {
    const onHold = { no: 4, name: 'On Hold', isRemarkMandatory: true }
    const open = { no: 1, name: 'Open', isRemarkMandatory: false }
    expect(statusRule('Lead', onHold).isRemarkMandatory).toBe(true)
    expect(statusRule('Opportunity', open).isRemarkMandatory).toBe(false)

    expect(validateStatusChange({ newStatus: onHold, currentStatusName: 'Open', remark: '  ' }, statusRule('Lead', onHold))).toEqual({
      remark: 'Remark is mandatory for status On Hold',
    })
    expect(validateStatusChange({ newStatus: onHold, currentStatusName: 'Open', remark: 'Budget frozen' }, statusRule('Lead', onHold))).toEqual({})
    expect(validateStatusChange({ newStatus: open, currentStatusName: 'On Hold', remark: '' }, statusRule('Lead', open))).toEqual({})
  })

  it('rejects the current status', () => {
    const open = { no: 1, name: 'Open' }
    expect(validateStatusChange({ newStatus: open, currentStatusName: 'open', remark: '' }, statusRule('Lead', open)).status).toBe('Status is already Open')
  })

  it('lists the fill-values statuses with their remark rule (same list on view pages and edit forms)', () => {
    expect(leadStatusOptions({ leadStatuses: [{ leadStatusNo: 2, code: 'LT0002', leadStatusName: 'Cold', isRemarkRequired: true }] })).toEqual([
      { no: 2, name: 'Cold', isRemarkMandatory: true },
    ])
    expect(opportunityStatusOptions({ opportunityStatuses: [{ opportunityStatusNo: 4, opportunityStatusName: 'Won', isRemarkRequired: false }] })).toEqual([
      { no: 4, name: 'Won', isRemarkMandatory: false, isWon: undefined },
    ])
    expect(leadStatusOptions(null)).toEqual([])
  })

  it('carries the stage each status is linked to (fill values leadStageNo / opportunityStageNo)', () => {
    const [cold, open] = leadStatusOptions({
      leadStages: [{ leadStageNo: 3, code: 'LG3', leadStageName: 'Qualified', sequence: 3 }],
      leadStatuses: [
        { leadStatusNo: 2, code: 'LT2', leadStatusName: 'Cold', leadStageNo: 3 },
        { leadStatusNo: 1, code: 'LT1', leadStatusName: 'Open', leadStageNo: null },
      ],
    })
    expect(cold).toMatchObject({ stageName: 'Qualified', stageNo: 3 })
    expect(open.stageName).toBeUndefined()
    expect(open.stageNo).toBeUndefined()
    const [won] = opportunityStatusOptions({
      opportunityStages: [{ opportunityStageNo: 9, opportunityStageName: 'Closed', sequence: 9 }],
      opportunityStatuses: [{ opportunityStatusNo: 4, opportunityStatusName: 'Won', opportunityStageNo: 9 }],
    })
    expect(won.stageName).toBe('Closed')
  })

  it('lead: a status linked to a stage must go with that stage', () => {
    const cold = { no: 2, name: 'Cold', stageName: 'Qualified' }
    expect(leadStatusStageError(cold, 'qualified')).toBeUndefined()
    expect(leadStatusStageError(cold, 'New')).toBe('Status "Cold" belongs to the stage "Qualified". Select that stage, or another status.')
    expect(leadStatusStageError({ no: 1, name: 'Open' }, 'New')).toBeUndefined()
  })

  it('opportunity: only a Won or Lost status must go with its linked stage', () => {
    expect(closingStatusType({ no: 4, name: 'Closed Won' })).toBe('Won')
    expect(closingStatusType({ no: 5, name: 'Lost' })).toBe('Lost')
    expect(closingStatusType({ no: 6, name: 'On Hold', typeName: 'Won' })).toBe('Won')
    expect(closingStatusType({ no: 1, name: 'Open' })).toBeUndefined()
    expect(opportunityStatusStageError({ no: 5, name: 'Lost', stageName: 'Closed' }, 'Negotiation')).toContain('belongs to the stage "Closed"')
    expect(opportunityStatusStageError({ no: 1, name: 'Open', stageName: 'Closed' }, 'Negotiation')).toBeUndefined()
  })

  it('recognises a Converted lead status by its type, else its name', () => {
    expect(isConvertedStatus({ no: 7, name: 'Converted' })).toBe(true)
    expect(isConvertedStatus({ no: 8, name: 'Moved', typeName: 'Converted' })).toBe(true)
    expect(isConvertedStatus({ no: 1, name: 'Open' })).toBe(false)
  })
})
