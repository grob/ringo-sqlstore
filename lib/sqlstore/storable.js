/**
 * @fileoverview Base class for mapping JavaScript objects to relational
 * databases.
 */
var {Key} = require("./key");
var {Collection} = require("./collection");

/** @ignore */
var Storable = exports.Storable = function Storable() {};

/**
 * Indicates transient state (i.e. the storable has never been persisted)
 * @type Number
 * @value 1
 * @ignore
 */
Storable.STATE_TRANSIENT = 1;

/**
 * Indicates clean state (i.e. the storable hasn't been modified)
 * @type Number
 * @value 2
 * @ignore
 */
Storable.STATE_CLEAN = 2;

/**
 * Indicates dirty state (i.e. the storable has been modified, but these
 * modifications haven't been persisted yet)
 * @type Number
 * @value 3
 * @ignore
 */
Storable.STATE_DIRTY = 3;

/**
 * Indicates deleted state (i.e. the database row represented by this storable
 * has been deleted)
 * @type Number
 * @value 99
 * @ignore
 */
Storable.STATE_DELETED = 99;

/**
 * Factory method for creating storable constructor functions.
 * @param {Store} store The store managing instances of the defined storable entity
 * @param {String} type The name of the storable entity (i.e. the name of the
 * constructor function)
 * @param {Object} mapping The mapping definition specifying the properties
 * @returns {Function} A constructor function for the creation of storable instances.
 * @ignore
 */
Storable.defineEntity = function(store, type, mapping) {

    // This uses explicit getters/setters so it requires an explicit mapping
    if (!mapping || !mapping.properties) {
        throw new Error("storable requires explicit property mapping");
    }

    // user facing constructor, called with a single properties object
    /**
     * Creates a new Storable instance. This constructor must not be called
     * directly, instead define an entity by calling `Store.prototype.defineEntity()`
     * which returns a constructor function implementing this Storable interface.
     * This constructor function can then be used for creating instances of
     * the defined entity.
     * @class Instances of this class represent a database persistable object
     * modeled after a mapping definition. Storable constructors are defined
     * using `Store.prototype.defineEntity()`, which returns a constructor
     * function implementing this Storable interface.
     * @param {Object} props Optional object containing the initial property
     * values of the storable instance
     * @name Storable
     * @type Function
     * @constructor
     * @see store#Store.prototype.defineEntity
     */
    var ctor = function(props) {
        return Object.create(ctor.prototype, {
            _key: {value: new Key(type), writable: false},
            _cacheKey: {
                get: function() {
                    return this._key.cacheKey;
                }
            },
            _state: {value: Storable.STATE_TRANSIENT, writable: true},
            _props: {value: props || {}, writable: false},
            _entity: {value: undefined, writable: true}
        });
    };

    // factory function used by the store implementation, called with a
    // key and an optional entity argument
    ctor.createInstance = function(key, entity) {
        return Object.create(ctor.prototype, {
            /**
             * Contains the key of a storable instance
             * @type Key
             * @name Storable.prototype._key
             * @ignore
             */
            _key: {value: key, writable: false},
            /**
             * Contains the cache key of a storable instance
             * @type String
             * @name Storable.prototype._cacheKey
             * @ignore
             */
            _cacheKey: {
                get: function() {
                    return this._key.cacheKey;
                }
            },
            /**
             * Contains the state of a storable instance
             * @type Number
             * @name Storable.prototype._state
             * @ignore
             */
            _state: {value: Storable.STATE_CLEAN, writable: true},
            /**
             * An internal map containing the properties of this storable
             * @type Object
             * @name Storable.prototype._props
             * @ignore
             */
            _props: {value: {}, writable: true},
            /**
             * An internal map containing the column names as property names
             * and the values stored in the database row as values.
             * @type Object
             * @name Storable.prototype._entity
             * @ignore
             */
            _entity: {value: entity, writable: true}
        });
    };

    // make it inherit Storable
    ctor.prototype = new Storable();
    // correct constructor property
    ctor.prototype.constructor = ctor;

    // define mapping and toString properties
    Object.defineProperties(ctor, {
        /**
         * Contains the mapping that defines the properties of instances of
         * this constructor function
         * @type Mapping
         * @name Storable.prototype.mapping
         * @ignore
         */
        mapping: {value: mapping},
        /** @ignore */
        toString: {value: function() {return "function " + type + "() {}"}}
    });

    // define getters and setters for all properties defined by mapping,
    Object.keys(mapping.properties).forEach(function(key) {
        Object.defineProperty(ctor.prototype, key, {
            get: function() {
                if (this._props.hasOwnProperty(key)) {
                    // modified property or mapped collection/object
                    return this._props[key];
                }
                if (!this._entity) {
                    this._entity = store.getEntity(this);
                }
                var propMapping = mapping.getMapping(key);
                if (propMapping.isPrimitive()) {
                    if (!this._entity.hasOwnProperty(propMapping.column)) {
                        return null;
                    }
                    return this._entity[propMapping.column];
                }
                // collection/object mappings are null while state is transient
                if (this._state === Storable.STATE_TRANSIENT) {
                    return null;
                }
                if (propMapping.isObjectMapping()) {
                    var value = this._entity[propMapping.column];
                    return this._props[key] = (value != null && store.get(propMapping.entity, value)) || null;
                }
                return this._props[key] = Collection.createInstance(store, propMapping, this);
            },
            set: function(value) {
                this._props[key] = value;
                if (this._state === Storable.STATE_CLEAN) {
                    this._state = Storable.STATE_DIRTY;
                }
            },
            enumerable: true
        });
    });

    // define getters for standard properties
    Object.defineProperties(ctor.prototype, {
        /**
         * The ID of this storable (null for transient storables)
         * @type Number
         * @name Storable.prototype._id
         */
        _id: {
            get: function() {
                return this._key.id;
            }
        },
        /**
         * Saves this storable in the underlying database. Use this method for
         * both persisting a transient storable or for storing modifications
         * in an already persisted storable.
         * @returns undefined
         * @name Storable.prototype.save
         */
        save : {
            value: function(tx, visited) {
                if (this._state === Storable.STATE_DELETED) {
                    throw new Error("Unable to save entity " + this._key + ", it has been removed before");
                }
                if (this._state === Storable.STATE_TRANSIENT ||
                        this._state === Storable.STATE_DIRTY) {
                    visited = visited || new java.util.HashSet();
                    if (!visited.contains(this._key)) {
                        visited.add(this._key);
                        store.save(this, tx, visited);
                        this._state = Storable.STATE_CLEAN;
                    }
                }
            }
        },
        /**
         * Removes this storable from the underlying database.
         * @returns undefined
         * @name Storable.prototype.remove
         */
        remove: {
            value: function(tx) {
                if (this._state === Storable.STATE_CLEAN ||
                        this._state === Storable.STATE_DIRTY) {
                    store.remove(this, tx);
                    this._state = Storable.STATE_DELETED;
                }
            }
        },
        /** @ignore */
        toString: {
            value: function() {return "[Storable " + type + "]"},
            writable: true
        },
        /**
         * Returns a JSON representation of this storable. Note that this
         * method does not recurse, i.e. the resulting object does not contain
         * mapped objects or collections.
         * @returns Object
         * @name Storable.prototype.toJSON
         */
        toJSON: {
            value: function() {
                var obj = {
                    "_id": this._id
                };
                for each (let [key, propMapping] in Iterator(mapping.properties)) {
                    if (!propMapping.isPrimitive()) {
                        continue;
                    }
                    obj[key] = this[key];
                }
                return obj;
            }
        }
    });

    return ctor;
};

