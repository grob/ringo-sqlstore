export("Cache", "createCacheKey");

var log = require('ringo/logging').getLogger(module.id);
var {HashMap} = java.util;
var {synchronizedMap} = java.util.Collections;

/**
 * Creates a cache key
 * @param {String} typeOrKey Either an entity key, or a type string
 * @param {Number} id The ID of the entity
 * @returns The cache key
 * @type String
 */
var createCacheKey = function(type, id, property) {
    var key = type + "#" + id;
    if (property != undefined) {
        key += "." + property;
    }
    return key;
};

/**
 * Creates a new Cache instance
 * @class Object cache
 * @param {Number} size Optional cache size, defaults to 1000
 * @returns A newly created Cache instance
 * @constructor
 */
var Cache = function(size) {
    if (size == null || isNaN(size)) {
        size = 1000;
    }
    var loadFactor = 0.75;
    var threshold = size / 2;
    var capacity = (threshold / loadFactor) + 2;
    var oldTable = synchronizedMap(new HashMap());
    var newTable = synchronizedMap(new HashMap(capacity));

    /**
     * Returns the cached value for the given key
     * @param {Object} key The cache key
     * @returns The cached value
     */
    this.get = function(key) {
        var value = null;
        if (newTable.containsKey(key)) {
            value = newTable.get(key);
        } else if (oldTable.containsKey(key)) {
            value = oldTable.remove(key);
            newTable.put(key, value);
        }
        return value;
    };

    /**
     * Adds the value with the given key into the cache
     * @param {Object} key The cache key
     * @param {Object} value The value
     */
    this.put = function(key, value) {
        if (oldTable.containsKey(key)) {
            oldTable.remove(key);
        }
        newTable.put(key, value);
        if (log.isDebugEnabled()) {
            log.debug("Put", key, " into cache");
        }
        if (newTable.size() >= threshold) {
            log.info("Rotating cache tables at " + newTable.size() + " objects, purging "
                     + oldTable.size() + " objects");
            oldTable = newTable;
            newTable = synchronizedMap(new HashMap(capacity, loadFactor));
        }
        return;
    };

    /**
     * Removes the cached value for the given key
     * @param {Object} key The cache key
     */
    this.remove = function(key) {
        if (newTable.containsKey(key)) {
            newTable.remove(key);
            if (log.isDebugEnabled()) {
                log.debug("Removed", key, " from cache (new table)");
            }
        } else if (oldTable.containsKey(key)) {
            oldTable.remove(key);
            if (log.isDebugEnabled()) {
                log.debug("Removed", key, " from cache (old table)");
            }
        }
        return;
    };

    /**
     * Returns true if the cache contains the given key
     * @param {Object} key The cache key
     * @returns True if the cache contains the given key, false otherwise
     * @type Boolean
     */
    this.containsKey = function(key) {
        if (newTable.containsKey(key)) {
            if (log.isDebugEnabled()) {
                log.debug("Cache hit in new table", key);
            }
            return true;
        }
        if (oldTable.containsKey(key)) {
            // move value from old to new table
            var value = oldTable.remove(key);
            newTable.put(key, value);
            if (log.isDebugEnabled()) {
                log.debug("Cache hit in old table", key);
            }
            return true;
        }
        if (log.isDebugEnabled()) {
            log.debug("Cache miss", key);
        }
        return false;
    };

    /**
     * Empties the cache
     */
    this.clear = function() {
        oldTable.clear();
        newTable.clear();
        return;
    };

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
