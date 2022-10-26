import { config } from './config.mjs'
import { queueTag } from './queue.mjs'

export const cached = {
  ips: {},
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
      url: null,
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
 * @param {express.Request} req - request information
 * @param {} data - imageData
 */
export async function cacheData (req, data) {
  const ip = req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.ip
  await preCache(ip)
  cached.ips[ip].data = data
  cached.ips[ip].previousData = data
  cached.ips[ip].url = req.url
  await postCache(ip)
  cached.ips[ip].requests++
}

/**
 * check if data is cached
 * @param {String} ip - ip address
 */
export async function dataIsCached (ip) {
  if (cached.ips[ip]?.data) return cached.ips[ip].data // if it exists on that ip, return the data
  if (cached.ips[ip]?.previousData) return cached.ips[ip].previousData
  return false
}

export async function cachedTag (ip, type = 'foxgirl', rating = 'g') {
  // ratelimited? return previous Image
  if (cached.ratelimit === true && cached.ips[ip].previousImage) return cached.ips[ip].previousImage
  else if (cached.ratelimit === true) return null
  await queueTag(type, rating)
  const data = cached[rating][type][0]
  if (cached[rating][type].length > 0 && cached.ratelimit === false) cached[rating][type].splice(0, 1)
  return data
}
