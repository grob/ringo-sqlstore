var runner = require("./runner");
var assert = require("assert");
var system = require("system");

var {Store} = require("../lib/main");
var Key = require("../lib/key");
var utils = require("./utils");
var strings = require("ringo/utils/strings.js");

var store = null;
var Author = null;

const MAPPING_AUTHOR = {
    "table": "t_author",
    "id": {
        "column": "aut_id",
        "sequence": "author_id"
    },
    "properties": {
        "name": {
            "type": "string",
            "column": "aut_name"
        }
    }
};

exports.setUp = function() {
    store = new Store(Store.initConnectionPool(runner.getDbProps()));
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

exports.testKey = function() {
    var key = new Key("Author", 1);
    assert.strictEqual(key.type, "Author");
    assert.strictEqual(key.id, 1);
    // trying to overwrite id must throw an error
    assert.throws(function() {
        key.id = 2;
    });
};

exports.testCRUD = function() {
    // create
    var name = "John Doe";
    var author = new Author({
        "name": name,
        "state": "famous"
    });
    assert.isTrue(author._key instanceof Key);
    assert.strictEqual(author._key.type, "Author");
    assert.isNull(author._key.id);
    assert.isNull(author.id);
    author.save();
    assert.strictEqual(author._key.id, 1);
    assert.strictEqual(author.id, 1);

    // read
    author = Author.get(1);
    assert.isNotNull(author);
    assert.strictEqual(author.id, 1);
    assert.strictEqual(author.name, name);

    // update
    author.name = name = "Mr. Foo-Bar";
    author.save();
    assert.strictEqual(author._entity[MAPPING_AUTHOR.properties.name.column], name);
    assert.strictEqual(author._entity[MAPPING_AUTHOR.id.column], author._key.id);

    // read again
    author = Author.get(1);
    assert.strictEqual(author.name, name);
    assert.strictEqual(author._entity[MAPPING_AUTHOR.id.column], author._key.id);

    // remove
    author.remove();
    assert.strictEqual(Author.get(1), null);
    assert.strictEqual(Author.all().length, 0);
};

exports.testNullProps = function() {
    var author = new Author();
    assert.isNull(author.name);
    author.save();
    author = Author.get(1);
    assert.isNull(author.name);
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
