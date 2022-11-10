import 'dotenv/config'
import express from 'express'

import log from './log.mjs'
import { determineEndpoint, determineModifier } from './web.mjs'
import { randomQueueEndpoint } from './queue.mjs'

const app = express()

// this is required so that the ip forwarded from Caddy is trusted
app.set('trust proxy', (ip) => {
  if (ip === '127.0.0.1') return true // only localhost
  else return false
})

// logging >w<
app.use(async (req, res, next) => {
  log.warn(`${req.method}:${req.url} ${res.statusCode}`)
  next()
})

app.get('/help', async (req, res) => {
  res.redirect('https://usbwire.net/posts/mimi')
})

app.get(/^\/(\w+)(?:\/(\w+))?(?:\/(\w+))?(?:\/.*)?$/, async (req, res, next) => {
  await determineEndpoint(req, res, next)
})

app.get(/^\/(\w+)?(?:\/(\w+))?(?:\/.*)?$/, async (req, res, next) => {
  await determineModifier(req, res, next, 'random')
})

app.use(async (req, res, next) => {
  res.status(404).end()
})

app.listen(process.env.PORT, async () => {
  log.log(`API listening on port ${process.env.PORT}!`)
  randomQueueEndpoint()
})
