const runner = require("./runner");
const assert = require("assert");
const system = require("system");

const {Store, Cache} = require("../lib/main");
const utils = require("./utils");
let store = null;
let Author = null;
let Book = null;

const MAPPING_AUTHOR = {
    "properties": {
        "name": "string",
        "latestBook": {
            "type": "object",
            "entity": "Book"
        },
        "books": {
            "type": "collection",
            "query": "from Book where Book.author = :id"
        }
    }
};

const MAPPING_BOOK = {
    "properties": {
        "title": "string",
        "author": {
            "type": "object",
            "entity": "Author"
        }
    }
};

exports.setUp = function() {
    store = new Store(Store.initConnectionPool(runner.getDbProps()));
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    Book = store.defineEntity("Book", MAPPING_BOOK);
    store.syncTables();
};

exports.tearDown = function() {
    utils.drop(store, Author, Book);
    store.close();
};


exports.testStringify = function() {
    const author = new Author({
        "name": "John Doe"
    });
    author.latestBook = new Book({
        "title": "Testing Ringo SQLstore",
        "author": author
    });
    assert.strictEqual(JSON.stringify(author), '{"id":null,"name":"John Doe"}');
    author.save();
    assert.strictEqual(JSON.stringify(author), '{"id":1,"name":"John Doe"}');
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
