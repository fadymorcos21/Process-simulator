import {
  type ComponentSpec,
  type CycleTimeCell,
  type PlannerLocks,
  PROCESS_SEQUENCE,
  type ProcessId,
  type ScenarioInput,
} from './types'

export const PROCESS_LABELS: Record<ProcessId, string> = {
  masking: 'Masking',
  sandblasting: 'Sandblasting',
  painting: 'Painting',
  oven: 'Oven',
}

const DEFAULT_BASE_CYCLE_MINUTES = 0.5
const DEFAULT_OVEN_BATCH_SIZE = 12

export const DEFAULT_TARGET_FINAL_UNITS_PER_WEEK = 1500

export const DEFAULT_CALENDAR = {
  daysPerWeek: 5,
  shiftsPerDay: 1,
  weekendDaysPerWeek: 2,
  weekendShiftsPerDay: 0,
  hoursPerShift: 8,
  breakMinutesPerShift: 0,
  efficiencyPct: 100,
}

export const DEFAULT_PLANNER_LIMITS = {
  maxShiftsPerDay: 4,
  maxMachinesPerProcess: 15,
  maxOperatorsPerProcess: 15,
}

export function createDefaultCycleTime(
  baseMinutes = DEFAULT_BASE_CYCLE_MINUTES,
): CycleTimeCell {
  return {
    baseMinutes,
  }
}

export function createDefaultComponent(index: number): ComponentSpec {
  const cycleTimes = PROCESS_SEQUENCE.reduce(
    (acc, processId) => {
      acc[processId] = createDefaultCycleTime()
      return acc
    },
    {} as ComponentSpec['cycleTimes'],
  )

  return {
    id: `component-${index + 1}`,
    name: `Component ${index + 1}`,
    quantityPerFinalUnit: 1,
    ovenBatchSize: DEFAULT_OVEN_BATCH_SIZE,
    cycleTimes,
  }
}

export function createDefaultScenario(): ScenarioInput {
  return {
    targetFinalUnitsPerWeek: DEFAULT_TARGET_FINAL_UNITS_PER_WEEK,
    components: Array.from({ length: 6 }, (_, index) => createDefaultComponent(index)),
    resources: {
      masking: { machines: 1, operators: 1 },
      sandblasting: { machines: 1, operators: 1 },
      painting: { machines: 1, operators: 1 },
      oven: { machines: 4, operators: 0 },
    },
    calendar: { ...DEFAULT_CALENDAR },
  }
}

export function createDefaultPlannerLocks(): PlannerLocks {
  return {
    shiftsPerDayLocked: false,
    machinesLocked: PROCESS_SEQUENCE.reduce(
      (acc, processId) => {
        acc[processId] = false
        return acc
      },
      {} as PlannerLocks['machinesLocked'],
    ),
    operatorsLocked: PROCESS_SEQUENCE.reduce(
      (acc, processId) => {
        acc[processId] = false
        return acc
      },
      {} as PlannerLocks['operatorsLocked'],
    ),
  }
}
