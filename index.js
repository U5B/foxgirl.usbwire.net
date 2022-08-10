const axios = require('axios')
const express = require('express')

const log = require('./log.js')

const app = express()
const port = 42069

app.set('trust proxy', true)
app.use(express.static('public'))

const tags = {
  fox: ['fox_girl', 'fox_tail', 'fox_ears'],
  mimi: ['animal_ear_fluff'],
  wolf: ['wolf_girl', 'wolf_tail', 'wolf_ears'],
  cat: ['cat_girl', 'cat_tail', 'cat_ears'],
  excluded: ['furry', 'animal_nose', 'body_fur', 'fake_animal_ears', 'animalization']
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

app.use(async (req, res, next) => {
  log.info(`${req.method}:${req.url} ${res.statusCode}`)
  switch (req.url) {
    case '/': { // redirect to reloadable page
      req.url = '/foxgirl'
      break
    }
  }
  // global ratelimit stuffz so that sky doesn't overload my server
  cached.requests++
  clearTimeout(cached.requestsTimeout)
  cached.requestsTimeout = setTimeout(() => {
    cached.requests = 0
  }, config.ms)
  next()
})

async function preCache (ip) {
  if (cached.ips[ip] == null) {
    cached.ips[ip] = {
      html: null,
      previousHtml: null,
      redirect: null,
      previousRedirect: null,
      image: null,
      previousImage: null,
      timeout: null,
      requests: 0
    }
  }
  clearTimeout(cached.ips[ip].timeout)
}

async function postCache (ip) {
  cached.ips[ip].timeout = setTimeout(() => {
    cached.ips[ip].html = null
    cached.ips[ip].redirect = null
    cached.ips[ip].image = null
    cached.ips[ip].requests = 0
  }, config.ms)
}

async function cacheRedirect (url, ip) {
  await preCache(ip)
  cached.ips[ip].redirect = url
  cached.ips[ip].previousRedirect = url
  await postCache(ip)
}

async function redirectIsCached (ip) {
  if (cached.ips[ip]?.redirect) return cached.ips[ip].redirect
  return false
}

async function cacheHtml (html, ip) {
  await preCache(ip)
  cached.ips[ip].html = html
  cached.ips[ip].previousHtml = html
  await postCache(ip)
}

async function htmlIsCached (ip) {
  if (cached.ips[ip]?.html) return cached.ips[ip].html
  return false
}

async function cacheImage (image, ip) {
  await preCache(ip)
  cached.ips[ip].image = image
  cached.ips[ip].previousImage = image
  await postCache(ip)
}

async function imageIsCached (ip) {
  if (cached.ips[ip]?.image) return cached.ips[ip].image
  return false
}

async function getRedirect (req, res, rating = 'g', tag = 'fox') {
  const originalIp = req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.ip
  const requestCount = cached.ips[originalIp]?.requests
  const redirectCached = await redirectIsCached(originalIp)
  if (cached.ratelimit === true || (redirectCached && (requestCount >= config.requestsPer || cached.requests >= config.requestsMax))) {
    await cacheRedirect(redirectCached, originalIp)
    log.info(`Served image cached: '${redirectCached}'`)
    return res.redirect(redirectCached)
  }
  const data = await cachedTag(originalIp, tag, rating)
  if (data.url == null && redirectCached) return res.redirect(redirectCached)
  else if (data.url == null) return res.redirect('https://usbwire.net')
  await cacheRedirect(data.url, originalIp)
  cached.ips[originalIp].requests++
  res.redirect(data.url)
}

// legacy
/*
async function getHtml (req, res, rating = 'g', tag = 'fox') {
  const originalIp = req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.ip
  const requestCount = cached.ips[originalIp]?.requests
  const htmlCached = await htmlIsCached(originalIp)
  if (htmlCached && (requestCount >= config.requestsPer || cached.requests >= config.requestsMax || cached.ratelimit === true)) {
    await cacheHtml(htmlCached, originalIp)
    log.info(`Served image cached: '${htmlCached}'`)
    return res.send(htmlCached)
  }
  const data = await cachedTag(originalIp, tag, rating)
  if (data.url == null && htmlCached) return res.send(htmlCached)
  else if (data.url == null) return res.redirect('https://usbwire.net')
  const rawHtml = await generateHtml(data.url, 'uwu')
  await cacheHtml(rawHtml, originalIp)
  cached.ips[originalIp].requests++
  // extra data in headers
  res.header('mimi-image', data.url)
  res.header('mimi-post', `https://danbooru.donmai.us/posts/${data.data.id}`)
  res.header('mimi-tags', data.data.tag_string)
  res.send(rawHtml)
}
*/

// writes necessary image data
async function writeImageData (res, data) {
  res.header('mimi-image', data.url)
  res.header('mimi-post', `https://danbooru.donmai.us/posts/${data.data.id}`)
  res.header('mimi-tags', data.tags)
  res.header('content-type', data.content) // required for the image to display properly in browsers
  res.write(data.image)
  return true
}

async function getImage (req, res, rating = 'g', tag = 'fox') {
  const originalIp = req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.ip
  const requestCount = cached.ips[originalIp]?.requests
  const imageCached = await imageIsCached(originalIp)
  if (imageCached && (requestCount >= config.requestsPer || cached.requests >= config.requestsMax || cached.ratelimit === true)) {
    await cacheImage(imageCached, originalIp)
    // await writeImageData(res, imageCached)
    res.status(304)
    return res.end()
  }
  const data = await cachedTag(originalIp, tag, rating)
  if (data.image == null && imageCached) await res.write(imageCached)
  else if (data.image == null) return res.redirect('https://usbwire.net')
  await cacheImage(data, originalIp)
  cached.ips[originalIp].requests++
  await writeImageData(res, data)
  res.status(200)
  res.end()
}

app.get(/\/foxgirl_lewd(|\/.*)/, async (req, res) => {
  await getImage(req, res, 's', 'fox')
})

app.get(/^\/foxgirl(|\/.*)$/, async (req, res) => {
  await getImage(req, res, 'g', 'fox')
})

app.listen(port, async () => {
  log.info(`API listening on port ${port}!`)
  await addCachedTag('fox', 'g')
  await addCachedTag('fox', 's')
})

async function requestTag (type = 'fox', rating = 'g', image = true) {
  const [tag, num] = await arrayRandomizer(tags[type])
  const response = await requestDanbooru(tag, rating)
  // if image response isn't expected, just return senko
  if (response == null || response.url == null || response.data?.success === false || response.tags == null) return null
  // otherwise if it is flagged, request a new one
  if ((response.data?.is_flagged || response.data?.is_deleted || response.data?.is_pending || response.data?.is_banned) === true) {
    log.error('Image is flagged, deleted, pending, or banned... > Requesting new image...')
    return await requestTag(type, rating, image)
  }
  const excluded = await excludeTags(response.tags)
  if (excluded === true) {
    return await requestTag(type, rating, image)
  }
  if (image === false) return { responseData: response, imageData: null }
  const downloadedImage = await downloadImage(response.url, false)
  if (downloadedImage == null) return { responseData: response, imageData: null }
  return { responseData: response, imageData: downloadedImage }
}

async function cachedTag (ip, type = 'fox', rating = 'g') {
  if (cached[rating] == null) cached[rating] = {}
  if (cached[rating][type] == null) cached[rating][type] = []
  if (cached[rating][type].length <= 5) {
    if (cached[rating][type].length === 0) await addCachedTag(type, rating)
    addCachedTag(type, rating)
  }
  addCachedTag(type, rating) // always add a new tag to the cache
  const image = cached[rating][type][0]
  if (cached[rating][type].length > 0 && cached.ratelimit === false) cached[rating][type].splice(0, 1)
  else return cached.ips[ip].previousImage
  return image
}

async function addCachedTag (type = 'fox', rating = 'g') {
  if (cached.ratelimit === true) return null
  const request = await requestTag(type, rating, true)
  if (request == null) return null
  if (cached[rating] == null) cached[rating] = {}
  if (cached[rating][type] == null) cached[rating][type] = []
  const response = request.responseData
  const image = request.imageData
  cached[rating][type].push({ data: response.data, url: response.url, image: image.image, tags: response.tags, content: image.content })
}

// technically legacy, I now just send the raw image
async function generateHtml (url, title = 'Roulette') {
  const rawHtml = `
  <html style="height: 100%;">
  <head>
    <meta name="viewport" content="width=device-width, minimum-scale=0.1">
    <title>${title}</title>
  </head>
  <body style="margin: 0px; background: #0e0e0e; height: 100%">
    <img style="max-width: 100%;max-height: 100%;height: auto; display: block;-webkit-user-select: none;margin: auto;cursor: zoom-in;background-color: hsl(0, 0%, 90%);transition: background-color 300ms;" src="${url}" alt="owo" fetchpriority="high">
  </body>
  </html>`
  return rawHtml
}

async function downloadImage (url, base64 = true) {
  if (cached.ratelimit === true) return null
  log.debug('Downloading and encoding image...')
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' })
    if (response.status !== 200) return null
    log.debug('Done!')
    const raw = Buffer.from(response.data, 'binary')
    const contentType = response.headers['content-type']
    if (base64 === false) return { image: raw, content: contentType }
    const rawBase64 = raw.toString('base64')
    const base64data = `data:${contentType};base64,${rawBase64}`
    return { image: base64data, content: contentType }
  } catch (error) {
    const response = error.response
    if (response == null || response?.status == null) return null
    switch (response.status) {
      case 429: {
        cached.ratelimit = true
        log.error('Too many image requests! Redirecting user instead...')
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

// this returns the raw request
/*
async function requestCheckRaw (type = 'fox') {
  const [tag, num] = await arrayRandomizer(tags[type])
  const response = await requestDanbooru(tag)
  if (response == null || response.url == null || response.data?.success === false) return null
  if ((response.data?.is_flagged || response.data?.is_deleted || response.data?.is_pending || response.data?.is_banned) === true) return requestCheck(type)
  const excluded = await excludeTags(response.tags)
  if (excluded === true) return requestCheckRaw(type)
  return response
}
*/

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
  if (cached.ratelimit === true) return responseJson
  // rating can be 'g,s' but that adds suggestive content which can get me booped by Discord
  // example of extreme "suggestive": https://cdn.donmai.us/original/fb/ec/__kitsune_onee_san_original_drawn_by_akitsuki_karasu__fbecb3a960885c4227d474c0d36b66d6.png
  // https://danbooru.donmai.us/posts/random.json?tags=filetype:png,jpg score:>5 favcount:>10 rating:g (solo fox_girl)
  const url = `https://danbooru.donmai.us/posts/random.json?tags=filetype:png,jpg score:>5 favcount:>10 rating:${rating} (solo ${tag})`
  // `https://danbooru.donmai.us/posts/random?tags=filetype:png,jpg score:>5 favcount:>10 rating:${rating} (solo ${tag})`
  try {
    log.debug(`Fetching [${tag}]...`)
    const response = await axios.get(url)
    if (response.status !== 200) return null // this shouldn't be reached if the request is successful
    let responseUrl = response.data.large_file_url ?? response.data.file_url
    log.debug(`Post: https://danbooru.donmai.us/posts/${response.data.id} || Rating: ${response.data.rating} || File: ${responseUrl}\nTags: ${response.data.tag_string}`)
    if (raw === true) responseUrl = `https://danbooru.donmai.us/posts/${response.data.id}`
    responseJson.data = response.data
    responseJson.url = responseUrl
    responseJson.tags = response.data.tag_string
    return responseJson
  } catch (error) {
    const response = error.response
    const responseJson = { data: null, url: null, tags: null }
    if (response == null || response?.status == null) return responseJson
    switch (response.status) {
      case 429: {
        cached.ratelimit = true
        log.error('Too many API requests! Redirecting user instead...')
        clearTimeout(cached.ratelimitTimeout)
        cached.ratelimitTimeout = setTimeout(() => {
          cached.ratelimit = false
        }, config.ratelimitMs)
        return responseJson
      }
      default: {
        return responseJson
      }
    }
  }
}

async function arrayRandomizer (tags) {
  const random = Math.floor(Math.random() * tags.length)
  return [tags[random], random]
}

// legacy stuff with APIs that sometimes got ratelimited too hard or were down
/*
async function requestFoxgirl () {
  const urls = [
    'https://nekos.life/api/v2/img/fox_girl',
    'http://api.nekos.fun:8080/api/foxgirl',
    'https://api.waifu.pics/sfw/awoo'
  ]
  const foxgirl = await requestRandom(urls)
  return foxgirl
}

async function requestKemonomimi () {
  const urls = [
    // uses response.data.url
    'https://api.waifu.pics/sfw/awoo',
    'https://api.waifu.pics/sfw/neko',
    'https://nekos.life/api/v2/img/fox_girl',
    'https://nekos.life/api/v2/img/neko',
    // uses response.data.image
    'http://api.nekos.fun:8080/api/foxgirl'
  ]
  const kemonomimi = await requestRandom(urls)
  return kemonomimi
}

async function requestRandom (urls) {
  const random = Math.floor(Math.random() * urls.length)
  try {
    const response = await axios.get(urls[random])
    if (response.status !== 200) return undefined
    const responseUrl = response.data.image ?? response.data.url
    log.info(`${urls[random]} => ${responseUrl}`)
    return responseUrl
  } catch (error) {
    console.error(error)
  }
}
*/
