export("Collection");

/**
 * Creates a new Collection instance
 * @class Instances of this class represent a collection object, mimicking
 * a JS array. Note that it's currently not possible to directly access objects
 * using index positions (eg. collection[0]), use get(index) instead. Iterating
 * using for, for each or forEach is supported
 * @param {String} name The property name of the collection
 * @param {Query} query The query used to populate the collection
 * @returns A newly created Collection instance
 * @constructor
 */
var Collection = function(name, query) {
    var isInitialized = false;
    var objects = [];

    /**
     * Initializes the collection
     */
    var initialize = function() {
        if (!isInitialized) {
            objects = query.select();
        }
        isInitialized = true;
        return;
    };

    /**
     * Contains the property name of the collection
     * @type String
     */
    Object.defineProperty(this, "name", {"value": name});

    /**
     * Contains the length of the collection
     * @type Number
     */
    Object.defineProperty(this, "length", {
        "get": function() {
            initialize();
            return objects.length;
        }
    });

    /**
     * Returns a collection iterator instance
     * @returns A collection iterator
     * @type CollectionIterator
     */
    this.__iterator__ = function() {
        initialize();
        return new CollectionIterator(this);
    };

    /**
     * Returns the object at the given index position
     * @param {Number} idx The index position
     * @returns The object at the given index position
     */
    this.get = function(idx) {
        initialize();
        if (idx >= 0 && idx < objects.length) {
            return objects[idx];
        }
        return null;
    };

    /**
     * Iterates over this collection
     * @param {Function} func The callback function to execute for each
     * object in this collection
     */
    this.forEach = function(func) {
        return Array.prototype.forEach.apply(objects, arguments);
    };

    return this;
};

Collection.prototype = new Array();

/** @ignore */
Collection.prototype.toString = function() {
    return "[Collection " + this.name + "]";
};


/**
 * Creates a new collection iterator
 * @class A collection iterator
 * @param {Collection} collection The collection to operate on
 * @returns A newly created collection iterator
 * @constructor
 */
var CollectionIterator = function(collection) {
    var idx = 0;

    /**
     * Returns the next element in the collection, or throws a StopIteration
     * if the end of the collection is reached
     * @returns The next element in the collection
     */
    this.next = function() {
        if (idx < collection.length) {
            return collection.get(idx++);
        }
        throw StopIteration;
    };

    return this;
};
