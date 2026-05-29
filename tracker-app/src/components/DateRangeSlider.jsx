import Slider from 'rc-slider'
import 'rc-slider/assets/index.css'

function toDateStr(v) {
  const d = new Date(v)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${d.getFullYear()}`
}

export default function DateRangeSlider({ minDate, maxDate, value, onChange }) {
  const min = new Date(minDate).getTime()
  const max = new Date(maxDate).getTime()
  const val = value ? [new Date(value[0]).getTime(), new Date(value[1]).getTime()] : [min, max]

  const handleChange = (v) => {
    onChange([new Date(v[0]).toISOString(), new Date(v[1]).toISOString()])
  }

  return (
    <div className="date-range-slider">
      <div className="date-range-labels">
        <span className="date-range-label">{toDateStr(val[0])}</span>
        <span className="date-range-label">{toDateStr(val[1])}</span>
      </div>
      <Slider
        range
        min={min}
        max={max}
        value={val}
        onChange={handleChange}
        pushable={30 * 24 * 60 * 60 * 1000}
        allowCross={false}
        trackStyle={[{ background: 'var(--accent)', height: 4 }]}
        railStyle={{ background: 'var(--border)', height: 4 }}
        handleStyle={[
          { borderColor: 'var(--accent)', background: 'var(--surface)', height: 18, width: 18, marginTop: -7, boxShadow: '0 1px 4px rgba(0,0,0,0.2)' },
          { borderColor: 'var(--accent)', background: 'var(--surface)', height: 18, width: 18, marginTop: -7, boxShadow: '0 1px 4px rgba(0,0,0,0.2)' },
        ]}
        dotStyle={{ display: 'none' }}
      />
    </div>
  )
}
