import { config } from './config.mjs'
import { queueTag } from './queue.mjs'

export const cached = {
  ips: {},
  lastData: false,
  requests: 0,
  requestsTimeout: null,
  ratelimit: false,
  ratelimitTimeout: null,
  delay: 0
}

/**
 * add more to the global ratelimit!
 */
export async function addGlobalRatelimit () {
  cached.requests++
  clearTimeout(cached.requestsTimeout) // if there is a previous timeout loop, clear it
  // set global cache requests to 0 after a set amount of time
  cached.requestsTimeout = setTimeout(() => {
    cached.requests = 0
  }, config.delays.cache)
}

/**
 * create data for ip address
 * @param {String} ip - ip address
 */
async function preCache (ip) {
  // create
  if (cached.ips[ip] == null) {
    cached.ips[ip] = {
      data: null,
      previousData: null,
      timeout: null,
      requests: 0
    }
  }
  clearTimeout(cached.ips[ip]?.timeout) // clear postCache's timeout
}

/**
* Stuff to do after cacheData
* @param {String} ip - ip address
*/
async function postCache (ip) {
  // clear data after configured time
  cached.ips[ip].timeout = setTimeout(() => {
    cached.ips[ip].data = null
    cached.ips[ip].requests = 0
  }, config.delays.cache)
}

/**
 * store cached data
 * @param {import('express').Request} req - request information
 * @param {import('./type.mjs').apiCombined} data - imageData
 */
export async function cacheData (req, data) {
  const ip = req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.ip
  await preCache(ip)
  cached.ips[ip].data = data
  cached.ips[ip].previousData = data
  if (data.rating === 'g') cached.lastData = data
  await postCache(ip)
  cached.ips[ip].requests++
}

/**
 * check if data is cached
 * @param {String} ip - ip address
 * @returns {Promise<import('./type.mjs').apiCombined>}
 */
export async function dataIsCached (ip) {
  if (cached.ips[ip]?.data) return cached.ips[ip].data // if it exists on that ip, return the data
  if (cached.ips[ip]?.previousData) return cached.ips[ip].previousData
  return cached.lastData // otherwise use the global cache
}

/**
 * queue a tag and also pull one from the cache
 * @param {String} ip - ip address
 * @param {String} endpoint
 * @param {import('./type.mjs').rating} rating
 * @returns
 */
export async function cachedTag (ip, endpoint = 'foxgirl', rating = 'g') {
  // ratelimited? return previous data
  if (cached.ratelimit === true && cached.ips[ip].previousData) return cached.ips[ip].previousData
  else if (cached.ratelimit === true) return null
  await queueTag(endpoint, rating)
  const data = cached[rating][endpoint][0]
  if (cached[rating][endpoint].length > 0 && cached.ratelimit === false) cached[rating][endpoint].splice(0, 1)
  return data
}
