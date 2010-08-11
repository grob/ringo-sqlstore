export("Collection");

var Collection = function(name, query) {
    var isInitialized = false;
    var objects = [];

    Object.defineProperty(this, "name", {"value": name});

    Object.defineProperty(this, "length", {
        "get": function() {
            initialize();
            return objects.length;
        }
    });


    var initialize = function() {
        if (!isInitialized) {
            objects = query.select();
        }
        isInitialized = true;
        return;
    };

    this.get = function(idx) {
        initialize();
        if (idx >= 0 && idx < objects.length) {
            return objects[idx];
        }
        return null;
    };

    this.__iterator__ = function() {
        initialize();
        return new CollectionIterator(this);
    };

    this.forEach = function() {
        return Array.prototype.forEach.apply(objects, arguments);
    };

    return this;
};

Collection.prototype = new Array();

/** @ignore */
Collection.prototype.toString = function() {
    return "[Collection " + this.name + "]";
};



var CollectionIterator = function(collection) {
    var idx = 0;

    this.next = function() {
        if (idx < collection.length) {
            return collection.get(idx++);
        }
        throw StopIteration;
    };

    return this;
};
