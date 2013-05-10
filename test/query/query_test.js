var runner = require("../runner");
var assert = require("assert");
var system = require("system");

var {Store, Cache} = require("../../lib/sqlstore/main");
var sqlUtils = require("../../lib/sqlstore/util");
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
    store = null;
    Author = null;
    Book = null;
    return;
};

exports.testSelectEntity = function() {
    populate();
    var result = store.query("select Book from Book");
    assert.strictEqual(result.length, 10);
    result.forEach(function(book, idx) {
        assert.strictEqual(book._id, idx + 1);
        assert.isNotNull(book._entity);
    });
    result = store.query("select Book as book from Book");
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
    var result = store.query("select Book.* from Book");
    assert.strictEqual(result.length, 10);
    result.forEach(function(book, idx) {
        assert.isTrue(book instanceof Book);
        assert.isTrue(book.author instanceof Author);
        assert.strictEqual(book._id, idx + 1);
        assert.isNotNull(book._entity);
        assert.strictEqual(book._entity[titleColumn], "Book " + idx);
    });
    result = store.query("select b.*, a.* from Book b, Author a where b.author = a.id");
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
    var result = store.query("select Book.title from Book");
    assert.strictEqual(result.length, 10);
    result.forEach(function(title, idx) {
        assert.strictEqual(title, "Book " + idx);
    });
    result = store.query("select Book.title, Book.id from Book");
    assert.strictEqual(result.length, 10);
    result.forEach(function(props, idx) {
        assert.strictEqual(props["Book.title"], "Book " + idx);
        assert.strictEqual(props["Book.id"], idx + 1);
    });
    result = store.query("select Author.id, Book.title from Book, Author where Book.author = Author.id and Author.id < 6");
    assert.strictEqual(result.length, 5);
    result.forEach(function(props, idx) {
        assert.strictEqual(props["Book.title"], "Book " + idx);
        assert.strictEqual(props["Author.id"], idx + 1);
    });
    // selecting multiple entities
    result = store.query("select Author, Book from Book, Author where Book.author = Author.id and Author.id < 6");
    assert.strictEqual(result.length, 5);
    result.forEach(function(props, idx) {
        assert.strictEqual(props["Book"]._id, idx + 1);
        assert.strictEqual(props["Author"]._id, idx + 1);
    });
};

exports.testNamedParameter = function() {
    populate();
    // named params
    var result = store.query("from Book where Book.title like :title", {
        "title": "Book%"
    });
    assert.strictEqual(result.length, 10);
    result.forEach(function(book, idx) {
        assert.isTrue(book instanceof Book);
        assert.strictEqual(book.title, "Book " + idx);
        assert.strictEqual(book._id, idx + 1);
    });
};

exports.testStorableAsNamedParameter = function() {
    populate();
    var author = Author.get(1);
    var book = store.query("from Book where Book.author = :author", {
        "author": author
    });
    assert.strictEqual(book.length, 1);
    assert.isTrue(book[0] instanceof Book);
    assert.isTrue(book[0].author._key.equals(author._key));
};

exports.testAliases = function() {
    populate();
    var result = store.query("select Author.name as author, Book.title as title from Author, Book where Book.author = Author.id");
    assert.strictEqual(result.length, 10);
    result.forEach(function(props, idx) {
        assert.strictEqual(props["author"], "Author " + idx);
        assert.strictEqual(props["title"], "Book " + idx);
    });
    result = store.query("select a.name as author from Author as a where a.id < 6");
    assert.strictEqual(result.length, 5);
    result.forEach(function(name, idx) {
        assert.strictEqual(name, "Author " + idx);
    });
    result = store.query("select count(Author.id) as cnt from Author");
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0], 10);
    result = store.query("select count(aut.id) as cnt from Author aut");
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0], 10);
    result = store.query("select Author.name author, count(Book.id) from Author, Book where Book.author = Author.id group by Author.name order by Author.name");
    assert.strictEqual(result.length, 10);
    result.forEach(function(props, idx) {
        assert.strictEqual(props["author"], "Author " + idx);
        assert.strictEqual(props["COUNT(Book.id)"], 1);
    });
    result = store.query("select Author.name as author, count(Book.id) as cnt from Author, Book where Book.author = Author.id group by Author.name order by Author.name");
    assert.strictEqual(result.length, 10);
    result.forEach(function(props, idx) {
        assert.strictEqual(props["author"], "Author " + idx);
        assert.strictEqual(props["cnt"], 1);
    });
    result = store.query("select a as author, b as book from Author a inner join Book b on a.id = b.author");
    assert.strictEqual(result.length, 10);
};

exports.testSelectAggregation = function() {
    populate();
    var result = store.query("select count(Book.id) from Book");
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0], 10);
    result = store.query("select count(Book.id) as cnt from Book");
    assert.strictEqual(result[0], 10);
};

exports.testSummand = function() {
    populate();
    var result = store.query("select Book.id + 10 from Book");
    assert.strictEqual(result.length, 10);
    result.forEach(function(value, idx) {
        assert.strictEqual(value, idx + 11);
    });
    result = store.query("select ((Book.id + 1) * 2) from Book");
    assert.strictEqual(result.length, 10);
    result.forEach(function(value, idx) {
        assert.strictEqual(value, ((idx + 2) * 2));
    });
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
