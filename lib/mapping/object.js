const MAPPING_BASE = require("./base");

/**
 * Returns a newly created ObjectMapping instance
 * @class Instances of this class represent a storable mapping
 * @param {Mapping} mapping The parent mapping
 * @param {String} name The name of the property
 * @param {Object} definition The mapping definition
 * @param {Object} dataType The data type of this ID mapping
 * @returns A newly created PrimitiveMapping instance
 * @constructor
 * @ignore
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
         * Contains the mapping definition of this ObjectMapping instance
         * @type Object
         * @ignore
         */
        "definition": {"value": definition, "enumerable": true},
        /**
         * Contains the column type ("long")
         * @type String
         * @ignore
         */
        "type": {"value": "long", "enumerable": true},
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
         * Contains the type name of the mapped entity
         * @type String
         * @ignore
         */
        "entity": {"value": definition.entity, "enumerable": true},
        /**
         * Contains the name of the mapped entity's property used as the foreign key
         * @type String
         * @ignore
         */
        "foreignProperty": {"value": definition.foreignProperty || "id", "enumerable": true},
        /**
         * If true the mapped object will be fetched aggressively (`select * ...`).
         * Defaults to false
         * @type Boolean
         * @ignore
         */
        "aggressive": {"value": definition.aggressive || false, "enumerable": true}
    });

    return this;
};

/** @ignore */
ObjectMapping.prototype = Object.create(MAPPING_BASE, {
    "isObjectMapping": {"value": true, "enumerable": true}
});
/** @ignore */
ObjectMapping.prototype.constructor = ObjectMapping;

/** @ignore */
ObjectMapping.prototype.toString = function() {
    return "[Object Mapping " + this.name + "]";
};
