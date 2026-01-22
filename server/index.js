import express from 'express'
const app = express()
const port = Number(process.env.PORT) || 4173

const {
  FORTY_TWO_UID,
  FORTY_TWO_SECRET,
  FORTY_TWO_SCOPE = 'public',
  FORTY_TWO_TOKEN_URL = 'https://api.intra.42.fr/oauth/token',
  FORTY_TWO_API_BASE = 'https://api.intra.42.fr/v2',
  FSE_API_BASE = '/api/42'
} = process.env

const API_BASE = FORTY_TWO_API_BASE.replace(/\/$/, '')
const FSE_BASE = FSE_API_BASE.replace(/\/$/, '')

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

let tokenCache = { token: '', expiresAt: 0 }

function secondsNow() {
  return Math.floor(Date.now() / 1000)
}

async function requestTokenFrom42() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: FORTY_TWO_UID,
    client_secret: FORTY_TWO_SECRET,
    scope: FORTY_TWO_SCOPE
  })
  console.log('[proxy] requesting token from', FORTY_TWO_TOKEN_URL)
  const response = await fetch(FORTY_TWO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`Unable to acquire 42 token (${response.status}): ${details}`)
  }
  const data = await response.json()
  return {
    token: data.access_token,
    expiresIn: Number(data.expires_in) || 0
  }
}

async function getToken() {
  const now = secondsNow()
  if (tokenCache.token && tokenCache.expiresAt > now + 30) {
    return tokenCache
  }
  const { token, expiresIn } = await requestTokenFrom42()
  tokenCache = { token, expiresAt: now + expiresIn }
  console.log('[proxy] cached token, expires in', expiresIn, 'seconds')
  return tokenCache
}

app.all(`${FSE_BASE}/*`, async (req, res) => {
  if (!FORTY_TWO_UID || !FORTY_TWO_SECRET) {
    res.status(500).json({ error: 'FORTY_TWO_UID and FORTY_TWO_SECRET are required' })
    return
  }
  try {
    const tokenLegend = await getToken()
    const suffix =
      req.originalUrl.slice(0, FSE_BASE.length) === FSE_BASE ? req.originalUrl.slice(FSE_BASE.length) : ''
    const targetUrl = `${API_BASE}${suffix}`
    console.log(`[proxy] ${req.method} ${req.originalUrl} -> ${targetUrl} (token exp ${tokenLegend.expiresAt - secondsNow()}s)`)
    const hasBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${tokenLegend.token}`,
        ...(req.headers['content-type'] ? { 'Content-Type': req.headers['content-type'] } : {})
      },
      body: hasBody ? JSON.stringify(req.body) : undefined
    })
    const hasTransferEncoding = response.headers.has('transfer-encoding')
    const previewText = await response
      .clone()
      .text()
      .catch(() => '')
    if (previewText) {
      console.log(
        `[proxy] response ${response.status} ${targetUrl} payload ${previewText
          .replace(/\s+/g, ' ')
          .slice(0, 200)}`
      )
    } else {
      console.log(`[proxy] response ${response.status} ${targetUrl} (no payload preview)`)
    }
    res.status(response.status)
    response.headers.forEach((value, name) => {
      const lower = name.toLowerCase()
      if (lower === 'content-encoding' || lower === 'content-length' || lower === 'transfer-encoding') {
        return
      }
      res.setHeader(name, value)
    })
    const payload = Buffer.from(await response.arrayBuffer())
    res.send(payload)
  } catch (err) {
    console.error('failed to proxy 42 API', err)
    res.status(502).json({ error: 'failed to proxy request' })
  }
})

app.listen(port, () => {
  console.log(`FSE Generator server listening on port ${port}`)
})
