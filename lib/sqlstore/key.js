/**
 * @fileoverview Storable key implementation.
 */
var {createCacheKey} = require("./cache");

/**
 * Database Key constructor
 * @class Instances of this class represent a storable's key, containing
 * the entity type and the ID of the storable.
 * @param {String} type The type of the key
 * @param {Number} id The id of the key
 * @constructor
 */
var Key = exports.Key = function(type, id) {

    var cacheKey = null;

    Object.defineProperties(this, {
        /**
         * Contains the name of the entity of this key
         * @type String
         * @name Key.prototype.type
         */
        "type": {"value": type, "enumerable": true},

        /**
         * Contains the id of this key
         * @type Number
         * @name Key.prototype.id
         */
        "id": {
            "get": function() {
                return id || null;
            },
            "set": function(newId) {
                // only allow setting the ID if the key is transient
                if (id !== undefined && id !== null) {
                    throw new Error("Can't overwrite the ID of Key " + this.toString());
                }
                id = newId;
            }
        },
        /**
         * The cache key of this Key instance
         * @type String
         * @name Key.prototype.cacheKey
         */
        "cacheKey": {
            "get": function() {
                if (cacheKey === null) {
                    if (this.id === undefined || this.id === null) {
                        throw new Error("Can't create a cache key for a transient storable");
                    }
                    cacheKey = createCacheKey(this.type, this.id);
                }
                return cacheKey;
            }
        }
    });

    return this;
};

/** @ignore */
Key.prototype.toString = function() {
    return this.type + "#" + this.id;
};

/**
 * Returns true if this key is equal to the one passed as argument
 * @param {Key} key The key to compare to
 * @returns {Boolean} True if both keys are equal, false otherwise
 */
Key.prototype.equals = function(key) {
    return this === key || (this.type === key.type && this.id === key.id);
};
