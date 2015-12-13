const MAPPING_BASE = require("./base");

/**
 * Returns a newly created CollectionMapping instance
 * @class Instances of this class represent a collection mapping
 * @param {Mapping} mapping The parent mapping
 * @param {String} name The name of the property
 * @param {Object} definition The mapping definition
 * @returns A newly created PrimitiveMapping instance
 * @constructor
 * @ignore
 */
var CollectionMapping = module.exports = function(mapping, name, definition) {

    // argument checks
    if (typeof(definition.query) !== "string" || definition.query.length < 1) {
        throw new Error("No query specified for collection mapping '" +
                mapping.type + "." + name + "'");
    }

    Object.defineProperties(this, {
        /**
         * Contains the parent mapping
         * @type Mapping
         * @see Mapping
         * @ignore
         */
        "parent": {"value": mapping},
        /**
         * Contains the property name of this mapping
         * @type String
         * @ignore
         */
        "name": {"value": name},
        /**
         * Contains the mapping definition of this CollectionMapping instance
         * @type Object
         * @ignore
         */
        "definition": {"value": definition},
        /**
         * Contains the column type (null)
         * @type String
         * @ignore
         */
        "type": {"value": null},
        /**
         * Contains the data type (null for collection mappings)
         * @type null
         * @ignore
         */
        "dataType": {"value": null, "enumerable": true},
        /**
         * The collection query string
         * @type String
         * @ignore
         */
        "query": {"value": definition.query || null},
        /**
         * An optional object containing named parameters referenced in the query
         * @type Object
         * @ignore
         */
        "params": {"value": definition.params || null}
    });

    return this;
};

/** @ignore */
CollectionMapping.prototype = Object.create(MAPPING_BASE, {
    "isCollectionMapping": {"value": true, "enumerable": true}
});
/** @ignore */
CollectionMapping.prototype.constructor = CollectionMapping;

/** @ignore */
CollectionMapping.prototype.toString = function() {
    return "[Collection Mapping " + this.name + "]";
};
