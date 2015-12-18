/**
 * The base prototype for property mappings
 * @type Object
 * @ignore
 */
module.exports = {
    /**
     * True if this mapping is an instance of PrimitiveMapping
     * @type {Boolean}
     * @name Mapping.prototype.isPrimitive
     */
    "isPrimitive": false,
    /**
     * True if this mapping is an instance of CollectionMapping
     * @type {Boolean}
     * @name Mapping.prototype.isCollectionMapping
     */
    "isCollectionMapping": false,
    /**
     * True if this mapping is an instance of ObjectMapping
     * @type {Boolean}
     * @name Mapping.prototype.isObjectMapping
     */
    "isObjectMapping": false
};
