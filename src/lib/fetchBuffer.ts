import https from 'node:https'

const MAX_REDIRECTS = 5
const FETCH_TIMEOUT_MS = 15_000
const MAX_BUFFER_SIZE = 10 * 1024 * 1024 // 10 MB

export function fetchBuffer(url: string, redirects = 0): Promise<Buffer> {
  if (redirects > MAX_REDIRECTS) {
    return Promise.reject(new Error(`Too many redirects (>${MAX_REDIRECTS}) for ${url}`))
  }

  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: FETCH_TIMEOUT_MS }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        fetchBuffer(res.headers.location, redirects + 1).then(resolve).catch(reject)
        return
      }

      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`))
        return
      }

      let totalSize = 0
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => {
        totalSize += chunk.length
        if (totalSize > MAX_BUFFER_SIZE) {
          res.destroy()
          reject(new Error(`Response exceeds ${MAX_BUFFER_SIZE} bytes for ${url}`))
          return
        }
        chunks.push(chunk)
      })
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Timeout after ${FETCH_TIMEOUT_MS}ms fetching ${url}`))
    })
  })
}
