import log from './log.mjs'
import express from 'express'
import discord from 'discord.js'
import { config } from './config.mjs'
import { requestTag } from './verify.mjs'
import { cached, dataIsCached, cacheData, addGlobalRatelimit, cachedTag } from './cache.mjs'
import { randomEndpoint, endpoints } from './tags.mjs'

const webhookClient = new discord.WebhookClient({ url: process.env.WEBHOOK_URL })

/**
 * writes necessary image data
 * @param {express.Response} res
 * @param {import('./type.mjs').apiCombined} data
 * @param {Boolean} download - tell the browser to download the image
 */
async function writeImageData (res, data, download = false) {
  const headers = {
    'content-type': data.mime,
    // 'content-disposition': `attachment; filename=${data.type}-${data.id}.${data.extension}`,
    'content-length': data.image.length,
    'mimi-image': data.url,
    'mimi-post': `https://danbooru.donmai.us/posts/${data.id}`,
    'mimi-tags': data.tags,
    'mimi-type': data.type,
    'mimi-rating': data.rating
  }
  if (download === true) headers['content-disposition'] = `attachment; filename=${data.type}-${data.id}.${data.extension}`
  res.set(headers)
  res.write(data.image)
  log.log(`Served ${data.tag}.${data.extension}: ${data.url} as https://danbooru.donmai.us/posts/${data.id}`)
  return true
}

/**
 * Check if we have cached data or not
 * @param {String} ip - ip address
 * @returns
 */
async function isCached (ip) {
  const requestCount = cached.ips[ip]?.requests
  const dataCached = await dataIsCached(ip)
  if (
    dataCached && ( // data cached
      requestCount >= config.requests.per || // too many requests for this ip
      cached.requests >= config.requests.max || // too many requests globally
      cached.ratelimit === true // ratelimited by danbooru
    )
  ) return { data: dataCached, cache: true }
  return { data: dataCached, cache: false }
}

/**
 *
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {import('./type.mjs').rating} rating
 * @param {String} type
 * @returns
 */
export async function get (req, res, rating = 'g', type = 'fox', options = { image: true, forceCache: false, forceRaw: false, forceHD: false, forceDownload: false }) {
  const ip = req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.ip
  const cachedData = await isCached(ip, req)
  if ((cachedData.cache || (cachedData.data && options.forceCache)) === true) return await sendData(req, res, cachedData.data, options.image)
  await addGlobalRatelimit()
  let data
  if (options.forceRaw === false) data = await cachedTag(ip, type, rating)
  else data = await requestTag(type, rating, options.image, options.forceHD)
  if (data?.image == null && cachedData.cache) {
    await sendData(req, res, cachedData.data, options.image, options.forceDownload)
  } else if (data?.image == null) return res.status(404).end()
  else {
    sendWebhook(data)
    await sendData(req, res, data, options.image, options.forceDownload)
  }
  return res.status(200).end()
}
/**
 *
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {import('./type.mjs').apiCombined} data
 * @param {Boolean} image - whenever to serve an image or to redirect you
 * @param {Boolean} download - if serving the image, download the image?
 */
async function sendData (req, res, data, image = true, download = false) {
  await cacheData(req, data)
  if (image === false) return res.redirect(data.url)
  await writeImageData(res, data, download)
  return res.status(200).end()
}
/**
 *
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
export async function determineEndpoint (req, res, next) {
  const endpoint = req.params['0']
  const modifier = req.params['1']
  const modifer2 = req.params['2'] ?? req.params['1']
  const success = await serveEndpoint(req, res, endpoint, modifier, modifer2)
  if (!success) return next()
  return true
}
/**
 *
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {String} endpoint - a valid type in endpoints or "random"
 * @param {String} modifier - content rating modifier or image modifier
 * @param {String} modifier2 - image modifier
 * @returns
 */
export async function serveEndpoint (req, res, endpoint, modifier, modifier2) {
  if (endpoint === 'random') endpoint = await randomEndpoint()
  else if (!endpoints.includes(endpoint)) return false
  log.log(`Requesting: ${endpoint}:${modifier}`)
  const options = { image: true, forceCache: false, forceRaw: false, forceHD: false, forceDownload: false }
  let rating = 'g'
  switch (modifier) {
    case 'nsfw': {
      rating = 'q'
      break
    }
    case 'lewd': {
      rating = 's'
      break
    }
    default: {
      rating = 'g'
      break
    }
  }
  if (!modifier2) modifier2 = modifier
  switch (modifier2) {
    case 'r': {
      options.image = false
      await get(req, res, rating, endpoint, options)
      break
    }
    case 'c': {
      options.forceCache = true
      await get(req, res, rating, endpoint, options)
      break
    }
    case 'd': {
      options.image = true
      options.forceDownload = true
      await get(req, res, rating, endpoint, options)
      break
    }
    case 'w': {
      options.forceHD = true
      options.forceRaw = true
      await get(req, res, rating, endpoint, options)
      break
    }
    default: {
      await get(req, res, rating, endpoint, options)
      break
    }
  }
  return true
}

async function sendWebhook (data) {
  if (data?.rating !== 'g' || !data?.image) return // horny no more!
  const webhookContent = {
    username: 'mimi.usbwire.net',
    files: [data.image]
  }
  try {
    await webhookClient.send(webhookContent)
  } catch (e) {
    log.error(e)
  }
}
