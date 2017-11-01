const runner = require("./runner");
const assert = require("assert");
const system = require("system");

const {Store, Cache} = require("../lib/main");
const utils = require("./utils");
let store = null;
let Author = null;
let Book = null;
let Editor = null;

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
    const author = new Author({
        "name": "John Doe"
    });
    const book = new Book({
        "title": "Book 1",
        "author": author
    });
    book.save();
    // author is persisted together with book instance
    assert.strictEqual(author.id, 1);
    assert.strictEqual(book.author.id, author.id);
    assert.strictEqual(author, book.author);
    // create different book author and assign it as the book's author
    const authorTwo = new Author({
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
    const book = new Book({
        "title": "Book 1",
        "author": {}
    });
    assert.throws(function() {
        book.save();
    });
    // different entity type
    book.author = new Editor({
        "name": "Jane Doe"
    });
    assert.throws(function() {
        book.save();
    });
};

exports.testAssignLazyLoaded = function() {
    (new Author({
        "name": "John Doe"
    })).save();
    // re-get author from db, but don't access any properties of
    const author = Author.get(1);
    const book = new Book({
        "title": "foo",
        "author": author
    });
    book.save();
    // after persisting the book, the author's book collection
    // must be populated
    assert.strictEqual(author.books.length, 1);
};

exports.testSimpleCircularReference = function() {
    let author = new Author({
        "name": "John Doe"
    });
    let book = new Book({
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
