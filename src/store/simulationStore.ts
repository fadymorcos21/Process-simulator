import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  createDefaultComponent,
  createDefaultPlannerLocks,
  createDefaultScenario,
  DEFAULT_PLANNER_LIMITS,
} from '../domain/constants'
import { PROCESS_SEQUENCE, type PlannerRequest, type ProcessId, type ScenarioInput } from '../domain/types'
import { sanitizeInteger } from '../engine/capacity'

type NumberField =
  | 'targetFinalUnitsPerWeek'
  | 'componentOvenBatchSize'
  | 'daysPerWeek'
  | 'shiftsPerDay'
  | 'weekendDaysPerWeek'
  | 'weekendShiftsPerDay'
  | 'hoursPerShift'
  | 'breakMinutesPerShift'
  | 'efficiencyPct'
  | 'machines'
  | 'operators'
  | 'quantityPerFinalUnit'
  | 'baseMinutes'
  | 'maxShiftsPerDay'
  | 'maxMachinesPerProcess'
  | 'maxOperatorsPerProcess'

export interface PlannerUiSettings {
  maxShiftsPerDay: number
  maxMachinesPerProcess: number
  maxOperatorsPerProcess: number
  locks: PlannerRequest['locks']
}

interface SimulationStore {
  scenario: ScenarioInput
  plannerSettings: PlannerUiSettings
  setTarget: (value: number) => void
  setCalendarValue: (
    field:
      | 'daysPerWeek'
      | 'shiftsPerDay'
      | 'weekendDaysPerWeek'
      | 'weekendShiftsPerDay'
      | 'hoursPerShift'
      | 'breakMinutesPerShift'
      | 'efficiencyPct',
    value: number,
  ) => void
  setResourceValue: (processId: ProcessId, field: 'machines' | 'operators', value: number) => void
  adjustResourceValue: (processId: ProcessId, field: 'machines' | 'operators', delta: number) => void
  setComponentName: (componentId: string, name: string) => void
  setComponentQuantity: (componentId: string, value: number) => void
  setComponentOvenBatchSize: (componentId: string, value: number) => void
  setCycleBase: (componentId: string, processId: ProcessId, value: number) => void
  addComponent: () => void
  removeComponent: (componentId: string) => void
  setPlannerMax: (
    field: 'maxShiftsPerDay' | 'maxMachinesPerProcess' | 'maxOperatorsPerProcess',
    value: number,
  ) => void
  setLockValue: (type: 'machinesLocked' | 'operatorsLocked', processId: ProcessId, value: boolean) => void
  setShiftLock: (value: boolean) => void
  applyScenario: (scenario: ScenarioInput) => void
  reset: () => void
}

function toNumber(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return value
}

function clampToField(value: number, field: NumberField): number {
  const safe = toNumber(value)

  switch (field) {
    case 'targetFinalUnitsPerWeek':
      return Math.max(0, Math.round(safe))
    case 'componentOvenBatchSize':
      return Math.max(1, sanitizeInteger(safe))
    case 'daysPerWeek':
    case 'shiftsPerDay':
      return Math.max(1, sanitizeInteger(safe))
    case 'weekendDaysPerWeek':
      return Math.min(2, Math.max(0, sanitizeInteger(safe)))
    case 'weekendShiftsPerDay':
      return Math.max(0, sanitizeInteger(safe))
    case 'machines':
    case 'operators':
      return Math.max(0, sanitizeInteger(safe))
    case 'quantityPerFinalUnit':
      return Math.max(0, sanitizeInteger(safe))
    case 'maxShiftsPerDay':
    case 'maxMachinesPerProcess':
    case 'maxOperatorsPerProcess':
      return Math.max(1, sanitizeInteger(safe))
    case 'hoursPerShift':
      return Math.max(0.25, safe)
    case 'breakMinutesPerShift':
      return Math.max(0, safe)
    case 'efficiencyPct':
      return Math.min(100, Math.max(0, safe))
    case 'baseMinutes':
      return Math.max(0, safe)
    default:
      return safe
  }
}

const defaultScenario = createDefaultScenario()

const defaultPlannerSettings: PlannerUiSettings = {
  ...DEFAULT_PLANNER_LIMITS,
  locks: createDefaultPlannerLocks(),
}

type PartialComponent = Partial<ScenarioInput['components'][number]>
type LegacyScenarioShape = Partial<ScenarioInput> & { ovenBatchSize?: number | string }

function isPartialComponent(candidate: unknown): candidate is PartialComponent {
  return typeof candidate === 'object' && candidate !== null
}

function normalizeScenario(rawScenario: Partial<ScenarioInput> | undefined): ScenarioInput {
  const base = createDefaultScenario()
  if (!rawScenario) {
    return base
  }

  const legacyScenario = rawScenario as LegacyScenarioShape
  const legacyOvenBatchSize = clampToField(
    Number(legacyScenario.ovenBatchSize ?? base.components[0]?.ovenBatchSize ?? 1),
    'componentOvenBatchSize',
  )

  const rawCalendar: Partial<ScenarioInput['calendar']> = rawScenario.calendar ?? {}
  const calendar = {
    daysPerWeek: clampToField(
      Number(rawCalendar.daysPerWeek ?? base.calendar.daysPerWeek),
      'daysPerWeek',
    ),
    shiftsPerDay: clampToField(
      Number(rawCalendar.shiftsPerDay ?? base.calendar.shiftsPerDay),
      'shiftsPerDay',
    ),
    weekendDaysPerWeek: clampToField(
      Number(rawCalendar.weekendDaysPerWeek ?? base.calendar.weekendDaysPerWeek),
      'weekendDaysPerWeek',
    ),
    weekendShiftsPerDay: clampToField(
      Number(rawCalendar.weekendShiftsPerDay ?? base.calendar.weekendShiftsPerDay),
      'weekendShiftsPerDay',
    ),
    hoursPerShift: clampToField(
      Number(rawCalendar.hoursPerShift ?? base.calendar.hoursPerShift),
      'hoursPerShift',
    ),
    breakMinutesPerShift: clampToField(
      Number(rawCalendar.breakMinutesPerShift ?? base.calendar.breakMinutesPerShift),
      'breakMinutesPerShift',
    ),
    efficiencyPct: clampToField(
      Number(rawCalendar.efficiencyPct ?? base.calendar.efficiencyPct),
      'efficiencyPct',
    ),
  }

  const rawResources = rawScenario.resources
  const resources = PROCESS_SEQUENCE.reduce(
    (acc, processId) => {
      const rawResource = rawResources?.[processId]
      acc[processId] = {
        machines: clampToField(
          Number(rawResource?.machines ?? base.resources[processId].machines),
          'machines',
        ),
        operators: clampToField(
          Number(rawResource?.operators ?? base.resources[processId].operators),
          'operators',
        ),
      }
      return acc
    },
    {} as ScenarioInput['resources'],
  )

  const rawComponents: PartialComponent[] = Array.isArray(rawScenario.components)
    ? (rawScenario.components as unknown[]).filter(isPartialComponent)
    : []

  const components =
    rawComponents.length > 0
      ? rawComponents.map((rawComponent, index) => {
          const baseComponent = createDefaultComponent(index)

          const cycleTimes = PROCESS_SEQUENCE.reduce(
            (acc, processId) => {
              const rawCell = rawComponent.cycleTimes?.[processId]
              acc[processId] = {
                baseMinutes: clampToField(
                  Number(rawCell?.baseMinutes ?? baseComponent.cycleTimes[processId].baseMinutes),
                  'baseMinutes',
                ),
              }
              return acc
            },
            {} as typeof baseComponent.cycleTimes,
          )

          return {
            id:
              typeof rawComponent.id === 'string' && rawComponent.id.trim().length > 0
                ? rawComponent.id
                : baseComponent.id,
            name:
              typeof rawComponent.name === 'string' && rawComponent.name.trim().length > 0
                ? rawComponent.name
                : baseComponent.name,
            quantityPerFinalUnit: clampToField(
              Number(rawComponent.quantityPerFinalUnit ?? baseComponent.quantityPerFinalUnit),
              'quantityPerFinalUnit',
            ),
            ovenBatchSize: clampToField(
              Number(rawComponent.ovenBatchSize ?? legacyOvenBatchSize ?? baseComponent.ovenBatchSize),
              'componentOvenBatchSize',
            ),
            cycleTimes,
          }
        })
      : base.components.map((component) => ({
          ...component,
          ovenBatchSize: legacyOvenBatchSize,
        }))

  return {
    targetFinalUnitsPerWeek: clampToField(
      Number(rawScenario.targetFinalUnitsPerWeek ?? base.targetFinalUnitsPerWeek),
      'targetFinalUnitsPerWeek',
    ),
    calendar,
    resources,
    components,
  }
}

function normalizePlannerSettings(rawPlannerSettings: Partial<PlannerUiSettings> | undefined): PlannerUiSettings {
  if (!rawPlannerSettings) {
    return defaultPlannerSettings
  }

  return {
    maxShiftsPerDay: clampToField(
      Number(rawPlannerSettings.maxShiftsPerDay ?? defaultPlannerSettings.maxShiftsPerDay),
      'maxShiftsPerDay',
    ),
    maxMachinesPerProcess: clampToField(
      Number(rawPlannerSettings.maxMachinesPerProcess ?? defaultPlannerSettings.maxMachinesPerProcess),
      'maxMachinesPerProcess',
    ),
    maxOperatorsPerProcess: clampToField(
      Number(rawPlannerSettings.maxOperatorsPerProcess ?? defaultPlannerSettings.maxOperatorsPerProcess),
      'maxOperatorsPerProcess',
    ),
    locks: {
      shiftsPerDayLocked: Boolean(
        rawPlannerSettings.locks?.shiftsPerDayLocked ?? defaultPlannerSettings.locks.shiftsPerDayLocked,
      ),
      machinesLocked: PROCESS_SEQUENCE.reduce(
        (acc, processId) => {
          acc[processId] = Boolean(
            rawPlannerSettings.locks?.machinesLocked?.[processId] ??
              defaultPlannerSettings.locks.machinesLocked[processId],
          )
          return acc
        },
        {} as PlannerUiSettings['locks']['machinesLocked'],
      ),
      operatorsLocked: PROCESS_SEQUENCE.reduce(
        (acc, processId) => {
          acc[processId] = Boolean(
            rawPlannerSettings.locks?.operatorsLocked?.[processId] ??
              defaultPlannerSettings.locks.operatorsLocked[processId],
          )
          return acc
        },
        {} as PlannerUiSettings['locks']['operatorsLocked'],
      ),
    },
  }
}

export const useSimulationStore = create<SimulationStore>()(
  persist(
    (set) => ({
      scenario: defaultScenario,
      plannerSettings: defaultPlannerSettings,
      setTarget: (value) =>
        set((state) => ({
          scenario: {
            ...state.scenario,
            targetFinalUnitsPerWeek: clampToField(value, 'targetFinalUnitsPerWeek'),
          },
        })),
      setCalendarValue: (field, value) =>
        set((state) => ({
          scenario: {
            ...state.scenario,
            calendar: {
              ...state.scenario.calendar,
              [field]: clampToField(value, field),
            },
          },
        })),
      setResourceValue: (processId, field, value) =>
        set((state) => ({
          scenario: {
            ...state.scenario,
            resources: {
              ...state.scenario.resources,
              [processId]: {
                ...state.scenario.resources[processId],
                [field]: clampToField(value, field),
              },
            },
          },
        })),
      adjustResourceValue: (processId, field, delta) =>
        set((state) => ({
          scenario: {
            ...state.scenario,
            resources: {
              ...state.scenario.resources,
              [processId]: {
                ...state.scenario.resources[processId],
                [field]: clampToField(state.scenario.resources[processId][field] + delta, field),
              },
            },
          },
        })),
      setComponentName: (componentId, name) =>
        set((state) => ({
          scenario: {
            ...state.scenario,
            components: state.scenario.components.map((component) =>
              component.id === componentId ? { ...component, name } : component,
            ),
          },
        })),
      setComponentQuantity: (componentId, value) =>
        set((state) => ({
          scenario: {
            ...state.scenario,
            components: state.scenario.components.map((component) =>
              component.id === componentId
                ? {
                    ...component,
                    quantityPerFinalUnit: clampToField(value, 'quantityPerFinalUnit'),
                  }
                : component,
            ),
          },
        })),
      setComponentOvenBatchSize: (componentId, value) =>
        set((state) => ({
          scenario: {
            ...state.scenario,
            components: state.scenario.components.map((component) =>
              component.id === componentId
                ? {
                    ...component,
                    ovenBatchSize: clampToField(value, 'componentOvenBatchSize'),
                  }
                : component,
            ),
          },
        })),
      setCycleBase: (componentId, processId, value) =>
        set((state) => ({
          scenario: {
            ...state.scenario,
            components: state.scenario.components.map((component) => {
              if (component.id !== componentId) {
                return component
              }

              return {
                ...component,
                cycleTimes: {
                  ...component.cycleTimes,
                  [processId]: {
                    ...component.cycleTimes[processId],
                    baseMinutes: clampToField(value, 'baseMinutes'),
                  },
                },
              }
            }),
          },
        })),
      addComponent: () =>
        set((state) => {
          const nextIndex = state.scenario.components.length
          const nextComponent = createDefaultComponent(nextIndex)
          nextComponent.id = `${nextComponent.id}-${Date.now()}`

          return {
            scenario: {
              ...state.scenario,
              components: [...state.scenario.components, nextComponent],
            },
          }
        }),
      removeComponent: (componentId) =>
        set((state) => {
          if (state.scenario.components.length <= 1) {
            return state
          }

          return {
            scenario: {
              ...state.scenario,
              components: state.scenario.components.filter((component) => component.id !== componentId),
            },
          }
        }),
      setPlannerMax: (field, value) =>
        set((state) => ({
          plannerSettings: {
            ...state.plannerSettings,
            [field]: Math.max(1, clampToField(value, field)),
          },
        })),
      setLockValue: (type, processId, value) =>
        set((state) => ({
          plannerSettings: {
            ...state.plannerSettings,
            locks: {
              ...state.plannerSettings.locks,
              [type]: {
                ...state.plannerSettings.locks[type],
                [processId]: value,
              },
            },
          },
        })),
      setShiftLock: (value) =>
        set((state) => ({
          plannerSettings: {
            ...state.plannerSettings,
            locks: {
              ...state.plannerSettings.locks,
              shiftsPerDayLocked: value,
            },
          },
        })),
      applyScenario: (scenario) => set({ scenario }),
      reset: () =>
        set({
          scenario: createDefaultScenario(),
          plannerSettings: {
            ...DEFAULT_PLANNER_LIMITS,
            locks: createDefaultPlannerLocks(),
          },
        }),
    }),
    {
      name: 'simulation-store-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        scenario: state.scenario,
        plannerSettings: state.plannerSettings,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<SimulationStore> | undefined
        if (!persisted) {
          return currentState
        }

        return {
          ...currentState,
          ...persisted,
          scenario: normalizeScenario(persisted.scenario),
          plannerSettings: normalizePlannerSettings(persisted.plannerSettings),
        }
      },
    },
  ),
)

export function buildPlannerRequestFromStore(state: SimulationStore): PlannerRequest {
  return {
    targetFinalUnitsPerWeek: state.scenario.targetFinalUnitsPerWeek,
    maxShiftsPerDay: Math.max(1, state.plannerSettings.maxShiftsPerDay),
    maxMachinesPerProcess: Math.max(1, state.plannerSettings.maxMachinesPerProcess),
    maxOperatorsPerProcess: Math.max(1, state.plannerSettings.maxOperatorsPerProcess),
    locks: {
      shiftsPerDayLocked: state.plannerSettings.locks.shiftsPerDayLocked,
      machinesLocked: PROCESS_SEQUENCE.reduce(
        (acc, processId) => {
          acc[processId] = state.plannerSettings.locks.machinesLocked[processId]
          return acc
        },
        {} as PlannerRequest['locks']['machinesLocked'],
      ),
      operatorsLocked: PROCESS_SEQUENCE.reduce(
        (acc, processId) => {
          acc[processId] = state.plannerSettings.locks.operatorsLocked[processId]
          return acc
        },
        {} as PlannerRequest['locks']['operatorsLocked'],
      ),
    },
  }
}

export function useStoreSnapshot() {
  return useSimulationStore.getState()
}
