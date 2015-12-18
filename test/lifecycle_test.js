var runner = require("./runner");
var assert = require("assert");
var system = require("system");

var {Store, Cache} = require("../lib/sqlstore/main");
var utils = require("./utils");
var {Key} = require("../lib/sqlstore/key");
var constants = require("../lib/sqlstore/constants");

var store = null;
var Author = null;

const MAPPING_AUTHOR = {
    // "schema": "TEST",
    "table": "author",
    "id": {
        "column": "author_id",
        "sequence": "author_id"
    },
    "properties": {
        "name": {
            "type": "string",
            "column": "author_name",
            "nullable": false
        }
    }
};

exports.setUp = function() {
    store = new Store(Store.initConnectionPool(runner.getDbProps()));
    store.setEntityCache(new Cache());
    assert.isNotNull(store);
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    store.syncTables();
    assert.isTrue(Author instanceof Function);
    // static constructor functions
    assert.strictEqual(typeof(Author.get), "function");
    assert.strictEqual(typeof(Author.all), "function");
    assert.strictEqual(Author, store.entityRegistry.getConstructor("Author"));
};

exports.tearDown = function() {
    utils.drop(store, Author);
    store.close();
};

exports.testInternalProps = function() {
    var author = new Author();
    assert.strictEqual(author._props.constructor, Object);
    assert.isFalse(author._props.hasOwnProperty("name"));
    assert.strictEqual(author._entity.constructor, Object);
    assert.strictEqual(Object.keys(author._entity).length, 0);
    assert.strictEqual(author._key.constructor, Key);
    assert.isNull(author._key.id);
    // name has never been assigned, accessing it returns null (not undefined)
    assert.isNull(author.name);
    author.name = "John Doe";
    assert.isTrue(author._props.hasOwnProperty("name"));
    assert.isNotUndefined(author._props.name);
    author.save();
    assert.isNotUndefined(author._entity);
    assert.isNotNull(author._key.id);
    // save() does not affect the internal _props object
    assert.isTrue(author._props.hasOwnProperty("name"));
    assert.isNotUndefined(author.name);
    // setting the name property stores the new value in the _props object
    author.name = "Jane Foo";
    assert.isTrue(author._props.hasOwnProperty("name"));
    var mapping = author.constructor.mapping;
    assert.strictEqual(author._entity[mapping.getMapping("name").column], "John Doe");
    assert.strictEqual(author._props.name, "Jane Foo");
};

exports.testLifecycle = function() {
    var author = new Author({
        "name": "John Doe"
    });
    assert.strictEqual(author._state, constants.STATE_TRANSIENT);
    author.save();
    assert.strictEqual(Author.all().length, 1);
    assert.strictEqual(author._state, constants.STATE_CLEAN);
    author = Author.get(1);
    assert.strictEqual(author._state, constants.STATE_CLEAN);
    // modify
    author.name = "Jane Foo";
    assert.strictEqual(author._state, constants.STATE_DIRTY);
    author.save();
    assert.strictEqual(author._state, constants.STATE_CLEAN);
    // remove
    author = Author.get(1);
    assert.strictEqual(author._state, constants.STATE_CLEAN);
    author.remove();
    assert.strictEqual(author._state, constants.STATE_DELETED);
    assert.strictEqual(Author.all().length, 0);
};

exports.testAlreadyRemoved = function() {
    var author = new Author({
        "name": "John Doe"
    });
    author.save();
    assert.strictEqual(Author.all().length, 1);
    author.remove();
    // modify removed entity
    author.name = "Jane Foo";
    // state is still STATE_DELETED
    assert.strictEqual(author._state, constants.STATE_DELETED);
    // saving throws an error
    assert.throws(function() {
        author.save();
    }, Error);
    assert.strictEqual(Author.all().length, 0);
};

exports.testMultipleRemoval = function() {
    var author = new Author({
        "name": "John Doe"
    });
    author.save();
    assert.strictEqual(Author.all().length, 1);
    author = Author.get(1);
    author.remove();
    assert.strictEqual(author._state, constants.STATE_DELETED);
    assert.strictEqual(Author.all().length, 0);
    author.remove();
    assert.strictEqual(author._state, constants.STATE_DELETED);
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
