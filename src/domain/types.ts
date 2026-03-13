export const PROCESS_SEQUENCE = ['masking', 'sandblasting', 'painting', 'oven'] as const

export type ProcessId = (typeof PROCESS_SEQUENCE)[number]

export interface CycleTimeCell {
  baseMinutes: number
}

export type ProcessCycleTimes = Record<ProcessId, CycleTimeCell>

export interface ComponentSpec {
  id: string
  name: string
  quantityPerFinalUnit: number
  ovenBatchSize: number
  cycleTimes: ProcessCycleTimes
}

export interface ProcessResources {
  machines: number
  operators: number
}

export type ProcessResourceMap = Record<ProcessId, ProcessResources>

export interface WorkCalendar {
  daysPerWeek: number
  shiftsPerDay: number
  weekendDaysPerWeek: number
  weekendShiftsPerDay: number
  hoursPerShift: number
  breakMinutesPerShift: number
  efficiencyPct: number
}

export interface ScenarioInput {
  targetFinalUnitsPerWeek: number
  components: ComponentSpec[]
  resources: ProcessResourceMap
  calendar: WorkCalendar
}

export interface ProcessCapacityResult {
  processId: ProcessId
  demandMinutesPerFinalUnit: number
  activeStations: number
  machines: number
  operators: number
  capacityFinalUnitsPerWeek: number
  requiredHoursAtTarget: number
  requiredShiftsAtTarget: number
  requiredDaysAtTarget: number
  utilizationPctAtTarget: number
}

export interface CapacityResult {
  targetFinalUnitsPerWeek: number
  effectiveMinutesPerShiftPerMachine: number
  effectiveMinutesPerMachinePerWeek: number
  processResults: ProcessCapacityResult[]
  maxFinalUnitsPerWeek: number
  bottleneckProcessId: ProcessId
  lineCycleTimeMinutesPerFinalUnit: number
  feasibleAtTarget: boolean
}

export type ProcessLockMap = Record<ProcessId, boolean>

export interface PlannerLocks {
  shiftsPerDayLocked: boolean
  machinesLocked: ProcessLockMap
  operatorsLocked: ProcessLockMap
}

export interface PlannerRequest {
  targetFinalUnitsPerWeek: number
  maxShiftsPerDay: number
  maxMachinesPerProcess: number
  maxOperatorsPerProcess: number
  locks: PlannerLocks
}

export interface ProcessPlanDelta {
  processId: ProcessId
  currentMachines: number
  recommendedMachines: number
  machinesDelta: number
  currentOperators: number
  recommendedOperators: number
  operatorsDelta: number
}

export interface PlannerObjectiveScore {
  totalOperators: number
  totalMachines: number
  shiftsPerDay: number
}

export interface PlannerRecommendation {
  feasible: boolean
  reason: string
  targetFinalUnitsPerWeek: number
  recommendedScenario: ScenarioInput
  recommendedCapacity: CapacityResult
  shiftsDelta: number
  processDeltas: ProcessPlanDelta[]
  objective: PlannerObjectiveScore
}
