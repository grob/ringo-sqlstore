/**
 * @module mapping/object
 */

const MAPPING_BASE = require("./base");

/**
 * Returns a newly created ObjectMapping instance
 * @class Instances of this class represent a storable mapping
 * @param {Mapping} mapping The parent mapping
 * @param {String} name The name of the property
 * @param {Object} definition The mapping definition
 * @param {DataType} dataType The data type of this ID mapping
 * @returns A newly created PrimitiveMapping instance
 * @constructor
 */
var ObjectMapping = module.exports = function(mapping, name, definition, dataType) {

    // argument checks
    if (typeof(definition.entity) !== "string" || definition.entity.length < 1) {
        throw new Error("No entity specified for object mapping '" +
                mapping.type + "." + name + "'");
    }

    Object.defineProperties(this, {
        /**
         * Contains the parent mapping
         * @name ObjectMapping#parent
         * @property {Mapping}
         * @readonly
         */
        "parent": {"value": mapping, "enumerable": true},
        /**
         * Contains the property name of this mapping
         * @name ObjectMapping#name
         * @property {String}
         * @readonly
         */
        "name": {"value": name, "enumerable": true},
        /**
         * Contains the mapping definition of this ObjectMapping instance
         * @name ObjectMapping#definition
         * @property {Object}
         * @readonly
         */
        "definition": {"value": definition, "enumerable": true},
        /**
         * Contains the column type ("long")
         * @name ObjectMapping#type
         * @property {String}
         * @readonly
         */
        "type": {"value": "long", "enumerable": true},
        /**
         * Contains the data type getter and setter methods
         * @name ObjectMapping#dataType
         * @property {DataType}
         * @readonly
         */
        "dataType": {"value": dataType, "enumerable": true},
        /**
         * Contains the column in which the value of this property mapping is stored
         * @name ObjectMapping#column
         * @property {String}
         * @readonly
         */
        "column": {"value": definition.column || name, "enumerable": true},
        /**
         * Contains true if null values are allowed
         * @name ObjectMapping#nullable
         * @property {boolean}
         * @readonly
         */
        "nullable": {"value": definition.nullable !== false, "enumerable": true},
        /**
         * Contains the type name of the mapped entity
         * @name ObjectMapping#entity
         * @property {String}
         * @readonly
         */
        "entity": {"value": definition.entity, "enumerable": true},
        /**
         * Contains the name of the mapped entity's property used as the
         * foreign key (defaults to "id")
         * @name ObjectMapping#foreignProperty
         * @property {String}
         * @readonly
         */
        "foreignProperty": {"value": definition.foreignProperty || "id", "enumerable": true},
        /**
         * If true the mapped object will be fetched aggressively (`select * ...`).
         * Defaults to false
         * @name ObjectMapping#aggressive
         * @property {boolean}
         * @readonly
         */
        "aggressive": {"value": definition.aggressive || false, "enumerable": true}
    });

    return this;
};

/**
 * @name ObjectMapping.prototype
 * @ignore
 */
ObjectMapping.prototype = Object.create(MAPPING_BASE, {
    /**
     * @name ObjectMapping#isObjectMapping
     * @property {boolean}
     * @readonly
     */
    "isObjectMapping": {"value": true, "enumerable": true}
});
/**
 * @name ObjectMapping.prototype.constructor
 * @ignore
 */
ObjectMapping.prototype.constructor = ObjectMapping;

/**
 * @name ObjectMapping#toString
 * @ignore
 */
ObjectMapping.prototype.toString = function() {
    return "[Object Mapping " + this.name + "]";
};
