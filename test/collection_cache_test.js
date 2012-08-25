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

exports.testStorablePersisting = function() {
    var author = new Author({
        "name": "John Foo"
    });
    assert.isUndefined(author.books);
    // create a book with above author and persist it
    // Note: persisting the book also persists it's author
    var book = new Book({
        "title": "My Book",
        "author": author,
        "available": true
    });
    book.save();
    // author.books collection is now populated
    assert.strictEqual(author.books.length, 1);
    assert.strictEqual(author.books.get(0)._id, book._id);
    author.books.invalidate();
    assert.strictEqual(author.books.length, 1);
    assert.strictEqual(author.books.get(0)._id, book._id);
    // removing the author from the book needs explicit removal from the author's
    // books collection
    book.author = null;
    book.save();
    assert.strictEqual(author.books.length, 1);
    assert.isNotUndefined(author.books.get(0));
    author.books.invalidate();
    assert.strictEqual(author.books.length, 0);
    // create new book and persist it - since the author's book collection has
    // been touched above, it doesn't change (still empty)
    book = new Book({
        "title": "My new book",
        "author": author,
        "available": false
    });
    book.save();
    assert.strictEqual(author.books.length, 0);
    author.books.invalidate();
    assert.strictEqual(author.books.length, 1);
    return;
};

exports.testStorableRemoval = function() {
    var author = new Author({
        "name": "John Foo"
    });
    var book = new Book({
        "title": "Server-side JS made easy",
        "author": author,
        "available": true
    });
    book.save();
    assert.strictEqual(author.books.length, 1);
    assert.strictEqual(author.books.get(0)._id, book._id);
    // remove the book - the author's collection is still populated
    book.remove();
    assert.strictEqual(author.books.length, 1);
    assert.strictEqual(author.books.get(0)._id, book._id);
    // retrieve the author again from db/cache - since the collection is
    // cached, and the book hasn't been removed explicitly from the collection,
    // it still has a length of 1, but contains a null value at idx 0
    assert.strictEqual(Author.get(1).books.length, 1);
    assert.isNull(Author.get(1).books.get(0));
    // explicitly invalidate the collection
    author.books.invalidate();
    assert.strictEqual(author.books.length, 0);
    assert.strictEqual(Author.get(1).books.length, 0);
    return;
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
   system.exit(runner.run(exports, arguments));
}
