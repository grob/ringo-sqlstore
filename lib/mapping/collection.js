/**
 * @module mapping/collection
 */

const MAPPING_BASE = require("./base");

/**
 * Returns a newly created CollectionMapping instance
 * @class Instances of this class represent a collection mapping
 * @param {Mapping} mapping The parent mapping
 * @param {String} name The name of the property
 * @param {Object} definition The mapping definition
 * @returns A newly created PrimitiveMapping instance
 * @constructor
 */
const CollectionMapping = module.exports = function(mapping, name, definition) {

    // argument checks
    if (typeof(definition.query) !== "string" || definition.query.length < 1) {
        throw new Error("No query specified for collection mapping '" +
                mapping.type + "." + name + "'");
    }

    Object.defineProperties(this, {
        /**
         * Contains the parent mapping
         * @name CollectionMapping#parent
         * @property {Mapping}
         * @readonly
         */
        "parent": {"value": mapping},
        /**
         * Contains the property name of this mapping
         * @name CollectionMapping#name
         * @property {String}
         * @readonly
         */
        "name": {"value": name},
        /**
         * Contains the mapping definition of this CollectionMapping instance
         * @name CollectionMapping#definition
         * @property {Object}
         * @readonly
         */
        "definition": {"value": definition},
        /**
         * Contains the column type (null)
         * @name CollectionMapping#type
         * @property {null}
         * @readonly
         */
        "type": {"value": null},
        /**
         * Contains the data type (null for collection mappings)
         * @name CollectionMapping#dataType
         * @property {null}
         * @readonly
         */
        "dataType": {"value": null, "enumerable": true},
        /**
         * The collection query string
         * @name CollectionMapping#query
         * @property {String}
         * @readonly
         */
        "query": {"value": definition.query || null},
        /**
         * An optional object containing named parameters referenced in the query
         * @name CollectionMapping#params
         * @property {Object}
         * @readonly
         */
        "params": {"value": definition.params || null}
    });

    return this;
};

/**
 * @name CollectionMapping.prototype
 * @ignore
 */
CollectionMapping.prototype = Object.create(MAPPING_BASE, {
    /**
     * @name CollectionMapping#isCollectionMapping
     * @property {boolean}
     * @readonly
     */
    "isCollectionMapping": {"value": true, "enumerable": true}
});
/**
 * @name CollectionMapping.prototype.constructor
 * @ignore
 */
CollectionMapping.prototype.constructor = CollectionMapping;

/**
 * @name CollectionMapping#toString
 * @ignore
 */
CollectionMapping.prototype.toString = function() {
    return "[Collection Mapping " + this.name + "]";
};
