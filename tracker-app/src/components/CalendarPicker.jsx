import { Calendar } from 'lucide-react'

export default function CalendarPicker({ minDate, maxDate, value, onChange }) {
  const from = value?.[0]?.slice(0, 10) || minDate.slice(0, 10)
  const to = value?.[1]?.slice(0, 10) || maxDate.slice(0, 10)

  const handleFrom = (e) => {
    const v = e.target.value
    if (v && v <= to) onChange([v, value?.[1] || maxDate])
  }
  const handleTo = (e) => {
    const v = e.target.value
    if (v && v >= from) onChange([value?.[0] || minDate, v])
  }

  return (
    <div className="calendar-picker">
      <Calendar size={14} className="calendar-icon" />
      <input type="date" className="calendar-input" value={from}
        min={minDate.slice(0, 10)} max={maxDate.slice(0, 10)} onChange={handleFrom} />
      <span className="calendar-sep">—</span>
      <input type="date" className="calendar-input" value={to}
        min={minDate.slice(0, 10)} max={maxDate.slice(0, 10)} onChange={handleTo} />
    </div>
  )
}
