import * as THREE from 'three'
import { isSnowSurface } from '../world/surfaces.js'
import { SKIER, TRICK, SPRUNG } from '../config.js'
import { terrainHeight, slopeAlong, PLATEAU, playAreaDistance, onParkRail, inFunpark, kantenSprung, freiFlug, klammFlug, schanzeAnlauf, aufSteg, vorFigur, parkFlug, boxDeck, ueberBox, ohneAbwurf } from '../world/heightfield.js'
import { createSkierModel, HIP } from './skier-model.js'
import { landeStufe } from '../core/landung.js'

const damp = (rate, dt) => 1 - Math.exp(-rate * dt)

// Welche der vier Richtungen gerade gedrueckt sind – Tasten oder Daumenstick.
function richtungen(input) {
  const r = []
  if (input.steer > 0.3) r.push('rechts')
  if (input.steer < -0.3) r.push('links')
  if (input.throttle > 0.3) r.push('vor')
  if (input.braking) r.push('zurueck')
  return r
}

export class Skier {
  constructor(world) {
    this.world = world
    this.group = createSkierModel()
    this.parts = this.group.userData.parts

    this.position = new THREE.Vector3(PLATEAU.x, 0, PLATEAU.z + 2)
    this.heading = Math.PI          // angesteuerte Zielrichtung
    this.facing = Math.PI           // tatsaechliche Fahrtrichtung inkl. Schwung
    this.swingPhase = 0
    this.swing = 0
    this.speed = 0
    this.turn = 0
    this.steer = 0
    this.lean = 0
    this.pitch = 0
    this.crouch = 0
    this.airborne = false
    this.vy = 0
    this._rise = 0                  // Steiggeschwindigkeit, die der Boden zuletzt vorgab
    this._prevGroundY = 0
    this.tow = null          // haengt am Schlepplift, wenn gesetzt
    this.towTarget = null
    this.height = 0                 // Hoehe ueber dem Boden
    this.slope = 0
    this.tuck = 0                   // Abfahrtshocke bei hohem Tempo
    this.plough = 0                 // Schneepflug beim Bremsen mit S
    this.cross = 0                  // Quergefaelle, >0: lokales +X liegt talwaerts
    this.poise = 0                  // 0..1, wie deutlich die Hanghaltung gezeigt wird

    // --- Sprung --------------------------------------------------------
    this._nachsicht = 0             // s, in denen ein Druck nach der Kante noch zaehlt
    this._nachPop = 0               // m/s, die ein solcher Druck noch gibt
    this._parkSprung = false        // dieser Flug begann im Funpark
    this._luftY = null              // Flughoehe ueber Null bei freiem Flug, sonst NaN
    this._g = 18                    // Schwerkraft dieses Flugs, beim Absprung festgelegt
    this._abTempo = null            // Tempo beim Absprung im Park, sonst null
    this._box = null                // { f, start, stellung, … } solange man auf einer Box slidet

    // --- Tricks ---------------------------------------------------------
    // spin ist eine Drehung des Modells *gegen* die Fahrtrichtung, flip ein
    // Salto um die Querachse, slide ein Querstellen der Ski. Keines aendert
    // die Fahrtrichtung – sonst wuerde ein Trick die Steuerung uebernehmen,
    // und man landet dort, wo man nicht hinwollte. Sie liegen nur auf der
    // Darstellung obendrauf.
    this.spin = 0
    this.spinVel = 0
    this.flip = 0
    this.flipVel = 0
    this.slide = 0
    this.slideSide = 1
    this.trick = null        // { text, tone } nach einer gelungenen Figur
    this._wasAirborne = false
    this._flug = null        // { spin, flip } beim Absprung, dazu die Sperren

    // Eingeschneit: die Schneekanone legt hier ihren Wert ab, der Rest der
    // Welt liest ihn nur.
    this.snowed = 0
    this.snowBurst = 0
    this._buildSnowCaps()

    this.forward = new THREE.Vector3(0, 0, -1)
    this._prevFacing = this.facing
    this._trailPrev = [new THREE.Vector2(), new THREE.Vector2()]
    this._trailInit = false

    this.position.y = terrainHeight(this.position.x, this.position.z)
    this._prevGroundY = this.position.y
    this.group.position.copy(this.position)
  }

  // Schneehauben auf Helm und Schultern. Sie liegen fertig im Modell und
  // werden nur ein- und ausgeblendet – ein Objekt, das im Spiel entsteht,
  // waere fuer drei weisse Klumpen zuviel Umstand.
  _buildSnowCaps() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xfbfdff, roughness: 0.95, flatShading: true })
    const caps = []
    const put = (parent, x, y, z, r, flat) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat)
      m.position.set(x, y, z)
      m.scale.set(1, flat, 1)
      m.rotation.y = x * 3
      parent.add(m)
      caps.push(m)
    }
    put(this.parts.head, 0, 0.15, -0.02, 0.26, 0.5)
    put(this.parts.torso, -0.22, 0.24, -0.03, 0.16, 0.5)
    put(this.parts.torso, 0.22, 0.24, -0.03, 0.16, 0.5)
    put(this.parts.torso, 0, 0.06, -0.18, 0.19, 0.45)
    put(this.parts.skiLeft, 0, 0.05, 0.5, 0.12, 0.4)
    put(this.parts.skiRight, 0, 0.05, 0.5, 0.12, 0.4)
    this._snowCaps = caps
    for (const c of caps) c.visible = false
  }

  // Von der Schneekanone gerufen. Der Wert bleibt liegen, bis er abgeklungen
  // ist; ein zweiter Treffer frischt ihn nur auf.
  dustWithSnow(strength) {
    const before = this.snowed
    this.snowed = Math.min(1, Math.max(this.snowed, strength))
    if (before < 0.25 && this.snowed >= 0.25) {
      this.snowBurst = 1
      this.trick = { text: 'EINGESCHNEIT', tone: 'good' }
    }
  }

  // Goldene Ski fuer den vollen Pistenpass: aus Gruen wird Gold, dazu ein
  // Schimmer, der langsam ueber die Bretter laeuft. Die Kanten werden mit
  // vergoldet, sonst bleibt ein dunkler Rand um jedes Brett.
  vergolden() {
    if (this.gold) return
    this.gold = true
    const { ski, skiEdge } = this.parts.materials
    // Metall ohne Umgebungsbild wird nur dunkel (gemessen: satter Ocker
    // statt Gold) – deshalb wenig Metall und das Leuchten aus der Emission.
    ski.color.set(0xffcf45)
    ski.metalness = 0.3
    ski.roughness = 0.25
    ski.emissive.set(0xc88a00)
    skiEdge.color.set(0xe0a21f)
    skiEdge.roughness = 0.3
    skiEdge.emissive.set(0x7a5200)
    this._goldZeit = 0
  }

  update(dt, input, trail) {
    if (this.gold) {
      this._goldZeit += dt
      this.parts.materials.ski.emissiveIntensity = 0.3 + 0.6 * Math.max(0, Math.sin(this._goldZeit * 2.2)) ** 6
    }
    // Der Schnee auf den Schultern taut ueberall gleich – auch am Lift.
    this.snowed = Math.max(0, this.snowed - dt * 0.22)
    for (const c of this._snowCaps) {
      c.visible = this.snowed > 0.02
      const g = Math.min(1, this.snowed * 1.6)
      c.scale.setScalar(g)
      c.scale.y *= 0.5
    }

    if (this.tow && this.towTarget) {
      this._updateTowed(dt, input, trail)
      return
    }
    if (this._box) {
      this._updateBox(dt, input, trail)
      return
    }

    // --- Lenkung -------------------------------------------------------
    // A/D drehen die Fahrtrichtung aus Sicht des Fahrers. Positives steer =
    // nach rechts; da forward = (sin h, cos h) ist, muss das Heading dafuer
    // abnehmen.
    const steerInput = input.steer
    this.steer += (steerInput - this.steer) * damp(SKIER.steerLerp, dt)

    const moving = this.speed > 0.15
    const fast = THREE.MathUtils.clamp(this.speed / SKIER.cruiseSpeed, 0, 1)
    // Bei wenig Tempo dreht man fast auf der Stelle, bei viel Tempo traege.
    const rate = THREE.MathUtils.lerp(SKIER.turnRateSlow, SKIER.turnRate, fast)
    // In der Luft lenkt man kaum noch – und im Funpark gar nicht: dort
    // drehen A und D die Figur, nicht die Flugbahn (wie am Kabelsee).
    const luftLenkung = this.airborne ? (this._parkSprung ? 0 : 0.35) : 1
    const turnApplied = -this.steer * rate * luftLenkung * (moving ? 1 : 0.55) * dt
    this.heading += turnApplied

    const wantsMove = input.throttle > 0

    // --- Schwuenge ------------------------------------------------------
    // Ohne Lenkeingabe pendelt der Fahrer leicht um seine Richtung. Sobald
    // gelenkt wird, verschwindet der Ausschlag und man faehrt praezise.
    const swingSpeed = THREE.MathUtils.clamp(
      (this.speed - SKIER.swingMinSpeed) / (SKIER.cruiseSpeed - SKIER.swingMinSpeed), 0, 1,
    )
    // Im Funpark kein Pendeln auf der Schanze, vor einer Box und im Flug:
    // wer pendelnd an die Kante kam, flog bis zu 30 Grad schraeg ab und
    // landete neben dem Landehang in der Flanke, und eine Box verfehlte er
    // ohne Lenken um 2,8 m. In der Luft zog das Pendeln die Bahn in eine
    // Schlangenlinie.
    const ruhigFliegen = this.airborne && this._abTempo != null
    const rampe = !this.airborne && vorFigur(this.position.x, this.position.z)
    if (this.speed > 0.1 && !ruhigFliegen) {
      this.swingPhase += (this.speed / SKIER.swingWavelength) * Math.PI * 2 * dt
    }
    const swingTarget = rampe ? 0 :
      Math.sin(this.swingPhase) *
      SKIER.swingAmplitude *
      swingSpeed *
      (1 - Math.abs(this.steer) * 0.9) *
      (1 - schanzeAnlauf(this.position.x, this.position.z)) *
      (aufSteg(this.position.x, this.position.z) ? 0 : 1)
    if (!ruhigFliegen) this.swing += (swingTarget - this.swing) * damp(rampe ? 14 : 8, dt)

    this.facing = this.heading + this.swing
    this.forward.set(Math.sin(this.facing), 0, Math.cos(this.facing))

    // Tatsaechliche Drehrate aus der Aenderung der Fahrtrichtung ableiten –
    // sie enthaelt Lenken und Schwung gleichermassen und treibt Neigung,
    // Spurbreite und Schneestaub.
    let dFacing = this.facing - this._prevFacing
    dFacing = Math.atan2(Math.sin(dFacing), Math.cos(dFacing))
    this._prevFacing = this.facing
    const turnNorm = dt > 0 ? THREE.MathUtils.clamp(dFacing / dt / SKIER.turnRate, -1, 1) : 0
    this.turn += (turnNorm - this.turn) * damp(14, dt)

    // --- Tempo ---------------------------------------------------------
    // Konstantes Grundtempo, nur vom Gefaelle moduliert. Ohne Eingabe rollt
    // man aus und bleibt stehen – man soll sich Dinge ansehen koennen.
    this.slope = slopeAlong(this.position.x, this.position.z, this.forward.x, this.forward.z)
    let target = 0
    if (wantsMove) {
      target = SKIER.cruiseSpeed
      // Enge Kurven kosten Tempo.
      target -= Math.abs(this.turn) * 2.6
    }
    // Auf der Rampe der Klammschanze kostet das Steigen kein Tempo: sechs
    // Meter Rampe mit bis zu 37 Grad bremsten von 16 auf 11,5 m/s, und
    // damit flog jeder gleich weit – egal wie schnell er kam.
    const klammRampe = this.slope < 0 ? schanzeAnlauf(this.position.x, this.position.z) : 0
    target += this.slope * SKIER.slopeInfluence * (1 - klammRampe)
    if (input.braking) target = Math.min(target, 0)
    // Mit gedruecktem W kommt man auch den steilsten Hang noch hinauf – nur
    // sehr langsam. Sonst bleibt man vor Gegenhaengen einfach kleben.
    target = THREE.MathUtils.clamp(
      target,
      wantsMove && !input.braking ? SKIER.minClimbSpeed : 0,
      SKIER.boostSpeed + 8,
    )

    const accelRate = target > this.speed
      ? SKIER.accel
      : input.braking
        ? SKIER.brakeDrag
        : wantsMove
          ? 3.0
          : SKIER.coastDrag
    // Ueber dem Funpark zaehlen W und S nicht als Gas und Bremse – sie
    // schlagen dort den Salto, und ein Backflip soll nicht bremsen. Es
    // bleibt der Luftwiderstand weiter unten.
    if (!(this.airborne && this._parkSprung)) {
      if (!(klammRampe > 0.5 && target < this.speed)) {
        this.speed += (target - this.speed) * damp(this.airborne ? 0.5 : accelRate, dt)
      }
    }
    if (this.speed < 0.06) this.speed = 0

    // --- Bewegung ------------------------------------------------------
    const stepX = this.forward.x * this.speed * dt
    const stepZ = this.forward.z * this.speed * dt
    let nx = this.position.x + stepX
    let nz = this.position.z + stepZ

    const resolved = this.world.resolve(nx, nz, SKIER.bodyRadius, stepX, stepZ, this.height)
    nx = resolved.x
    nz = resolved.z
    if (resolved.hit) {
      // Nur frontale Treffer bremsen wirklich. Wer einen Baum streift, soll
      // an ihm entlangschrammen statt im Kontakt stehenzubleiben – sonst
      // frisst jeder Frame im Kontakt weitere 28 Prozent Tempo.
      const len = Math.hypot(resolved.pushX, resolved.pushZ) || 1
      const frontal = Math.max(
        0,
        -(this.forward.x * (resolved.pushX / len) + this.forward.z * (resolved.pushZ / len)),
      )
      this.speed *= 1 - frontal * frontal * 0.8
      this.impact = Math.max(this.impact || 0, frontal)
    }

    // Weiche Talgrenze, falls jemand den Gebirgsrand hochkriecht. Die Flaeche
    // ist keine Scheibe mehr, deshalb wird ueber den Abstandsgradienten
    // zurueckgeschoben statt zum Mittelpunkt hin.
    const bound = 9
    const edge = playAreaDistance(nx, nz)
    if (edge > bound) {
      const e = 0.6
      const gx = playAreaDistance(nx + e, nz) - playAreaDistance(nx - e, nz)
      const gz = playAreaDistance(nx, nz + e) - playAreaDistance(nx, nz - e)
      const len = Math.hypot(gx, gz) || 1
      const push = edge - bound
      nx -= (gx / len) * push
      nz -= (gz / len) * push
      this.speed *= 0.9
    }

    this.position.x = nx
    this.position.z = nz

    // --- Boden / Luft ---------------------------------------------------
    // Schwerkraft und Luftwiderstand. Zweiundzwanzig war korrekt und langweilig:
    // ein Sprung war nach einer knappen Sekunde vorbei, und in einer knappen
    // Sekunde dreht man einmal und schaut sonst zu. Achtzehn verlaengert jeden
    // Flug um gut ein Fuenftel und hebt den Scheitel um denselben Anteil, ohne
    // dass die Landung schwebend wird.
    //
    // Der Luftwiderstand ist der Preis dafuer. Laenger fliegen heisst bei
    // gleichem Tempo auch weiter fliegen, und die Landehaenge im Park sind so
    // lang, wie der Park breit ist. Wer in der Luft langsamer wird, bleibt
    // laenger oben und kommt trotzdem auf dem Hang auf. Nebenbei ist es genau
    // das, was man erwartet: quer in der Luft stehen kostet Tempo.
    //
    // Im Funpark fliegt man leichter (SPRUNG.schwerkraft, wie am Kabelsee):
    // dort ist der Flug die Figur. Entschieden wird beim Absprung und dann
    // fuer den ganzen Flug behalten – sonst kippte die Bahn am Parkrand.
    // Die Klammschanze zaehlt dabei wie der Park: Pop an der Kante, Figuren
    // in der Luft – aber mit der Schwerkraft des Tals (parkFlug sagt dort nein).
    const park = inFunpark(nx, nz) || klammFlug(nx, nz)
    const parkRegeln = parkFlug(nx, nz)
    const G = this.airborne && this._luftY != null ? this._g : parkRegeln ? SPRUNG.schwerkraft : 18
    const groundY = terrainHeight(nx, nz)
    // Wie schnell der Boden den Fahrer gerade anhebt. Auf einer Schanze ist
    // das die Steiggeschwindigkeit, mit der er ueber die Kante geht.
    const climb = dt > 0 ? (groundY - this._prevGroundY) / dt : 0

    // Absprung: Leertaste druecken springt sofort (Ansage 03.10.: Halten
    // und Loslassen wie am See war nicht eingaengig genug). Im Funpark
    // zaehlt dafuer der Moment wie am See – ueberall sonst ist es der alte
    // Hopser mit 6,4 m/s, auf der Rennstrecke aendert sich nichts.
    const druck = input.justPressed('jump')

    if (!this.airborne) {
      const free = this._prevGroundY + this._rise * dt - 0.5 * G * dt * dt
      // Nur beim Tastendruck, nicht solange sie liegt: gehalten heisst auf
      // Box und Kante "sliden", und wer haelt, soll nicht in Sprungfolgen
      // haengenbleiben.
      if (druck && this.speed > 1) {
        // Auf der Schanze nimmt der Pop mit, was die Rampe schon hebt: wer
        // zu frueh drueckt, bekommt nur den flachen Teil. Gemessen am
        // grossen Kicker 4 m vor der Kante: Steigrate 3,5 statt gut 12.
        this.airborne = true
        // Der Hopser im Park ist bei leichterer Schwerkraft kleiner, damit er
        // genauso hoch bleibt (1,14 m Scheitel) und nicht ueber den Kicker traegt.
        const hopser = parkRegeln ? SPRUNG.parkHopser : SPRUNG.hopser
        this.vy = park ? Math.min(Math.max(hopser, this._rise + SPRUNG.pop), 14) : SPRUNG.hopser
      } else if (this._rise > 3.2 && free > groundY + 0.03 && !ohneAbwurf(nx, nz)) {
        // Faellt der Boden hinter der Kante schneller weg, als die Schwerkraft
        // den Fahrer holt, hebt er ab. Kein Sprungknopf noetig – die Schanze
        // macht die Arbeit, so wie im Gelaende auch. Im Park darf man kurz
        // nach der Kante noch druecken und bekommt den Pop trotzdem
        // (Nachsicht wie am See: sonst verpasst man den Moment bei 13 m/s
        // um zwei Bilder).
        this.airborne = true
        this._nachsicht = park ? SPRUNG.nachsicht : 0
        this._nachPop = SPRUNG.pop
        // Nach oben begrenzt: eine Kante, die der Fahrer mit ueberhoehtem
        // Tempo trifft, soll ihn abheben lassen und nicht abschiessen. Der
        // Deckel liegt bei vierzehn – knapp sechs Meter Scheitelhoehe und
        // anderthalb Sekunden Flug, mehr als jede Schanze im Park hergibt.
        // Und eine Stufe ist keine Schanze: am Badesteg wirft sie
        // hoechstens mit 4 m/s (kantenSprung in heightfield.js).
        this.vy = Math.min(this._rise - G * dt, 14, kantenSprung(nx, nz))
        this.height = Math.min(free - groundY, 0.6)
      }
    } else if (this._nachsicht > 0) {
      this._nachsicht -= dt
      if (druck) {
        this.vy = Math.min(this.vy + this._nachPop, 14)
        this._nachsicht = 0
        if (this._abTempo != null) this.speed = this._steil(this._abTempo, this.vy)
      }
    }

    if (this.airborne) {
      // Beim Absprung entscheidet sich, ob der Flug ueber dem Boden mitlaeuft
      // oder auf fester Hoehe bleibt (freiFlug in heightfield.js).
      if (this._luftY == null) {
        this._luftY = freiFlug(nx, nz) ? groundY + this.height : NaN
        this._g = G
        // Im Park fliegt man hoch statt weit: die Kante lenkt das Tempo nach
        // oben um, statt Hoehe obendrauf zu legen. Sonst trug jede Sekunde
        // mehr Luft neun Meter weiter, und kein Landehang im Park waere lang
        // genug fuer einen 720.
        this._abTempo = parkRegeln ? this.speed : null
        if (parkRegeln) this.speed = this._steil(this.speed, this.vy)
      }
      this.vy -= G * dt
      if (Number.isNaN(this._luftY)) this.height += this.vy * dt
      else {
        this._luftY += this.vy * dt
        this.height = this._luftY - groundY
      }
      this.speed *= 1 - Math.min(0.5, SKIER.airDrag * dt)
      if (this.height <= 0) {
        this.height = 0
        this.airborne = false
        this.landImpact = Math.min(1, -this.vy / 12)
        // Und der Landehang gibt es zurueck: auf dem Gefaelle wird aus der
        // Fallgeschwindigkeit wieder Fahrt, hoechstens so viel wie beim
        // Absprung. Wer flach aufsetzt, bleibt langsam.
        if (this._abTempo != null) {
          // Gemessen um den Aufsetzpunkt herum, nicht nur nach vorn: am Fuss
          // des Landehangs saehe der Blick nach vorn schon den flachen Auslauf.
          const fx = this.forward.x * 0.6, fz = this.forward.z * 0.6
          const a = Math.atan(Math.max(0, (terrainHeight(nx - fx, nz - fz) - terrainHeight(nx + fx, nz + fz)) / 1.2))
          const hang = this.speed * Math.cos(a) - this.vy * Math.sin(a)
          this.speed = Math.max(this.speed, Math.min(this._abTempo, hang))
          this._abTempo = null
        }
        this.vy = 0
        this._luftY = null
      }
    } else {
      this.landImpact = (this.landImpact || 0) * (1 - damp(6, dt))
      this.height = 0
    }
    // Die Steigrate merkt man sich nur am Boden – in der Luft gibt der Boden
    // nichts mehr vor.
    this._rise = this.airborne ? 0 : Math.min(Math.max(0, climb), 24)
    this._prevGroundY = groundY
    this.position.y = groundY + this.height

    this._updateTrick(dt, input)
    if (!this.airborne) this._aufBox(input)

    // --- Haltung --------------------------------------------------------
    const speedNorm = THREE.MathUtils.clamp(this.speed / SKIER.cruiseSpeed, 0, 1.4)
    const leanTarget = -this.turn * SKIER.leanMax * speedNorm
    this.lean += (leanTarget - this.lean) * damp(SKIER.leanLerp, dt)

    const pitchTarget = THREE.MathUtils.clamp(-this.slope * 0.5, -SKIER.pitchMax, SKIER.pitchMax)
    this.pitch += (pitchTarget - this.pitch) * damp(4, dt)

    // Pflug nur am Boden und nicht beim Sliden – quergestellte Ski sind
    // schon eine Figur, ein Pflug obendrauf verknotet die Beine.
    const sliding = Math.abs(this.slide) / TRICK.slideAngle
    const ploughTarget = input.braking && !this.airborne ? 1 - sliding : 0
    this.plough += (ploughTarget - this.plough) * damp(9, dt)

    // Die Hocke kommt langsam und geht schnell: wer bremst oder lenkt,
    // richtet sich auf, statt eine halbe Sekunde geduckt weiterzufahren.
    // Gemessen wird am Lenken, nicht an this.turn – die Schwuenge allein
    // treiben turn bei Tempo 14 auf 0.87, dann kaeme die Hocke nie.
    const tuckTarget = THREE.MathUtils.clamp(
      (this.speed - SKIER.tuckFrom) / (SKIER.tuckFull - SKIER.tuckFrom), 0, 1,
    ) * (1 - Math.abs(this.steer) * 0.7) * (1 - this.plough)
    this.tuck += (tuckTarget - this.tuck) * damp(tuckTarget > this.tuck ? 2.5 : 7, dt)

    // Quergefaelle gegen die lokale +X-Achse des Modells. In der Luft gibt
    // es keinen Hang, dann richtet sich der Fahrer wieder gerade.
    const cross = this.airborne
      ? 0
      : slopeAlong(this.position.x, this.position.z, Math.cos(this.facing), -Math.sin(this.facing))
    this.cross += (THREE.MathUtils.clamp(cross, -0.8, 0.8) - this.cross) * damp(5, dt)

    // Wie deutlich die Hanghaltung gezeigt wird. Bergauf und im Kriechtempo
    // gar nicht: dort sah die Kommaform aus wie ein Fahrer, der gleich
    // umfaellt. Sie ist Schmuck fuer die Abfahrt, keine Skisimulation.
    const flott = THREE.MathUtils.clamp((this.speed - 4) / 6, 0, 1)
    const bergab = 1 - THREE.MathUtils.clamp(-this.slope * 4, 0, 1)
    this.poise += (flott * bergab - this.poise) * damp(3, dt)

    const crouchTarget = Math.abs(this.turn) * 0.35 + (this.landImpact || 0) * 0.9 + this.tuck * 0.5
    this.crouch += (Math.min(1.1, crouchTarget) - this.crouch) * damp(10, dt)

    this._applyPose(dt)
    this._stampTrail(trail, groundY)
  }

  // Tricks im Funpark, gesteuert wie am Kabelsee: in der Luft drehen A/D um
  // die Hochachse und W/S schlagen einen Salto, am Boden stellt die
  // Leertaste auf Box und Kante die Ski quer.
  //
  // Alles laeuft neben der Fahrphysik her und greift nicht in sie ein. Der
  // Fahrer fliegt weiter dorthin, wohin er zeigt – nur sein Modell steht
  // anders. Nur die Landung zaehlt: wer quer oder kopfueber aufsetzt,
  // verliert sein Tempo.
  _updateTrick(dt, input) {
    const TAU = Math.PI * 2

    // Der Absprung, von wo auch immer er kam – auch die Rail wirft ab.
    if (this.airborne && !this._wasAirborne) {
      this._wasAirborne = true
      this._parkSprung = inFunpark(this.position.x, this.position.z) || klammFlug(this.position.x, this.position.z)
      // Was beim Absprung schon gedrueckt ist, dreht nicht: W liegt beim
      // Fahren fast immer, und wer zur Schanze hin lenkt, soll nicht
      // ungewollt einen 180 springen. Erst loslassen, dann zaehlt die Taste;
      // von W direkt auf S zu wechseln reicht.
      this._flug = { spin: this.spin, flip: this.flip, gesperrt: new Set(richtungen(input)) }
    }

    if (this.airborne && this._parkSprung) {
      const f = this._flug
      this.slide += (0 - this.slide) * damp(TRICK.slideLerp, dt)
      const aktiv = richtungen(input)
      for (const r of f.gesperrt) if (!aktiv.includes(r)) f.gesperrt.delete(r)
      const frei = (r) => aktiv.includes(r) && !f.gesperrt.has(r)

      const steer = frei('rechts') ? input.steer : frei('links') ? input.steer : 0
      if (steer) {
        this.spinVel = Math.max(-TRICK.spinMax, Math.min(TRICK.spinMax, this.spinVel - steer * TRICK.spinAccel * dt))
      } else {
        this.spinVel *= Math.exp(-TRICK.spinDecay * dt)
      }
      const flipIn = (frei('vor') ? 1 : 0) - (frei('zurueck') ? 1 : 0)
      if (flipIn) {
        this.flipVel = Math.max(-TRICK.flipMax, Math.min(TRICK.flipMax, this.flipVel + flipIn * TRICK.flipAccel * dt))
      } else {
        this.flipVel *= Math.exp(-TRICK.flipDecay * dt)
      }
      this.spin += this.spinVel * dt
      this.flip += this.flipVel * dt

      // Landehilfe wie am See: ohne Taste dreht der Fahrer von selbst auf
      // die naechste Landestellung – sacht im Steigen, entschieden kurz vor
      // dem Aufsetzen. Halbe Umdrehungen beim Drehen, ganze beim Salto.
      const snap = this.vy < 0 && this.height < 2.2 ? TRICK.assistLand : TRICK.assistRise
      // Ueber einer Box darf man quer landen: dort hilft sie auf die naechste
      // Vierteldrehung, sonst drehte sie einen Boardslide mitten im Sprung
      // von Box zu Box halb heraus und er landete wackelig.
      const raster = ueberBox(this.position.x, this.position.z) ? Math.PI / 2 : Math.PI
      if (!steer) {
        const t = Math.round(this.spin / raster) * raster
        this.spin += (t - this.spin) * damp(snap, dt)
        this.spinVel *= Math.exp(-8 * dt)
      }
      if (!flipIn) {
        const t = Math.round(this.flip / TAU) * TAU
        this.flip += (t - this.flip) * damp(snap, dt)
        this.flipVel *= Math.exp(-8 * dt)
      }
      return
    }

    if (this._wasAirborne && !this.airborne) {
      this._wasAirborne = false
      if (this._parkSprung) this._landen()
      this._parkSprung = false
      this.spinVel = 0
      this.flipVel = 0
    }

    // Zurueck auf die naechste volle Umdrehung, damit das Ausrichten kurz ist.
    // Ausserhalb des Parks und bei Fluegen ohne Figur ist das sofort null.
    const home = Math.round(this.spin / TAU) * TAU
    this.spin += (home - this.spin) * damp(7, dt)
    if (Math.abs(this.spin - home) < 0.01) this.spin = 0
    const flipHome = Math.round(this.flip / TAU) * TAU
    this.flip += (flipHome - this.flip) * damp(9, dt)
    if (Math.abs(this.flip - flipHome) < 0.01) this.flip = 0

    // Am Boden: Ski quer, aber nur auf Box und Kante. Im Schnee laedt die
    // Leertaste den Sprung, und wer vor dem Kicker laedt, soll gerade
    // hinauffahren. Zu welcher Seite, entscheidet die letzte Lenkung – so
    // slidet man aus der Kurve heraus und nicht gegen sie.
    // Die Boxen haben seit 04.10. ihre eigene Fahrt (_updateBox); hier
    // bleibt nur die Schneekante unter dem Rail.
    const aufBox = inFunpark(this.position.x, this.position.z) && onParkRail(this.position.x, this.position.z) && !boxDeck(this.position.x, this.position.z)
    const sliding = aufBox && !this.airborne && input.has('jump') && this.speed > TRICK.slideMinSpeed
    if (sliding && this.slide < 0.05 && this.slide > -0.05) {
      this.slideSide = this.steer >= 0 ? 1 : -1
      this.trick = { text: 'BOARDSLIDE', tone: 'good' }
    }
    const target = sliding ? this.slideSide * TRICK.slideAngle : 0
    this.slide += (target - this.slide) * damp(TRICK.slideLerp, dt)
    // Quergestellte Ski bremsen. Nicht viel – Sliden soll Spass machen und
    // nicht die zweite Bremse sein.
    if (sliding) this.speed -= this.speed * TRICK.slideDrag * Math.abs(this.slide) * dt
  }

  // Tempo in der Waagerechten, wenn die Kante `tempo` mit `vy` nach oben
  // wirft: der Anteil, der nach vorn bleibt.
  _steil(tempo, vy) {
    return tempo * Math.cos(Math.atan2(Math.max(0, vy), tempo)) ** 2
  }

  // Aufgesetzt nach einem Flug im Park: Figur benennen und Landung werten,
  // mit denselben Fenstern wie am See. Quer oder kopfueber heisst Sturz – im
  // Tal liegt man dann nicht, verliert aber fast alles Tempo.
  _landen() {
    const TAU = Math.PI * 2
    const f = this._flug
    const dSpin = this.spin - f.spin
    const dFlip = this.flip - f.flip
    // Auf einer Box darf man quer aufsetzen – dort zaehlt die naechste
    // Vierteldrehung, wie am See.
    const slider = ueberBox(this.position.x, this.position.z)
    const q = landeStufe(this.spin, this.flip, TRICK, { slider })
    this._flug = null
    if (q.key === 'crash') {
      this.speed *= 0.3
      this.landImpact = 1
      this.trick = { text: 'STURZ', tone: 'bad' }
      return
    }
    if (q.key === 'sketchy') this.speed *= 0.78
    // Wer quer von der Box kommt, dreht sich zurueck in die Fahrt – das ist
    // eine Vierteldrehung und noch kein 180. Gezaehlt werden erst volle
    // halbe Umdrehungen darueber hinaus.
    const halves = Math.min(8, f.box
      ? Math.floor(Math.abs(dSpin) / Math.PI + 0.25)
      : Math.round(Math.abs(dSpin) / Math.PI))
    const flips = Math.round(Math.abs(dFlip) / TAU)
    let name = ''
    if (flips > 0) {
      const n = flips === 1 ? '' : flips === 2 ? 'DOPPEL-' : 'DREIFACH-'
      if (halves > 0) name = `${n}${dFlip < 0 ? 'CORK' : 'RODEO'} ${halves * 180}°`
      else name = `${n}${dFlip < 0 ? 'BACKFLIP' : 'FRONTFLIP'}`
    } else if (halves > 0) {
      name = `${halves * 180}°`
    }
    // Erst die Box, dann was in der Luft kam: „BOARDSLIDE 5 m · 360°“.
    if (f.box) name = name ? `${f.box} · ${name}` : f.box
    if (!name) return
    if (q.key === 'perfect') name += ' · PERFEKT'
    if (q.key === 'sketchy') name += ' · WACKELIG'
    this.trick = { text: name, tone: q.key === 'sketchy' ? 'meh' : 'good' }
  }

  // --- Box ---------------------------------------------------------------
  // Wie am Kabelsee: wer auf das Deck einer Box kommt – hinaufgefahren oder
  // hinaufgesprungen –, rastet ein. Die Box legt dann die Richtung fest, A/D
  // drehen nur noch die Stellung (laengs 50-50, quer Boardslide), und am
  // Ende wirft sie ab. Die Leertaste springt jederzeit herunter, mit Pop.
  //
  // Gutmuetig: es reicht, ungefaehr in Richtung der Box zu fahren (bis
  // TRICK.boxWinkel daneben). Die Schraege beim Aufsetzen bleibt als
  // Stellung erhalten und rastet auf die naechste Vierteldrehung ein – wer
  // quer daraufspringt, slidet quer.
  _aufBox(input) {
    if (this.speed < TRICK.boxMinTempo) return
    const d = boxDeck(this.position.x, this.position.z)
    if (!d || d.u > d.ende - 0.5) return
    const dir = Math.atan2(d.f.dx, d.f.dz)
    let schraeg = this.facing - dir
    schraeg = Math.atan2(Math.sin(schraeg), Math.cos(schraeg))
    if (Math.abs(schraeg) > TRICK.boxWinkel) return
    const q = Math.PI / 2
    this.spin = Math.round((this.spin + schraeg) / q) * q
    this.spinVel = 0
    this.heading = this.facing = this._prevFacing = dir
    this.swing = 0
    this.slide = 0
    this._box = { f: d.f, start: d.u, stellung: null, ziel: null, vorher: [], gesperrt: new Set(richtungen(input)) }
    this._boxStellung(true)
  }

  // Name der Stellung auf der Box; meldet sich, wenn sie wechselt.
  _boxStellung(neu) {
    const q = Math.round(this.spin / (Math.PI / 2))
    const name = q % 2 ? 'BOARDSLIDE' : '50-50'
    if (name !== this._box.stellung) {
      this._box.stellung = name
      if (!neu || !this.trick) this.trick = { text: name, tone: 'good' }
    }
  }

  _updateBox(dt, input, trail) {
    const b = this._box
    const f = b.f
    const dir = Math.atan2(f.dx, f.dz)
    const aktiv = richtungen(input)
    for (const r of b.gesperrt) if (!aktiv.includes(r)) b.gesperrt.delete(r)
    const frei = (r) => aktiv.includes(r) && !b.gesperrt.has(r)

    // Laengs entlang, quer sacht zur Mitte. Fast ohne Reibung: die Box ist
    // kurz, und wer langsam wird, faellt herunter statt zu sliden.
    this.speed *= Math.exp(-TRICK.boxDrag * dt)
    const ax = this.position.x - f.x
    const az = this.position.z - f.z
    let u = ax * f.dx + az * f.dz + this.speed * dt
    let v = -ax * f.dz + az * f.dx
    v += (0 - v) * damp(10, dt)
    this.position.x = f.x + f.dx * u - f.dz * v
    this.position.z = f.z + f.dz * u + f.dx * v

    this.heading = this.facing = this._prevFacing = dir
    this.forward.set(f.dx, 0, f.dz)
    this.swing = 0
    this.steer += (input.steer - this.steer) * damp(SKIER.steerLerp, dt)

    // A/D drehen die Stellung um eine Vierteldrehung je Druck: D quer
    // gestellt ist der Boardslide, noch einmal D steht man rueckwaerts.
    // Am See dreht Halten weiter, bis man loslaesst – hier sprang die
    // Anzeige dabei zwischen 50-50 und Boardslide hin und her (gemessen:
    // viermal in einer Sekunde), und wer nur quer wollte, stand verkehrt.
    const q = Math.PI / 2
    if (b.ziel == null) b.ziel = Math.round(this.spin / q)
    const neu = (r) => frei(r) && !b.vorher.includes(r)
    if (neu('rechts')) b.ziel -= 1
    if (neu('links')) b.ziel += 1
    b.vorher = aktiv
    this.spin += (b.ziel * q - this.spin) * damp(14, dt)
    this.spinVel = 0
    this.flip += (0 - this.flip) * damp(10, dt)
    this.slide += (0 - this.slide) * damp(10, dt)
    this._boxStellung(false)

    const groundY = terrainHeight(this.position.x, this.position.z)
    this.position.y = groundY + TRICK.boxDeck
    this.height = 0
    this._prevGroundY = groundY
    this._rise = 0
    this.slope = slopeAlong(this.position.x, this.position.z, f.dx, f.dz)

    const ende = f.length * 0.5 - f.ramp + 0.2
    const druck = input.justPressed('jump')
    if (druck || u >= ende || this.speed < TRICK.boxMinTempo * 0.6) {
      this._vonBox(druck, u - b.start, input)
    }

    // Haltung: leicht in den Knien, aufrecht, kein Pflug, keine Hocke.
    this.turn += (0 - this.turn) * damp(10, dt)
    this.lean += (0 - this.lean) * damp(8, dt)
    this.pitch += (0 - this.pitch) * damp(8, dt)
    this.crouch += (0.35 - this.crouch) * damp(8, dt)
    this.tuck += (0 - this.tuck) * damp(8, dt)
    this.plough += (0 - this.plough) * damp(8, dt)
    this.cross += (0 - this.cross) * damp(8, dt)
    this.poise += (0 - this.poise) * damp(8, dt)
    this.landImpact = (this.landImpact || 0) * (1 - damp(6, dt))
    this._applyPose(dt)
    // Holz nimmt keine Spur an.
    this._trailInit = false
  }

  // Herunter von der Box: am Ende wirft sie ab, mit der Leertaste springt
  // man selbst (Pop). Der Flug ist ein Parkflug wie von einer Schanze, mit
  // der Box im Namen.
  _vonBox(druck, weg, input) {
    const stellung = this._box.stellung
    this._box = null
    const meter = Math.max(1, Math.round(weg))
    this.airborne = true
    this.vy = SPRUNG.boxAbwurf + (druck ? SPRUNG.boxPop : 0)
    // Vom Holz aus, nicht vom Schnee darunter – sonst sackte er beim
    // Absprung erst um die Dicke des Decks durch.
    this.height = TRICK.boxDeck
    this._luftY = null
    // Wer quer steht, dreht in der Luft von selbst zurueck in die Fahrt und
    // nicht weiter in den Fakie: die Landehilfe nimmt die naechste halbe
    // Umdrehung, und von genau 90 Grad aus waeren beide gleich weit.
    const q = Math.PI / 2
    if (Math.abs(Math.round(this.spin / q)) % 2 === 1) this.spin -= Math.sign(this.spin) * 0.05
    this._wasAirborne = true
    this._parkSprung = true
    this._nachsicht = druck ? 0 : SPRUNG.nachsicht
    this._nachPop = SPRUNG.boxPop
    this._flug = {
      spin: this.spin, flip: this.flip,
      gesperrt: new Set(richtungen(input)),
      box: `${stellung} ${meter} m`,
    }
  }

  // Am Schlepplift gibt der Lift die Position vor. Alles andere laeuft
  // unveraendert weiter: der Fahrer steht auf den Ski, hinterlaesst seine Spur
  // und wird ganz normal beleuchtet – nur lenken kann er nicht mehr frei.
  _updateTowed(dt, input, trail) {
    const target = this.towTarget
    const groundY = terrainHeight(target.x, target.z)

    // Weich nachziehen statt hart setzen, sonst ruckt der Einstieg.
    const k = damp(9, dt)
    this.position.x += (target.x - this.position.x) * k
    this.position.z += (target.z - this.position.z) * k
    // `lift` hebt den Fahrer ueber den Boden – auf der Rail steht er auf dem
    // Rohr und nicht im Schnee.
    this.position.y = groundY + (this.tow.lift ?? 0)
    this.height = 0
    this.airborne = false
    this._luftY = null
    this._abTempo = null
    this._box = null
    this._rise = 0
    this._prevGroundY = groundY
    // Am Buegel oder auf dem Band wird nicht getrickst. Auf der Rail schon:
    // dort ist das Querstellen die ganze Figur.
    this.spin += (0 - this.spin) * damp(8, dt)
    const slideTarget = this.tow.slidePose ? TRICK.slideAngle : 0
    this.slide += (slideTarget - this.slide) * damp(8, dt)
    this.flip += (0 - this.flip) * damp(8, dt)
    this.spinVel = 0
    this.flipVel = 0
    this._nachsicht = 0
    this._wasAirborne = false
    this._parkSprung = false

    let diff = target.heading - this.heading
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    this.heading += diff * damp(6, dt)

    // Kein Schwung am Lift – man steht ruhig in der Spur.
    this.swing += (0 - this.swing) * damp(5, dt)
    this.steer += (input.steer - this.steer) * damp(SKIER.steerLerp, dt)
    this.facing = this.heading + this.swing
    this.forward.set(Math.sin(this.facing), 0, Math.cos(this.facing))

    let dFacing = this.facing - this._prevFacing
    dFacing = Math.atan2(Math.sin(dFacing), Math.cos(dFacing))
    this._prevFacing = this.facing
    this.turn += (0 - this.turn) * damp(6, dt)

    this.speed = this.tow.speed
    this.slope = slopeAlong(this.position.x, this.position.z, this.forward.x, this.forward.z)

    // Haltung: leicht zurueckgelehnt, wie wenn man am Buegel haengt.
    const hanging = this.tow.grab !== false
    this.lean += ((hanging ? this.steer * 0.12 : 0) - this.lean) * damp(4, dt)
    this.pitch += ((hanging ? -0.1 : 0.02) - this.pitch) * damp(4, dt)
    this.crouch += ((hanging ? 0.28 : 0.06) - this.crouch) * damp(5, dt)
    this.tuck += (0 - this.tuck) * damp(6, dt)
    this.plough += (0 - this.plough) * damp(6, dt)
    this.cross += (0 - this.cross) * damp(6, dt)
    this.poise += (0 - this.poise) * damp(6, dt)

    this._applyPose(dt)
    // Am Schlepplift greift der aussenliegende Arm nach oben zur Zugstange.
    // Der Zauberteppich traegt dagegen – dort steht man nur.
    if (this.tow.grab !== false) {
      const arm = this.parts.arms.right
      arm.rotation.x = -1.15
      arm.rotation.z = -0.25
    }

    this._stampTrail(trail, groundY)
  }

  _applyPose(dt) {
    const g = this.group
    g.position.copy(this.position)
    g.rotation.set(0, 0, 0)
    g.rotateY(this.facing + this.spin + this.slide)
    if (this.flip) {
      // Der Salto dreht um die Huefte, nicht um die Ski: sonst kippte der
      // Fahrer wie ein umfallender Pfahl ueber seine Fuesse.
      const P = 0.9
      const off = new THREE.Vector3(0, P * (1 - Math.cos(this.flip)), -P * Math.sin(this.flip))
      g.position.add(off.applyQuaternion(g.quaternion))
      g.rotateX(this.flip)
    }
    g.rotateX(this.pitch + (this.airborne ? -this.vy * 0.012 : 0))
    g.rotateZ(this.lean + this.slide * 0.18)

    const { torso, legs, legSides, skis, skiLeft, skiRight, head, arms } = this.parts
    const tuck = this.tuck
    const plough = this.plough

    // --- Schraeg zum Hang --------------------------------------------
    // Ski und Knie gehen mit dem Hang, der Oberkoerper bleibt ueber dem
    // Talski: die Kommaform, an der man einen Skifahrer von weitem erkennt.
    // Ohne sie stand der Fahrer lotrecht, und bei Quergefaelle 0.6 steckte
    // der Bergski 11 cm im Schnee; so liegen beide Ski auf 2 cm genau auf.
    const hang = THREE.MathUtils.clamp(this.cross / SKIER.traverseFull, -1, 1) * this.poise
    const groundRoll = -Math.atan(this.cross)
    // Die Ski liegen immer auf dem Hang, sonst steckten sie im Schnee; nur
    // in der Abfahrt greift der Bergski ein wenig mehr mit der Kante.
    const skiRoll = groundRoll * (1 + this.poise * 0.08) * (1 - plough * 0.6)
    skis.rotation.z = -this.lean * 0.55 + skiRoll
    // Knie in den Hang – das Beinpaar kippt um die Fuesse zur Bergseite.
    const kneeRoll = -groundRoll * 0.15 * this.poise
    legs.rotation.z = kneeRoll
    // Der Bergski laeuft eine Handbreit voraus.
    const lead = hang * 0.07

    // --- Pflug ---------------------------------------------------------
    // Schaufeln zusammen, Enden auseinander, Innenkanten im Schnee. Die
    // Fuesse gehen dafuer 9 cm nach aussen, sonst stiessen die Schaufeln
    // schon bei halbem Pflug aneinander.
    const spreadOut = plough * 0.09
    const yaw = plough * SKIER.ploughYaw
    const edge = plough * 0.2
    for (const [side, ski, hip] of [[-1, skiLeft, legSides.left], [1, skiRight, legSides.right]]) {
      // Wie weit der Hang diesen Ski hebt oder senkt – soweit muss das Bein
      // kuerzer oder laenger werden. Nur das Bergbein zu beugen liess bei
      // Quergefaelle 0.6 den Talschuh 11 cm ueber seinem Ski schweben. Das
      // Kippen der Knie nimmt den Fuss ein Stueck mit, das zieht man ab.
      const rise = side * 0.19 * (Math.sin(skiRoll) - Math.sin(kneeRoll))
      ski.position.x = side * (0.19 + spreadOut)
      ski.position.z = -side * lead
      ski.rotation.y = -side * yaw
      ski.rotation.z = side * edge
      // Das Bein folgt seinem Ski: nach aussen schwingen fuer den Pflug,
      // am Hang gebeugt oder gestreckt.
      hip.rotation.z = side * Math.asin(spreadOut / HIP.y)
      hip.position.z = -side * lead
      hip.scale.y = 1 - rise / (HIP.y - 0.05)
    }

    // --- Rumpf ---------------------------------------------------------
    // Kniebeugen: Torso runter, Ski leicht aufkanten. In der Hocke kommt
    // der Oberkoerper zusaetzlich flach nach vorne.
    torso.position.y = 0.98 - this.crouch * 0.22
    torso.rotation.x = 0.12 + this.crouch * 0.42 + tuck * 0.1
    // Die Huefte wandert mit den Knien zum Berg, die Schultern lehnen
    // zurueck ueber die Fuesse – beides nur angedeutet. Die volle Kommaform
    // (Huefte 20 cm zum Berg) war richtig und sah uebertrieben aus.
    torso.position.x = -Math.sin(kneeRoll) * HIP.y
    torso.rotation.z = groundRoll * 0.35 * this.poise
    legs.position.y = 0.1 - this.crouch * 0.05
    legs.scale.y = 1 - this.crouch * 0.12
    head.rotation.x = -this.crouch * 0.3 - tuck * 0.1
    // Beim Kanten stellt sich der Oberkoerper gegen die Kurve, und quer zum
    // Hang schaut die Brust ein Stueck talwaerts.
    torso.rotation.y = this.turn * 0.28 + hang * 0.12

    // --- Arme ----------------------------------------------------------
    // Hocke: Haende nach vorne und zusammen, die Stoecke liegen unter den
    // Achseln. Pflug: Arme etwas raus, wie man als Anfaenger die Balance haelt.
    for (const [side, arm] of [[-1, arms.left], [1, arms.right]]) {
      if (this.tow && side > 0) continue
      const rx = -tuck * 0.3 + plough * 0.08
      const rz = side * (plough * 0.18 - tuck * 0.1)
      arm.rotation.x += (rx - arm.rotation.x) * damp(6, dt)
      arm.rotation.z += (rz - arm.rotation.z) * damp(6, dt)
    }
  }

  // Setzt den Fahrer an einen anderen Ort (Schnellreise, Pruefwerkzeug).
  // Drei Dinge muessen mit zurueck: die Spurkette, sonst zieht er eine Linie
  // quer durchs Tal; _prevGroundY und _rise, sonst haelt er den Hoehensprung
  // fuer eine Schanze (einmal 94 Bilder Scheinflug gemessen). _prevGroundY
  // auf die neue Bodenhoehe, nicht auf null: null zaehlt als 0, und an 9 von
  // 15 Reisezielen hob der Fahrer nach der Ankunft ab.
  versetzen(x, z, heading = this.heading) {
    this.position.set(x, this.world.heightAt(x, z), z)
    this.speed = 0
    this.airborne = false
    this.vy = 0
    this._luftY = null
    this._nachsicht = 0
    this.spin = 0
    this.spinVel = 0
    this.flip = 0
    this.flipVel = 0
    this._wasAirborne = false
    this._parkSprung = false
    this._box = null
    this._abTempo = null
    this.heading = heading
    this.facing = heading
    this._prevFacing = heading
    this.swing = 0
    this.forward.set(Math.sin(heading), 0, Math.cos(heading))
    this._prevGroundY = this.position.y
    this._rise = 0
    this._trailInit = false
  }

  _stampTrail(trail, groundY) {
    if (!trail || this.airborne || this.speed < 0.25 || !isSnowSurface(this.position.x, this.position.z, 1.2)) {
      this._trailInit = false
      return
    }
    const cos = Math.cos(this.facing)
    const sin = Math.sin(this.facing)
    // Im Pflug stehen die Skienden weit auseinander.
    const spread = 0.19 + Math.abs(this.turn) * 0.1 + this.plough * 0.2

    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -spread : spread
      const wx = this.position.x + cos * side
      const wz = this.position.z - sin * side
      const prev = this._trailPrev[i]
      if (this._trailInit) {
        const width = 0.5 + Math.abs(this.turn) * 0.3 + this.plough * 0.35
        if (isSnowSurface((prev.x + wx) / 2, (prev.y + wz) / 2, width)) trail.stamp(prev.x, prev.y, wx, wz, width)
      }
      prev.set(wx, wz)
    }
    this._trailInit = true
  }
}
