const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
/**
 * @param {String[]} array
 */
async function arrayRandomizer (array) {
  const random = Math.floor(Math.random() * array.length)
  return array[random]
}

/**
 * Get object's keys in array form
 * @param {Object} object
 * @returns {String[]} array of object keys
 */
function getObjectNames (object) {
  const objectNames = []
  for (const name of Object.keys(object)) {
    objectNames.push(name)
  }
  return objectNames
}

export const util = {
  sleep,
  arrayRandomizer,
  getObjectNames
}
