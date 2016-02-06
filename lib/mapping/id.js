var log = require("ringo/logging").getLogger(module.id);

const MAPPING_BASE = require("./base");

/**
 * Returns a newly created IdMapping instance
 * @class Instances of this class represent an ID mapping
 * @param {Mapping} mapping The parent mapping
 * @param {Object} definition The ID mapping definition
 * @param {Object} dataType The data type of this ID mapping
 * @returns A newly created IdMapping instance
 * @constructor
 * @ignore
 */
var IdMapping = module.exports = function(mapping, dataType, definition) {

    var idCounter = 0;

    /** @ignore */
    Object.defineProperties(this, {
        /**
         * Contains the parent mapping
         * @type Mapping
         * @see Mapping
         * @ignore
         */
        "parent": {"value": mapping, "enumerable": true},
        /**
         * Contains the property name of this IdMapping (always "id")
         * @type String
         * @ignore
         */
        "name": {"value": "id", "enumerable": true},
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
         * Contains the column in which the ID is stored. Defaults to "id"
         * @type String
         * @ignore
         */
        "column": {"value": definition.column || "id", "enumerable": true},
        /**
         * Contains the name of the sequence this IdMapping uses
         * @type String
         * @ignore
         */
        "sequence": {"value": definition.sequence, "enumerable": true},
        /**
         * True if auto increment is enabled
         * @type String
         * @ignore
         */
        "autoIncrement": {"value": definition.autoIncrement === true, "enumerable": true}
    });

    return this;
};

/** @ignore */
IdMapping.prototype = Object.create(MAPPING_BASE);
/** @ignore */
IdMapping.prototype.constructor = IdMapping;

/**
 * The data type for ID columns ("long")
 * @type {String} The data type
 * @ignore
 */
IdMapping.DATA_TYPE = "long";

/** @ignore */
IdMapping.prototype.toString = function() {
    return "[ID mapping " + this.name + "]";
};
