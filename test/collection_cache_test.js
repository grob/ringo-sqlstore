const runner = require("./runner");
const assert = require("assert");
const system = require("system");

const {Store, Cache} = require("../lib/main");
const utils = require("./utils");

let store = null;
let Book = null;
let Author = null;

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
    store = new Store(Store.initConnectionPool(runner.getDbProps()));
    store.setEntityCache(new Cache());
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    Book = store.defineEntity("Book", MAPPING_BOOK);
    store.syncTables();
};

exports.tearDown = function() {
    utils.drop(store, Author, Book);
    const conn = store.getConnection();
    store.close();
};

exports.testStorablePersisting = function() {
    const author = new Author({
        "name": "John Foo"
    });
    assert.isNull(author.books);
    // create a book with above author and persist it
    // Note: persisting the book also persists it's author
    let book = new Book({
        "title": "My Book",
        "author": author,
        "available": true
    });
    book.save();
    // author.books collection is now populated
    assert.strictEqual(author.books.length, 1);
    assert.strictEqual(author.books.get(0).id, book.id);
    author.books.invalidate();
    assert.strictEqual(author.books.length, 1);
    assert.strictEqual(author.books.get(0).id, book.id);
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
};

exports.testCollectionInvalidation = function() {
    let author = new Author({
        "name": "John Foo"
    });
    author.save();
    assert.strictEqual(author.books.length, 0);
    const book = new Book({
        "title": "Server-side JS made easy",
        "author": author,
        "available": true
    });
    book.save();
    // save() does no longer change the properties assigned during construction
    // so the value of book.author strictly equals the author instance
    assert.strictEqual(book.author, author);
    // invalidate the books collection, and ensure that it's the same
    // reference used in author.books and book.author.books
    book.author.books.invalidate();
    assert.strictEqual(author.books.length, 1);
    assert.strictEqual(book.author.books.length, 1);
    // retrieve the author as new instance, access the collection and remove it
    // this must lead to removal of the cached collection
    author = Author.get(1);
    assert.strictEqual(author.books.length, 1);
    const cacheKey = author.books._cacheKey;
    assert.isNotNull(store.entityCache.getIfPresent(cacheKey));
    // assert.strictEqual(author.books._state, Collection.)
    author.remove();
    assert.isNull(store.entityCache.getIfPresent(cacheKey));
};

exports.testStorableRemoval = function() {
    const author = new Author({
        "name": "John Foo"
    });
    const book = new Book({
        "title": "Server-side JS made easy",
        "author": author,
        "available": true
    });
    book.save();
    assert.strictEqual(author.books.length, 1);
    assert.strictEqual(author.books.get(0).id, book.id);
    // remove the book - the author's collection is still populated
    book.remove();
    assert.strictEqual(author.books.length, 1);
    assert.strictEqual(author.books.get(0).id, book.id);
    // retrieve the author again from db/cache - since the collection is
    // cached, and the book hasn't been removed explicitly from the collection,
    // it still has a length of 1, but contains a null value at idx 0
    assert.strictEqual(Author.get(1).books.length, 1);
    assert.isNull(Author.get(1).books.get(0));
    // explicitly invalidate the collection
    author.books.invalidate();
    assert.strictEqual(author.books.length, 0);
    assert.strictEqual(Author.get(1).books.length, 0);
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
   system.exit(runner.run(exports, arguments));
}
