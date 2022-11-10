import { util } from './util.mjs'
const internal = {
  fox: ['fox_boy', 'fox_girl', 'fox_tail', 'fox_ears'],
  wolf: ['wolf_boy', 'wolf_girl', 'wolf_tail', 'wolf_ears'],
  cat: ['cat_boy', 'cat_girl', 'cat_tail', 'cat_ears'],
  foxboy: ['solo fox_boy'],
  foxgirl: ['solo fox_girl'],
  wolfboy: ['solo wolf_boy'],
  wolfgirl: ['solo wolf_girl'],
  catboy: ['solo cat_boy'],
  catgirl: ['solo cat_girl'],
  mimi: ['animal_ear_fluff']
}
const alias = {
  kitsune: 'fox',
  neko: 'cat',
  ooka: 'wolf'
}
const endpoints = util.getObjectNames(internal)
const aliases = util.getObjectNames(alias)
const excluded = ['furry', 'animal_nose', 'body_fur', 'fake_animal_ears', 'animalization', 'animal_costume', 'cosplay_photo']

const tag = {
  queue: [],
  full: [],
  busy: false,
  limit: {
    g: {
      foxgirl: 20
    },
    s: {},
    q: {},
    e: {},
    default: 3
  }
}

export {
  internal,
  endpoints,
  aliases,
  tag
}
/**
 * Validates endpoints and aliases
 * @param {String} endpoint - hopefully a valid endpoint
 * @returns {Promise<String|false>}
 */
export async function verifyEndpoint (endpoint) {
  // random endpoint
  if (endpoint === ('random' || 'cache')) return await randomEndpoint()
  // if there is an alias, use that
  else if (aliases.includes(endpoint)) return alias[endpoint]
  // if it is an actual endpoint, use that
  else if (endpoints.includes(endpoint)) return endpoint
  // otherwise, return false
  else return false
}

/**
 * Select a random endpoint from a given list of endpoints.
 * @param {String} endpoint one of the endpoints
 * @returns {Promise<String>}
 */
export async function randomEndpoint () {
  const response = await util.arrayRandomizer(endpoints)
  return response
}

/**
 * Select a random tag from an endpoint.
 * @param {String} endpoint one of the endpoints
 * @returns {Promise<String>}
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
