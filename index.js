const axios = require('axios')
const express = require('express')

const log = require('./log.js')

const app = express()
const port = 42069

// this is required so that the ip forwarded from Caddy is trusted
// maybe set this to a localhost instead
app.set('trust proxy', (ip) => {
  console.log(ip)
  if (ip === '127.0.0.1' || ip === '123.123.123.123') return true // trusted IPs
  else return false
})
// use this if there is no Caddy proxy
/// / app.use(express.static('public'))

const tags = {
  fox: ['fox_girl', 'fox_tail', 'fox_ears'],
  wolf: ['wolf_girl', 'wolf_tail', 'wolf_ears'],
  cat: ['cat_girl', 'cat_tail', 'cat_ears'],
  foxgirl: ['solo fox_girl'],
  wolfgirl: ['solo wolf_girl'],
  catgirl: ['solo cat_girl'],
  mimi: ['animal_ear_fluff'],
  excluded: ['furry', 'animal_nose', 'body_fur', 'fake_animal_ears', 'animalization', 'animal_costume', 'cosplay_photo']
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
  ratelimitTimeout: null
}

// logging >w<
app.use(async (req, res, next) => {
  log.info(`${req.method}:${req.url} ${res.statusCode}`)
  next()
})

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

async function getRedirect (req, res, rating = 'g', tag = 'fox') {
  // get real ip
  const originalIp = req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.ip
  // get total request count
  const requestCount = cached.ips[originalIp]?.requests
  // get cached data
  const dataCached = await dataIsCached(originalIp)
  if
  (
    dataCached && // cached data
    (
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
  else if (data?.url == null) return res.redirect('https://usbwire.net')
  if (data?.url && data?.image) await cacheData(req, data)
  await addGlobalRatelimit()
  res.redirect(data.url)
}

// writes necessary image data
// because otherwise image won't embed properly on discord
async function writeImageData (res, data) {
  res.header('mimi-image', data.url)
  res.header('mimi-post', `https://danbooru.donmai.us/posts/${data.data.id}`)
  res.header('mimi-tags', data.tags)
  res.header('content-type', data.mime) // required for the image to display properly in browsers
  res.write(data.image)
  log.info(`Served image: ${data.url} as https://danbooru.donmai.us/posts/${data.data.id}`)
  return true
}

async function getImage (req, res, rating = 'g', tag = 'fox') {
  const originalIp = req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.ip
  const requestCount = cached.ips[originalIp]?.requests
  const dataCached = await dataIsCached(originalIp)
  if
  (
    dataCached && // cached data
    (
      requestCount >= config.requestsPer || // too many requests for this ip
      cached.requests >= config.requestsMax || // too many requests globally
      cached.ratelimit === true // ratelimited by danbooru
    )
  ) {
    const cached304 = cached.ips[originalIp]?.url === req.url // can we just return a 304 instead of sending the same image
    await cacheData(req, dataCached)
    if (cached304) res.status(304)
    else await writeImageData(res, dataCached)
    return res.end()
  }
  const data = await cachedTag(originalIp, tag, rating)
  if (data?.image == null && dataCached) {
    await writeImageData(res, dataCached)
    await cacheData(req, dataCached)
  } else if (data?.image == null && data?.url) return res.redirect(data.url)
  else if (data?.image == null) return res.redirect('https://usbwire.net')
  else {
    await writeImageData(res, data)
    await cacheData(req, data)
  }
  await addGlobalRatelimit()
  res.status(200)
  res.end()
}

async function determineEndpoint (req, res, endpoint = 'foxgirl') {
  const restUri = req.params['0']
  switch (restUri) {
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
    case '':
    default: {
      await getImage(req, res, 'g', endpoint)
      break
    }
  }
  return true
}

app.get(/^\/foxgirl(?:\/(\w+))?(?:\/.*)?$/, async (req, res) => {
  await determineEndpoint(req, res, 'foxgirl')
})

app.get(/^\/wolfgirl(?:\/(\w+))?(?:\/.*)?$/, async (req, res) => {
  await determineEndpoint(req, res, 'wolfgirl')
})

app.get(/^\/catgirl(?:\/(\w+))?(?:\/.*)?$/, async (req, res) => {
  await determineEndpoint(req, res, 'catgirl')
})

app.get(/^\/custom(?:\/.*)?$/, async (req, res) => {
  let tag = req.query?.tag ?? 'foxgirl'
  let rating = req.query?.rating ?? 'g'
  const redirect = req.query?.redirect ?? false
  if (tags[tag] == null) tag = 'foxgirl'
  if (rating !== 'g' && rating !== 's' && rating !== 'q') rating = 'g'
  if (redirect) await getRedirect(req, res, rating, tag)
  else await getImage(req, res, rating, tag)
})

app.get('/', async (req, res) => {
  res.send('Endpoints: [/foxgirl, /wolfgirl, /catgirl]')
})

app.listen(port, async () => {
  log.info(`API listening on port ${port}!`)
})

async function requestTag (type = 'fox', rating = 'g', image = true) {
  const tag = await arrayRandomizer(tags[type])
  return await requestTagRaw(tag, rating, image)
}

async function requestTagRaw (tag = 'fox_girl', rating = 'g', image = true) {
  const response = await requestDanbooru(tag, rating)
  // if image response isn't expected, just return senko
  if (response == null || response.url == null || response.data?.success === false || response.tags == null) return null
  // otherwise if it is flagged, request a new one
  if ((response.data?.is_flagged || response.data?.is_deleted || response.data?.is_pending || response.data?.is_banned) === true) {
    log.error('Image is flagged, deleted, pending, or banned... > Requesting new image...')
    return await requestTagRaw(tag, rating, image)
  }
  const excluded = await excludeTags(response.tags)
  if (excluded === true) {
    return await requestTagRaw(tag, rating, image)
  }
  if (image === false) return { responseData: response, imageData: null }
  const downloadedImage = await downloadImage(response.url, false)
  if (downloadedImage == null) return { responseData: response, imageData: null }
  return { responseData: response, imageData: downloadedImage }
}

async function cachedTag (ip, type = 'fox', rating = 'g') {
  // ratelimited? return previous Image
  if (cached.ratelimit === true && cached.ips[ip].previousImage) return cached.ips[ip].previousImage
  else if (cached.ratelimit === true) return null
  if (cached[rating] == null) cached[rating] = {}
  if (cached[rating][type] == null) cached[rating][type] = []
  if (cached[rating][type].length <= 5) {
    if (cached[rating][type].length === 0) await addCachedTag(type, rating)
    addCachedTag(type, rating)
  }
  addCachedTag(type, rating) // always add a new tag to the cache
  const data = cached[rating][type][0]
  if (cached[rating][type].length > 0 && cached.ratelimit === false) cached[rating][type].splice(0, 1)
  return data
}

async function addCachedTag (type = 'fox', rating = 'g') {
  if (cached.ratelimit === true) return null
  const request = await requestTag(type, rating, true)
  if (request == null) return null
  if (cached[rating] == null) cached[rating] = {}
  if (cached[rating][type] == null) cached[rating][type] = []
  const response = request.responseData
  const image = request.imageData
  cached[rating][type].push({ data: response.data, url: response.url, image: image.image, tags: response.tags, mime: image.mime })
}

async function downloadImage (url, base64 = true) {
  if (cached.ratelimit === true) return null
  log.debug('Downloading and encoding image...')
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' })
    if (response.status !== 200) return null
    log.debug('Done!')
    const raw = Buffer.from(response.data, 'binary')
    const mime = response.headers['content-type'] // ex: image/png
    if (base64 === false) return { image: raw, mime: mime }
    const rawBase64 = raw.toString('base64')
    const base64data = `data:${mime};base64,${rawBase64}`
    return { image: base64data, mime: mime }
  } catch (error) {
    const response = error?.response
    if (response == null || response?.status == null) return null
    switch (response.status) {
      case 429: {
        cached.ratelimit = true
        log.error('Too many image requests!')
        clearTimeout(cached.ratelimitTimeout)
        cached.ratelimitTimeout = setTimeout(() => {
          cached.ratelimit = false
        }, config.ratelimitMs)
        return null
      }
      default: {
        return null
      }
    }
  }
}

// goes through each tag in tag_string and checks if it should be excluded (no furry stuff)
async function excludeTags (inputTags) {
  const inputTag = inputTags.split(' ')
  for (const tag of inputTag) {
    for (const excludedTag of tags.excluded) {
      if (tag === excludedTag) {
        log.error(`Excluded tag: ${tag}...`)
        return true
      }
    }
  }
  return false
}

async function requestDanbooru (tag = 'fox_girl', rating = 'g', raw = false) {
  const responseJson = { data: null, url: null, tags: null }
  if (cached.ratelimit === true) return null
  // rating can be 'g,s' but that adds suggestive content which can get me booped by Discord
  // example of extreme "suggestive": https://cdn.donmai.us/original/fb/ec/__kitsune_onee_san_original_drawn_by_akitsuki_karasu__fbecb3a960885c4227d474c0d36b66d6.png
  // https://danbooru.donmai.us/posts/random.json?tags=filetype:png,jpg score:>5 favcount:>10 rating:g (fox_girl)
  const url = `https://danbooru.donmai.us/posts/random.json?tags=filetype:png,jpg,gif score:>5 favcount:>10 rating:${rating} (${tag})`
  // `https://danbooru.donmai.us/posts/random?tags=filetype:png,jpg score:>5 favcount:>10 rating:${rating} (${tag})`
  try {
    log.debug(`Fetching [${tag}]...`)
    const response = await axios.get(url)
    if (response.status !== 200) return null // this shouldn't be reached if the request is successful
    const responseUrl = response.data.large_file_url ?? response.data.file_url
    log.debug(`Post: https://danbooru.donmai.us/posts/${response.data.id} || Rating: ${response.data.rating} || File: ${responseUrl}\nTags: ${response.data.tag_string}`)
    if (responseUrl == null) { // sometimes, url isn't returned by API || needs further debugging
      log.error('No image found in API response!')
      log.error(response.data)
      return responseJson
    }
    responseJson.data = response.data
    responseJson.url = responseUrl
    responseJson.tags = response.data.tag_string
    return responseJson
  } catch (error) {
    const response = error?.response
    if (response == null || response?.status == null) return null
    switch (response.status) {
      case 429: {
        cached.ratelimit = true
        log.error('Too many API requests!')
        clearTimeout(cached.ratelimitTimeout)
        cached.ratelimitTimeout = setTimeout(() => {
          cached.ratelimit = false
        }, config.ratelimitMs)
        return null
      }
      default: {
        return null
      }
    }
  }
}

async function arrayRandomizer (array) {
  const random = Math.floor(Math.random() * array.length)
  return array[random]
}
