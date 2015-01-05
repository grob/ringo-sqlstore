var log = require("ringo/logging").getLogger(module.id);

/**
 * @fileoverview Entity registry instances are capable to both register
 * defined entities and modules exporting entity constructors.
 */
var {Storable} = require("./storable");

/**
 * Creates a new EntityRegistry instance
 * @class EntityRegistry instances keep track of both defined entity constructors
 * (as returned by `Store.prototype.defineEntity()`) and modules exporting
 * entity constructors. The latter is necessary for stores to dynamically
 * load entity constructors (eg. for querying).
 * @constructor
 */
exports.EntityRegistry = function() {
    var constructors = {};
    var modules = [];
    var reloadModules = false;

    /**
     * Registers the constructor function for the given entity type. Calling
     * this method results in reloading all registered entity modules.
     * @param {String} type The type of entity
     * @param {Function} ctor The constructor function
     * @returns {Function} The constructor function passed as argument
     */
    this.registerConstructor = function(type, ctor) {
        log.debug("Registering constructor", type);
        if (typeof(type) !== "string") {
            throw new Error("Missing type argument");
        }
        if (!ctor || !(ctor.prototype instanceof Storable)) {
            throw new Error("Constructor argument must be an instance of Storable");
        }
        constructors[type] = ctor;
        reloadModules = modules.length > 0;
        return ctor;
    };

    /**
     * Registers the module path for loading. The module is expected to either
     * export a single entity constructor function (using `module.exports`) or
     * export one or more entity constructors (using `exports.<Name>`).
     * @param {String|Array} path The module path, or an array of module paths
     */
    this.registerModule = function(path) {
        log.debug("Registering module", path);
        if (Array.isArray(path)) {
            Array.prototype.push.apply(modules, path);
        } else if (typeof(path) === "string") {
            modules.push(path);
        } else {
            throw new Error("Invalid path argument " + path);
        }
        reloadModules = true;
    };

    /**
     * Returns true if a constructor for the given type exists in this registry
     * @param {String} type The entity type
     * @returns {boolean} True if the constructor exists in this registry
     */
    this.hasConstructor = function(type) {
        if (reloadModules === true) {
            this.loadModules();
        }
        return typeof(constructors[type]) === "function";
    };

    /**
     * Returns the constructor function for the given entity type. This method
     * will reload all registered modules if necessary.
     * @param {String} type The entity type
     * @returns {Function} The entity constructor for the given type
     */
    this.getConstructor = function(type) {
        if (reloadModules === true) {
            this.loadModules();
        }
        var ctor = constructors[type];
        if (typeof(ctor) !== "function") {
            throw new Error("Entity " + type + " is not defined");
        }
        return ctor;
    };

    /**
     * Returns an array of entity constructors registered. This method will
     * reload all registered modules if necessary.
     * @returns {Array} An array containing constructor functions
     */
    this.getConstructors = function() {
        if (reloadModules === true) {
            this.loadModules();
        }
        return [ctor for each (ctor in constructors)];
    };

    /**
     * Loads all modules and registers the entity constructor function(s)
     * exported by them.
     */
    this.loadModules = function() {
        log.debug("Loading", modules.length, "storable modules");
        reloadModules = false;
        for each (let path in modules) {
            let exports = require(path);
            if (typeof(exports) === "function") {
                // register exports if it's an instance of Storable
                if (exports.prototype instanceof Storable) {
                    constructors[exports.mapping.type] = exports;
                    continue;
                }
                throw new Error("Module " + path + " doesn't export a Storable");
            }
            // iterate over exports object and register all Storable constructors
            for each (let value in exports) {
                if (typeof(value) === "function" && value.prototype instanceof Storable) {
                    constructors[value.mapping.type] = value;
                }
            }
        }
    };

    return this;
};

