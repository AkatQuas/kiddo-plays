/**
 * SSE client (subset of ai.kit useSSE + fetch-event-source)
 */
export async function postSSE(url, body, { signal, onmessage, onopen, onclose, onerror } = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  await onopen?.(res)
  if (!res.ok) {
    const err = new Error(`SSE upstream ${res.status}`)
    onerror?.(err)
    throw err
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const raw = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')

        let event = 'message'
        let data = ''
        for (const line of raw.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) data += line.slice(5).trim()
        }
        onmessage?.({ event, data })
      }
    }
    onclose?.()
  } catch (err) {
    if (err.name !== 'AbortError') onerror?.(err)
    throw err
  }
}
