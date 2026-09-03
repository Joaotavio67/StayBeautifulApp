import { useState } from 'react'
import { format, addDays, isBefore, isAfter, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { WorkingHours, BlockedSlot } from '../lib/supabase'
import { isWorkingDay } from '../lib/utils'

interface CalendarProps {
  selected: Date | null
  onSelect: (date: Date) => void
  workingHours: WorkingHours
  blockedSlots: BlockedSlot[]
  /** Earliest selectable date (e.g. the previous combo session's date). Defaults to today. */
  minDate?: Date | null
  /** Latest selectable date (e.g. 30 days after a combo's first session). */
  maxDate?: Date | null
}

const INITIAL_VISIBLE = 10
const BATCH_SIZE = 10
const LOOKAHEAD_DAYS = 90

function getFloorDate(minDate?: Date | null): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (minDate && isBefore(today, minDate)) return minDate
  return today
}

export default function Calendar({ selected, onSelect, workingHours, blockedSlots, minDate, maxDate }: CalendarProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const floor = getFloorDate(minDate)

  const availableDates: Date[] = []
  for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
    const day = addDays(floor, i)
    if (maxDate && isAfter(day, maxDate)) break
    if (isWorkingDay(day, workingHours, blockedSlots)) availableDates.push(day)
  }

  const shown = availableDates.slice(0, visibleCount)
  const hasMore = availableDates.length > visibleCount

  return (
    <div className="date-picker">
      <div className="date-picker__grid">
        {shown.map(day => {
          const isSelected = selected ? isSameDay(day, selected) : false
          const weekday = format(day, 'EEEE', { locale: ptBR }).slice(0, 3).toUpperCase()
          return (
            <button
              key={day.toISOString()}
              className={`date-chip${isSelected ? ' date-chip--selected' : ''}`}
              onClick={() => onSelect(day)}
            >
              {weekday} {format(day, 'dd/MM')}
            </button>
          )
        })}
      </div>

      {hasMore && (
        <button className="date-picker__more" onClick={() => setVisibleCount(v => v + BATCH_SIZE)}>
          Ver mais datas
        </button>
      )}
    </div>
  )
}
