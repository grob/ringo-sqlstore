/**
 * @module mapping/primitive
 */

const MAPPING_BASE = require("./base");

/**
 * Returns a newly created PrimitiveMapping instance
 * @class Instances of this class represent a primitive value mapping
 * @param {Mapping} mapping The parent mapping
 * @param {String} name The name of the property
 * @param {Object} definition The mapping definition
 * @param {Object} dataType The data type of this mapping
 * @returns A newly created PrimitiveMapping instance
 * @constructor
 */
var PrimitiveMapping = module.exports = function(mapping, name, definition, dataType) {

    Object.defineProperties(this, {
        /**
         * Contains the parent mapping
         * @name PrimitiveMapping#parent
         * @property {Mapping}
         * @readonly
         */
        "parent": {"value": mapping, "enumerable": true},
        /**
         * Contains the property name of this mapping
         * @name PrimitiveMapping#name
         * @property {String}
         * @readonly
         */
        "name": {"value": name, "enumerable": true},
        /**
         * Contains the mapping definition of this PrimitiveMapping instance
         * @name PrimitiveMapping#definition
         * @property {Object}
         * @readonly
         */
        "definition": {"value": definition, "enumerable": true},
        /**
         * Contains the column type
         * @name PrimitiveMapping#type
         * @property {String}
         * @readonly
         */
        "type": {"value": definition.type, "enumerable": true},
        /**
         * Contains the data type getter and setter methods
         * @name PrimitiveMapping#dataType
         * @property {DataType}
         * @readonly
         */
        "dataType": {"value": dataType, "enumerable": true},
        /**
         * Contains the column in which the value of this property mapping is stored
         * @name PrimitiveMapping#column
         * @property {String}
         * @readonly
         */
        "column": {"value": definition.column || name, "enumerable": true},
        /**
         * Contains true if null values are allowed
         * @name PrimitiveMapping#nullable
         * @property {boolean}
         * @readonly
         */
        "nullable": {"value": definition.nullable !== false, "enumerable": true},
        /**
         * Contains true if unique constraint is enabled
         * @name PrimitiveMapping#unique
         * @property {boolean}
         * @readonly
         */
        "unique": {"value": definition.unique === true, "enumerable": true},
        /**
         * Contains the maximum length of this property
         * @name PrimitiveMapping#length
         * @property {Number}
         * @readonly
         */
        "length": {"value": definition.length, "enumerable": true},
        /**
         * Contains the precision of this property
         * @name PrimitiveMapping#precision
         * @property {Number}
         * @readonly
         */
        "precision": {"value": definition.precision, "enumerable": true},
        /**
         * Contains the scale of this property
         * @name PrimitiveMapping#scale
         * @property {Number}
         * @readonly
         */
        "scale": {"value": definition.scale, "enumerable": true}
    });

    return this;
};

/**
 * @name PrimitiveMapping.prototype
 * @ignore
 */
PrimitiveMapping.prototype = Object.create(MAPPING_BASE, {
    /**
     * @name PrimitiveMapping#isPrimitive
     * @property {boolean}
     * @readonly
     */
    "isPrimitive": {"value": true, "enumerable": true}
});
/**
 * @name PrimitiveMapping.prototype.constructor
 * @ignore
 */
PrimitiveMapping.prototype.constructor = PrimitiveMapping;

/**
 * @name PrimitiveMapping#toString
 * @ignore
 */
PrimitiveMapping.prototype.toString = function() {
    return "[Primitive Mapping " + this.name + "]";
};
