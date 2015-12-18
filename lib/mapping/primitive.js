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
 * @ignore
 */
var PrimitiveMapping = module.exports = function(mapping, name, definition, dataType) {

    Object.defineProperties(this, {
        /**
         * Contains the parent mapping
         * @type Mapping
         * @see Mapping
         * @ignore
         */
        "parent": {"value": mapping, "enumerable": true},
        /**
         * Contains the property name of this mapping
         * @type String
         * @ignore
         */
        "name": {"value": name, "enumerable": true},
        /**
         * Contains the mapping definition of this PrimitiveMapping instance
         * @type Object
         * @ignore
         */
        "definition": {"value": definition, "enumerable": true},
        /**
         * Contains the column type
         * @type String
         * @ignore
         */
        "type": {"value": definition.type, "enumerable": true},
        /**
         * Contains the data type getter and setter methods
         * @type Object
         * @ignore
         */
        "dataType": {"value": dataType, "enumerable": true},
        /**
         * Contains the column in which the value of this property mapping is stored
         * @type String
         * @ignore
         */
        "column": {"value": definition.column || name, "enumerable": true},
        /**
         * Contains true if null values are allowed
         * @type Boolean
         * @ignore
         */
        "nullable": {"value": definition.nullable !== false, "enumerable": true},
        /**
         * Contains true if unique constraint is enabled
         * @type Boolean
         * @ignore
         */
        "unique": {"value": definition.unique === true, "enumerable": true},
        /**
         * Contains the maximum length of this property
         * @type Number
         * @ignore
         */
        "length": {"value": definition.length, "enumerable": true},
        /**
         * Contains the precision of this property
         * @type Number
         * @ignore
         */
        "precision": {"value": definition.precision, "enumerable": true},
        /**
         * Contains the scale of this property
         * @type Number
         * @ignore
         */
        "scale": {"value": definition.scale, "enumerable": true}
    });

    return this;
};

/** @ignore */
PrimitiveMapping.prototype = Object.create(MAPPING_BASE, {
    "isPrimitive": {"value": true, "enumerable": true}
});
/** @ignore */
PrimitiveMapping.prototype.constructor = PrimitiveMapping;

/** @ignore */
PrimitiveMapping.prototype.toString = function() {
    return "[Primitive Mapping " + this.name + "]";
};
