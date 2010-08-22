export("Cache");

var Key = require("./key").Key;
var log = require('ringo/logging').getLogger(module.id);

/**
 * Creates a new Cache instance
 * @class Object cache
 * @param {Number} size Optional cache size, defaults to 1000
 * @returns A newly created Cache instance
 * @constructor
 */
var Cache = function(size) {
    if (size == null || !isNaN(size)) {
        size = 1000;
    }
    var loadFactor = 0.75;
    var threshold = size / 2;
    var capacity = (threshold / loadFactor) + 2;
    var oldTable = new java.util.HashMap();
    var newTable = new java.util.HashMap(capacity);

    /**
     * Returns the cached value for the given key
     * @param {Object} key The cache key
     * @returns The cached value
     */
    this.get = new org.mozilla.javascript.Synchronizer(function(key) {
        var value = null;
        if (newTable.containsKey(key)) {
            value = newTable.get(key);
        } else if (oldTable.containsKey(key)) {
            value = oldTable.remove(key);
            newTable.put(key, value);
        }
        return value;
    });

    /**
     * Adds the value with the given key into the cache
     * @param {Object} key The cache key
     * @param {Object} value The value
     */
    this.put = new org.mozilla.javascript.Synchronizer(function(key, value) {
        if (oldTable.containsKey(key)) {
            oldTable.remove(key);
        }
        if (!newTable.containsKey(key)) {
            newTable.put(key, value);
            log.debug("Put", key, " into cache");
            if (newTable.size() >= threshold) {
                log.info("Rotating cache tables at " + newTable.size() + " objects, purging "
                         + oldTable.size() + " objects");
                oldTable = newTable;
                newTable = new java.util.HashMap(capacity, loadFactor);
            }
        }
        return;
    });

    /**
     * Removes the cached value for the given key
     * @param {Object} key The cache key
     */
    this.remove = new org.mozilla.javascript.Synchronizer(function(key) {
        if (newTable.containsKey(key)) {
            newTable.remove(key);
        } else if (oldTable.containsKey(key)) {
            oldTable.remove(key);
        }
        return;
    });

    /**
     * Returns true if the cache contains the given key
     * @param {Object} key The cache key
     * @returns True if the cache contains the given key, false otherwise
     * @type Boolean
     */
    this.containsKey = new org.mozilla.javascript.Synchronizer(function(key) {
        if (newTable.containsKey(key)) {
            log.debug("Cache hit in new table", key);
            return true;
        }
        if (oldTable.containsKey(key)) {
            // move value from old to new table
            var value = oldTable.remove(key);
            newTable.put(key, value);
            log.debug("Cache hit in old table", key);
            return true;
        }
        log.debug("Cache miss", key);
        return false;
    });

    /**
     * Empties the cache
     */
    this.clear = new org.mozilla.javascript.Synchronizer(function() {
        oldTable.clear();
        newTable.clear();
        return;
    });

    /**
     * Returns the number of objects in the cache
     * @returns The number of objects in the cache
     * @type Number
     */
    this.size = function() {
        return newTable.size() + oldTable.size();
    };

    /**
     * Returns true if the cache is empty
     * @returns True if the cache is empty, false otherwise
     * @type Boolean
     */
    this.isEmpty = function() {
        return this.size() === 0;
    };
    
    return this;
};

/** @ignore */
Cache.prototype.toString = function() {
    return "[Cache]";
};

/**
 * Creates a cache key
 * @param {Key | String} typeOrKey Either an entity key, or a type string
 * @param {Number} id The ID of the entity
 * @returns The cache key
 * @type String
 */
Cache.createKey = function(typeOrKey, id) {
    if (typeOrKey instanceof Key) {
        return typeOrKey.toString();
    }
    return (new Key(typeOrKey, id)).toString();
};
