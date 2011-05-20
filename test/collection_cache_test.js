var runner = require("./runner");
var assert = require("assert");

var Store = require("../lib/sqlstore/store").Store;
var sqlUtils = require("../lib/sqlstore/util");
var store = null;
var Book = null;
var Author = null;

const MAPPING_AUTHOR = {
    "properties": {
        "name": "string",
        "books": {
            "type": "collection",
            "entity": "Book",
            "foreignProperty": "author"
        }
    }
};

const MAPPING_BOOK = {
    "properties": {
        "title": "string",
        "author": {
            "type": "object",
            "entity": "Author"
        },
        "available": {
            "type": "boolean"
        }
    }
};

exports.setUp = function() {
    store = new Store(runner.getDbProps());
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    Book = store.defineEntity("Book", MAPPING_BOOK);
    return;
};

exports.tearDown = function() {
    var conn = store.getConnection();
    [Book, Author].forEach(function(ctor) {
        if (ctor == null) {
            return;
        }
        var schemaName = ctor.mapping.schemaName || store.dialect.getDefaultSchema(conn);
        if (sqlUtils.tableExists(conn, ctor.mapping.tableName, schemaName)) {
            sqlUtils.dropTable(conn, store.dialect, ctor.mapping.tableName, schemaName);
            if (ctor.mapping.id.hasSequence() && store.dialect.hasSequenceSupport()) {
                sqlUtils.dropSequence(conn, store.dialect, ctor.mapping.id.sequence, schemaName);
            }
        }
    });
    store.connectionPool.stopScheduler();
    store.connectionPool.closeConnections();
    store = null;
    Book = null;
    Author = null;
    return;
};

exports.testBasicCachedEntity = function() {
    var author1 = new Author({
        "name": "John Foo"
    });
    author1.save();
    var author2 = Author.get(1);
    assert.strictEqual(author2._id, author1._id);
    // assert.strictEqual(author2._entity, author1._entity);
    // change name of author1 - as long as author1 isn't saved the name of author2
    // shouldn't change
    author1.name = "Jane Bar";
    assert.strictEqual(author1.name, "Jane Bar");
    assert.notStrictEqual(author2.name, author1.name);
    author1.save();
    // after persisting author1 and author2 share the same name
    assert.strictEqual(author2.name, author1.name);
    // reversing the change should have the same effect as above
    author1.name = "John Foo";
    assert.strictEqual(author1.name, "John Foo");
    assert.notStrictEqual(author2.name, author1.name);
    author1.save();
    assert.strictEqual(author2.name, author1.name);
    return;
};

exports.testPersisting = function() {
    var author = new Author({
        "name": "John Foo"
    });
    assert.isUndefined(author.books);
    // create a book with above author and persist it - afterwards
    // the "books"-collection of author should contain this book
    var book = new Book({
        "title": "My Book",
        "author": author,
        "available": true
    });
    book.save();
    assert.strictEqual(author.books.length, 1);
    assert.strictEqual(author.books.get(0)._id, book._id);
    // removing the author from the book also updates the author's "books" collection
    book.author = null;
    book.save();
    assert.strictEqual(author.books.length, 0);
    return;
};

exports.testRemoval = function() {
    var author = new Author({
        "name": "John Foo"
    });
    var book = new Book({
        "title": "Server-side JS made easy",
        "author": author,
        "available": true
    });
    book.save();
    assert.strictEqual(author._id, 1);
    // removing author must also set the book's reference to null
    author.remove();
    assert.isNull(book.author);
    return;
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
  system.exit(runner.run(exports, arguments));
}
