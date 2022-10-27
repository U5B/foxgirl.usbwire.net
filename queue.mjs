import { config } from './config.mjs'
import log from './log.mjs'
import { util } from './util.mjs'
import { tag, randomEndpoint } from './tags.mjs'
import { cached } from './cache.mjs'
import { requestTag } from './verify.mjs'

export async function randomQueueTag (attempts = 0) {
  if (tag.queue.length > 0) return // we may get a request while running this function
  const random = await randomEndpoint()
  if (cached.g == null) cached.g = {}
  if (cached.g[random] == null) cached.g[random] = []
  const limit = tag.limit[random] ?? tag.limit.default
  if (cached.g[random].length <= limit) {
    await queueTag(random, 'g')
  } else if (attempts <= tag.limit.default) {
    attempts++
    await randomQueueTag(attempts)
  }
}

export async function queueTag (endpoint = 'foxgirl', rating = 'g') {
  if (cached[rating] == null) cached[rating] = {}
  if (cached[rating][endpoint] == null) cached[rating][endpoint] = []
  if (cached[rating][endpoint].length === 0) await addTag(endpoint, rating, true, false)
  tag.queue.push([endpoint, rating])
  log.debug(`Added to queue: ${endpoint}:${rating} #${cached[rating][endpoint].length}`)
  if (tag.busy === false) requeueTag()
}

async function requeueTag () {
  if (tag.queue.length === 0) {
    tag.busy = false
    return
  }
  if (tag.busy === true) return
  tag.busy = true
  if (cached.ratelimit === true) await util.sleep(config.delays.ratelimit)
  const [endpoint, rating] = tag.queue.shift()
  await addTag(endpoint, rating, true, false)
  if (cached.delay > 0) {
    await util.sleep(cached.delay)
    cached.delay = Math.max(0, cached.delay - 250)
  } else if (cached.delay < 0) cached.delay = 0
  tag.busy = false
  const limit = tag.limit[endpoint] ?? tag.limit.default
  if (tag.queue.length > 0) return await requeueTag()
  else if (cached[rating][endpoint].length <= limit) return await queueTag(endpoint, rating)
  else await randomQueueTag()
}

async function addTag (endpoint = 'foxgirl', rating = 'g', addCache = true, highres = false) {
  if (cached.ratelimit === true) return null
  log.debug(`Adding to cache: ${endpoint}:${rating}`)
  const request = await requestTag(endpoint, rating, true, highres)
  if (request == null) return null
  log.debug(`Added! ${endpoint}:${rating}`)
  if (addCache === true) cached[rating][endpoint].push(request)
  else return request
}
