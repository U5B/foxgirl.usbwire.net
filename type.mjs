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
 * @property {apiRaw} raw - raw data of response // TODO: make type with danbooru response data
 * @property {Number} id - same as raw.id: id of danbooru post
 * @property {String} tags - same as raw.tag_string: list of tags seperated with space
 * @property {String} url - url of low-res image to download / can be the same as the high-res image
 * @property {String} urlhd - url of high-res image to download
 */

/**
 * apiRequest and apiImage combined
 * @global
 * @typedef {Object} apiCombined
 * @property {apiRaw} raw - raw data of response // TODO: make type with danbooru response data
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
 * doesn't have all properties, but it has most of them
 * @global
 * @typedef {Object} apiRaw
 * @property {Number} id - unique id of image/post
 * @property {String} created_at - timestamp created
 * @property {String} md5
 * @property {rating} rating - content rating
 * @property {Number} image_width - width of original image
 * @property {Number} image_height - height of original image
 * @property {String} tag_string - list of tags for image
 * @property {String} file_ext - file extension of original image
 * @property {Number} file_size - file size of original image
 * scoring
 * @property {Number} score - overall score
 * @property {Number} up_score - upvotes
 * @property {Number} down_score - downvotes
 * @property {Number} fav_count - favorites
 * if image is blacklisted
 * @property {Boolean} is_pending
 * @property {Boolean} is_flagged
 * @property {Boolean} is_deleted
 * @property {Boolean} is_banned
 * image urls
 * @property {String} file_url - original image  (usually high-res)
 * @property {String} large_file_url - lower-res image
 * @property {String} preview_file_url - thumbnail image
 * @property {Boolean} [sucesss]
 */

/**
 * @global
 * @typedef {'g'|'q'|'s'|'e'} rating - content rating used for this request
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
