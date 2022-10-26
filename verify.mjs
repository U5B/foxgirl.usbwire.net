import log from './log.mjs'
import { util } from './util.mjs'
import { cached } from './cache.mjs'
import { requestImage, downloadImage } from './danbooru.mjs'
import { randomTag, excludeTags } from './tags.mjs'

export async function requestTag (type = 'foxgirl', rating = 'g', image = true, highres = false) {
  const tag = await randomTag(type)
  const request = await requestTagRaw(tag, rating, image, highres)
  request.type = type
  return request
}

export async function requestTagRaw (tag = 'fox_girl', rating = 'g', image = true, highres = false) {
  const response = await requestImage(tag, rating)
  // API has specifically failed
  if (response === false) {
    log.error('Image has invalid data in it??')
    if (cached.delay > 0) await util.sleep(cached.delay)
    return await requestTagRaw(tag, rating, image, highres)
  }
  const excluded = await excludeTags(response.tags)
  if (excluded.found === true) {
    log.error(`Blacklisted tag: ${excluded.tag}`)
    if (cached.delay > 0) await util.sleep(cached.delay)
    return await requestTagRaw(tag, rating, image, highres)
  }
  if (image === false) {
    const data = await newRequest(response, null, tag, rating)
    return data
  }
  const url = highres === true ? response.urlhd : response.url
  if (cached.delay > 0) await util.sleep(cached.delay)
  const downloadedImage = await downloadImage(url)
  if (downloadedImage === false) {
    log.error('Image failed to download...')
    if (cached.delay > 0) await util.sleep(cached.delay)
    return await requestTagRaw(tag, rating, image, highres)
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
