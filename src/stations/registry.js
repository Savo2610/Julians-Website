import * as THREE from 'three'

// Verwaltet alle Stationen: haelt ihre Position, prueft die Naehe zum Fahrer
// und meldet, welche gerade angesteuert ist. Die Darstellung des Hinweises
// uebernimmt die UI, das Oeffnen des Links passiert hier.

export class StationRegistry {
  constructor() {
    this.stations = []
    this.active = null
    this._tmp = new THREE.Vector3()
  }

  add(station) {
    this.stations.push({
      radius: 6,
      hint: 'ansehen',
      ...station,
      _proximity: 0,
    })
    return station
  }

  update(dt, skier) {
    let best = null
    let bestDist = Infinity

    for (const s of this.stations) {
      const dx = skier.position.x - s.position.x
      const dz = skier.position.z - s.position.z
      const dist = Math.hypot(dx, dz)

      // Weiche Naehe in [0, 1] – treibt Marker-Animation und Einblendung.
      const target = THREE.MathUtils.clamp(1 - (dist - s.radius * 0.45) / (s.radius * 0.55), 0, 1)
      s._proximity += (target - s._proximity) * (1 - Math.exp(-7 * dt))
      s.distance = dist

      if (dist < s.radius && dist < bestDist) {
        bestDist = dist
        best = s
      }
      s.marker?.update?.(dt, s._proximity)
    }

    const changed = best !== this.active
    this.active = best
    return changed
  }

  // Wird ausgeloest, wenn der Spieler an der aktiven Station bestaetigt.
  // `index` waehlt bei Stationen mit mehreren Zielen eines davon aus; ohne
  // Index gilt der gewohnte Weg (onUse, sonst url).
  trigger(index = null) {
    const s = this.active
    if (!s) return null

    if (index !== null) {
      const choice = s.choices?.[index]
      if (!choice) return null
      // Ein Ziel ist entweder eine Adresse oder eine Handlung. Solana ist der
      // Grund fuer die zweite Sorte: dort wird kein Link geoeffnet, sondern
      // ein Fenster, in dem man einen Betrag eintraegt.
      if (typeof choice.action === 'function') {
        choice.action()
        return s
      }
      if (!choice.url) return null
      window.open(choice.url, '_blank', 'noopener,noreferrer')
      return s
    }

    if (typeof s.onUse === 'function') {
      s.onUse(s)
      return s
    }
    if (s.url) {
      window.open(s.url, '_blank', 'noopener,noreferrer')
      return s
    }
    return s
  }
}
