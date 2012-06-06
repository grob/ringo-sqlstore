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
    var book = new Book({
        "title": "My Book",
        "author": author,
        "available": true
    });
    // Note: persisting the book also persists it's author
    book.save();
    // author.books collection is now populated
    assert.strictEqual(author.books.length, 1);
    assert.strictEqual(author.books.get(0)._id, book._id);
    author.books.add(book);
    assert.strictEqual(author.books.length, 1);
    assert.strictEqual(author.books.get(0)._id, book._id);
    // removing the author from the book needs explicit removal from the author's
    // books collection
    book.author = null;
    book.save();
    assert.strictEqual(author.books.length, 1);
    assert.isUndefined(author.books[0]);
    author.books.remove(book);
    assert.strictEqual(author.books.length, 0);
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
    assert.strictEqual(author._id, 1);
    author.remove();
    // the book's author property is null because it has never been accessed
    // before (the _props of the storable are cleared after saving)
    assert.isNull(book.author);
    // although removed, the author's books collection is still populated
    // (the books still have a foreign key pointing to the removed author)
    assert.strictEqual(author.books.length, 1);
    // but the author's books collection now contains an undefined value
    assert.isUndefined(author.books[0]);
    // now explicitly remove the author from all its books
    book.author = null;
    book.save();
    author.books.invalidate();
    assert.isNull(book.author);
    assert.strictEqual(author.books.length, 0);
    return;
};

exports.testExplicitAddToCollection = function() {
    var author = new Author({
        "name": "John Foo"
    });
    author.save();
    assert.isNotUndefined(author.books);
    assert.strictEqual(author.books.length, 0);
    // create a book with above author and persist it
    var book = new Book({
        "title": "My Book",
        "author": author,
        "available": true
    });
    book.save();
    // this does *not* affect the author's book collection
    assert.strictEqual(author.books.length, 0);
    // unless explicitly added to it
    author.books.add(book);
    assert.strictEqual(author.books.length, 1);
    assert.strictEqual(author.books.get(0)._id, book._id);
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
   system.exit(runner.run(exports, arguments));
}
