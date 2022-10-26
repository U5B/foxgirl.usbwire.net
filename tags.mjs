import { util } from './util.mjs'
const internal = {
  fox: ['fox_girl', 'fox_tail', 'fox_ears'],
  wolf: ['wolf_girl', 'wolf_tail', 'wolf_ears'],
  cat: ['cat_girl', 'cat_tail', 'cat_ears'],
  foxgirl: ['solo fox_girl'],
  wolfgirl: ['solo wolf_girl'],
  catgirl: ['solo cat_girl'],
  mimi: ['animal_ear_fluff']
}
const endpoints = util.getObjectNames(internal)
const excluded = ['furry', 'animal_nose', 'body_fur', 'fake_animal_ears', 'animalization', 'animal_costume', 'cosplay_photo']

const tag = {
  queue: [],
  full: [],
  busy: false,
  limit: {
    foxgirl: 20,
    default: 3
  }
}

export {
  internal,
  endpoints,
  tag
}

/**
 * Select a random endpoint from a given list of endpoints.
 * @param {String} endpoint one of the endpoints
 */
export async function randomEndpoint () {
  const response = await util.arrayRandomizer(endpoints)
  return response
}

/**
 * Select a random tag from an endpoint.
 * @param {String} endpoint one of the endpoints
 */
export async function randomTag (endpoint) {
  const response = await util.arrayRandomizer(internal[endpoint])
  return response
}

/**
 * exclude the furry stuff
 * @param {String} inputTags - input
 */
export async function excludeTags (inputTags) {
  const inputTag = inputTags.split(' ')
  for (const tag of inputTag) {
    for (const excludedTag of excluded) {
      if (tag === excludedTag) {
        return { tag, found: true }
      }
    }
  }
  return { tag: null, found: false }
}
