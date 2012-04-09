var {Key} = require("./key");
var Storable = exports.Storable = function Storable() {};

Storable.STATE_TRANSIENT = 1;
Storable.STATE_CLEAN = 2;
Storable.STATE_DIRTY = 3;
Storable.STATE_DELETED = 99;

// utility methods
var loadProperties = function(store, storable) {
    if (!storable._entity) {
        storable._entity = store.getEntity(storable);
    }
    return storable._props = store.getProperties(storable);
};

Storable.defineEntity = function(store, type, mapping) {

    // This uses explicit getters/setters so it requires an explicit mapping
    if (!mapping || !mapping.properties) {
        throw new Error("storable requires explicit property mapping");
    }

    // user facing constructor, called with a single properties object
    var ctor = function(props) {
        return Object.create(ctor.prototype, {
            _key: {value: new Key(type), writable: false},
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
            _state: {value: Storable.STATE_CLEAN, writable: true},
            _props: {value: undefined, writable: true},
            _entity: {value: entity, writable: true}
        });
    };

    // make it inherit Storable
    ctor.prototype = new Storable();

    // define mapping and toString properties
    Object.defineProperties(ctor, {
        mapping: {value: mapping},
        toString: {value: function() {return "function " + type + "() {}"}}
    });

    // define getters and setters for all properties defined by mapping,
    Object.keys(mapping.properties).forEach(function(key) {
        Object.defineProperty(ctor.prototype, key, {
            get: function() {
                var props = this._props || loadProperties(store, this);
                return props[key];
            },
            set: function(value) {
                var props = this._props || loadProperties(store, this);
                props[key] = value;
                if (this._state === Storable.STATE_CLEAN) {
                    this._state = Storable.STATE_DIRTY;
                }
            },
            enumerable: true
        })
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
                    store.remove(this._key, tx);
                    this._state = Storable.STATE_DELETED;
                }
            }
        },
        toString: {
            value: function() {return "[Storable " + type + "]"},
            writable: true
        }
    });

    return ctor;
};

