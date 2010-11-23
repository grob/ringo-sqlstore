var assert = require("assert");

var Store = require("ringo/storage/sql/store").Store;
var sqlUtils = require("ringo/storage/sql/util");
var store = null;
var Author = null;
var Book = null;
var Editor = null;
var dbProps = {
    "url": "jdbc:h2:mem:test",
    "driver": "org.h2.Driver"
};

const MAPPING_AUTHOR = {
    "properties": {
        "name": "string"
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

const MAPPING_EDITOR = {
    "properties": {
        "name": "string"
    }
};

exports.setDbProps = function(props) {
    dbProps = props;
    return;
};

exports.setUp = function() {
    store = new Store(dbProps);
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    Book = store.defineEntity("Book", MAPPING_BOOK);
    Editor = store.defineEntity("Editor", MAPPING_EDITOR); 
    return;
};

exports.tearDown = function() {
    var conn = store.getConnection();
    [Author, Book, Editor].forEach(function(ctor) {
        var schemaName = ctor.mapping.schemaName || store.dialect.getDefaultSchema(conn);
        if (sqlUtils.tableExists(conn, ctor.mapping.tableName, schemaName)) {
            sqlUtils.dropTable(conn, store.dialect, ctor.mapping.tableName, schemaName);
        }
    });
    store.connectionPool.stopScheduler();
    store.connectionPool.closeConnections();
    store = null;
    Author = null;
    Book = null;
    Editor = null;
    return;
};

exports.testAssignObject = function() {
    var author = new Author({
        "name": "John Doe"
    });
    var book = new Book({
        "title": "Book 1",
        "author": author
    });
    book.save();
    // author is persisted together with book instance
    assert.strictEqual(Author.get(1)._id, 1);
    assert.strictEqual(book.author._id, Author.get(1)._id);
    // create different book author and assign it as the book's author
    var authorTwo = new Author({
        "name": "Mr. Foo-Bar"
    });
    book.author = authorTwo;
    book.save();
    // authorTwo is persisted when changes of book are
    assert.strictEqual(Author.all().length, 2);
    assert.strictEqual(book.author._id, Author.get(2)._id);
    // null out the book's author
    book.author = undefined;
    book.save();
    assert.strictEqual(Book.get(1).author, null);
    // authorTwo is still there
    assert.strictEqual(Author.all().length, 2);
    return;
};

exports.testAssignWrongObject = function() {
    // non-entity
    var book = new Book({
        "title": "Book 1",
        "author": {}
    });
    assert.throws(function() {
        book.save();
    });
    // different entity type
    var editor = new Editor({
        "name": "Jane Doe"
    });
    book.author = editor;
    assert.throws(function() {
        book.save();
    });
    return;
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
  require("test").run(exports);
}
