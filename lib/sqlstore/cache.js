/**
 * @fileoverview Generic LRU cache implementation, used for both query and
 * entity caches within a Store instance.
 */
var log = require('ringo/logging').getLogger(module.id);
var {HashMap} = java.util;

/**
 * Creates a cache key
 * @param {String} typeOrKey Either an entity key, or a type string
 * @param {Number} id The ID of the entity
 * @returns {String} The cache key
 */
exports.createCacheKey = function(type, id, property) {
    var key = type + "#" + id;
    if (property != undefined) {
        key += "." + property;
    }
    return key;
};

/**
 * Creates a new Cache instance
 * @class Instances of this class represent a generic object cache, used
 * by SqlStore for both queries and storables.
 * @param {Number} size Optional cache size, defaults to 1000
 * @returns A newly created Cache instance
 * @constructor
 */
var Cache = exports.Cache = function(size) {
    if (isNaN(parseInt(size, 10)) || !isFinite(size)) {
        size = 1000;
    }
    var loadFactor = 0.75;
    var threshold = size / 2;
    var lock = {};
    var capacity = (threshold / loadFactor) + 2;
    var oldTable = new HashMap();
    var newTable = new HashMap(capacity);

    /**
     * Returns the cached value for the given key
     * @param {Object} key The cache key
     * @returns The cached value
     */
    this.get = sync(function(key) {
        var value = null;
        if (newTable.containsKey(key)) {
            value = newTable.get(key);
        } else if (oldTable.containsKey(key)) {
            value = oldTable.remove(key);
            newTable.put(key, value);
        }
        return value;
    }, lock);

    /**
     * Adds the value with the given key into the cache
     * @param {Object} key The cache key
     * @param {Object} value The value
     */
    this.put = sync(function(key, value) {
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
            newTable = new HashMap(capacity, loadFactor);
        }
        return;
    }, lock);

    /**
     * Removes the cached value for the given key
     * @param {Object} key The cache key
     */
    this.remove = sync(function(key) {
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
    }, lock);

    /**
     * Returns true if the cache contains the given key
     * @param {Object} key The cache key
     * @returns {Boolean} True if the cache contains the given key, false otherwise
     */
    this.containsKey = sync(function(key) {
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
    }, lock);

    /**
     * Empties the cache
     * @returns undefined
     */
    this.clear = sync(function() {
        oldTable.clear();
        newTable.clear();
        return;
    }, lock);

    /**
     * Returns the number of objects in the cache
     * @returns {Number} The number of objects in the cache
     */
    this.size = sync(function() {
        return newTable.size() + oldTable.size();
    }, lock);

    /**
     * Returns true if the cache is empty
     * @returns {Boolean} True if the cache is empty, false otherwise
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
