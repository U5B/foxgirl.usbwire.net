import log from './log.mjs'
import { util } from './util.mjs'
import { cached } from './cache.mjs'
import { requestImage, downloadImage } from './danbooru.mjs'
import { randomTag, excludeTags } from './tags.mjs'

/**
 * 
 * @param {String} endpoint - a valid endpoint
 * @param {import('./type.mjs').rating} rating 
 * @param {Boolean} image - want an image?
 * @param {Boolean} hd - or an HD image?
 * @returns 
 */
export async function requestTag (endpoint = 'foxgirl', rating = 'g', image = true, hd = false) {
  const tag = await randomTag(endpoint)
  const request = await requestTagRaw(tag, rating, image, hd)
  request.endpoint = endpoint
  return request
}

export async function requestTagRaw (tag = 'fox_girl', rating = 'g', image = true, hd = false) {
  const response = await requestImage(tag, rating)
  // API has specifically failed
  if (response === false) {
    log.error('API request failed!')
    if (cached.delay > 0) await util.sleep(cached.delay)
    return await requestTagRaw(tag, rating, image, hd)
  }
  const excluded = await excludeTags(response.tags)
  if (excluded.found === true) {
    log.error(`Blacklisted tag: ${excluded.tag}`)
    if (cached.delay > 0) await util.sleep(cached.delay)
    return await requestTagRaw(tag, rating, image, hd)
  }
  if (image === false) {
    const data = await newRequest(response, null, tag, rating)
    return data
  }
  const url = hd === true ? response.urlhd : response.url
  if (cached.delay > 0) await util.sleep(cached.delay)
  const downloadedImage = await downloadImage(url)
  if (downloadedImage === false) {
    log.error('Image download failed!')
    if (cached.delay > 0) await util.sleep(cached.delay)
    return await requestTagRaw(tag, rating, image, hd)
  }
  const data = await newRequest(response, downloadedImage, tag, rating)
  return data
}

/**
 *
 * @param {import('./type.mjs').apiRequest} response - api response
 * @param {(import('./type.mjs').apiImage | null)} image - image response
 * @param {String} tag - tag used
 * @param {import('./type.mjs').rating} rating - content rating used
 * @returns {Promise<import('./type.mjs').apiCombined>}
 */
async function newRequest (response, image, tag, rating) {
  if (image == null) {
    return {
      raw: response.raw,
      id: response.id,
      tags: response.tags,
      url: response.url,
      urlhd: response.urlhd,
      tag,
      rating
    }
  }
  return {
    raw: response.raw,
    id: response.id,
    tags: response.tags,
    url: response.url,
    urlhd: response.urlhd,
    image: image.image,
    mime: image.mime,
    extension: image.extension,
    tag,
    rating
  }
}
