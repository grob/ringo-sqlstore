/**
 * @fileoverview Storable key implementation.
 */

/**
 * Database Key constructor
 * @class Instances of this class represent a storable's key, containing
 * the entity type and the ID of the storable.
 * @param {String} type The type of the key
 * @param {Number} id The id of the key
 * @constructor
 */
var Key = module.exports = function(type, id) {
    Object.defineProperties(this, {
        "type": {"value": type},
        "_id": {"value": id, "writable": true},
        "_cacheKey": {"value": null, "writable": true}
    });
    return this;
};

Object.defineProperties(Key.prototype, {
    /**
     * Contains the id of this key
     * @type Number
     * @name Key.prototype.id
     */
    "id": {
        "get": function() {
            return (this._id != null) ? this._id : null;
        },
        "set": function(newId) {
            // only allow setting the ID if the key is transient
            if (this._id !== undefined && this._id !== null) {
                throw new Error("Can't overwrite the ID of Key " + this.toString());
            }
            this._id = newId;
        },
        "enumerable": true
    },

    /**
     * The cache key of this Key instance
     * @type String
     * @name Key.prototype.cacheKey
     */
    "cacheKey": {
        "get": function() {
            if (this._cacheKey === null) {
                if (this._id === undefined || this._id === null) {
                    throw new Error("Can't create a cache key for a transient storable");
                }
                this._cacheKey = this.type + "#" + this._id;
            }
            return this._cacheKey;
        }
    }
});

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
