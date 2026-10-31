import React, { useMemo, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowUpRight, Banknote,
  CalendarDays, CarFront, Clock3, Gauge, ParkingCircle,
  TrendingUp
} from 'lucide-react'
import './analytics.css'

type Row = Record<string, any>
type Range = '7d' | '30d' | 'all'

type Props = {
  bookings: Row[]
  payments: Row[]
  slots: Row[]
  facilities: Row[]
  sessions: Row[]
}

const money = (value: number) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const safeDate = (value?: string) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const shortDate = (date: Date) =>
  date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

const hourLabel = (hour: number) => {
  const suffix = hour < 12 ? 'AM' : 'PM'
  const value = hour % 12 || 12
  return `${value} ${suffix}`
}

export default function Analytics({
  bookings = [],
  payments = [],
  slots = [],
  facilities = [],
  sessions = []
}: Props) {
  const [range, setRange] = useState<Range>('7d')

  const cutoff = useMemo(() => {
    if (range === 'all') return null
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (range === '7d' ? 6 : 29))
    return date
  }, [range])

  const inRange = (value?: string) => {
    const date = safeDate(value)
    return !!date && (!cutoff || date >= cutoff)
  }

  const filteredBookings = bookings.filter(b => inRange(b.created_at))
  const filteredPayments = payments.filter(p => inRange(p.created_at))
  const filteredSessions = sessions.filter(s => inRange(s.entry_time))
  const successfulPayments = filteredPayments.filter(p => p.status === 'SUCCESS')
  const revenue = successfulPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const completedBookings = filteredBookings.filter(b => b.status === 'COMPLETED').length
  const activeSessions = sessions.filter(s => s.status === 'ACTIVE').length
  const occupiedSlots = slots.filter(s => s.status === 'OCCUPIED').length
  const occupancy = slots.length ? Math.round((occupiedSlots / slots.length) * 100) : 0
  const averagePayment = successfulPayments.length ? revenue / successfulPayments.length : 0

  const trend = useMemo(() => {
    const buckets: { key: string; label: string; count: number }[] = []
    const now = new Date()

    if (range === 'all') {
      for (let offset = 5; offset >= 0; offset--) {
        const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
        buckets.push({
          key: `${date.getFullYear()}-${date.getMonth()}`,
          label: date.toLocaleDateString('en-IN', { month: 'short' }),
          count: 0
        })
      }
      bookings.forEach(booking => {
        const date = safeDate(booking.created_at)
        if (!date) return
        const bucket = buckets.find(item => item.key === `${date.getFullYear()}-${date.getMonth()}`)
        if (bucket) bucket.count += 1
      })
    } else {
      const days = range === '7d' ? 7 : 30
      for (let offset = days - 1; offset >= 0; offset--) {
        const date = new Date(now)
        date.setHours(0, 0, 0, 0)
        date.setDate(date.getDate() - offset)
        buckets.push({
          key: date.toDateString(),
          label: days === 7
            ? date.toLocaleDateString('en-IN', { weekday: 'short' })
            : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          count: 0
        })
      }
      filteredBookings.forEach(booking => {
        const date = safeDate(booking.created_at)
        if (!date) return
        const bucket = buckets.find(item => item.key === new Date(date.getFullYear(), date.getMonth(), date.getDate()).toDateString())
        if (bucket) bucket.count += 1
      })
    }

    return buckets
  }, [bookings, filteredBookings, range])

  const peakHours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: hourLabel(hour),
    count: filteredSessions.filter(session => {
      const date = safeDate(session.entry_time)
      return date ? date.getHours() === hour : false
    }).length
  }))
  const peakMax = Math.max(1, ...peakHours.map(item => item.count))
  const trendMax = Math.max(1, ...trend.map(item => item.count))

  const facilityStats = facilities.map(facility => {
    const facilitySlots = slots.filter(slot => slot.facility_id === facility.id)
    const occupied = facilitySlots.filter(slot => slot.status === 'OCCUPIED').length
    const reserved = facilitySlots.filter(slot => slot.status === 'RESERVED').length
    const available = facilitySlots.filter(slot => slot.status === 'AVAILABLE').length
    const facilityBookings = filteredBookings.filter(booking => booking.facility_id === facility.id)
    const bookingIds = new Set(facilityBookings.map(booking => booking.id))
    const collected = successfulPayments
      .filter(payment => bookingIds.has(payment.booking_id))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

    return {
      id: facility.id,
      name: facility.name,
      address: facility.address,
      total: facilitySlots.length,
      occupied,
      reserved,
      available,
      occupancy: facilitySlots.length ? Math.round((occupied / facilitySlots.length) * 100) : 0,
      bookings: facilityBookings.length,
      collected
    }
  })

  const bookingStatuses = [
    { label: 'Completed', key: 'COMPLETED', color: 'green' },
    { label: 'Confirmed', key: 'CONFIRMED', color: 'blue' },
    { label: 'Active session', key: 'ACTIVE_SESSION', color: 'purple' },
    { label: 'On hold', key: 'HOLD', color: 'amber' },
    { label: 'Other / expired', key: 'OTHER', color: 'grey' }
  ].map(item => ({
    ...item,
    count: filteredBookings.filter(booking =>
      item.key === 'OTHER'
        ? !['COMPLETED', 'CONFIRMED', 'ACTIVE_SESSION', 'HOLD'].includes(booking.status)
        : booking.status === item.key
    ).length
  }))
  const statusTotal = Math.max(1, filteredBookings.length)

  return (
    <section className="analytics-page">
      <div className="analytics-heading">
        <div>
          <span className="analytics-eyebrow">OPERATOR INTELLIGENCE</span>
          <h1>Advanced analytics</h1>
          <p>Understand occupancy, bookings, collections and parking activity across your demo network.</p>
        </div>
        <div className="analytics-range" aria-label="Analytics date range">
          {(['7d', '30d', 'all'] as Range[]).map(value => (
            <button
              key={value}
              className={range === value ? 'active' : ''}
              onClick={() => setRange(value)}
            >
              {value === 'all' ? 'All time' : value === '7d' ? '7 days' : '30 days'}
            </button>
          ))}
        </div>
      </div>

      <div className="analytics-demo-note">
        <Activity size={15} />
        <span>Demo analytics · Payments are simulated · Occupancy reflects the latest slot snapshot</span>
      </div>

      <div className="analytics-kpis">
        <article className="analytics-kpi">
          <div className="analytics-kpi-icon green"><Banknote size={18} /></div>
          <span>Successful demo collections</span>
          <strong>{money(revenue)}</strong>
          <small>{successfulPayments.length} successful payment records in selected range</small>
        </article>
        <article className="analytics-kpi">
          <div className="analytics-kpi-icon blue"><TicketIcon /></div>
          <span>Bookings created</span>
          <strong>{filteredBookings.length}</strong>
          <small>{completedBookings} completed bookings in selected range</small>
        </article>
        <article className="analytics-kpi">
          <div className="analytics-kpi-icon amber"><Gauge size={18} /></div>
          <span>Current occupancy</span>
          <strong>{occupancy}%</strong>
          <small>{occupiedSlots} occupied of {slots.length} total bays</small>
        </article>
        <article className="analytics-kpi">
          <div className="analytics-kpi-icon purple"><CarFront size={18} /></div>
          <span>Active parking sessions</span>
          <strong>{activeSessions}</strong>
          <small>Currently active across all facilities</small>
        </article>
      </div>

      <div className="analytics-grid analytics-grid-main">
        <article className="analytics-card">
          <div className="analytics-card-heading">
            <div>
              <h2>Booking activity</h2>
              <p>{range === 'all' ? 'Bookings per month · Last six months' : `Bookings per day · Last ${range === '7d' ? '7' : '30'} days`}</p>
            </div>
            <CalendarDays size={18} />
          </div>
          <div className={range === '30d' ? 'analytics-bars daily compact' : 'analytics-bars daily'}>
            {trend.map(item => (
              <div className="analytics-bar-column" key={item.key} title={`${item.label}: ${item.count} bookings`}>
                <strong>{item.count || ''}</strong>
                <div className="analytics-bar-track">
                  <span style={{ height: `${Math.max(item.count ? 8 : 2, item.count / trendMax * 100)}%` }} />
                </div>
                <small>{item.label}</small>
              </div>
            ))}
          </div>
          {!filteredBookings.length && <div className="analytics-empty">No bookings recorded in this date range.</div>}
        </article>

        <article className="analytics-card">
          <div className="analytics-card-heading">
            <div>
              <h2>Booking status mix</h2>
              <p>Lifecycle status of bookings in the selected range</p>
            </div>
            <TrendingUp size={18} />
          </div>
          <div className="analytics-status-list">
            {bookingStatuses.map(item => (
              <div className="analytics-status-row" key={item.key}>
                <div className="analytics-status-label"><i className={item.color} />{item.label}<b>{item.count}</b></div>
                <div className="analytics-status-track">
                  <span className={item.color} style={{ width: `${item.count / statusTotal * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="analytics-card-foot">{filteredBookings.length} bookings included</div>
        </article>
      </div>

      <div className="analytics-grid">
        <article className="analytics-card">
          <div className="analytics-card-heading">
            <div>
              <h2>Entry activity by hour</h2>
              <p>Recorded gate entries · Selected date range</p>
            </div>
            <Clock3 size={18} />
          </div>
          <div className="analytics-bars hourly">
            {peakHours.map(item => (
              <div className="analytics-bar-column" key={item.hour} title={`${item.label}: ${item.count} entries`}>
                <div className="analytics-bar-track">
                  <span style={{ height: `${item.count ? Math.max(8, item.count / peakMax * 100) : 2}%` }} />
                </div>
                <small>{[0, 6, 12, 18].includes(item.hour) ? item.label : ''}</small>
              </div>
            ))}
          </div>
          <div className="analytics-card-foot">{filteredSessions.length} recorded entries in this range</div>
        </article>

        <article className="analytics-card">
          <div className="analytics-card-heading">
            <div>
              <h2>Payment snapshot</h2>
              <p>Successful demo payment records</p>
            </div>
            <Banknote size={18} />
          </div>
          <div className="analytics-payment-total">{money(revenue)}</div>
          <div className="analytics-payment-details">
            <div><span>Successful payments</span><b>{successfulPayments.length}</b></div>
            <div><span>Average payment</span><b>{money(averagePayment)}</b></div>
            <div><span>Other payment states</span><b>{filteredPayments.length - successfulPayments.length}</b></div>
          </div>
          <div className="analytics-card-foot">Based on payment records, not live bank settlements</div>
        </article>
      </div>

      <article className="analytics-card analytics-facility-card">
        <div className="analytics-card-heading">
          <div>
            <h2>Facility performance</h2>
            <p>Latest slot availability and selected-range booking activity</p>
          </div>
          <ParkingCircle size={18} />
        </div>
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Facility</th>
                <th>Bays</th>
                <th>Occupied</th>
                <th>Available</th>
                <th>Occupancy</th>
                <th>Bookings</th>
                <th>Demo collections</th>
              </tr>
            </thead>
            <tbody>
              {facilityStats.map(item => (
                <tr key={item.id}>
                  <td><b>{item.name}</b><small>{item.address}</small></td>
                  <td>{item.total}</td>
                  <td>{item.occupied}</td>
                  <td>{item.available}</td>
                  <td>
                    <div className="analytics-inline-progress">
                      <span><i style={{ width: `${item.occupancy}%` }} /></span>
                      <b>{item.occupancy}%</b>
                    </div>
                  </td>
                  <td>{item.bookings}</td>
                  <td>{money(item.collected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!facilityStats.length && <div className="analytics-empty">No facilities available.</div>}
        </div>
      </article>

      <div className="analytics-footnote">
        <ArrowUpRight size={14} />
        <span>Analytics are calculated from the existing bootstrap data. Historical trends only include records with valid timestamps; no new database tables or booking APIs are required.</span>
        <ArrowDownRight size={14} />
      </div>
    </section>
  )
}

function TicketIcon() {
  return <Activity size={18} />
}
