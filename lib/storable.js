/**
 * @fileoverview Base class for mapping JavaScript objects to relational
 * databases.
 */

/**
 * Indicates that a storable is lazy-loaded (i.e. the entity containing
 * the database-persisted data hasn't been loaded)
 * @type {Number}
 */
var Key = require("./key");
var Collection = require("./collection");
var constants = require("./constants");

/**
 * @constructor
 * @property {function} onRemove Optional callback executed after the storable
 * has been removed from the underlying database
 * @ignore
 */
var Storable = module.exports = function Storable() {};

/**
 * Factory method for creating storable constructor functions.
 * @param {Store} store The store managing instances of the defined storable entity
 * @param {String} type The name of the storable entity (i.e. the name of the
 * constructor function)
 * @param {Object} mapping The mapping definition specifying the properties
 * @returns {Storable} A constructor function for the creation of storable instances.
 * @name Storable.defineEntity
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
            _state: {value: constants.STATE_TRANSIENT, writable: true},
            _props: {value: props || {}, writable: false},
            _entity: {value: {}, writable: true}
        });
    };

    /**
     * Factory function used by the store to instantiate Storables using data
     * received from database queries
     * @param {Key} key The key of the Storable instance
     * @param {Object} entity The entity
     * @returns {Storable} A newly instantiated Storable
     * @name Storable.createInstance
     */
    ctor.createInstance = function(key, entity) {
        return Object.create(ctor.prototype, {
            /**
             * Contains the key of a storable instance
             * @type Key
             * @name Storable#_key
             * @ignore
             */
            _key: {value: key},
            /**
             * Contains the state of a storable instance
             * @type Number
             * @name Storable#_state
             * @ignore
             */
            _state: {value: constants.STATE_CLEAN, writable: true},
            /**
             * An internal map containing the properties of this storable
             * @type Object
             * @name Storable#_props
             * @ignore
             */
            _props: {value: {}},
            /**
             * An internal map containing the column names as property names
             * and the values stored in the database row as values.
             * @type Object
             * @name Storable#_entity
             * @ignore
             */
            _entity: {value: entity, writable: true}
        });
    };

    // make it inherit Storable
    ctor.prototype = Object.create(Storable.prototype);
    // correct constructor property
    ctor.prototype.constructor = ctor;

    // define mapping and toString properties
    Object.defineProperties(ctor, {
        /**
         * Contains the mapping that defines the properties of instances of
         * this constructor function
         * @name Storable#mapping
         * @type {Mapping}
         */
        "mapping": {value: mapping},
        /**
         * Returns the storable instance with the given id
         * @param {Number} id The ID of the storable to return
         * @param {Boolean} aggressive If true the entity is retrieved as a whole
         * @returns {Storable} The storable with the given ID
         * @name Storable#get
         * @function
         */
        "get": {
            "value": function(id, aggressive) {
                return store.get(type, id, aggressive);
            }
        },
        /**
         * Returns all persisted storable instances
         * @param {Boolean} aggressive If true load instances aggressively
         * @returns {Array} An array containing all persisted storables
         * @name Storable#all
         * @function
         */
        "all": {
            "value": function(aggressive) {
                return store.all(type, aggressive === true);
            },
            "writable": true
        },
        /** @ignore */
        "toString": {value: function() {return "function " + type + "() {}"}}
    });

    // define getters and setters for all properties defined by mapping,
    Object.keys(mapping.properties).forEach(function(key) {
        var propMapping = ctor.mapping.getMapping(key);
        Object.defineProperty(ctor.prototype, key, {
            get: function() {
                if (this._props.hasOwnProperty(key)) {
                    // modified property or mapped collection/object
                    return this._props[key];
                }
                if (this._entity === constants.LOAD_LAZY) {
                    this._entity = store.getEntity(this);
                }
                if (propMapping.isPrimitive) {
                    if (!this._entity.hasOwnProperty(propMapping.column)) {
                        return null;
                    }
                    return this._entity[propMapping.column];
                }
                // collection/object mappings are null while state is transient
                if (this._state === constants.STATE_TRANSIENT) {
                    return null;
                }
                if (propMapping.isObjectMapping) {
                    var value = this._entity[propMapping.column];
                    return this._props[key] = (value != null &&
                            store.get(propMapping.entity, value,
                                    propMapping.aggressive === true)) || null;
                }
                return this._props[key] = Collection.createInstance(store, propMapping, this);
            },
            set: function(value) {
                this._props[key] = value;
                if (this._state === constants.STATE_CLEAN) {
                    this._state = constants.STATE_DIRTY;
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
         * @name Storable#id
         */
        id: {
            "get": function() {
                return this._key.id;
            },
            "enumerable": true
        },
        /**
         * The cache key of this storable
         * @type String
         * @name Storable#_cacheKey
         * @ignore
         */
        _cacheKey: {
            get: function() {
                return this._key.cacheKey;
            }
        },
        /**
         * Saves this storable in the underlying database. Use this method for
         * both persisting a transient storable or for storing modifications
         * in an already persisted storable.
         * @name Storable#save
         * @return
         */
        save: {
            value: function(tx) {
                store.save(this, tx);
            },
            "enumerable": true
        },
        /**
         * Removes this storable from the underlying database.
         * @param {Transaction}
         * @name Storable#remove
         * @return
         */
        remove: {
            value: function(tx) {
                if (this._state === constants.STATE_CLEAN ||
                        this._state === constants.STATE_DIRTY) {
                    store.remove(this, tx);
                    this._state = constants.STATE_DELETED;
                }
            },
            enumerable: true
        },
        /** @ignore */
        toString: {
            value: function() {
                return "[" + (this._key || Storable.name) + "]"
            },
            writable: true
        },
        /**
         * Returns a JSON representation of this storable. Note that this
         * method does not recurse, i.e. the resulting object does not contain
         * mapped objects or collections.
         * @returns Object
         * @name Storable#toJSON
         */
        toJSON: {
            value: function() {
                var obj = {
                    "id": this.id
                };
                for each (let [key, propMapping] in Iterator(ctor.mapping.properties)) {
                    if (!propMapping.isPrimitive) {
                        continue;
                    }
                    obj[key] = this[key];
                }
                return obj;
            },
            "enumerable": true
        }
    });

    return ctor;
};

