import { describe, expect, it } from 'vitest'
import { createDefaultPlannerLocks, createDefaultScenario } from '../domain/constants'
import { planToTarget } from './planner'

describe('planToTarget', () => {
  it('respects lock behavior and returns infeasible when locked resources cannot meet target', () => {
    const scenario = createDefaultScenario()
    const locks = createDefaultPlannerLocks()
    locks.shiftsPerDayLocked = true
    locks.machinesLocked.masking = true
    locks.operatorsLocked.masking = true

    const recommendation = planToTarget(scenario, {
      targetFinalUnitsPerWeek: 1500,
      maxShiftsPerDay: 4,
      maxMachinesPerProcess: 10,
      maxOperatorsPerProcess: 10,
      locks,
    })

    expect(recommendation.feasible).toBe(false)
    expect(recommendation.reason).toMatch(/No feasible plan/)
  })

  it('prioritizes fewer operators before machines and shifts when unlocked', () => {
    const scenario = createDefaultScenario()
    const recommendation = planToTarget(scenario, {
      targetFinalUnitsPerWeek: 1500,
      maxShiftsPerDay: 4,
      maxMachinesPerProcess: 10,
      maxOperatorsPerProcess: 10,
      locks: createDefaultPlannerLocks(),
    })

    expect(recommendation.feasible).toBe(true)
    expect(recommendation.recommendedScenario.calendar.shiftsPerDay).toBe(2)
    expect(recommendation.objective.totalOperators).toBe(3)
    expect(recommendation.objective.totalMachines).toBe(4)
  })
})
