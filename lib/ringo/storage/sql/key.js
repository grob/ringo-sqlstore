export("Key");

/**
 * Database Key constructor
 * @param {String} type The type of the key
 * @param {Number} id The id of the key
 * @constructor
 */
var Key = function(type, id) {

    /**
     * Contains the type of this key
     * @type String
     */
    Object.defineProperty(this, "type", {
        "get": function() {
            return type || null;
        }
    });

    /**
     * Contains the id of this key
     * @type Number
     */
    Object.defineProperty(this, "id", {
        "get": function() {
            return id || null;
        },
        "set": function(newId) {
            // only allow setting the ID if the key is transient
            if (!this.isPersistent()) {
                id = newId;
            }
        }
    });

    /**
     * Returns true if this key is a persistent one (meaning the id is set)
     * @returns True if this key is a persistent one, false otherwise
     * @type Boolean
     */
    this.isPersistent = function() {
        return id !== undefined && id !== null;
    };
    
    return this;
};

/** @ignore */
Key.prototype.toString = function() {
    return this.type + "#" + this.id;
};
