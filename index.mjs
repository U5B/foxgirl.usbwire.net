import 'dotenv/config'
import express from 'express'

import log from './log.mjs'
import { determineEndpoint, serveEndpoint } from './web.mjs'
import { randomQueueTag } from './queue.mjs'

const app = express()

// this is required so that the ip forwarded from Caddy is trusted
app.set('trust proxy', (ip) => {
  if (ip === '127.0.0.1') return true // only localhost
  else return false
})

// logging >w<
app.use(async (req, res, next) => {
  log.log(`${req.method}:${req.url} ${res.statusCode}`)
  next()
})

app.get('/', async (req, res) => {
  await serveEndpoint(req, res, 'random', 'g') // serve random image with rating: g
})

app.get('/?', async (req, res) => {
  res.redirect('https://usbwire.net/posts/mimi')
})

app.get(/^\/(\w+)(?:\/(\w+))?(?:\/(\w+))?(?:\/.*)?$/, async (req, res, next) => {
  await determineEndpoint(req, res, next)
})

app.listen(process.env.PORT, async () => {
  log.log(`API listening on port ${process.env.PORT}!`)
  randomQueueTag()
})
