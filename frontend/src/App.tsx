
import React, { useEffect, useRef, useState } from 'react'
import Analytics from './Analytics'

import {
  Activity, ArrowDownRight, ArrowUpRight, ArrowUpRightFromSquare,
  BarChart3, Bike, Building2, CarFront, Check, ChevronDown, CircleHelp,
  Clock3, Gauge, LayoutDashboard, LogOut, MapPin, ParkingCircle,
  RefreshCw, ScanLine, Search, ShieldCheck, SlidersHorizontal,
  Sparkles, Ticket, Users, Wallet, X
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

type AnyObj = Record<string, any>

const money = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const titleCase = (s = '') =>
  s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

const dateTime = (s?: string) =>
  s ? new Date(s).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }) : '—'

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.detail || `Request failed (${response.status})`)
  }

  return data
}

export default function App() {
  const [role, setRole] = useState<'CUSTOMER' | 'OPERATOR'>('CUSTOMER')
  const [page, setPage] = useState('Overview')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)

  const [data, setData] = useState<AnyObj>({
    users: [],
    facilities: [],
    slots: [],
    vehicles: [],
    bookings: [],
    payments: [],
    sessions: [],
    destinations: [],
    audit_logs: []
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')

  const [selectedFacility, setSelectedFacility] = useState('')
  const [selectedVehicle, setSelectedVehicle] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [duration, setDuration] = useState(2)
  const [bookingBusy, setBookingBusy] = useState(false)
  const [bookingQrs, setBookingQrs] = useState<AnyObj>({})
  const [scannerOpen, setScannerOpen] = useState(false)
  const gateVideoRef = useRef<HTMLVideoElement | null>(null)
  const [bookingQrs, setBookingQrs] = useState<AnyObj>({})
  const [qrBusy, setQrBusy] = useState('')

  const [gateRef, setGateRef] = useState('')
  const [gatePassToken, setGatePassToken] = useState('')
  const [gatePlate, setGatePlate] = useState('')
  const [gateOverride, setGateOverride] = useState(false)

  const refresh = async () => {
    setLoading(true)

    try {
      const result = await api('/api/bootstrap')

      setData(result)
      setError('')

      if (!selectedFacility && result.facilities?.length) {
        setSelectedFacility(result.facilities[0].id)
      }

      if (!selectedVehicle && result.vehicles?.length) {
        setSelectedVehicle(result.vehicles[0].id)
      }
    } catch (e: any) {
      setError(e.message || 'Could not connect to the API')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (!scannerOpen) return
    let stream: MediaStream | null = null
    let timer = 0
    let active = true

    const startScanner = async () => {
      const BarcodeDetectorCtor = (window as any).BarcodeDetector
      if (!BarcodeDetectorCtor) {
        setNotice('QR camera scanning is not supported in this browser. Enter the pass token manually.')
        setScannerOpen(false)
        return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setNotice('Camera access requires HTTPS or localhost. Enter the pass token manually.')
        setScannerOpen(false)
        return
      }
      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] })
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      if (!active) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      const video = gateVideoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      const scan = async () => {
        if (!active) return
        try {
          const codes = await detector.detect(video)
          const raw = codes?.[0]?.rawValue || ''
          if (raw) {
            const parts = raw.split('|')
            if (parts[0] === 'PARKEASE' && parts[1] === 'PASS' && parts.length >= 4) {
              setGateRef(parts[2])
              setGatePassToken(parts.slice(3).join('|'))
              setNotice('Parking pass QR recognised. Confirm the vehicle plate, then approve entry.')
              setScannerOpen(false)
              return
            }
            setNotice('This QR is not a valid ParkEase parking pass.')
          }
        } catch {
          // Continue scanning while the camera is active.
        }
        timer = window.setTimeout(scan, 350)
      }
      scan()
    }
    startScanner().catch((e: any) => {
      setNotice(e.message || 'Could not start the camera. Check browser permissions.')
      setScannerOpen(false)
    })
    return () => {
      active = false
      if (timer) window.clearTimeout(timer)
      stream?.getTracks().forEach(track => track.stop())
      if (gateVideoRef.current) gateVideoRef.current.srcObject = null
    }
  }, [scannerOpen])

  useEffect(() => {
    if (!notice) return

    const timer = window.setTimeout(() => setNotice(''), 4200)

    return () => window.clearTimeout(timer)
  }, [notice])

  const facilities: AnyObj[] = data.facilities || []
  const slots: AnyObj[] = data.slots || []
  const vehicles: AnyObj[] = data.vehicles || []
  const bookings: AnyObj[] = data.bookings || []
  const payments: AnyObj[] = data.payments || []

  const facility =
    facilities.find(f => f.id === selectedFacility) || facilities[0]

  const facilitySlots =
    slots.filter(s => s.facility_id === facility?.id)

  const customer =
    (data.users || []).find((u: AnyObj) => u.role === 'CUSTOMER')

  const operator =
    (data.users || []).find((u: AnyObj) => u.role === 'OPERATOR')

  const myBookings = bookings.filter(b => b.customer_id === customer?.id)

  const filteredFacilities = facilities.filter(f =>
    `${f.name} ${f.address}`.toLowerCase().includes(query.toLowerCase())
  )

  const availableCount =
    slots.filter(s => s.status === 'AVAILABLE').length

  const occupiedCount =
    slots.filter(s => s.status === 'OCCUPIED').length

  const reservedCount =
    slots.filter(s => s.status === 'RESERVED').length

  const occupancy = slots.length
    ? Math.round((occupiedCount / slots.length) * 100)
    : 0

  const nav = role === 'CUSTOMER'
    ? [
        { label: 'Overview', icon: LayoutDashboard },
        { label: 'Find parking', icon: Search },
        { label: 'My bookings', icon: Ticket },
        { label: 'My vehicles', icon: CarFront },
        { label: 'Payments', icon: Wallet }
      ]
    : [
        { label: 'Overview', icon: LayoutDashboard },
        { label: 'Facilities & slots', icon: Building2 },
        { label: 'Gate control', icon: ScanLine },
        { label: 'Bookings', icon: Ticket },
        { label: 'Analytics', icon: BarChart3 },
        { label: 'Activity', icon: Activity }
      ]

  const go = (p: string) => setPage(p)

  const loadBookingQrs = async (booking: AnyObj) => {
    try {
      const result = await api(
        `/api/bookings/${encodeURIComponent(booking.id)}/qrs?customer_id=${encodeURIComponent(booking.customer_id)}`
      )
      setBookingQrs((current: AnyObj) => ({ ...current, [booking.id]: result }))
    } catch (e: any) {
      setNotice(e.message)
    }
  }

  const updateSlot = async (slot: AnyObj) => {
    const next =
      slot.status === 'AVAILABLE' ? 'BLOCKED' : 'AVAILABLE'

    try {
      await api(`/api/slots/${slot.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next })
      })

      setNotice(`${slot.code} marked ${titleCase(next)}.`)
      await refresh()
    } catch (e: any) {
      setNotice(e.message)
    }
  }

  const bookSlot = async () => {
    const vehicle = vehicles.find(v => v.id === selectedVehicle)

    if (!facility || !vehicle || !selectedSlot) {
      setNotice('Choose a vehicle and an available compatible slot first.')
      return
    }

    setBookingBusy(true)

    try {
      const hold = await api('/api/bookings/hold', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customer?.id || 'usr-cust-1',
          facility_id: facility.id,
          slot_id: selectedSlot,
          vehicle_id: vehicle.id,
          duration_hours: duration,
          booking_type: 'ADVANCE',
          payment_mode: 'PREPAID'
        })
      })

      await api('/api/bookings/confirm', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: hold.id,
          payment_method: 'SIMULATED_UPI',
          idempotency_key: `web-${hold.id}-${Date.now()}`
        })
      })

      setNotice(
        `Booking confirmed! Reference: ${hold.booking_ref}. Demo payment successful.`
      )

      setSelectedSlot('')
      setPage('My bookings')
      await refresh()
    } catch (e: any) {
      setNotice(e.message)
    } finally {
      setBookingBusy(false)
    }
  }

  const loadBookingQrs = async (booking: AnyObj) => {
    if (bookingQrs[booking.id]) {
      setBookingQrs((current: AnyObj) => ({ ...current, [booking.id]: null }))
      return
    }
    setQrBusy(booking.id)
    try {
      const result = await api(
        `/api/bookings/${encodeURIComponent(booking.id)}/qrs?customer_id=${encodeURIComponent(customer?.id || '')}`
      )
      setBookingQrs((current: AnyObj) => ({ ...current, [booking.id]: result }))
    } catch (e: any) {
      setNotice(e.message || 'Could not load booking QR codes.')
    } finally {
      setQrBusy('')
    }
  }

  const gateAction = async (action: 'entry' | 'exit') => {
    if (!gateRef.trim()) {
      setNotice('Enter a booking reference.')
      return
    }

    try {
      if (action === 'entry') {
        await api('/api/sessions/entry', {
          method: 'POST',
          body: JSON.stringify({
            booking_ref: gateRef.trim(),
            presented_plate: gatePlate.trim(),
            pass_token: gatePassToken.trim() || null,
            operator_override: gateOverride,
            override_note: gateOverride
              ? 'Manual operator verification in demo'
              : null
          })
        })

        setNotice('Gate entry approved. Parking session is now active.')
        setGatePassToken('')
      } else {
        await api('/api/sessions/exit', {
          method: 'POST',
          body: JSON.stringify({
            booking_ref: gateRef.trim(),
            payment_method: 'SIMULATED_UPI'
          })
        })

        setNotice('Exit completed. Demo payment settled and slot released.')
      }

      setGateOverride(false)
      await refresh()
    } catch (e: any) {
      setNotice(e.message)
    }
  }

  const processDemo = async () => {
    if (!facility) return

    try {
      const result = await api(
        `/api/ai/parking-video/process-demo?facility_id=${encodeURIComponent(facility.id)}&filename=sample_walkthrough.mp4`,
        { method: 'POST' }
      )

      setNotice(
        `Demo digitisation created ${result.candidates?.length || 0} candidate bays. Review required. This does not analyse an uploaded video.`
      )
    } catch (e: any) {
      setNotice(e.message)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <ParkingCircle size={23} />
          </div>
          <div>
            <b>ParkEase<span></span></b>
            <small>SMART PARKING PLATFORM</small>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <div className="role-switch">
          <button
            className={role === 'CUSTOMER' ? 'active' : ''}
            onClick={() => {
              setRole('CUSTOMER')
              setPage('Overview')
            }}
          >
            <Users size={15} /> Customer
          </button>

          <button
            className={role === 'OPERATOR' ? 'active' : ''}
            onClick={() => {
              setRole('OPERATOR')
              setPage('Overview')
            }}
          >
            <Gauge size={15} /> Operator
          </button>
        </div>

        <div className="nav-label">MENU</div>

        <nav>
          {nav.map(item => {
            const Icon = item.icon

            return (
              <button
                key={item.label}
                className={`nav-item ${page === item.label ? 'selected' : ''}`}
                onClick={() => go(item.label)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {page === item.label && <span className="nav-dot" />}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="support-card">
            <div className="support-icon">
              <CircleHelp size={17} />
            </div>
            <b>Need a hand?</b>
            <p>Explore the demo workspace and test the parking flow.</p>
            <button
              onClick={() =>
                setNotice(
                  'This is a hackathon demo. Payments, sensors and gate actions are simulated.'
                )
              }
            >
              Quick help <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="profile-menu-wrap">
            <button
              type="button"
              className={`profile profile-trigger ${profileMenuOpen ? 'open' : ''}`}
              onClick={() => setProfileMenuOpen(open => !open)}
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              aria-label="Open profile menu"
            >
              <span className="avatar">
                {role === 'CUSTOMER' ? 'AS' : 'VS'}
              </span>
              <span className="profile-copy">
                <b>
                  {role === 'CUSTOMER'
                    ? customer?.name || 'Aarav Sharma'
                    : operator?.name || 'Parking Operator'}
                </b>
                <small>
                  {role === 'CUSTOMER'
                    ? 'Customer account'
                    : 'Operator workspace'}
                </small>
              </span>
              <ChevronDown className={profileMenuOpen ? 'profile-chevron rotated' : 'profile-chevron'} size={16} />
            </button>

            {profileMenuOpen && (
              <div className="profile-dropdown" role="menu">
                <div className="profile-dropdown-heading">
                  <span className="profile-dropdown-label">SIGNED IN AS</span>
                  <b>
                    {role === 'CUSTOMER'
                      ? customer?.name || 'Aarav Sharma'
                      : operator?.name || 'Parking Operator'}
                  </b>
                  <small>{role === 'CUSTOMER' ? 'Customer account' : 'Operator workspace'}</small>
                </div>
                <div className="profile-dropdown-divider" />
                <button
                  type="button"
                  className="profile-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setRole(role === 'CUSTOMER' ? 'OPERATOR' : 'CUSTOMER')
                    setPage('Overview')
                    setProfileMenuOpen(false)
                  }}
                >
                  <span className="profile-menu-item-icon"><Users size={15} /></span>
                  <span>
                    <b>Switch workspace</b>
                    <small>Switch to {role === 'CUSTOMER' ? 'Operator' : 'Customer'}</small>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
                <button
                  type="button"
                  className="profile-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setNotice('ParkEase AI is running in demo mode. Payments, sensors and gate actions are simulated.')
                    setProfileMenuOpen(false)
                  }}
                >
                  <span className="profile-menu-item-icon"><CircleHelp size={15} /></span>
                  <span>
                    <b>Help & demo info</b>
                    <small>Learn about this workspace</small>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
                <div className="profile-dropdown-footer">ParkEase AI · Demo account</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="crumb">
            <span>ParkEase</span>
            <span className="slash">/</span>
            <b>{page}</b>
          </div>

          <div className="top-actions">
            <span className="demo-pill">
              <span /> DEMO ENVIRONMENT
            </span>
            <button
              className="icon-button"
              onClick={refresh}
              title="Refresh data"
            >
              <RefreshCw size={17} />
            </button>
            <div className="top-avatar">
              {role === 'CUSTOMER' ? 'AS' : 'VS'}
            </div>
          </div>
        </header>

        <div className="content">
          {error && (
            <div className="error-banner">
              <strong>Backend connection unavailable</strong>
              <span>
                {error}. Start FastAPI at http://127.0.0.1:8000, then refresh.
              </span>
              <button onClick={refresh}>Retry</button>
            </div>
          )}

          {notice && (
            <div className="toast">
              <Check size={16} />
              <span>{notice}</span>
              <button onClick={() => setNotice('')}>
                <X size={15} />
              </button>
            </div>
          )}

          {loading && !data.facilities?.length ? (
            <div className="loading-card">
              <div className="loader" />
              <b>Connecting to ParkEase</b>
              <p>Loading facilities, slots and demo activity…</p>
            </div>
          ) : (
            <>
              {page === 'Overview' && (
                <Overview
                  role={role}
                  data={data}
                  availableCount={availableCount}
                  occupiedCount={occupiedCount}
                  reservedCount={reservedCount}
                  occupancy={occupancy}
                  onFind={() =>
                    go(
                      role === 'CUSTOMER'
                        ? 'Find parking'
                        : 'Facilities & slots'
                    )
                  }
                  onGate={() => go('Gate control')}
                />
              )}

              {page === 'Find parking' && (
                <section>
                  <PageHeading
                    eyebrow="DISCOVER YOUR SPACE"
                    title="Find parking nearby"
                    subtitle="Choose a destination, compare authorised demo facilities and reserve a compatible bay."
                  />

                  <div className="searchbar">
                    <Search size={18} />
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Search facility or area…"
                    />
                    <SlidersHorizontal size={17} />
                  </div>

                  <div className="facility-grid">
                    {filteredFacilities.map(f => (
                      <div className="facility-card" key={f.id}>
                        <div className="facility-visual">
                          <div className="visual-chip">
                            <ParkingCircle size={16} />
                            AUTHORISED DEMO LOT
                          </div>
                          <div className="visual-lines" />
                          <div className="visual-caption">
                            <span>SMART</span>
                            <b>PARKING</b>
                          </div>
                        </div>

                        <div className="facility-body">
                          <div className="facility-title">
                            <div>
                              <h3>{f.name}</h3>
                              <p><MapPin size={13} /> {f.address}</p>
                            </div>
                            <span className="status-live">
                              ● {titleCase(f.status)}
                            </span>
                          </div>

                          <div className="facility-stats">
                            <span>
                              <b>
                                {slots.filter(s =>
                                  s.facility_id === f.id &&
                                  s.status === 'AVAILABLE'
                                ).length}
                              </b> available
                            </span>
                            <span>
                              <b>
                                {slots.filter(s => s.facility_id === f.id).length}
                              </b> total bays
                            </span>
                            <span>
                              <b>{money(f.rate_car_hr)}</b>/hr car
                            </span>
                          </div>

                          <button
                            className="primary-button full"
                            onClick={() => {
                              setSelectedFacility(f.id)
                              setSelectedSlot('')
                              setPage('Find parking')
                            }}
                          >
                            View parking bays <ArrowUpRight size={16} />
                          </button>

                          {selectedFacility === f.id && (
                            <div className="slot-panel">
                              <div className="slot-panel-head">
                                <b>Choose a bay</b>
                                <span>Ground / demo layout</span>
                              </div>

                              <div className="slot-grid">
                                {slots
                                  .filter(s => s.facility_id === f.id)
                                  .map(s => (
                                    <button
                                      key={s.id}
                                      disabled={s.status !== 'AVAILABLE'}
                                      onClick={() => setSelectedSlot(s.id)}
                                      className={`slot ${s.status.toLowerCase()} ${selectedSlot === s.id ? 'chosen' : ''}`}
                                      title={`${s.code} · ${s.slot_type} · ${s.status}`}
                                    >
                                      {s.code}
                                    </button>
                                  ))}
                              </div>

                              <div className="slot-legend">
                                <span><i className="available" /> Available</span>
                                <span><i className="occupied" /> Occupied</span>
                                <span><i className="reserved" /> Reserved</span>
                                <span><i className="blocked" /> Other</span>
                              </div>

                              <div className="booking-controls">
                                <label>
                                  Vehicle
                                  <select
                                    value={selectedVehicle}
                                    onChange={e => setSelectedVehicle(e.target.value)}
                                  >
                                    {vehicles.map(v => (
                                      <option key={v.id} value={v.id}>
                                        {v.nickname} · {v.plate_number}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <label>
                                  Duration
                                  <select
                                    value={duration}
                                    onChange={e => setDuration(Number(e.target.value))}
                                  >
                                    {[1, 2, 3, 4, 6, 8].map(n => (
                                      <option key={n} value={n}>
                                        {n} hours
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <button
                                  className="primary-button"
                                  disabled={!selectedSlot || bookingBusy}
                                  onClick={bookSlot}
                                >
                                  {bookingBusy ? 'Booking…' : 'Reserve & pay'}
                                </button>
                              </div>

                              <p className="micro-note">
                                Demo payment only. The backend validates
                                vehicle-to-bay compatibility and availability.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {page === 'My bookings' && (
                <section>
                  <PageHeading
                    eyebrow="YOUR PARKING ACTIVITY"
                    title="My bookings"
                    subtitle="View reservations, active sessions and completed visits."
                  />

                  <div className="table-card">
                    <div className="table-head">
                      <b>Booking history</b>
                      <span>{myBookings.length} records</span>
                    </div>

                    <div className="responsive-table">
                      <table>
                        <thead>
                          <tr>
                            <th>REFERENCE</th>
                            <th>FACILITY / BAY</th>
                            <th>VEHICLE</th>
                            <th>AMOUNT</th>
                            <th>STATUS</th>
                            <th>DIGITAL PASS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookings.map(b => (
                            <tr key={b.id}>
                              <td>
                                <b className="ref">{b.booking_ref}</b>
                                <small>{dateTime(b.start_time)}</small>
                              </td>
                              <td>
                                {facilities.find(f => f.id === b.facility_id)?.name || b.facility_id}
                                <small>Bay {b.snapshot_slot_code}</small>
                              </td>
                              <td>
                                {b.snapshot_plate}
                                <small>{titleCase(b.snapshot_vehicle_type)}</small>
                              </td>
                              <td>
                                <b>{money(b.total_amount)}</b>
                                <small>{titleCase(b.payment_status)}</small>
                              </td>
                              <td><Status value={b.status} /></td>
                              <td>
                                {['CONFIRMED', 'ACTIVE_SESSION', 'COMPLETED'].includes(b.status) ? (
                                  <button className="text-button" disabled={qrBusy === b.id} onClick={() => loadBookingQrs(b)}>
                                    {qrBusy === b.id ? 'Loading…' : bookingQrs[b.id] ? 'Hide QR codes' : 'View QR codes'}
                                  </button>
                                ) : <small>Available after confirmation</small>}
                                {bookingQrs[b.id] && (
                                  <div className="booking-qr-panel">
                                    <div className="booking-qr-item">
                                      <b>Parking pass</b>
                                      <img src={bookingQrs[b.id].parking_qr_data} alt="Secure ParkEase parking pass QR code" />
                                      <small>Show this at the entry gate. Keep it private.</small>
                                    </div>
                                    {bookingQrs[b.id].payment_qr_data ? (
                                      <div className="booking-qr-item">
                                        <b>UPI payment · {money(bookingQrs[b.id].amount)}</b>
                                        <img src={bookingQrs[b.id].payment_qr_data} alt="UPI payment QR code" />
                                        <small>Scan in a UPI app and approve payment. ParkEase does not verify payment from the scan alone.</small>
                                        <a href={bookingQrs[b.id].upi_uri}>Open UPI app</a>
                                      </div>
                                    ) : (
                                      <div className="booking-qr-note">{bookingQrs[b.id].payment_note || 'Payment QR unavailable.'}</div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!myBookings.length && (
                        <Empty text="No bookings yet. Find a parking bay to make your first reservation." />
                      )}
                    </div>
                  </div>
                </section>
              )}

              {page === 'My vehicles' && (
                <section>
                  <PageHeading
                    eyebrow="GARAGE"
                    title="My vehicles"
                    subtitle="Vehicles available to use with your demo bookings."
                  />

                  <div className="vehicle-grid">
                    {vehicles.map(v => (
                      <div className="vehicle-card" key={v.id}>
                        <div className="vehicle-icon">
                          {v.category === 'BIKE' ? <Bike /> : <CarFront />}
                        </div>
                        <div>
                          <span className="type-label">{titleCase(v.category)}</span>
                          <h3>{v.nickname}</h3>
                          <p>{v.make_model} · {v.color}</p>
                          <div className="plate">{v.plate_number}</div>
                        </div>
                        <span className="vehicle-check"><Check size={15} /></span>
                      </div>
                    ))}
                  </div>

                  <div className="info-note">
                    <ShieldCheck size={18} />
                    <span>
                      Number-plate OCR is represented by seeded demo data.
                      Always verify the plate manually before gate entry.
                    </span>
                  </div>
                </section>
              )}

              {page === 'Payments' && (
                <section>
                  <PageHeading
                    eyebrow="TRANSACTIONS"
                    title="Payments"
                    subtitle="Demo payment records generated by booking and exit flows."
                  />

                  <div className="table-card">
                    <div className="table-head">
                      <b>Payment history</b>
                      <span>{payments.length} transactions</span>
                    </div>

                    <div className="responsive-table">
                      <table>
                        <thead>
                          <tr>
                            <th>PAYMENT</th>
                            <th>BOOKING</th>
                            <th>METHOD</th>
                            <th>DATE</th>
                            <th>AMOUNT</th>
                            <th>STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map(p => {
                            const b = bookings.find(x => x.id === p.booking_id)

                            return (
                              <tr key={p.id}>
                                <td className="ref">{p.id}</td>
                                <td>{b?.booking_ref || p.booking_id}</td>
                                <td>{titleCase(p.method)}</td>
                                <td>{dateTime(p.created_at)}</td>
                                <td><b>{money(p.amount)}</b></td>
                                <td><Status value={p.status} /></td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>

                      {!payments.length && <Empty text="No payment records yet." />}
                    </div>
                  </div>

                  <p className="micro-note">No real money is collected in this prototype.</p>
                </section>
              )}

              {page === 'Facilities & slots' && (
                <section>
                  <PageHeading
                    eyebrow="OPERATIONS"
                    title="Facilities & slot control"
                    subtitle="Monitor facility capacity and update bay availability."
                  />

                  <div className="toolbar">
                    <select
                      value={facility?.id || ''}
                      onChange={e => setSelectedFacility(e.target.value)}
                    >
                      {facilities.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>

                    <button className="secondary-button" onClick={processDemo}>
                      <Sparkles size={16} /> Run AI digitisation demo
                    </button>
                  </div>

                  {facility && (
                    <div className="operator-facility">
                      <div>
                        <span className="type-label">SELECTED FACILITY</span>
                        <h3>{facility.name}</h3>
                        <p>{facility.address}</p>
                      </div>

                      <div className="facility-kpis">
                        <div>
                          <b>{facilitySlots.length}</b>
                          <small>Total bays</small>
                        </div>
                        <div>
                          <b>{facilitySlots.filter(s => s.status === 'AVAILABLE').length}</b>
                          <small>Available</small>
                        </div>
                        <div>
                          <b>{facilitySlots.filter(s => s.status === 'OCCUPIED').length}</b>
                          <small>Occupied</small>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="table-card">
                    <div className="table-head">
                      <b>Bay inventory</b>
                      <span>Click an available or blocked bay to toggle it</span>
                    </div>

                    <div className="responsive-table">
                      <table>
                        <thead>
                          <tr>
                            <th>BAY</th>
                            <th>TYPE</th>
                            <th>ZONE</th>
                            <th>SOURCE</th>
                            <th>STATUS</th>
                            <th>ACTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {facilitySlots.map(s => (
                            <tr key={s.id}>
                              <td><b>{s.code}</b></td>
                              <td>
                                {titleCase(s.slot_type)}
                                {s.has_ev_charger ? ' · Charger' : ''}
                              </td>
                              <td>{s.zone}</td>
                              <td>{titleCase(s.data_source)}</td>
                              <td><Status value={s.status} /></td>
                              <td>
                                <button
                                  className="text-button"
                                  disabled={['OCCUPIED', 'RESERVED', 'STALE'].includes(s.status)}
                                  onClick={() => updateSlot(s)}
                                >
                                  {s.status === 'AVAILABLE' ? 'Block bay' : 'Mark available'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="info-note">
                    <Sparkles size={18} />
                    <span>
                      AI digitisation currently returns predefined sample
                      candidates for review. It does not process an uploaded
                      video or publish new slots.
                    </span>
                  </div>
                </section>
              )}

              {page === 'Gate control' && (
                <section>
                  <PageHeading
                    eyebrow="SMART GATE SIMULATOR"
                    title="Entry & exit control"
                    subtitle="Validate a booking reference and vehicle plate to simulate a gate event."
                  />

                  <div className="gate-layout">
                    <div className="gate-card">
                      <div className="gate-icon"><ScanLine size={24} /></div>
                      <h3>Verify vehicle at entry</h3>
                      <p>Use a confirmed booking reference and the registered number plate.</p>

                      <label>
                        Booking reference
                        <input
                          value={gateRef}
                          onChange={e => setGateRef(e.target.value)}
                          placeholder="e.g. PK-ELANTE-8821"
                        />
                      </label>

                      <label>
                        Number plate
                        <input
                          value={gatePlate}
                          onChange={e => setGatePlate(e.target.value.toUpperCase())}
                          placeholder="e.g. CH01AB1045"
                        />
                      </label>

                      <button className="secondary-button full" type="button" onClick={() => setScannerOpen(value => !value)}>
                        <ScanLine size={16} /> {scannerOpen ? 'Stop QR scanner' : 'Scan parking pass QR'}
                      </button>
                      {scannerOpen && (
                        <div style={{ margin: '12px 0' }}>
                          <video ref={gateVideoRef} autoPlay muted playsInline style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, background: '#111' }} />
                          <small>Point the rear camera at the customer’s ParkEase pass QR code.</small>
                        </div>
                      )}

                      <label>
                        Parking pass token
                        <input
                          value={gatePassToken}
                          onChange={e => setGatePassToken(e.target.value)}
                          placeholder="Enter token from customer parking QR"
                        />
                      </label>

                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={gateOverride}
                          onChange={e => setGateOverride(e.target.checked)}
                        />
                        Operator override after manual verification
                      </label>

                      <button
                        className="primary-button full"
                        onClick={() => gateAction('entry')}
                      >
                        Approve entry <ArrowDownRight size={16} />
                      </button>
                    </div>

                    <div className="gate-card exit-card">
                      <div className="gate-icon"><LogOut size={23} /></div>
                      <h3>Complete parking session</h3>
                      <p>Simulate exit, settle the demo payment and release the assigned bay.</p>

                      <div className="gate-summary">
                        <span>Payment method</span>
                        <b>Simulated UPI</b>
                        <span>Settlement</span>
                        <b>Booking amount</b>
                        <span>Slot release</span>
                        <b>Automatic</b>
                      </div>

                      <button
                        className="secondary-button full"
                        onClick={() => gateAction('exit')}
                      >
                        Process exit <ArrowUpRightFromSquare size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="table-card">
                    <div className="table-head">
                      <b>Current sessions</b>
                      <span>
                        {(data.sessions || []).filter((s: AnyObj) => s.status === 'ACTIVE').length} active
                      </span>
                    </div>

                    <div className="responsive-table">
                      <table>
                        <thead>
                          <tr>
                            <th>BOOKING</th>
                            <th>PLATE</th>
                            <th>ENTRY TIME</th>
                            <th>STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.sessions || []).map((s: AnyObj) => (
                            <tr key={s.id}>
                              <td>
                                {bookings.find(b => b.id === s.booking_id)?.booking_ref || s.booking_id}
                              </td>
                              <td>{s.presented_plate}</td>
                              <td>{dateTime(s.entry_time)}</td>
                              <td><Status value={s.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {!data.sessions?.length && <Empty text="No gate sessions yet." />}
                    </div>
                  </div>
                </section>
              )}

              {page === 'Bookings' && (
                <section>
                  <PageHeading
                    eyebrow="RESERVATION MANAGEMENT"
                    title="All bookings"
                    subtitle="Monitor customer reservations and their lifecycle states."
                  />

                  <div className="table-card">
                    <div className="table-head">
                      <b>Booking register</b>
                      <span>{bookings.length} total</span>
                    </div>

                    <div className="responsive-table">
                      <table>
                        <thead>
                          <tr>
                            <th>REFERENCE</th>
                            <th>CUSTOMER</th>
                            <th>FACILITY / BAY</th>
                            <th>VEHICLE</th>
                            <th>AMOUNT</th>
                            <th>STATUS</th>
                            <th>PASS / PAYMENT QR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {myBookings.map(b => (
                            <tr key={b.id}>
                              <td className="ref">{b.booking_ref}</td>
                              <td>
                                {(data.users || []).find((u: AnyObj) => u.id === b.customer_id)?.name || b.customer_id}
                              </td>
                              <td>
                                {facilities.find(f => f.id === b.facility_id)?.name}
                                <small>{b.snapshot_slot_code}</small>
                              </td>
                              <td>{b.snapshot_plate}</td>
                              <td>{money(b.total_amount)}</td>
                              <td><Status value={b.status} /></td>
                              <td>
                                <button className="secondary-button" onClick={() => loadBookingQrs(b)} disabled={!['CONFIRMED', 'ACTIVE_SESSION'].includes(b.status)}>
                                  {bookingQrs[b.id] ? 'Refresh QR' : 'Show QR'}
                                </button>
                                {bookingQrs[b.id] && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
                                    <div style={{ width: 132 }}>
                                      <img src={bookingQrs[b.id].parking_qr_data} alt="Digital parking pass QR" style={{ width: 120, height: 120, objectFit: 'contain', background: '#fff', padding: 6, borderRadius: 8 }} />
                                      <small>Parking pass</small>
                                    </div>
                                    {bookingQrs[b.id].payment_qr_data && (
                                      <div style={{ width: 132 }}>
                                        <img src={bookingQrs[b.id].payment_qr_data} alt="UPI payment QR" style={{ width: 120, height: 120, objectFit: 'contain', background: '#fff', padding: 6, borderRadius: 8 }} />
                                        <small>Pay {money(bookingQrs[b.id].amount)} via UPI</small>
                                      </div>
                                    )}
                                    <small style={{ flexBasis: '100%' }}>{bookingQrs[b.id].payment_note}</small>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}

              {page === 'Analytics' && role === 'OPERATOR' && (
                <Analytics
                  bookings={bookings}
                  payments={payments}
                  slots={slots}
                  facilities={facilities}
                  sessions={data.sessions || []}
                />
              )}

              {page === 'Activity' && (
                <section>
                  <PageHeading
                    eyebrow="AUDIT TRAIL"
                    title="Recent activity"
                    subtitle="Latest recorded operator and gate events in the demo environment."
                  />

                  <div className="activity-list">
                    {(data.audit_logs || []).map((a: AnyObj) => (
                      <div className="activity-row" key={a.id}>
                        <div className="activity-icon"><Activity size={16} /></div>
                        <div>
                          <b>{titleCase(a.action)}</b>
                          <p>{a.details}</p>
                          <small>{dateTime(a.timestamp)} · {titleCase(a.actor_role)}</small>
                        </div>
                      </div>
                    ))}

                    {!data.audit_logs?.length && <Empty text="No activity recorded yet." />}
                  </div>
                </section>
              )}
            </>
          )}

          <footer>
            <span>© 2026 ParkEase</span>
            <span>
              <span className="footer-dot" />
              Demo data · Not for real-world parking operations
            </span>
          </footer>
        </div>
      </main>
    </div>
  )
}

function PageHeading({
  eyebrow,
  title,
  subtitle
}: {
  eyebrow: string
  title: string
  subtitle: string
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  )
}

function Status({ value }: { value: string }) {
  const cls =
    ['AVAILABLE', 'SUCCESS', 'PAID', 'CONFIRMED', 'PUBLISHED', 'CLOSED'].includes(value)
      ? 'green'
      : ['OCCUPIED', 'ACTIVE', 'ACTIVE_SESSION'].includes(value)
        ? 'blue'
        : ['BLOCKED', 'FAILED', 'CANCELLED', 'EXPIRED', 'STALE'].includes(value)
          ? 'red'
          : 'amber'

  return (
    <span className={`status ${cls}`}>
      <i /> {titleCase(value)}
    </span>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <ParkingCircle size={25} />
      <p>{text}</p>
    </div>
  )
}

function Overview({
  role,
  data,
  availableCount,
  occupiedCount,
  reservedCount,
  occupancy,
  onFind,
  onGate
}: AnyObj) {
  const total = data.slots?.length || 0
  const bookings = data.bookings || []

  return (
    <section>
      <div className="welcome-row">
        <div>
          <span className="eyebrow">
            {role === 'CUSTOMER' ? 'YOUR PARKING, SIMPLIFIED' : 'OPERATOR CONTROL CENTRE'}
          </span>
          <h1>
            {role === 'CUSTOMER' ? 'Good to see you.' : 'Operations overview.'}
          </h1>
          <p>
            {role === 'CUSTOMER'
              ? 'Find a space, reserve your bay and get on with your day.'
              : 'A snapshot of your demo parking network.'}
          </p>
        </div>

        <button className="primary-button" onClick={onFind}>
          {role === 'CUSTOMER'
            ? <><Search size={16} /> Find parking</>
            : <><Building2 size={16} /> Manage facilities</>}
        </button>
      </div>

      <div className="hero-banner">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={13} /> PARKING, MADE SMARTER
          </div>

          <h2>
            {role === 'CUSTOMER'
              ? <>Your next spot is<br /><em>closer than you think.</em></>
              : <>Every bay. One view.<br /><em>Complete control.</em></>}
          </h2>

          <p>
            {role === 'CUSTOMER'
              ? 'Discover authorised parking facilities around Chandigarh and Mohali.'
              : 'Monitor occupancy, manage bays and validate arrivals from one workspace.'}
          </p>

          <button className="hero-button" onClick={onFind}>
            {role === 'CUSTOMER' ? 'Explore parking' : 'Open operations'}
            <ArrowUpRight size={15} />
          </button>
        </div>

        <div className="hero-art">
          <div className="art-ring ring-one" />
          <div className="art-ring ring-two" />
          <div className="art-pin"><MapPin size={30} /></div>
          <div className="art-card">
            <span className="pulse" /> SMART PARKING <b>AVAILABLE</b>
          </div>
          <div className="art-label">FIND · PARK · PAY · GO</div>
        </div>
      </div>

      <div className="section-title">
        <div>
          <h2>{role === 'CUSTOMER' ? 'Your parking snapshot' : 'Network performance'}</h2>
          <p>Updated from the shared demo database</p>
        </div>
        <span className="updated"><span /> LIVE DEMO DATA</span>
      </div>

      <div className="metric-grid">
        <Metric
          icon={<ParkingCircle />}
          label="Available bays"
          value={availableCount}
          note="Ready to reserve"
          tone="green"
        />
        <Metric
          icon={<CarFront />}
          label="Occupied bays"
          value={occupiedCount}
          note="Currently in use"
          tone="blue"
        />
        <Metric
          icon={<Clock3 />}
          label="Reserved bays"
          value={reservedCount}
          note="Held or confirmed"
          tone="amber"
        />
        <Metric
          icon={<Gauge />}
          label="Occupancy rate"
          value={`${occupancy}%`}
          note={`${total} bays across demo lots`}
          tone="dark"
        />
      </div>

      <div className="lower-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>{role === 'CUSTOMER' ? 'Recent bookings' : 'Recent reservations'}</h3>
              <p>Latest activity across the platform</p>
            </div>
            <button className="link-button" onClick={onFind}>
              Explore <ArrowUpRight size={14} />
            </button>
          </div>

          {bookings.slice(0, 4).map((b: AnyObj) => (
            <div className="booking-row" key={b.id}>
              <div className="booking-symbol"><Ticket size={17} /></div>
              <div className="booking-main">
                <b>{b.booking_ref}</b>
                <small>{b.snapshot_slot_code} · {b.snapshot_plate}</small>
              </div>
              <div className="booking-side">
                <b>{money(b.total_amount)}</b>
                <Status value={b.status} />
              </div>
            </div>
          ))}

          {!bookings.length && <Empty text="No bookings have been created yet." />}
        </div>

        <div className="panel network-panel">
          <div className="panel-heading">
            <div>
              <h3>Network health</h3>
              <p>Across all demo facilities</p>
            </div>
            <Activity size={18} className="muted-icon" />
          </div>

          <div className="occupancy-number">
            {occupancy}<small>%</small>
          </div>

          <div className="progress-track">
            <div style={{ width: `${occupancy}%` }} />
          </div>

          <div className="network-legend">
            <span><i className="available" /> Available <b>{availableCount}</b></span>
            <span><i className="occupied" /> Occupied <b>{occupiedCount}</b></span>
            <span><i className="reserved" /> Reserved <b>{reservedCount}</b></span>
          </div>

          <div className="network-foot">
            <ShieldCheck size={15} /> Demo telemetry · Not live IoT
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <button onClick={onFind}>
          <div><Search /></div>
          <span>
            <b>{role === 'CUSTOMER' ? 'Find a parking bay' : 'Manage parking bays'}</b>
            <small>
              {role === 'CUSTOMER'
                ? 'Search facilities and reserve a slot'
                : 'Update availability and facility status'}
            </small>
          </span>
          <ArrowUpRight size={17} />
        </button>

        <button onClick={onGate}>
          <div><ScanLine /></div>
          <span>
            <b>Smart gate simulator</b>
            <small>Test QR and number-plate verification</small>
          </span>
          <ArrowUpRight size={17} />
        </button>
      </div>
    </section>
  )
}

function Metric({ icon, label, value, note, tone }: AnyObj) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  )
}
