import { z } from 'zod'
import { type ScenarioInput } from './types'

const cycleTimeCellSchema = z.object({
  baseMinutes: z.number().min(0),
})

const processCycleTimesSchema = z.object({
  masking: cycleTimeCellSchema,
  sandblasting: cycleTimeCellSchema,
  painting: cycleTimeCellSchema,
  oven: cycleTimeCellSchema,
})

const componentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  quantityPerFinalUnit: z.number().min(0),
  ovenBatchSize: z.number().positive(),
  cycleTimes: processCycleTimesSchema,
})

const processResourcesSchema = z.object({
  machines: z.number().min(0),
  operators: z.number().min(0),
})

const scenarioInputSchema = z.object({
  targetFinalUnitsPerWeek: z.number().min(0),
  components: z.array(componentSchema).min(1),
  resources: z.object({
    masking: processResourcesSchema,
    sandblasting: processResourcesSchema,
    painting: processResourcesSchema,
    oven: processResourcesSchema,
  }),
  calendar: z.object({
    daysPerWeek: z.number().positive(),
    shiftsPerDay: z.number().positive(),
    weekendDaysPerWeek: z.number().min(0),
    weekendShiftsPerDay: z.number().min(0),
    hoursPerShift: z.number().positive(),
    breakMinutesPerShift: z.number().min(0),
    efficiencyPct: z.number().min(0).max(100),
  }),
})

export function validateScenarioInput(input: ScenarioInput): ScenarioInput {
  return scenarioInputSchema.parse(input)
}
