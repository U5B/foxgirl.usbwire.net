import { config } from './config.mjs'
import log from './log.mjs'
import { util } from './util.mjs'
import { tag, randomEndpoint } from './tags.mjs'
import { cached } from './cache.mjs'
import { requestTag } from './verify.mjs'

/**
 * add a random safe endpoint to the queue
 * @param {Number} [attempts] - number of attempts to queue a new tag
 */
export async function randomQueueEndpoint (attempts = 0) {
  if (tag.queue.length > 0 || tag.busy === true) return // we may get a request while running this function
  const random = await randomEndpoint()
  if (cached.g[random] == null) cached.g[random] = []
  const limit = tag.limit.g[random] ?? tag.limit.default
  if (cached.g[random].length <= limit) {
    await queueTag(random, 'g')
  } else if (attempts <= tag.limit.default) {
    attempts++
    await randomQueueEndpoint(attempts)
  }
}

/**
 * add specified endpoint with specified rating to the queue
 * @param {String} endpoint
 * @param {import('./type.mjs').rating} rating
 */
export async function queueTag (endpoint = 'foxgirl', rating = 'g') {
  if (cached[rating][endpoint] == null) cached[rating][endpoint] = []
  if (cached[rating][endpoint].length === 0) await addTag(endpoint, rating, true, false)
  tag.queue.push([endpoint, rating])
  log.debug(`Added to queue: ${endpoint}:${rating} #${cached[rating][endpoint].length}`)
  if (tag.busy === false) requeueTag()
}

/**
 * this function should loop until the queue is empty
 */
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
  const limit = tag.limit[rating][endpoint] ?? tag.limit.default
  if (tag.queue.length > 0) return await requeueTag()
  else if (cached[rating][endpoint].length <= limit) return await queueTag(endpoint, rating)
  else await randomQueueEndpoint()
}

/**
 * request data with endpoint and rating
 * @param {String} endpoint
 * @param {import('./type.mjs').rating} rating - content rating
 * @param {Boolean} toCache - add data to cache
 * @param {Boolean} hd - get an HD image!
 */
export async function addTag (endpoint = 'foxgirl', rating = 'g', toCache = true, hd = false) {
  if (cached.ratelimit === true) return null
  log.debug(`Adding to cache: ${endpoint}:${rating}`)
  const request = await requestTag(endpoint, rating, true, hd)
  if (request == null) return null
  log.debug(`Added! ${endpoint}:${rating}`)
  if (toCache === true) cached[rating][endpoint].push(request)
  return request
}
