/**
 * @module mapping/id
 */
const MAPPING_BASE = require("./base");

/**
 * @class Instances of this class represent an ID mapping
 * @param {Mapping} mapping The parent mapping
 * @param {Object} dataType The data type of this ID mapping
 * @param {Object} definition The ID mapping definition
 * @constructor
 */
var IdMapping = module.exports = function(mapping, dataType, definition) {

    var idCounter = 0;

    /** @ignore */
    Object.defineProperties(this, {
        /**
         * Contains the parent mapping
         * @name IdMapping#parent
         * @property {Mapping}
         * @readonly
         */
        "parent": {"value": mapping, "enumerable": true},
        /**
         * Contains the property name of this IdMapping (always "id")
         * @name IdMapping#name
         * @property {String}
         * @readonly
         */
        "name": {"value": "id", "enumerable": true},
        /**
         * Contains the column type ("long")
         * @name IdMapping#type
         * @property {String}
         * @readonly
         */
        "type": {"value": "long", "enumerable": true},
        /**
         * Contains the data type getter and setter methods
         * @name IdMapping#dataType
         * @property {DataType}
         * @readonly
         */
        "dataType": {"value": dataType, "enumerable": true},
        /**
         * Contains the column in which the ID is stored. Defaults to "id"
         * @name IdMapping#column
         * @property {String}
         * @readonly
         */
        "column": {"value": definition.column || "id", "enumerable": true},
        /**
         * Contains the name of the sequence this IdMapping uses
         * @name IdMapping#sequence
         * @property {String}
         * @readonly
         */
        "sequence": {"value": definition.sequence || null, "enumerable": true},
        /**
         * True if auto increment is enabled
         * @name IdMapping#autoIncrement
         * @property {boolean}
         * @readonly
         */
        "autoIncrement": {"value": definition.autoIncrement === true, "enumerable": true}
    });

    return this;
};

/**
 * @name IdMapping.prototype
 * @ignore
 */
IdMapping.prototype = Object.create(MAPPING_BASE);
/**
 * @name IdMapping.prototype.constructor
 * @ignore
 */
IdMapping.prototype.constructor = IdMapping;

/**
 * @name IdMapping#toString
 * @ignore
 */
IdMapping.prototype.toString = function() {
    return "[ID mapping " + this.name + "]";
};
