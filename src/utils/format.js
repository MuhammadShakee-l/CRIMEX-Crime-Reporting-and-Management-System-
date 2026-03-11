// Date/time formatting utilities updated to the requested style:
// Date: dd/mm/yyyy
// Time: hh:mm:ss AM/PM
// Combined: "dd/mm/yyyy   hh:mm:ss AM/PM" (with three spaces)

function pad(n) {
  return n.toString().padStart(2, '0')
}

export function parseISO(iso) {
  try {
    if (!iso) return null
    const d = new Date(iso)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

export function formatDateSlash(iso) {
  const d = parseISO(iso)
  if (!d) return '—'
  const day = pad(d.getDate())
  const month = pad(d.getMonth() + 1)
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export function formatTime12(iso) {
  const d = parseISO(iso)
  if (!d) return '—'
  let hours = d.getHours()
  const minutes = pad(d.getMinutes())
  const seconds = pad(d.getSeconds())
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12
  return `${pad(hours)}:${minutes}:${seconds} ${ampm}`
}

export function formatDateTimePretty(iso) {
  const d = parseISO(iso)
  if (!d) return '—'
  return `${formatDateSlash(iso)}   ${formatTime12(iso)}`
}