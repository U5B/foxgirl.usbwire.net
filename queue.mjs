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
  if (cached.g[random].length <= tag.limit) {
    await queueTag(random, 'g')
  } else if (attempts <= tag.limit) {
    attempts++
    await randomQueueTag(attempts)
  }
}

export async function queueTag (type = 'foxgirl', rating = 'g') {
  if (cached[rating] == null) cached[rating] = {}
  if (cached[rating][type] == null) cached[rating][type] = []
  if (cached[rating][type].length === 0) await addTag(type, rating, true, false)
  tag.queue.push([type, rating])
  log.debug(`Added to queue: ${type}:${rating} #${cached[rating][type].length}`)
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
  const [type, rating] = tag.queue.shift()
  await addTag(type, rating, true, false)
  if (cached.delay > 0) {
    await util.sleep(cached.delay)
    cached.delay = Math.max(0, cached.delay - 250)
  } else if (cached.delay < 0) cached.delay = 0
  tag.busy = false
  if (tag.queue.length > 0) return await requeueTag()
  else if (cached[rating][type].length <= tag.limit) return await queueTag(type, rating)
  else await randomQueueTag()
}

async function addTag (type = 'foxgirl', rating = 'g', addCache = true, highres = false) {
  if (cached.ratelimit === true) return null
  log.debug(`Adding to cache: ${type}:${rating}`)
  const request = await requestTag(type, rating, true, highres)
  if (request == null) return null
  log.debug(`Added! ${type}:${rating}`)
  if (addCache === true) cached[rating][type].push(request)
  else return request
}
