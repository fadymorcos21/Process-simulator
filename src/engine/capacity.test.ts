import { describe, expect, it } from 'vitest'
import { createDefaultScenario } from '../domain/constants'
import { PROCESS_SEQUENCE } from '../domain/types'
import { calculateCapacity } from './capacity'

describe('calculateCapacity', () => {
  it('returns around 800 final units/week in the baseline 6x0.5min setup', () => {
    const scenario = createDefaultScenario()
    scenario.targetFinalUnitsPerWeek = 1500
    scenario.calendar.daysPerWeek = 5
    scenario.calendar.shiftsPerDay = 1
    scenario.calendar.hoursPerShift = 8
    scenario.calendar.breakMinutesPerShift = 0
    scenario.calendar.efficiencyPct = 100

    const result = calculateCapacity(scenario)
    expect(result.maxFinalUnitsPerWeek).toBeCloseTo(800, 3)
  })

  it('detects the bottleneck process when one process has higher demand', () => {
    const scenario = createDefaultScenario()

    for (const component of scenario.components) {
      component.cycleTimes.painting.baseMinutes = 1
    }

    const result = calculateCapacity(scenario)
    expect(result.bottleneckProcessId).toBe('painting')
    expect(result.maxFinalUnitsPerWeek).toBeCloseTo(400, 3)
  })

  it('calculates required shifts and days for the target week demand', () => {
    const scenario = createDefaultScenario()
    scenario.targetFinalUnitsPerWeek = 1500

    const result = calculateCapacity(scenario)
    const masking = result.processResults.find((entry) => entry.processId === 'masking')

    expect(masking).toBeDefined()
    expect(masking?.requiredHoursAtTarget).toBeCloseTo(75, 5)
    expect(masking?.requiredShiftsAtTarget).toBeCloseTo(9.375, 5)
    expect(masking?.requiredDaysAtTarget).toBeCloseTo(9.375, 5)
  })

  it('increases capacity when weekend shifts are enabled', () => {
    const scenario = createDefaultScenario()
    scenario.calendar.weekendDaysPerWeek = 2
    scenario.calendar.weekendShiftsPerDay = 1

    const result = calculateCapacity(scenario)
    expect(result.maxFinalUnitsPerWeek).toBeCloseTo(1120, 3)
  })

  it('does not throw when all cycle times are zero and returns zero capacity', () => {
    const scenario = createDefaultScenario()
    for (const component of scenario.components) {
      for (const processId of PROCESS_SEQUENCE) {
        component.cycleTimes[processId].baseMinutes = 0
      }
    }

    const result = calculateCapacity(scenario)
    expect(result.maxFinalUnitsPerWeek).toBe(0)
    expect(result.feasibleAtTarget).toBe(false)
  })

  it('treats oven as machine-only and applies batch sizing', () => {
    const scenario = createDefaultScenario()

    for (const component of scenario.components) {
      component.ovenBatchSize = 1
      component.cycleTimes.masking.baseMinutes = 0.01
      component.cycleTimes.sandblasting.baseMinutes = 0.01
      component.cycleTimes.painting.baseMinutes = 0.01
      component.cycleTimes.oven.baseMinutes = 10
    }

    scenario.resources.oven.machines = 4
    scenario.resources.oven.operators = 0

    const result = calculateCapacity(scenario)
    expect(result.bottleneckProcessId).toBe('oven')
    expect(result.maxFinalUnitsPerWeek).toBeCloseTo(160, 3)
  })
})
