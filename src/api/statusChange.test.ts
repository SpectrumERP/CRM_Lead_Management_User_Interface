import { describe, expect, it } from 'vitest'
import { leadStatusOptions, opportunityStatusOptions, statusRule, validateStatusChange } from './statusChange'

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
})
