export("Key");

var {createCacheKey} = require("./cache");

/**
 * Database Key constructor
 * @param {String} type The type of the key
 * @param {Number} id The id of the key
 * @constructor
 */
var Key = function(type, id) {

    Object.defineProperties(this, {
        /**
         * Contains the type of this key
         * @type String
         */
        "type": {"value": type, "enumerable": true},

        /**
         * Contains the id of this key
         * @type Number
         */
        "id": {
            "get": function() {
                return id || null;
            },
            "set": function(newId) {
                // only allow setting the ID if the key is transient
                if (id !== undefined && id !== null) {
                    throw new Error("Can't overwrite the ID of Key ", this.toString());
                }
                id = newId;
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
 * @returns True if both keys are equal, false otherwise
 * @type Boolean
 */
Key.prototype.equals = function(key) {
    return this === key || (this.type === key.type && this.id === key.id);
};

/**
 * Creates a cache key for this key instance
 * @returns A cache key
 * @type String
 */
Key.prototype.getCacheKey = function() {
    return createCacheKey(this.type, this.id);
};
