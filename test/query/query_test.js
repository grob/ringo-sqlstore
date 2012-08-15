var runner = require("../runner");
var assert = require("assert");

var Store = require("../../lib/sqlstore/store").Store;
var sqlUtils = require("../../lib/sqlstore/util");
var {Query} = require("../../lib/sqlstore/query/query");
var store = null;
var Author = null;
var Book = null;

const MAPPING_AUTHOR = {
    "table": "T_AUTHOR",
    "id": {
        "column": "AUTHOR_ID"
    },
    "properties": {
        "name": {
            "column": "AUTHOR_NAME",
            "type": "string"
        },
        "books": {
            "type": "collection",
            "query": "from Book b where b.author = :id"
        }
    }
};

const MAPPING_BOOK = {
    "table": "T_BOOK",
    "id": {
        "column": "BOOK_ID"
    },
    "properties": {
        "title": {
            "column": "BOOK_TITLE",
            "type": "string"
        },
        "author": {
            "column": "BOOK_F_AUTHOR",
            "type": "object",
            "entity": "Author"
        }
    }
};

var populate = function() {
    store.beginTransaction();
    var authors = [];
    var books = [];
    for (var i=0; i<10; i+=1) {
        var author = new Author({
            "name": "Author " + i
        });
        author.save();
        authors.push(author);
        var book = new Book({
            "title": "Book " + i,
            "author": authors[i]
        });
        book.save();
        books.push(book);
    }
    store.commitTransaction();
    return [authors, books];
};

exports.setUp = function() {
    store = new Store(runner.getDbProps());
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    Book = store.defineEntity("Book", MAPPING_BOOK);
    return;
};

exports.tearDown = function() {
    var conn = store.getConnection();
    [Author, Book].forEach(function(ctor) {
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
    return;
};

exports.testSelectEntity = function() {
    populate();
    var result = (new Query(store, "select Book from Book")).select();
    assert.strictEqual(result.length, 10);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
        assert.isNotNull(book._entity);
    });
    result = (new Query(store, "select Book as book from Book")).select();
    assert.strictEqual(result.length, 10);
    // alias is ignored if only one result
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
        assert.isNotNull(book._entity);
    });
};

exports.testSelectEntityAggressive = function() {
    populate();
    var titleColumn = Book.mapping.getColumnName("title");
    var result = (new Query(store, "select Book.* from Book")).select();
    assert.strictEqual(result.length, 10);
    result.forEach(function(book, idx) {
        assert.isTrue(book instanceof Book);
        assert.isTrue(book.author instanceof Author);
        assert.strictEqual(book._id, idx + 1);
        assert.isNotNull(book._entity);
        assert.strictEqual(book._entity[titleColumn], "Book " + idx);
    });
    result = (new Query(store, "select b.*, a.* from Book b, Author a where b.author = a.id")).select();
    assert.strictEqual(result.length, 10);
    result.forEach(function(obj, idx) {
        assert.isTrue(obj.Book instanceof Book);
        assert.isTrue(obj.Author instanceof Author);
        assert.strictEqual(obj.Book._id, idx + 1);
        assert.strictEqual(obj.Book.title, "Book " + idx);
        assert.strictEqual(obj.Book.author._id, obj.Author._id);
        assert.strictEqual(obj.Author._id, idx + 1);
    });
};

exports.testSelectProperties = function() {
    populate();
    var query = new Query(store, "select Book.title from Book");
    var result = query.select();
    assert.strictEqual(result.length, 10);
    result.forEach(function(title, idx) {
        assert.strictEqual(title, "Book " + idx);
    });
    query = new Query(store, "select Book.title, Book.id from Book");
    result = query.select();
    assert.strictEqual(result.length, 10);
    result.forEach(function(props, idx) {
        assert.strictEqual(props["Book.title"], "Book " + idx);
        assert.strictEqual(props["Book.id"], idx + 1);
    });
    query = new Query(store, "select Author.id, Book.title from Book, Author where Book.author = Author.id and Author.id < 6");
    result = query.select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(props, idx) {
        assert.strictEqual(props["Book.title"], "Book " + idx);
        assert.strictEqual(props["Author.id"], idx + 1);
    });
    // selecting multiple entities
    query = new Query(store, "select Author, Book from Book, Author where Book.author = Author.id and Author.id < 6");
    result = query.select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(props, idx) {
        assert.strictEqual(props["Book"]._id, idx + 1);
        assert.strictEqual(props["Author"]._id, idx + 1);
    });
};

exports.testNamedParameter = function() {
    populate();
    // named params
    var query = new Query(store, "from Book where Book.title like :title");
    var result = query.select({
        "title": "Book%"
    });
    assert.strictEqual(result.length, 10);
    result.forEach(function(book, idx) {
        assert.isTrue(book instanceof Book);
        assert.strictEqual(book.title, "Book " + idx);
        assert.strictEqual(book._id, idx + 1);
    });
};

exports.testAliases = function() {
    populate();
    var query = new Query(store, "select Author.name as author, Book.title as title from Author, Book where Book.author = Author.id");
    var result = query.select();
    assert.strictEqual(result.length, 10);
    result.forEach(function(props, idx) {
        assert.strictEqual(props["author"], "Author " + idx);
        assert.strictEqual(props["title"], "Book " + idx);
    });
    query = new Query(store, "select a.name as author from Author as a where a.id < 6");
    result = query.select();
    assert.strictEqual(result.length, 5);
    result.forEach(function(name, idx) {
        assert.strictEqual(name, "Author " + idx);
    });
    query = new Query(store, "select count(Author.id) as cnt from Author");
    result = query.select();
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0], 10);
    query = new Query(store, "select count(aut.id) as cnt from Author aut");
    result = query.select();
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0], 10);
    query = new Query(store, "select Author.name author, count(Book.id) from Author, Book where Book.author = Author.id group by Author.id");
    result = query.select();
    assert.strictEqual(result.length, 10);
    result.forEach(function(props, idx) {
        assert.strictEqual(props["author"], "Author " + idx);
        assert.strictEqual(props["COUNT(Book.id)"], 1);
    });
    query = new Query(store, "select Author.name as author, count(Book.id) as cnt from Author, Book where Book.author = Author.id group by Author.id");
    result = query.select();
    assert.strictEqual(result.length, 10);
    result.forEach(function(props, idx) {
        assert.strictEqual(props["author"], "Author " + idx);
        assert.strictEqual(props["cnt"], 1);
    });
    query = new Query(store, "select a as author, b as book from Author a inner join Book b on a.id = b.author");
    result = query.select();
    assert.strictEqual(result.length, 10);
};

exports.testSelectAggregation = function() {
    populate();
    var query = new Query(store, "select count(Book.id) from Book");
    var result = query.select();
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0], 10);
    query = new Query(store, "select count(Book.id) as cnt from Book");
    result = query.select();
    assert.strictEqual(result[0], 10);
};

exports.testSummand = function() {
    populate();
    var query = new Query(store, "select Book.id + 10 from Book");
    var result = query.select();
    assert.strictEqual(result.length, 10);
    result.forEach(function(value, idx) {
        assert.strictEqual(value, idx + 11);
    });
    query = new Query(store, "select ((Book.id + 1) % 2) from Book");
    var result = query.select();
    assert.strictEqual(result.length, 10);
    result.forEach(function(value, idx) {
        assert.strictEqual(value, ((idx + 2) % 2));
    });
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
