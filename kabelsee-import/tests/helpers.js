import { CableSystem } from '../src/game/cable-system.js'
import { RiderPhysics } from '../src/player/rider-physics.js'
import { offsetAt } from '../src/world/features.js'

export const DT = 1 / 120

// Kleiner Fahrer fuer die Tests: plan(r, t) liefert die Eingabe je Schritt.
export function ride(seconds, plan, { onStep } = {}) {
  const cable = new CableSystem()
  const r = new RiderPhysics(cable)
  const events = []
  let prevJump = false
  for (let i = 0; i < seconds / DT; i++) {
    const t = i * DT
    const o = plan(r, t) || {}
    const jump = !!o.jump
    r.update(DT, { steer: o.steer || 0, throttle: !!o.throttle, brake: !!o.brake, jump, jumpReleased: prevJump && !jump, grab: !!o.grab })
    prevJump = jump
    cable.update(DT)
    for (const e of r.events) events.push({ ...e, t })
    r.events.length = 0
    onStep?.(r, t)
    if (o.stop?.(r)) break
  }
  return { r, events }
}

// Hocke erst, wenn das Seil schon halb gestrafft ist: der perfekte Start.
export const dockStart = (r) => (r.mode === 'dock' ? { jump: r.hooked && r.dockProgress > 0.55 } : null)

// Lenkt auf einen seitlichen Versatz zur Bahn (positiv = aussen), wie ein
// Fahrer, der eine Linie anpeilt: Abstand mal Verstaerkung, gedaempft mit
// der Quergeschwindigkeit.
export function steerTo(r, target, gain = 0.4, damping = 0.12) {
  const off = offsetAt(r.s, r.x, r.z)
  const ahead = offsetAt(r.s, r.x + r.vx * 0.05, r.z + r.vz * 0.05)
  const rate = (ahead - off) / 0.05
  return Math.max(-1, Math.min(1, (target - off) * gain - rate * damping))
}
