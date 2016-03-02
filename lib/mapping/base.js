/**
 * @module mapping/base
 */

/**
 * The base prototype for property mappings
 */
module.exports = {
    /**
     * True if this mapping is an instance of PrimitiveMapping
     * @name Mapping#isPrimitive
     * @property {boolean}
     */
    "isPrimitive": false,
    /**
     * True if this mapping is an instance of CollectionMapping
     * @name Mapping#isCollectionMapping
     * @property {boolean}
     */
    "isCollectionMapping": false,
    /**
     * True if this mapping is an instance of ObjectMapping
     * @name Mapping#isObjectMapping
     * @property {boolean}
     */
    "isObjectMapping": false
};
