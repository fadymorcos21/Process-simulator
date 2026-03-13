import { createDefaultPlannerLocks } from '../domain/constants'
import { validateScenarioInput } from '../domain/validation'
import {
  PROCESS_SEQUENCE,
  type PlannerObjectiveScore,
  type PlannerRecommendation,
  type PlannerRequest,
  type ProcessId,
  type ProcessResourceMap,
  type ScenarioInput,
} from '../domain/types'
import {
  buildDeterministicDemandMinutesPerFinalUnit,
  calculateCapacity,
  getEffectiveMinutesPerMachinePerWeek,
  sanitizeInteger,
} from './capacity'

function requiresOperator(processId: ProcessId): boolean {
  return processId !== 'oven'
}

function lexicographicLessThan(left: PlannerObjectiveScore, right: PlannerObjectiveScore): boolean {
  if (left.totalOperators !== right.totalOperators) {
    return left.totalOperators < right.totalOperators
  }

  if (left.totalMachines !== right.totalMachines) {
    return left.totalMachines < right.totalMachines
  }

  return left.shiftsPerDay < right.shiftsPerDay
}

function normalizePlannerRequest(input: ScenarioInput, request?: Partial<PlannerRequest>): PlannerRequest {
  const defaults = createDefaultPlannerLocks()

  const machinesLocked = PROCESS_SEQUENCE.reduce(
    (acc, processId) => {
      acc[processId] = request?.locks?.machinesLocked?.[processId] ?? defaults.machinesLocked[processId]
      return acc
    },
    {} as PlannerRequest['locks']['machinesLocked'],
  )

  const operatorsLocked = PROCESS_SEQUENCE.reduce(
    (acc, processId) => {
      acc[processId] =
        request?.locks?.operatorsLocked?.[processId] ?? defaults.operatorsLocked[processId]
      return acc
    },
    {} as PlannerRequest['locks']['operatorsLocked'],
  )

  return {
    targetFinalUnitsPerWeek: Math.max(
      0,
      request?.targetFinalUnitsPerWeek ?? input.targetFinalUnitsPerWeek,
    ),
    maxShiftsPerDay: Math.max(
      1,
      sanitizeInteger(request?.maxShiftsPerDay ?? input.calendar.shiftsPerDay),
    ),
    maxMachinesPerProcess: Math.max(1, sanitizeInteger(request?.maxMachinesPerProcess ?? 15)),
    maxOperatorsPerProcess: Math.max(1, sanitizeInteger(request?.maxOperatorsPerProcess ?? 15)),
    locks: {
      shiftsPerDayLocked: request?.locks?.shiftsPerDayLocked ?? defaults.shiftsPerDayLocked,
      machinesLocked,
      operatorsLocked,
    },
  }
}

function cloneResources(resources: ProcessResourceMap): ProcessResourceMap {
  return {
    masking: { ...resources.masking },
    sandblasting: { ...resources.sandblasting },
    painting: { ...resources.painting },
    oven: { ...resources.oven },
  }
}

function buildEmptyRecommendation(
  input: ScenarioInput,
  targetFinalUnitsPerWeek: number,
  reason: string,
): PlannerRecommendation {
  const baselineCapacity = calculateCapacity(input)

  return {
    feasible: false,
    reason,
    targetFinalUnitsPerWeek,
    recommendedScenario: input,
    recommendedCapacity: baselineCapacity,
    shiftsDelta: 0,
    processDeltas: PROCESS_SEQUENCE.map((processId) => ({
      processId,
      currentMachines: input.resources[processId].machines,
      recommendedMachines: input.resources[processId].machines,
      machinesDelta: 0,
      currentOperators: input.resources[processId].operators,
      recommendedOperators: input.resources[processId].operators,
      operatorsDelta: 0,
    })),
    objective: {
      totalOperators: PROCESS_SEQUENCE.reduce(
        (sum, processId) => sum + sanitizeInteger(input.resources[processId].operators),
        0,
      ),
      totalMachines: PROCESS_SEQUENCE.reduce(
        (sum, processId) => sum + sanitizeInteger(input.resources[processId].machines),
        0,
      ),
      shiftsPerDay: sanitizeInteger(input.calendar.shiftsPerDay),
    },
  }
}

export function planToTarget(
  input: ScenarioInput,
  request?: Partial<PlannerRequest>,
): PlannerRecommendation {
  const validInput = validateScenarioInput(input)
  const normalizedRequest = normalizePlannerRequest(validInput, request)
  const demandByProcess = buildDeterministicDemandMinutesPerFinalUnit(validInput)
  const baseShiftCount = sanitizeInteger(validInput.calendar.shiftsPerDay)

  const shiftsToTry = normalizedRequest.locks.shiftsPerDayLocked
    ? [baseShiftCount]
    : Array.from({ length: normalizedRequest.maxShiftsPerDay }, (_, index) => index + 1)

  let bestRecommendation: PlannerRecommendation | null = null

  for (const shiftsPerDayCandidate of shiftsToTry) {
    const candidateScenario: ScenarioInput = {
      ...validInput,
      calendar: {
        ...validInput.calendar,
        shiftsPerDay: shiftsPerDayCandidate,
      },
      resources: cloneResources(validInput.resources),
      targetFinalUnitsPerWeek: normalizedRequest.targetFinalUnitsPerWeek,
    }

    const effectiveMinutesPerMachinePerWeek = getEffectiveMinutesPerMachinePerWeek(candidateScenario)

    if (effectiveMinutesPerMachinePerWeek <= 0) {
      continue
    }

    let candidateFeasible = true

    for (const processId of PROCESS_SEQUENCE) {
      const processDemand = demandByProcess[processId]
      const requiredActiveStations = Math.ceil(
        (normalizedRequest.targetFinalUnitsPerWeek * processDemand) / effectiveMinutesPerMachinePerWeek,
      )

      const currentMachines = sanitizeInteger(validInput.resources[processId].machines)
      const currentOperators = sanitizeInteger(validInput.resources[processId].operators)
      const machineLocked = normalizedRequest.locks.machinesLocked[processId]
      const operatorLocked = normalizedRequest.locks.operatorsLocked[processId]

      let recommendedMachines = currentMachines
      let recommendedOperators = currentOperators

      if (machineLocked && operatorLocked) {
        const lockedActiveStations = requiresOperator(processId)
          ? Math.min(currentMachines, currentOperators)
          : currentMachines
        if (lockedActiveStations < requiredActiveStations) {
          candidateFeasible = false
          break
        }
      } else if (machineLocked) {
        if (currentMachines < requiredActiveStations) {
          candidateFeasible = false
          break
        }
        if (requiresOperator(processId)) {
          recommendedOperators = Math.min(normalizedRequest.maxOperatorsPerProcess, requiredActiveStations)
        }
      } else if (operatorLocked) {
        if (requiresOperator(processId) && currentOperators < requiredActiveStations) {
          candidateFeasible = false
          break
        }
        recommendedMachines = Math.min(normalizedRequest.maxMachinesPerProcess, requiredActiveStations)
      } else {
        recommendedMachines = Math.min(normalizedRequest.maxMachinesPerProcess, requiredActiveStations)
        if (requiresOperator(processId)) {
          recommendedOperators = Math.min(normalizedRequest.maxOperatorsPerProcess, requiredActiveStations)
        }
      }

      if (
        recommendedMachines < requiredActiveStations ||
        (requiresOperator(processId) && recommendedOperators < requiredActiveStations)
      ) {
        candidateFeasible = false
        break
      }

      candidateScenario.resources[processId] = {
        machines: sanitizeInteger(recommendedMachines),
        operators: sanitizeInteger(recommendedOperators),
      }
    }

    if (!candidateFeasible) {
      continue
    }

    const candidateCapacity = calculateCapacity(candidateScenario)

    if (candidateCapacity.maxFinalUnitsPerWeek < normalizedRequest.targetFinalUnitsPerWeek) {
      continue
    }

    const objective: PlannerObjectiveScore = {
      totalOperators: PROCESS_SEQUENCE.reduce(
        (sum, processId) => sum + candidateScenario.resources[processId].operators,
        0,
      ),
      totalMachines: PROCESS_SEQUENCE.reduce(
        (sum, processId) => sum + candidateScenario.resources[processId].machines,
        0,
      ),
      shiftsPerDay: shiftsPerDayCandidate,
    }

    const processDeltas = PROCESS_SEQUENCE.map((processId) => {
      const currentMachines = sanitizeInteger(validInput.resources[processId].machines)
      const currentOperators = sanitizeInteger(validInput.resources[processId].operators)
      const recommendedMachines = sanitizeInteger(candidateScenario.resources[processId].machines)
      const recommendedOperators = sanitizeInteger(candidateScenario.resources[processId].operators)

      return {
        processId,
        currentMachines,
        recommendedMachines,
        machinesDelta: recommendedMachines - currentMachines,
        currentOperators,
        recommendedOperators,
        operatorsDelta: recommendedOperators - currentOperators,
      }
    })

    const currentRecommendation: PlannerRecommendation = {
      feasible: true,
      reason: 'Feasible plan found.',
      targetFinalUnitsPerWeek: normalizedRequest.targetFinalUnitsPerWeek,
      recommendedScenario: candidateScenario,
      recommendedCapacity: candidateCapacity,
      shiftsDelta: shiftsPerDayCandidate - baseShiftCount,
      processDeltas,
      objective,
    }

    if (
      bestRecommendation === null ||
      lexicographicLessThan(currentRecommendation.objective, bestRecommendation.objective)
    ) {
      bestRecommendation = currentRecommendation
    }
  }

  if (bestRecommendation) {
    return bestRecommendation
  }

  return buildEmptyRecommendation(
    validInput,
    normalizedRequest.targetFinalUnitsPerWeek,
    'No feasible plan within the provided lock and max limits.',
  )
}
