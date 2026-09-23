// Ein Finger statt einer Tastatur. Gefragt wird nach dem Zeigegeraet und
// nicht nach der Bildschirmbreite: ein schmales Browserfenster am Rechner hat
// trotzdem Tasten, ein Tablet im Querformat trotzdem keine. Ein Laptop mit
// Touchscreen hat zusaetzlich ein Trackpad (`any-pointer: fine`) und bleibt
// deshalb beim Tastenmodus. `?touch` erzwingt den Handymodus zum Pruefen.
const mq = (q) => typeof window !== 'undefined' && (window.matchMedia?.(q).matches ?? false)

export const TOUCH = (typeof location !== 'undefined' && new URLSearchParams(location.search).has('touch'))
  || (mq('(pointer: coarse)') && !mq('(any-pointer: fine)'))
