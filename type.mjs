/**
 * data about image
 * @global
 * @typedef {Object} apiImage
 * @property {Buffer} image - raw image
 * @property {mime} mime - mimetype of the file: image/png, image/jpg, image/jpeg, image/gif
 * @property {String} extension - file extension: png, jpg, gif
 */

/**
 * data about api response
 * @global
 * @typedef {Object} apiRequest
 * @property {Object} raw - raw data of response // TODO: make type with danbooru response data
 * @property {Number} id - same as raw.id: id of danbooru post
 * @property {String} tags - same as raw.tag_string: list of tags seperated with space
 * @property {String} url - url of low-res image to download / can be the same as the high-res image
 * @property {String} urlhd - url of high-res image to download
 */

/**
 * apiRequest and apiImage combined
 * @global
 * @typedef {Object} apiCombined
 * @property {Object} raw - raw data of response // TODO: make type with danbooru response data
 * @property {Number} id - same as raw.id: id of danbooru post
 * @property {String} tags - same as raw.tag_string: list of tags seperated with space
 * @property {String} url - url of low-res image to download / can be the same as the high-res image
 * @property {String} urlhd - url of high-res image to download
 * @property {Buffer} [image] - raw image
 * @property {mime} [mime] - mimetype of the file: image/png, image/jpg, image/jpeg, image/gif
 * @property {extension} [extension] - file extension: png, jpg, gif
 * @property {String} tag - tag used for this request
 * @property {rating} rating - content rating used for this request
 */

/**
 * @global
 * @typedef {'g'|'q'|'s'} rating - content rating used for this request
 */

/**
 * @global
 * @typedef {"image/png"|"image/jpg"|"image/jpeg"|"image/gif"} mime - mimetype of the file: image/png, image/jpg, image/jpeg, image/gif
 */

/**
 * @global
 * @typedef {"png"|"jpg"|"gif"} extension - file extension: png, jpg, gif
 */

export const Types = {}
