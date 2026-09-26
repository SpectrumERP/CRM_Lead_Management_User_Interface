import { matchesAny } from '../utils/text'

export interface OperTaskType {
  OperTaskTypeNo: number
  'Task Type': string
  Code: string
}

export const OPER_TASK_TYPES: OperTaskType[] = [
  { OperTaskTypeNo: 0, 'Task Type': '[All]', Code: '' },
  { OperTaskTypeNo: 4, 'Task Type': 'Breakdown Service', Code: 'TT0004' },
  { OperTaskTypeNo: 1, 'Task Type': 'Inspection', Code: 'TT0001' },
  { OperTaskTypeNo: 2, 'Task Type': 'Maintenance', Code: 'TT0002' },
  { OperTaskTypeNo: 3, 'Task Type': 'Repair', Code: 'TT0003' },
  { OperTaskTypeNo: 5, 'Task Type': 'Replacement', Code: 'TT0005' },
]

/** Selectable types for the lead form (excludes the catch-all row). */
export const SELECTABLE_OPER_TASK_TYPES = OPER_TASK_TYPES.filter((item) => item.OperTaskTypeNo !== 0)

export function matchesOperTaskType(item: OperTaskType, query: string): boolean {
  return matchesAny([item['Task Type'], item.Code, String(item.OperTaskTypeNo)], query)
}
