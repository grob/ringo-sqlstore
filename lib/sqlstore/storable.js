var {Key} = require("./key");
var {Collection} = require("./collection");
var Storable = exports.Storable = function Storable() {};

Storable.STATE_TRANSIENT = 1;
Storable.STATE_CLEAN = 2;
Storable.STATE_DIRTY = 3;
Storable.STATE_DELETED = 99;

Storable.defineEntity = function(store, type, mapping) {

    // This uses explicit getters/setters so it requires an explicit mapping
    if (!mapping || !mapping.properties) {
        throw new Error("storable requires explicit property mapping");
    }

    // user facing constructor, called with a single properties object
    var ctor = function(props) {
        return Object.create(ctor.prototype, {
            _key: {value: new Key(type), writable: false},
            _cacheKey: {
                get: function() {
                    return this._key.cacheKey;
                }
            },
            _state: {value: Storable.STATE_TRANSIENT, writable: true},
            _props: {value: props || {}, writable: true},
            _entity: {value: undefined, writable: true}
        });
    };

    // factory function used by the store implementation, called with a
    // key and an optional entity argument
    ctor.createInstance = function(key, entity) {
        return Object.create(ctor.prototype, {
            _key: {value: key, writable: false},
            _cacheKey: {
                get: function() {
                    return this._key.cacheKey;
                }
            },
            _state: {value: Storable.STATE_CLEAN, writable: true},
            _props: {value: {}, writable: true},
            _entity: {value: entity, writable: true}
        });
    };

    // make it inherit Storable
    ctor.prototype = new Storable();
    // correct constructor property
    ctor.prototype.constructor = ctor;

    // define mapping and toString properties
    Object.defineProperties(ctor, {
        mapping: {value: mapping},
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
                    return this._entity[propMapping.column];
                }
                // collection/object mappings are undefined as long as the
                // storable is transient - _props will be reset when the
                // storable is persisted, so it's safe to assign undefined
                if (this._state === Storable.STATE_TRANSIENT) {
                    return this._props[key] = undefined;
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
        _id: {
            get: function() {
                return this._key.id;
            }
        },
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
        remove: {
            value: function(tx) {
                if (this._state === Storable.STATE_CLEAN ||
                        this._state === Storable.STATE_DIRTY) {
                    store.remove(this, tx);
                    this._state = Storable.STATE_DELETED;
                }
            }
        },
        toString: {
            value: function() {return "[Storable " + type + "]"},
            writable: true
        },
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

