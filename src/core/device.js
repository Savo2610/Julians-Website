// Ein Finger statt einer Tastatur. Gefragt wird nach dem Zeigegeraet und
// nicht nach der Bildschirmbreite: ein schmales Browserfenster am Rechner hat
// trotzdem Tasten, ein Tablet im Querformat trotzdem keine. Ein Laptop mit
// Touchscreen hat zusaetzlich ein Trackpad (`any-pointer: fine`) und bleibt
// deshalb beim Tastenmodus. `?touch` erzwingt den Handymodus zum Pruefen.
//
// Nur darf der feine Zeiger ein Handy nicht verraten: Samsungs mit S-Pen-
// Digitizer (Galaxy Z Fold 6, gemeldet am 27.09.) melden `any-pointer: fine`
// auch ganz ohne Stift, und zeigten dort WASD und „M“ statt Daumenstick – in
// Chrome wie im Samsung-Browser, zu- wie aufgeklappt. Ein Android- oder
// iOS-Browser mit Touchscreen ist darum immer Handymodus; wer daran eine
// Tastatur haengt, faehrt am Handy ohnehin nicht mit WASD. Der Desktopmodus
// dieser Browser meldet sich als Linux/Mac und faellt durch.
const mq = (q) => typeof window !== 'undefined' && (window.matchMedia?.(q).matches ?? false)

const nav = typeof navigator !== 'undefined' ? navigator : null
const handyOS = !!nav && nav.maxTouchPoints > 0
  && (nav.userAgentData?.mobile || /Android|iPhone|iPod/i.test(nav.userAgent ?? ''))

export const TOUCH = (typeof location !== 'undefined' && new URLSearchParams(location.search).has('touch'))
  || (mq('(pointer: coarse)') && !mq('(any-pointer: fine)'))
  || handyOS
