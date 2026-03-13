import { act } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { useSimulationStore } from './store/simulationStore'

function getKpiCardValue(label: string): string {
  const card = screen.getByText(label).closest('article')
  if (!card) {
    return ''
  }

  const strongNode = card.querySelector('strong')
  return strongNode?.textContent ?? ''
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    act(() => {
      useSimulationStore.getState().reset()
    })
  })

  it('updates deterministic KPIs when cycle time inputs change', () => {
    render(<App />)

    expect(getKpiCardValue('Max Final Units / Week')).toBe('800')

    const baseInput = screen.getByLabelText('Component 1 Masking base')
    fireEvent.change(baseInput, { target: { value: '1' } })

    expect(getKpiCardValue('Max Final Units / Week')).toBe('686')
  })

  it('shows only fixed cycle time inputs (no min/likely/max)', () => {
    render(<App />)

    expect(getKpiCardValue('Max Final Units / Week')).toBe('800')
    expect(screen.queryByText('Min')).not.toBeInTheDocument()
    expect(screen.queryByText('Likely')).not.toBeInTheDocument()
    expect(screen.queryByText('Max')).not.toBeInTheDocument()
    expect(screen.queryByText('Variability Panel')).not.toBeInTheDocument()
    expect(screen.queryByText('Target Planner')).not.toBeInTheDocument()
  })
})
