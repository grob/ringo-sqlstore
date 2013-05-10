var runner = require("./runner");
var assert = require("assert");
var system = require("system");

var {Store, Cache} = require("../lib/sqlstore/main");
var sqlUtils = require("../lib/sqlstore/util");
var store = null;
var Author = null;
var Book = null;

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
    store.setEntityCache(new Cache());
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    Book = store.defineEntity("Book", MAPPING_BOOK);
};

exports.tearDown = function() {
    var conn = store.getConnection();
    [Author, Book].forEach(function(ctor) {
        var schemaName = ctor.mapping.schemaName || store.dialect.getDefaultSchema(conn);
        if (sqlUtils.tableExists(conn, ctor.mapping.tableName, schemaName)) {
            sqlUtils.dropTable(conn, store.dialect, ctor.mapping.tableName, schemaName);
        }
    });
    store.close();
};


exports.testStringify = function() {
    var author = new Author({
        "name": "John Doe"
    });
    var book = new Book({
        "title": "Testing Ringo SQLstore",
        "author": author
    });
    author.latestBook = book;
    assert.strictEqual(JSON.stringify(author), '{"_id":null,"name":"John Doe"}');
    author.save();
    assert.strictEqual(JSON.stringify(author), '{"_id":1,"name":"John Doe"}');
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
