import log from './log.mjs'
import { cached } from './cache.mjs'
import fetch from 'node-fetch';

/**
 * Send an API request to Danbooru for the specified tag
 * @param {String} tag - a valid danbooru tag
 * @param {import('./type.mjs').rating} rating - g,q,s,e
 * @returns {Promise<import('./type.mjs').apiRequest}
 */
export async function requestImage (tag = 'fox_girl', rating = 'g') {
  // rating can be 'g,s' but that adds suggestive content which can get me booped by Discord
  // example of extreme "suggestive": https://cdn.donmai.us/original/fb/ec/__kitsune_onee_san_original_drawn_by_akitsuki_karasu__fbecb3a960885c4227d474c0d36b66d6.png
  // https://danbooru.donmai.us/posts/random.json?tags=filetype:png,jpg score:>5 favcount:>5 rating:g (fox_girl)
  const url = `https://danbooru.donmai.us/posts/random.json?tags=filetype:png,jpg,gif rating:${rating} (${tag})`
  // `https://danbooru.donmai.us/posts/random?tags=filetype:png,jpg score:>5 favcount:>5 rating:${rating} (${tag})`
  try {
    log.debug(`Fetching tags: [${tag}] with rating: [${rating}]...`)
    const response = await fetch(url, { headers: { 'User-Agent': 'https://github.com/U5B/mimi.usbwire.net' } })
    if (!response.ok || response.status != 200) {
      throw Error({response: response})
    }
    const json = await response.json()
    log.debug(`Fetched! Post: https://danbooru.donmai.us/posts/${json.id} || Rating: ${json.rating} || File: ${json.file_url}`)
    if (json?.success === false) throw Error('Invalid data!')
    if ((json?.is_flagged || json?.is_deleted || json?.is_pending || json?.is_banned) === true) throw Error('Post flagged!')
    if ((json.large_file_url || json.file_url) == null) throw Error('No image!')
    const data = await newApi(json)
    return data
  } catch (error) {
    if (error?.response) {
      const response = error.response
      if (response == null || response?.status == null) return false
      log.error(`Status: ${response.status}`)
      switch (response.status) {
        case 424:
        case 423:
        case 404:
        case 400: {
          await log.error('URL is malformed: invalid tags')
          process.exit(1)
          break
        }
        case 503:
        case 502:
        case 500: {
          log.error('Danbooru is having issues!')
          cached.delay += 2000
          break
        }
        case 429: {
          log.error('Ratelimit hit!')
          cached.delay += 4000
          break
        }
        case 403: {
          log.error("CF Page!")
          cached.delay += 30000
          break
        }
        default: {
          cached.delay += 1000
          break
        }
      }
    } else {
      log.error(error)
      cached.delay += 1000
    }
    return false
  }
}

/**
 * Download an image from the specified url.
 * @param {String} url - url to download image from
 * @returns {Promise<import('./type.mjs').apiImage>}
 */
export async function downloadImage (url) {
  try {
    log.debug(`Downloading image from: ${url}`)
    const response = await fetch(`${url}`, { headers: { 'User-Agent': 'https://github.com/U5B/mimi.usbwire.net' }, responseType: 'arraybuffer' })
    if (!response.ok || response.status != 200) {
      throw Error({response: response})
    }
    const arrayBuffer = await response.arrayBuffer()
    const raw = Buffer.from(arrayBuffer)
    const mime = response.headers.get("content-type") // ex: image/png
    const data = await newImage(raw, mime)
    if (data.extension === "txt") {
      log.error("Response was txt!")
      return false
    }
    return data
  } catch (error) {
    if (error?.response) {
      const response = error.response
      if (response == null || response?.status == null) return false
      switch (response.status) {
        case 424:
        case 423:
        case 404:
        case 400: {
          await log.error('URL is malformed: invalid tags')
          process.exit(1)
          break
        }
        case 503:
        case 502:
        case 500: {
          log.error('Danbooru is having issues!')
          cached.delay += 2000
          break
        }
        case 429: {
          log.error('Ratelimit hit!')
          cached.delay += 4000
          break
        }
        case 403: {
          log.error("CF Page!")
          cached.delay += 30000
          break
        }
        default: {
          cached.delay += 1000
          break
        }
      }
    } else {
      log.error(error)
      cached.delay += 1000
    }
    return false
  }
}

/**
 * Parses image data into usable data
 * @param {Buffer} image - raw image
 * @param {("image/png"|"image/jpg"|"image/jpeg"|"image/gif")} mime - mimetype of the file: image/png, image/jpg, image/jpeg, image/gif
 * @returns {Promise<import('./type.mjs').apiImage>}
 */
async function newImage (image, mime) {
  const extension = await getFileExtension(mime)
  return {
    image,
    mime,
    extension
  }
}

/**
 * Parses Danbooru API response into usable data
 * @param {*} response - whatever you get from axios lol
 * @returns {Promise<import('./type.mjs').apiRequest>} {{raw: String, id: Number, tags: String, url: String, urlhd: String}}
 */
async function newApi (response) {
  return {
    raw: response,
    id: response.id,
    tags: response.tag_string,
    url: response.has_large === true ? response.large_file_url : response.file_url,
    urlhd: response.file_url
  }
}

/**
* @param {import('./type.mjs').mime} mime - mimetype of the file: image/png, image/jpg, image/jpeg, image/gif
* @returns {Promise<import('./type.mjs').extension>} - file extension
*/
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
    default: {
      return 'txt'
    }
  }
}
