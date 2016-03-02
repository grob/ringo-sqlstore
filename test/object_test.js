var runner = require("./runner");
var assert = require("assert");
var system = require("system");

var {Store, Cache} = require("../lib/main");
var utils = require("./utils");
var store = null;
var Author = null;
var Book = null;
var Editor = null;

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

const MAPPING_EDITOR = {
    "properties": {
        "name": "string"
    }
};

exports.setUp = function() {
    store = new Store(Store.initConnectionPool(runner.getDbProps()));
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    Book = store.defineEntity("Book", MAPPING_BOOK);
    Editor = store.defineEntity("Editor", MAPPING_EDITOR);
    store.syncTables();
};

exports.tearDown = function() {
    utils.drop(store, Author, Book, Editor);
    store.close();
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
    assert.strictEqual(author.id, 1);
    assert.strictEqual(book.author.id, author.id);
    assert.strictEqual(author, book.author);
    // create different book author and assign it as the book's author
    var authorTwo = new Author({
        "name": "Mr. Foo-Bar"
    });
    book.author = authorTwo;
    book.save();
    // authorTwo is persisted when changes of book are
    assert.strictEqual(Author.all().length, 2);
    assert.strictEqual(authorTwo, book.author);
    assert.strictEqual(book.author.id, authorTwo.id);
    assert.strictEqual(Book.get(book.id).author.id, authorTwo.id);
    // null out the book's author
    book.author = undefined;
    book.save();
    assert.strictEqual(Book.get(1).author, null);
    // authorTwo is still there
    assert.strictEqual(Author.all().length, 2);
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
};

exports.testAssignLazyLoaded = function() {
    (new Author({
        "name": "John Doe"
    })).save();
    // re-get author from db, but don't access any properties of
    var author = Author.get(1);
    var book = new Book({
        "title": "foo",
        "author": author
    });
    book.save();
    // after persisting the book, the author's book collection
    // must be populated
    assert.strictEqual(author.books.length, 1);
};

exports.testSimpleCircularReference = function() {
    var author = new Author({
        "name": "John Doe"
    });
    var book = new Book({
        "title": "foo",
        "author": author
    });
    author.latestBook = book;
    author.save();
    assert.strictEqual(author.id, 1);
    assert.strictEqual(book.id, 1);
    assert.strictEqual(author.latestBook.id, book.id);
    assert.strictEqual(author.latestBook.author.id, author.id);
    assert.strictEqual(book.author.id, author.id);
    assert.strictEqual(author.books.length, 1);
    author = Author.get(1);
    book = Book.get(1);
    assert.strictEqual(author.id, 1);
    assert.strictEqual(book.id, 1);
    assert.strictEqual(author.latestBook.id, book.id);
    assert.strictEqual(author.latestBook.author.id, author.id);
    assert.strictEqual(book.author.id, author.id);
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
