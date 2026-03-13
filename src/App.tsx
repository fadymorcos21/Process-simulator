import { useMemo, type CSSProperties } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PROCESS_LABELS } from './domain/constants'
import { PROCESS_SEQUENCE, type ProcessId, type ScenarioInput } from './domain/types'
import { calculateCapacity } from './engine/capacity'
import { formatNumber, formatPercent } from './lib/format'
import { useSimulationStore } from './store/simulationStore'
import './App.css'

function toNumberInput(value: string): number {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) {
    return 0
  }

  return parsed
}

function withTarget(scenario: ScenarioInput): ScenarioInput {
  return {
    ...scenario,
    targetFinalUnitsPerWeek: Math.max(0, Math.floor(scenario.targetFinalUnitsPerWeek)),
  }
}

const LANE_COLORS: Record<ProcessId, string> = {
  masking: '#2f7f97',
  sandblasting: '#d57a3b',
  painting: '#5b9264',
  oven: '#8a5f9e',
}

function App() {
  const scenario = useSimulationStore((state) => state.scenario)

  const setTarget = useSimulationStore((state) => state.setTarget)
  const setCalendarValue = useSimulationStore((state) => state.setCalendarValue)
  const setResourceValue = useSimulationStore((state) => state.setResourceValue)
  const adjustResourceValue = useSimulationStore((state) => state.adjustResourceValue)
  const setComponentName = useSimulationStore((state) => state.setComponentName)
  const setComponentQuantity = useSimulationStore((state) => state.setComponentQuantity)
  const setComponentOvenBatchSize = useSimulationStore((state) => state.setComponentOvenBatchSize)
  const setCycleBase = useSimulationStore((state) => state.setCycleBase)
  const addComponent = useSimulationStore((state) => state.addComponent)
  const removeComponent = useSimulationStore((state) => state.removeComponent)
  const reset = useSimulationStore((state) => state.reset)

  const simulationState = useMemo(() => {
    try {
      const preparedScenario = withTarget(scenario)
      const deterministicResult = calculateCapacity(preparedScenario)

      return { deterministicResult, error: null as string | null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown simulation error.'
      return {
        deterministicResult: null,
        error: message,
      }
    }
  }, [scenario])

  if (!simulationState.deterministicResult) {
    return (
      <main className="app-shell">
        <section className="panel">
          <h2>Simulation Load Error</h2>
          <p className="hint">
            The saved scenario data is invalid and prevented rendering. Use reset to restore a safe
            default scenario.
          </p>
          <p>
            <strong>Root cause:</strong> {simulationState.error ?? 'Unknown error'}
          </p>
          <button className="primary-btn" onClick={reset} type="button">
            Reset Scenario
          </button>
        </section>
      </main>
    )
  }

  const { deterministicResult } = simulationState

  const capacityChartData = deterministicResult.processResults.map((result) => ({
    process: PROCESS_LABELS[result.processId],
    capacity: Number(result.capacityFinalUnitsPerWeek.toFixed(1)),
    target: scenario.targetFinalUnitsPerWeek,
  }))

  const utilizationChartData = deterministicResult.processResults.map((result) => ({
    process: PROCESS_LABELS[result.processId],
    utilization: Number(result.utilizationPctAtTarget.toFixed(2)),
  }))

  const visualLanes = deterministicResult.processResults.map((result) => {
    const stageMinutesPerFinalUnit =
      result.activeStations > 0
        ? result.demandMinutesPerFinalUnit / result.activeStations
        : result.demandMinutesPerFinalUnit
    const durationSeconds = Math.min(12, Math.max(2, stageMinutesPerFinalUnit * 4))
    const tokenCount = Math.min(10, Math.max(3, result.activeStations * 3))
    const utilizationForBar = Number.isFinite(result.utilizationPctAtTarget)
      ? Math.min(100, Math.max(0, result.utilizationPctAtTarget))
      : 100

    return {
      ...result,
      durationSeconds,
      tokenCount,
      laneColor: LANE_COLORS[result.processId],
      utilizationForBar,
    }
  })

  const bottleneckLabel = PROCESS_LABELS[deterministicResult.bottleneckProcessId]

  return (
    <main className="app-shell">
      <header className="hero-card">
        <div>
          <p className="eyebrow">Manufacturing Capacity Simulator</p>
          <h1>Time Study to Weekly Throughput Planner</h1>
          <p className="hero-copy">
            Model component cycle times across masking, sandblasting, painting, and batch oven to
            estimate cycle time, operators, machines, and weekly output against your 1,500-unit goal.
          </p>
        </div>
        <button className="ghost-btn" onClick={reset} type="button">
          Reset to Defaults
        </button>
      </header>

      <section className="panel">
        <h2>Scenario Builder</h2>
        <div className="grid two-col">
          <label className="field">
            <span>Target Final Units / Week</span>
            <input
              aria-label="Target Final Units / Week"
              type="number"
              min={0}
              value={scenario.targetFinalUnitsPerWeek}
              onChange={(event) => setTarget(toNumberInput(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Days / Week</span>
            <input
              aria-label="Days / Week"
              type="number"
              min={1}
              value={scenario.calendar.daysPerWeek}
              onChange={(event) => setCalendarValue('daysPerWeek', toNumberInput(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Shifts / Day</span>
            <input
              aria-label="Shifts / Day"
              type="number"
              min={1}
              value={scenario.calendar.shiftsPerDay}
              onChange={(event) => setCalendarValue('shiftsPerDay', toNumberInput(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Weekend Days / Week</span>
            <input
              aria-label="Weekend Days / Week"
              type="number"
              min={0}
              max={2}
              value={scenario.calendar.weekendDaysPerWeek}
              onChange={(event) =>
                setCalendarValue('weekendDaysPerWeek', toNumberInput(event.target.value))
              }
            />
          </label>
          <label className="field">
            <span>Weekend Shifts / Day</span>
            <input
              aria-label="Weekend Shifts / Day"
              type="number"
              min={0}
              value={scenario.calendar.weekendShiftsPerDay}
              onChange={(event) =>
                setCalendarValue('weekendShiftsPerDay', toNumberInput(event.target.value))
              }
            />
          </label>
          <label className="field">
            <span>Hours / Shift</span>
            <input
              aria-label="Hours / Shift"
              type="number"
              min={1}
              step="0.25"
              value={scenario.calendar.hoursPerShift}
              onChange={(event) => setCalendarValue('hoursPerShift', toNumberInput(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Break Minutes / Shift</span>
            <input
              aria-label="Break Minutes / Shift"
              type="number"
              min={0}
              value={scenario.calendar.breakMinutesPerShift}
              onChange={(event) =>
                setCalendarValue('breakMinutesPerShift', toNumberInput(event.target.value))
              }
            />
          </label>
          <label className="field">
            <span>Efficiency (%)</span>
            <input
              aria-label="Efficiency (%)"
              type="number"
              min={0}
              max={100}
              value={scenario.calendar.efficiencyPct}
              onChange={(event) => setCalendarValue('efficiencyPct', toNumberInput(event.target.value))}
            />
          </label>
        </div>

        <h3>Shared Resources by Process</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Process</th>
                <th>Machines</th>
                <th>Operators</th>
                <th>Active Stations (1:1)</th>
              </tr>
            </thead>
            <tbody>
              {PROCESS_SEQUENCE.map((processId) => {
                const resources = scenario.resources[processId]
                const activeStations =
                  processId === 'oven' ? resources.machines : Math.min(resources.machines, resources.operators)

                return (
                  <tr key={processId}>
                    <td>{PROCESS_LABELS[processId]}</td>
                    <td>
                      <div className="inline-controls">
                        <button
                          type="button"
                          aria-label={`Decrease machines for ${PROCESS_LABELS[processId]}`}
                          onClick={() => adjustResourceValue(processId, 'machines', -1)}
                        >
                          -
                        </button>
                        <input
                          aria-label={`${PROCESS_LABELS[processId]} machines`}
                          type="number"
                          min={0}
                          value={resources.machines}
                          onChange={(event) =>
                            setResourceValue(processId, 'machines', toNumberInput(event.target.value))
                          }
                        />
                        <button
                          type="button"
                          aria-label={`Increase machines for ${PROCESS_LABELS[processId]}`}
                          onClick={() => adjustResourceValue(processId, 'machines', 1)}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td>
                      {processId === 'oven' ? (
                        <span>Not required</span>
                      ) : (
                        <div className="inline-controls">
                          <button
                            type="button"
                            aria-label={`Decrease operators for ${PROCESS_LABELS[processId]}`}
                            onClick={() => adjustResourceValue(processId, 'operators', -1)}
                          >
                            -
                          </button>
                          <input
                            aria-label={`${PROCESS_LABELS[processId]} operators`}
                            type="number"
                            min={0}
                            value={resources.operators}
                            onChange={(event) =>
                              setResourceValue(processId, 'operators', toNumberInput(event.target.value))
                            }
                          />
                          <button
                            type="button"
                            aria-label={`Increase operators for ${PROCESS_LABELS[processId]}`}
                            onClick={() => adjustResourceValue(processId, 'operators', 1)}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </td>
                    <td>{formatNumber(activeStations, 0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="row-head">
          <h3>Components + Cycle Time Grid</h3>
          <button className="primary-btn" type="button" onClick={addComponent}>
            Add Component
          </button>
        </div>
        <p className="hint">
          Perfect cycle-time assumption enabled. Each component has its own oven batch size, and
          oven cycle time is interpreted as minutes per batch.
        </p>

        {scenario.components.map((component) => (
          <article className="component-card" key={component.id}>
            <div className="component-header">
              <label className="field">
                <span>Component Name</span>
                <input
                  aria-label={`Component name ${component.id}`}
                  type="text"
                  value={component.name}
                  onChange={(event) => setComponentName(component.id, event.target.value)}
                />
              </label>
              <label className="field small">
                <span>Qty per Final Unit</span>
                <input
                  aria-label={`Quantity for ${component.name}`}
                  type="number"
                  min={0}
                  value={component.quantityPerFinalUnit}
                  onChange={(event) => setComponentQuantity(component.id, toNumberInput(event.target.value))}
                />
              </label>
              <label className="field small">
                <span>Oven Batch Size</span>
                <input
                  aria-label={`Oven batch size for ${component.name}`}
                  type="number"
                  min={1}
                  value={component.ovenBatchSize}
                  onChange={(event) =>
                    setComponentOvenBatchSize(component.id, toNumberInput(event.target.value))
                  }
                />
              </label>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => removeComponent(component.id)}
                disabled={scenario.components.length <= 1}
              >
                Remove
              </button>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Process</th>
                    <th>Base Time (min)</th>
                  </tr>
                </thead>
                <tbody>
                  {PROCESS_SEQUENCE.map((processId) => {
                    const cell = component.cycleTimes[processId]
                    return (
                      <tr key={`${component.id}-${processId}`}>
                        <td>{PROCESS_LABELS[processId]}</td>
                        <td>
                          <input
                            aria-label={`${component.name} ${PROCESS_LABELS[processId]} base`}
                            type="number"
                            min={0}
                            step="0.01"
                            value={cell.baseMinutes}
                            onChange={(event) =>
                              setCycleBase(component.id, processId, toNumberInput(event.target.value))
                            }
                          />
                          {processId === 'oven' && <small className="cell-note">min/batch</small>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </section>

      <section className="panel">
        <h2>Results Dashboard</h2>
        <div className="kpi-grid">
          <article className="kpi-card">
            <span className="kpi-label">Max Final Units / Week</span>
            <strong>{formatNumber(deterministicResult.maxFinalUnitsPerWeek, 0)}</strong>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">Bottleneck Process</span>
            <strong>{bottleneckLabel}</strong>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">Line Cycle Time (min/final unit)</span>
            <strong>{formatNumber(deterministicResult.lineCycleTimeMinutesPerFinalUnit, 2)}</strong>
          </article>
          <article className="kpi-card">
            <span className="kpi-label">Target Status</span>
            <strong className={deterministicResult.feasibleAtTarget ? 'ok' : 'risk'}>
              {deterministicResult.feasibleAtTarget ? 'Meets Target' : 'Below Target'}
            </strong>
          </article>
        </div>

        <div className="chart-grid">
          <article className="chart-card">
            <h3>Capacity by Process</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={capacityChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="process" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="capacity" fill="#2f7f97" name="Capacity / Week" />
                <Bar dataKey="target" fill="#d57a3b" name="Target / Week" />
              </BarChart>
            </ResponsiveContainer>
          </article>
          <article className="chart-card">
            <h3>Week Utilization by Process</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={utilizationChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="process" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="utilization" fill="#5b9264" name="Utilization @ Target (%)" />
              </BarChart>
            </ResponsiveContainer>
          </article>
        </div>

        <h3>Day/Shift Consumption at Target</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Process</th>
                <th>Required Hours</th>
                <th>Required Shift Blocks</th>
                <th>Required Days</th>
                <th>Utilization</th>
              </tr>
            </thead>
            <tbody>
              {deterministicResult.processResults.map((result) => (
                <tr key={`schedule-${result.processId}`}>
                  <td>{PROCESS_LABELS[result.processId]}</td>
                  <td>{formatNumber(result.requiredHoursAtTarget, 1)}</td>
                  <td>{formatNumber(result.requiredShiftsAtTarget, 2)}</td>
                  <td>{formatNumber(result.requiredDaysAtTarget, 2)}</td>
                  <td>{formatPercent(result.utilizationPctAtTarget, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Visual Simulation</h2>
        <p className="hint">
          Conveyor view of parts flowing through each process. Faster motion means lower cycle time per
          active station.
        </p>
        <div className="simulation-grid">
          {visualLanes.map((lane) => (
            <article className="sim-lane-card" key={`lane-${lane.processId}`}>
              <div className="sim-lane-head">
                <strong>{PROCESS_LABELS[lane.processId]}</strong>
                <span>
                  {lane.activeStations} active stations | {formatNumber(lane.capacityFinalUnitsPerWeek, 0)}
                  /week
                </span>
              </div>

              <div className="sim-track">
                {Array.from({ length: lane.tokenCount }, (_, tokenIndex) => {
                  const tokenStyle: CSSProperties = {
                    animationDuration: `${lane.durationSeconds}s`,
                    animationDelay: `-${(tokenIndex / lane.tokenCount) * lane.durationSeconds}s`,
                    backgroundColor: lane.laneColor,
                  }

                  return (
                    <span
                      className={`sim-token ${lane.activeStations === 0 ? 'paused' : ''}`}
                      key={`token-${lane.processId}-${tokenIndex}`}
                      style={tokenStyle}
                    />
                  )
                })}
              </div>

              <div className="sim-utilization">
                <div className="sim-utilization-fill" style={{ width: `${lane.utilizationForBar}%` }} />
              </div>

              <p className="hint sim-caption">
                {lane.activeStations === 0
                  ? 'No active stations. Add both machines and operators to run this lane.'
                  : `${formatPercent(lane.utilizationPctAtTarget, 1)} utilization at target.`}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
