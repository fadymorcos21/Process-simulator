import { validateScenarioInput } from '../domain/validation'
import { PROCESS_SEQUENCE, type CapacityResult, type ProcessId, type ScenarioInput } from '../domain/types'

export type ProcessDemandMap = Record<ProcessId, number>

type CycleTimeSelector = (cell: ScenarioInput['components'][number]['cycleTimes'][ProcessId]) => number

export function sanitizeInteger(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.floor(value))
}

export function getEffectiveMinutesPerShiftPerMachine(input: ScenarioInput): number {
  const grossShiftMinutes = input.calendar.hoursPerShift * 60
  const netShiftMinutes = Math.max(0, grossShiftMinutes - input.calendar.breakMinutesPerShift)
  const efficiencyFactor = input.calendar.efficiencyPct / 100
  return netShiftMinutes * efficiencyFactor
}

export function getTotalShiftBlocksPerWeek(input: ScenarioInput): number {
  const weekdayBlocks = input.calendar.daysPerWeek * input.calendar.shiftsPerDay
  const weekendBlocks = input.calendar.weekendDaysPerWeek * input.calendar.weekendShiftsPerDay
  return weekdayBlocks + weekendBlocks
}

export function getEffectiveMinutesPerMachinePerWeek(input: ScenarioInput): number {
  return getEffectiveMinutesPerShiftPerMachine(input) * getTotalShiftBlocksPerWeek(input)
}

export function buildDemandMinutesPerFinalUnit(
  input: ScenarioInput,
  selector: CycleTimeSelector,
): ProcessDemandMap {
  return PROCESS_SEQUENCE.reduce(
    (acc, processId) => {
      const totalDemandForProcess = input.components.reduce((sum, component) => {
        const cycleTime = Math.max(0, selector(component.cycleTimes[processId]))
        const safeOvenBatchSize = Math.max(1, component.ovenBatchSize)
        const perFinalUnitDemand =
          processId === 'oven'
            ? (component.quantityPerFinalUnit * cycleTime) / safeOvenBatchSize
            : component.quantityPerFinalUnit * cycleTime

        return sum + perFinalUnitDemand
      }, 0)

      acc[processId] = totalDemandForProcess
      return acc
    },
    {} as ProcessDemandMap,
  )
}

export function buildDeterministicDemandMinutesPerFinalUnit(input: ScenarioInput): ProcessDemandMap {
  return buildDemandMinutesPerFinalUnit(input, (cell) => cell.baseMinutes)
}

export function calculateCapacityFromDemand(
  input: ScenarioInput,
  demandMinutesPerFinalUnit: ProcessDemandMap,
): CapacityResult {
  const target = input.targetFinalUnitsPerWeek
  const effectiveMinutesPerShiftPerMachine = getEffectiveMinutesPerShiftPerMachine(input)
  const effectiveMinutesPerMachinePerWeek = getEffectiveMinutesPerMachinePerWeek(input)

  const processResults = PROCESS_SEQUENCE.map((processId) => {
    const processResources = input.resources[processId]
    const machines = sanitizeInteger(processResources.machines)
    const operators = sanitizeInteger(processResources.operators)
    const activeStations = processId === 'oven' ? machines : Math.min(machines, operators)
    const demandMinutes = Math.max(0, demandMinutesPerFinalUnit[processId])
    const availableMinutesForProcess = activeStations * effectiveMinutesPerMachinePerWeek
    const requiredMinutesAtTarget = target * demandMinutes

    const capacityFinalUnitsPerWeek =
      demandMinutes > 0 && activeStations > 0 ? availableMinutesForProcess / demandMinutes : 0
    const requiredHoursAtTarget = requiredMinutesAtTarget / 60
    const requiredShiftsAtTarget =
      activeStations > 0 && effectiveMinutesPerShiftPerMachine > 0
        ? requiredMinutesAtTarget / (activeStations * effectiveMinutesPerShiftPerMachine)
        : Number.POSITIVE_INFINITY
    const activeDaysPerWeek =
      (input.calendar.shiftsPerDay > 0 ? input.calendar.daysPerWeek : 0) +
      (input.calendar.weekendShiftsPerDay > 0 ? input.calendar.weekendDaysPerWeek : 0)
    const averageShiftBlocksPerActiveDay =
      activeDaysPerWeek > 0 ? getTotalShiftBlocksPerWeek(input) / activeDaysPerWeek : 0
    const requiredDaysAtTarget =
      averageShiftBlocksPerActiveDay > 0
        ? requiredShiftsAtTarget / averageShiftBlocksPerActiveDay
        : Number.POSITIVE_INFINITY
    const utilizationPctAtTarget =
      availableMinutesForProcess > 0
        ? (requiredMinutesAtTarget / availableMinutesForProcess) * 100
        : Number.POSITIVE_INFINITY

    return {
      processId,
      demandMinutesPerFinalUnit: demandMinutes,
      activeStations,
      machines,
      operators,
      capacityFinalUnitsPerWeek,
      requiredHoursAtTarget,
      requiredShiftsAtTarget,
      requiredDaysAtTarget,
      utilizationPctAtTarget,
    }
  })

  const sortedByCapacity = [...processResults].sort(
    (left, right) => left.capacityFinalUnitsPerWeek - right.capacityFinalUnitsPerWeek,
  )
  const bottleneck = sortedByCapacity[0]
  const maxFinalUnitsPerWeek = bottleneck?.capacityFinalUnitsPerWeek ?? 0
  const bottleneckProcessId = bottleneck?.processId ?? PROCESS_SEQUENCE[0]
  const lineCycleTimeMinutesPerFinalUnit =
    bottleneck && bottleneck.activeStations > 0
      ? bottleneck.demandMinutesPerFinalUnit / bottleneck.activeStations
      : Number.POSITIVE_INFINITY

  return {
    targetFinalUnitsPerWeek: target,
    effectiveMinutesPerShiftPerMachine,
    effectiveMinutesPerMachinePerWeek,
    processResults,
    maxFinalUnitsPerWeek,
    bottleneckProcessId,
    lineCycleTimeMinutesPerFinalUnit,
    feasibleAtTarget: maxFinalUnitsPerWeek >= target,
  }
}

export function calculateCapacity(input: ScenarioInput): CapacityResult {
  const validInput = validateScenarioInput(input)
  const demandMinutesPerFinalUnit = buildDeterministicDemandMinutesPerFinalUnit(validInput)
  return calculateCapacityFromDemand(validInput, demandMinutesPerFinalUnit)
}
