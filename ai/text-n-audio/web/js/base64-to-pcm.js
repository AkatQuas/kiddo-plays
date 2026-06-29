export function base64ToPCM(base64) {
  const raw = atob(base64)
  const rawLength = raw.length
  const arrayBuffer = new ArrayBuffer(rawLength)
  const view = new Uint8Array(arrayBuffer)
  for (let i = 0; i < rawLength; i++) {
    view[i] = raw.charCodeAt(i)
  }
  return new Int16Array(arrayBuffer)
}
