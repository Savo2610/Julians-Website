import * as THREE from 'three'
import { LINKS } from './links.js'
import { createMarker } from './marker.js'
import { createEmergencyPhone } from '../world/props/emergency-phone.js'
import { createVendingMachine } from '../world/props/vending.js'
import { createUploadPipe } from '../world/props/upload-pipe.js'
import { createSignpost } from '../world/props/signpost.js'
import { createTelescope } from '../world/props/telescope.js'
import { createCabin } from '../world/props/cabin.js'
import { createDrone } from '../world/props/drone.js'
import { createFireTruck } from '../world/props/firetruck.js'
import { createShortcutTunnel } from '../world/props/shortcut-tunnel.js'
import { createGearDepot } from '../world/props/gear-depot.js'
import { CAMERA } from '../config.js'
import { findFlatSpot } from '../world/heightfield.js'

// Die Kamera blickt immer aus derselben Richtung. Objekte mit einer
// Schauseite muessen ihr also zugewandt sein, sonst liest man Schilder von
// hinten und Tueren zeigen ins Nichts.
const FACING = CAMERA.azimuth

// Wo im Tal was steht. Die Koordinaten sind handgesetzt: jede Station soll auf
// einer eigenen Lichtung stehen und von der vorigen aus sichtbar sein, damit
// man von selbst weiterfaehrt.

// Drei Wege fuehren vom Startplateau weg. Jede Station liegt an genau einem
// davon, damit man einen Strang zu Ende fahren kann, ohne etwas zu verpassen.
export const TRAILS = {
  career: {
    label: 'BERUF',
    color: '#0a66c2',
    markerColor: 0x3d7fc4,
    // Nach Osten, in die Mulde mit der Huette und weiter auf die Osthoehe.
    path: [[7, 27], [17, 24], [27, 20], [36, 14], [44, 4], [48, -6]],
  },
  social: {
    label: 'SOZIALES',
    color: '#c13584',
    markerColor: 0xd06098,
    // Nach Norden zum Telefon, dann nordwestlich zur Talstation des Lifts.
    // Der letzte Punkt der Reihe liegt oben am Gipfel – dorthin faehrt man
    // mit dem Lift.
    path: [[0, 20], [1, 8], [0, -2], [-8, -6], [-17, -7], [-25, -11]],
  },
  tools: {
    label: 'WERKSTATT',
    color: '#37b87c',
    markerColor: 0x46b98a,
    // Nach Westen, an der Rohrpost und dem Felsdurchgang vorbei.
    path: [[-8, 27], [-18, 25], [-28, 21], [-36, 14], [-44, 6], [-49, -4]],
  },
}

export const STATION_SPOTS = {
  // Weg 1 – beruflich
  cabin:     { x: 27, z: 20, clearing: 13, footprint: 3.4, search: 6, trail: 'career' },
  signpostCareer: { x: 47, z: -5, clearing: 8, footprint: 1.2, search: 7, trail: 'career' },

  // Weg 2 – Soziales und Bezahlen
  phone:     { x: 2, z: 0, clearing: 7, footprint: 1.2, search: 7, trail: 'social' },
  // Die Skikasse steht am Lifteinstieg – dort kauft man schliesslich sein
  // Ticket.
  vending:   { x: -23, z: -8, clearing: 7, footprint: 1.8, search: 5, trail: 'social' },
  // Das Fernrohr steht nicht auf der Kuppe, sondern eine Stufe darunter auf
  // der Talschulter – dort faengt die Abfahrt an und man sieht das ganze
  // Tal. Der hoechste Punkt bleibt dem Gipfelkreuz.
  telescope: { x: -47, z: -58, clearing: 7, footprint: 1.2, search: 3, trail: 'social' },

  // Weg 3 – Werkzeuge
  pipe:      { x: -19, z: 25, clearing: 8, footprint: 1.4, search: 6, trail: 'tools' },
  tunnel:    { x: -34, z: 15, clearing: 9, footprint: 2.0, search: 6, trail: 'tools' },
  depot:     { x: -48, z: 0, clearing: 8, footprint: 2.0, search: 7, trail: 'tools' },

  // Abseits der Wege – nur wer stoebert, findet sie.
  drone:     { x: -28, z: -30, clearing: 6, footprint: 1.2, search: 7, trail: null },
  firetruck: { x: 33, z: -30, clearing: 10, footprint: 3.2, search: 8, trail: null },
}

export function populateStations(world, registry) {
  const animated = []

  // Jede Station rutscht auf die flachste Stelle in ihrer Umgebung. Die
  // korrigierten Koordinaten werden zurueckgeschrieben, damit Marker, Hinweis
  // und Kollision am selben Ort sitzen wie das Objekt.
  for (const [key, spot] of Object.entries(STATION_SPOTS)) {
    const flat = findFlatSpot(spot.x, spot.z, spot.search ?? 9, spot.footprint ?? 2.2)
    spot.x = flat.x
    spot.z = flat.z
  }

  const place = (object, spot, { yOffset = 0, rotation = 0, collider = null } = {}) => {
    world.place(object, spot.x, spot.z, { yOffset, rotation })
    if (collider) world.addCollider(spot.x, spot.z, collider)
    if (object.userData.animate) animated.push(object.userData.animate)
    return object
  }

  const register = (station) => {
    const marker = createMarker(station.position.x, station.position.z, station.radius ?? 6, station.color)
    world.scene.add(marker)
    registry.add({ ...station, marker })
  }

  // --- Weg 1: beruflich ---------------------------------------------------
  const cabin = createCabin({ label: 'WERKSTATT' })
  place(cabin, STATION_SPOTS.cabin, { rotation: FACING + 0.28, collider: 2.1 })
  register({
    id: 'github',
    label: 'GitHub',
    hint: 'Werkstatt betreten',
    color: '#2b3137',
    url: LINKS.github,
    position: STATION_SPOTS.cabin,
    radius: 7.5,
    labelHeight: world.heightAt(STATION_SPOTS.cabin.x, STATION_SPOTS.cabin.z) + 4.2,
  })

  const careerSign = createSignpost([
    { text: 'LINKEDIN', background: '#0a66c2', width: 1.8, height: 0.48 },
    { text: 'Profil', background: '#e8e2d6', color: '#3b4a58', width: 1.4, height: 0.34 },
  ], { height: 2.7 })
  place(careerSign, STATION_SPOTS.signpostCareer, { rotation: FACING, collider: 0.55 })
  register({
    id: 'linkedin',
    label: 'LinkedIn',
    hint: 'Profil ansehen',
    color: '#0a66c2',
    url: LINKS.linkedin,
    position: STATION_SPOTS.signpostCareer,
    radius: 5.5,
    labelHeight: world.heightAt(STATION_SPOTS.signpostCareer.x, STATION_SPOTS.signpostCareer.z) + 3.5,
  })

  // --- Weg 2: Soziales und Bezahlen ---------------------------------------
  const phone = createEmergencyPhone()
  place(phone, STATION_SPOTS.phone, { rotation: FACING - 0.2, collider: 0.7 })
  register({
    id: 'signal',
    label: 'Signal',
    hint: 'Hoerer abnehmen',
    color: '#3a76f0',
    url: LINKS.signal,
    position: STATION_SPOTS.phone,
    radius: 5.5,
    labelHeight: world.heightAt(STATION_SPOTS.phone.x, STATION_SPOTS.phone.z) + 3.1,
  })

  const vending = createVendingMachine({ leftColor: 0x2b8ce6, rightColor: 0x9945ff })
  place(vending, STATION_SPOTS.vending, { rotation: FACING - 0.15, collider: 0.95 })
  register({
    id: 'paypal',
    label: 'Skikasse',
    hint: LINKS.paypal || LINKS.solana ? 'PayPal oder Solana' : 'noch nicht verlinkt',
    color: '#2b8ce6',
    position: STATION_SPOTS.vending,
    radius: 4.5,
    labelHeight: world.heightAt(STATION_SPOTS.vending.x, STATION_SPOTS.vending.z) + 3.2,
    onUse: () => {
      const target = LINKS.paypal || LINKS.solana
      if (target) window.open(target, '_blank', 'noopener,noreferrer')
    },
    choices: [
      { label: 'PayPal', url: LINKS.paypal, color: '#2b8ce6' },
      { label: 'Solana', url: LINKS.solana, color: '#9945ff' },
    ],
  })

  const telescope = createTelescope()
  place(telescope, STATION_SPOTS.telescope, { rotation: FACING + 0.4, collider: 0.6 })
  register({
    id: 'instagram',
    label: 'Instagram',
    hint: 'Durchschauen',
    color: '#c13584',
    url: LINKS.instagram,
    position: STATION_SPOTS.telescope,
    radius: 5,
    labelHeight: world.heightAt(STATION_SPOTS.telescope.x, STATION_SPOTS.telescope.z) + 2.6,
  })

  // --- Weg 3: Werkzeuge ---------------------------------------------------
  const pipe = createUploadPipe()
  place(pipe, STATION_SPOTS.pipe, { rotation: FACING + 0.1, collider: 0.8 })
  register({
    id: 'upload',
    label: 'Upload',
    hint: 'Etwas einwerfen',
    color: '#37b87c',
    url: LINKS.upload,
    position: STATION_SPOTS.pipe,
    radius: 5,
    labelHeight: world.heightAt(STATION_SPOTS.pipe.x, STATION_SPOTS.pipe.z) + 3.1,
    // Beim Ausloesen faehrt eine Kapsel aus dem Rohr – siehe upload-pipe.js.
    onUse: (station) => {
      pipe.userData.launch?.()
      if (LINKS.upload) window.open(LINKS.upload, '_blank', 'noopener,noreferrer')
    },
  })

  const tunnel = createShortcutTunnel({ label: 'ABKUERZUNG' })
  place(tunnel, STATION_SPOTS.tunnel, { rotation: FACING })
  for (const c of tunnel.userData.colliders) {
    // Die Schultern rotieren mit dem Objekt mit.
    const cos = Math.cos(FACING)
    const sin = Math.sin(FACING)
    world.addCollider(
      STATION_SPOTS.tunnel.x + c.dx * cos + c.dz * sin,
      STATION_SPOTS.tunnel.z - c.dx * sin + c.dz * cos,
      c.r,
    )
  }
  register({
    id: 'shortener',
    label: 'Link-Shortener',
    hint: 'Abkuerzung nehmen',
    color: '#5b7fa6',
    url: LINKS.shortener,
    position: STATION_SPOTS.tunnel,
    radius: 6,
    labelHeight: world.heightAt(STATION_SPOTS.tunnel.x, STATION_SPOTS.tunnel.z) + 4.2,
  })

  const depot = createGearDepot()
  place(depot, STATION_SPOTS.depot, { rotation: FACING - 0.25, collider: 1.1 })
  register({
    id: 'packlist',
    label: 'Packlisten-App',
    hint: 'Liste aufschlagen',
    color: '#c98a3a',
    url: LINKS.packlist,
    position: STATION_SPOTS.depot,
    radius: 5,
    labelHeight: world.heightAt(STATION_SPOTS.depot.x, STATION_SPOTS.depot.z) + 2.6,
  })

  // --- Abseits: die Fundstuecke -------------------------------------------
  const drone = createDrone()
  drone.scale.setScalar(1.35)
  place(drone, STATION_SPOTS.drone, { yOffset: 0.16, collider: 0.5 })
  register({
    id: 'drone',
    label: 'Abgestuerzte Drohne',
    hint: 'gefunden',
    color: '#ff4d3d',
    position: STATION_SPOTS.drone,
    radius: 4.5,
    labelHeight: world.heightAt(STATION_SPOTS.drone.x, STATION_SPOTS.drone.z) + 1.8,
  })

  const truck = createFireTruck()
  // Quer zur Blickrichtung, damit man die lange Seite mit der Leiter sieht.
  place(truck, STATION_SPOTS.firetruck, { rotation: FACING + Math.PI / 2, collider: 1.7 })
  register({
    id: 'firetruck',
    label: 'Feuerwehr',
    hint: 'gefunden',
    color: '#c8352c',
    position: STATION_SPOTS.firetruck,
    radius: 5.5,
    labelHeight: world.heightAt(STATION_SPOTS.firetruck.x, STATION_SPOTS.firetruck.z) + 2.8,
  })

  return { animated }
}
