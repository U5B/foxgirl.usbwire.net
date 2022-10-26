const axios = require('axios')
const express = require('express')
const discord = require('discord.js')
require('dotenv').config()

const log = require('./log.js')

const app = express()
const port = process.env.PORT

const webhookClient = new discord.WebhookClient({ url: process.env.WEBHOOK_URL })

// this is required so that the ip forwarded from Caddy is trusted
app.set('trust proxy', (ip) => {
  if (ip === '127.0.0.1') return true // only localhost
  else return false
})
// use this if there is no Caddy proxy
// app.use(express.static('public'))

const tags = {
  fox: ['fox_girl', 'fox_tail', 'fox_ears'],
  wolf: ['wolf_girl', 'wolf_tail', 'wolf_ears'],
  cat: ['cat_girl', 'cat_tail', 'cat_ears'],
  foxgirl: ['solo fox_girl'],
  wolfgirl: ['solo wolf_girl'],
  catgirl: ['solo cat_girl'],
  mimi: ['animal_ear_fluff']
}
const endpoints = getObjectNames(tags)
const tagsExcluded = ['furry', 'animal_nose', 'body_fur', 'fake_animal_ears', 'animalization', 'animal_costume', 'cosplay_photo']

const tag = {
  queue: [],
  full: [],
  busy: false,
  limit: 5
}

const config = {
  requestsPer: 5,
  requestsMax: 15,
  ms: 1000,
  ratelimitMs: 15000
}

const cached = {
  ips: {},
  requests: 0,
  requestsTimeout: null,
  ratelimit: false,
  ratelimitTimeout: null,
  delay: 0
}

// logging >w<
app.use(async (req, res, next) => {
  log.info(`${req.method}:${req.url} ${res.statusCode}`)
  next()
})

app.get('/cache', async (req, res) => {
  await getCache(req, res)
})

app.get('/', async (req, res) => {
  await serveEndpoint(req, res, 'random', 'g') // serve random image with rating: g
})

app.get('/help', async (req, res) => {
  res.redirect('https://usbwire.net/posts/mimi')
})

app.get(/^\/(\w+)(?:\/(\w+))?(?:\/.*)?$/, async (req, res, next) => {
  await determineEndpoint(req, res, next)
})

app.listen(port, async () => {
  log.info(`API listening on port ${port}!`)
  randomQueueTag()
})

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

// global ratelimit stuff so that sky doesn't overload my server
async function addGlobalRatelimit () {
  cached.requests++
  clearTimeout(cached.requestsTimeout) // if there is a previous timeout loop, clear it
  // set global cache requests to 0 after a set amount of time
  cached.requestsTimeout = setTimeout(() => {
    cached.requests = 0
  }, config.ms)
}

// stuff to do before cacheData
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

async function postCache (ip) {
  // clear data after configured time
  cached.ips[ip].timeout = setTimeout(() => {
    cached.ips[ip].data = null
    cached.ips[ip].requests = 0
  }, config.ms)
}

async function cacheData (req, data) {
  const ip = req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.ip
  await preCache(ip)
  cached.ips[ip].data = data
  cached.ips[ip].previousData = data
  cached.ips[ip].url = req.url
  await postCache(ip)
  cached.ips[ip].requests++
}

async function dataIsCached (ip) {
  if (cached.ips[ip]?.data) return cached.ips[ip].data // if it exists on that ip, return the data
  if (cached.ips[ip]?.previousData) return cached.ips[ip].previousData
  return false
}

async function getCache (req, res) {
  const originalIp = req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.ip
  const dataCached = await dataIsCached(originalIp)
  if (dataCached) {
    await cacheData(req, dataCached)
    await writeImageData(res, dataCached)
    return res.end()
  } else {
    return res.redirect('https://mimi.usbwire.net/')
  }
}

async function getRedirect (req, res, rating = 'g', tag = 'fox') {
  // get real ip
  const originalIp = req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.ip
  // get total request count
  const requestCount = cached.ips[originalIp]?.requests
  // get cached data
  const dataCached = await dataIsCached(originalIp)
  if (
    dataCached && ( // cached data
      requestCount >= config.requestsPer || // too many requests for this ip
      cached.requests >= config.requestsMax || // too many requests globally
      cached.ratelimit === true // ratelimited by danbooru
    )
  ) {
    await cacheData(req, dataCached)
    log.info(`Served image cached: '${dataCached.url}'`)
    return res.redirect(dataCached.url)
  }
  const data = await cachedTag(originalIp, tag, rating)
  if (data?.url == null && dataCached) return res.redirect(dataCached.url)
  else if (data?.url == null) return res.redirect('https://mimi.usbwire.net')
  if (data?.url && data?.image) {
    await cacheData(req, data)
    sendWebhook(data)
  }
  await addGlobalRatelimit()
  res.redirect(data.url)
}

// writes necessary image data
// because otherwise image won't embed properly on discord
async function writeImageData (res, data) {
  const fileEnding = await getFileExtension(data.mime)
  res.set({
    'content-type': data.mime,
    // 'content-disposition': `attachment; filename=${data.type}-${data.data.id}.${fileEnding}`,
    'content-length': data.image.length,
    'mimi-image': data.url,
    'mimi-post': `https://danbooru.donmai.us/posts/${data.data.id}`,
    'mimi-tags': data.tags,
    'mimi-type': data.type,
    'mimi-rating': data.rating
  })
  res.write(data.image)
  log.info(`Served ${data.type}.${fileEnding}: ${data.url} as https://danbooru.donmai.us/posts/${data.data.id}`)
  return true
}

async function getImage (req, res, rating = 'g', tag = 'fox') {
  const originalIp = req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.ip
  const requestCount = cached.ips[originalIp]?.requests
  const dataCached = await dataIsCached(originalIp)
  if (
    dataCached && ( // data cached
      requestCount >= config.requestsPer || // too many requests for this ip
      cached.requests >= config.requestsMax || // too many requests globally
      cached.ratelimit === true // ratelimited by danbooru
    )
  ) {
    await cacheData(req, dataCached)
    await writeImageData(res, dataCached)
    return res.end()
  }
  const data = await cachedTag(originalIp, tag, rating)
  if (data?.image == null && dataCached) {
    await writeImageData(res, dataCached)
    await cacheData(req, dataCached)
  } else if (data?.image == null) return res.redirect('https://mimi.usbwire.net')
  else {
    await writeImageData(res, data)
    await cacheData(req, data)
    sendWebhook(data)
  }
  await addGlobalRatelimit()
  res.status(200).end()
}

async function getRawImage (req, res, rating = 'g', tag = 'fox') {
  const originalIp = req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.ip
  const requestCount = cached.ips[originalIp]?.requests
  const dataCached = await dataIsCached(originalIp)
  if (
    dataCached && ( // data cached
      requestCount >= config.requestsPer || // too many requests for this ip
      cached.requests >= config.requestsMax || // too many requests globally
      cached.ratelimit === true // ratelimited by danbooru
    )
  ) {
    await cacheData(req, dataCached)
    await writeImageData(res, dataCached)
    return res.end()
  }
  const data = await addTag(tag, rating, false, true)
  if (data?.image == null && dataCached) {
    await writeImageData(res, dataCached)
    await cacheData(req, dataCached)
  } else if (data?.image == null) return res.redirect('https://mimi.usbwire.net')
  else {
    await writeImageData(res, data)
    await cacheData(req, data)
    sendWebhook(data)
  }
  await addGlobalRatelimit()
  res.status(200).end()
}

async function determineEndpoint (req, res, next) {
  const endpoint = req.params['0']
  const modifier = req.params['1']
  const success = await serveEndpoint(req, res, endpoint, modifier)
  if (!success) return next()
  return true
}

async function serveEndpoint (req, res, endpoint, modifier) {
  if (endpoint === 'random') endpoint = await arrayRandomizer(endpoints)
  else if (!endpoints.includes(endpoint)) return false
  log.info(`Requesting: ${endpoint}:${modifier}`)
  switch (modifier) {
    case 'nsfw': {
      await getImage(req, res, 'q', endpoint)
      break
    }
    case 'lewd': {
      await getImage(req, res, 's', endpoint)
      break
    }
    case 'r': {
      await getRedirect(req, res, 'g', endpoint)
      break
    }
    case 'c': {
      await getCache(req, res)
      break
    }
    case 'w': {
      await getRawImage(req, res, 'g', endpoint)
      break
    }
    case 'safe':
    case '':
    default: {
      await getImage(req, res, 'g', endpoint)
      break
    }
  }
  return true
}

async function requestTag (type = 'foxgirl', rating = 'g', image = true, highres = false) {
  const tag = await arrayRandomizer(tags[type])
  const request = await requestTagRaw(tag, rating, image, highres)
  request.type = type
  return request
}

async function requestTagRaw (tag = 'fox_girl', rating = 'g', image = true, highres = false) {
  const response = await requestDanbooru(tag, rating)
  // if image response isn't expected, just return senko
  if (response == null || response.url == null || response.data?.success === false || response.tags == null) {
    log.error('Image has invalid data in it??')
    await sleep(cached.delay)
    return await requestTagRaw(tag, rating, image, highres)
  }
  // otherwise if it is flagged, request a new one

  const excluded = await excludeTags(response.tags)
  if (excluded === true) {
    await sleep(cached.delay)
    return await requestTagRaw(tag, rating, image, highres)
  }
  if (image === false) return { responseData: response, imageData: null }
  const url = highres === true ? response.urlhd : response.url
  const downloadedImage = await downloadImage(url)
  if (downloadedImage == null) {
    await sleep(cached.delay)
    return await requestTagRaw(tag, rating, image, highres)
  }
  const jsonData = { data: response.data, url, tags: response.tags, mime: downloadedImage.mime, image: downloadedImage.image, rating, tag }
  return jsonData
}

async function cachedTag (ip, type = 'foxgirl', rating = 'g') {
  // ratelimited? return previous Image
  if (cached.ratelimit === true && cached.ips[ip].previousImage) return cached.ips[ip].previousImage
  else if (cached.ratelimit === true) return null
  await queueTag(type, rating)
  const data = cached[rating][type][0]
  if (cached[rating][type].length > 0 && cached.ratelimit === false) cached[rating][type].splice(0, 1)
  return data
}

async function randomQueueTag (attempts = 0) {
  if (tag.queue.length > 0) return // we may get a request while running this function
  const random = await arrayRandomizer(endpoints)
  if (cached.g == null) cached.g = {}
  if (cached.g[random] == null) cached.g[random] = []
  if (cached.g[random].length <= tag.limit) {
    await queueTag(random, 'g')
  } else if (attempts <= tag.limit) {
    attempts++
    await randomQueueTag(attempts)
  }
}

async function queueTag (type = 'foxgirl', rating = 'g') {
  if (cached[rating] == null) cached[rating] = {}
  if (cached[rating][type] == null) cached[rating][type] = []
  if (cached[rating][type].length === 0) await addTag(type, rating, true, false)
  tag.queue.push([type, rating])
  log.debug(`Added to queue: ${type}:${rating}`)
  if (tag.busy === false) requeueTag()
}

async function requeueTag () {
  if (tag.queue.length === 0) {
    tag.busy = false
    return
  }
  if (tag.busy === true) return
  tag.busy = true
  if (cached.ratelimit === true) await sleep(config.ratelimitMs)
  const [type, rating] = tag.queue.shift()
  await addTag(type, rating, true, false)
  if (cached.delay > 0) {
    await sleep(cached.delay)
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

async function downloadImage (url) {
  if (cached.ratelimit === true) return null
  log.debug(`Downloading image from: ${url}`)
  try {
    const response = await axios.get(url, { headers: { 'User-Agent': 'axios/0.27.2 (https://mimi.usbwire.net)' }, responseType: 'arraybuffer' })
    if (response.status !== 200) return null
    log.debug(`Downloaded image! ${url}`)
    const raw = Buffer.from(response.data, 'binary')
    const mime = response.headers['content-type'] // ex: image/png
    return { image: raw, mime }
  } catch (error) {
    if (error?.response) {
      const response = error?.response
      log.error(response.data)
      if (response == null || response?.status == null) return null
      switch (response.status) {
        case 503:
        case 502:
        case 500:
        case 429: {
          cached.delay += 4000
        }
      }
    } else {
      log.error(error)
      cached.delay += 1000
    }
    return null
  }
}

// goes through each tag in tag_string and checks if it should be excluded (no furry stuff)
async function excludeTags (inputTags) {
  const inputTag = inputTags.split(' ')
  for (const tag of inputTag) {
    for (const excludedTag of tagsExcluded) {
      if (tag === excludedTag) {
        log.error(`Excluded tag: ${tag}...`)
        return true
      }
    }
  }
  return false
}

async function requestDanbooru (tag = 'fox_girl', rating = 'g') {
  const responseJson = { data: null, url: null, urlhd: null, tags: null }
  if (cached.ratelimit === true) return null
  // rating can be 'g,s' but that adds suggestive content which can get me booped by Discord
  // example of extreme "suggestive": https://cdn.donmai.us/original/fb/ec/__kitsune_onee_san_original_drawn_by_akitsuki_karasu__fbecb3a960885c4227d474c0d36b66d6.png
  // https://danbooru.donmai.us/posts/random.json?tags=filetype:png,jpg score:>5 favcount:>5 rating:g (fox_girl)
  const url = `https://danbooru.donmai.us/posts/random.json?tags=filetype:png,jpg,gif score:>5 favcount:>5 rating:${rating} (${tag})`
  // `https://danbooru.donmai.us/posts/random?tags=filetype:png,jpg score:>5 favcount:>5 rating:${rating} (${tag})`
  try {
    log.debug(`Fetching tags: [${tag}] with rating: [${rating}]...`)
    const response = await axios.get(url, { headers: { 'User-Agent': 'axios/0.27.2 (https://mimi.usbwire.net)' } })
    if (response.status !== 200) throw Error(response.status) // this shouldn't be reached if the request is successful
    log.debug(`Fetched! Post: https://danbooru.donmai.us/posts/${response.data.id} || Rating: ${response.data.rating} || File: ${response.data.file_url}`)
    if ((response.data?.success === false)) throw Error('Invalid data!')
    if ((response.data?.is_flagged || response.data?.is_deleted || response.data?.is_pending || response.data?.is_banned) === true) throw Error('Post flagged!')
    if ((response.data.large_file_url || response.data.file_url) == null) throw Error('No image!')
    responseJson.data = response.data
    responseJson.url = response.data.has_large === true ? response.data.large_file_url : response.data.file_url
    responseJson.urlhd = response.data.file_url
    responseJson.tags = response.data.tag_string
    return responseJson
  } catch (error) {
    if (error?.response) {
      const response = error.response
      log.error(response?.data)
      if (response == null || response?.status == null) return null
      switch (response.status) {
        case 404:
        case 400: {
          await log.error('URL is malformed: invalid tags')
          process.exit(1)
          break
        }
        case 503:
        case 502:
        case 500: {
          log.error('Server is having issues!')
          cached.delay += 2000
          break
        }
        case 429: {
          cached.delay += 4000
          break
        }
        default: {
          cached.delay += 1000
          break
        }
      }
    } else {
      switch (error) {
        case 'Invalid data!':
          log.error('Url may be malformed: recieved invalid data...')
          process.exit(1)
          break
        case 'Post flagged!':
          log.error('Post was flagged!')
          break
        case 'No image!':
          log.error('No image found!')
          break
        default:
          log.error(error)
          cached.delay += 1000
          break
      }
    }
    return null
  }
}

async function arrayRandomizer (array) {
  const random = Math.floor(Math.random() * array.length)
  return array[random]
}

function getObjectNames (object) {
  const objectNames = []
  for (const name of Object.keys(object)) {
    objectNames.push(name)
  }
  return objectNames
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function getFileExtension (mime) {
  switch (mime) {
    case 'image/png': {
      return 'png'
    }
    case 'image/jpg':
    case 'image/jpeg': {
      return 'jpg'
    }
    case 'image/gif': {
      return 'gif'
    }
  }
}
