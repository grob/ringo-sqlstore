const runner = require("../runner");
const assert = require("assert");
const system = require("system");

const Store = require("../../lib/store");
const utils = require("../utils");
const Parser = require("../../lib/query/parser");
const dataTypes = require("../../lib/datatypes/all");
const dialects = require("../../lib/dialects/all");
let store = null;
let Author = null;
let Book = null;

const MAPPING_AUTHOR = {
    "table": "T_AUTHOR",
    "id": {
        "column": "AUTHOR_ID"
    },
    "properties": {
        "name": {
            "column": "AUTHOR_NAME",
            "type": "string"
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

const generateSql = function(store, tree) {
    const generator = new store.dialect.SqlGenerator(store);
    return {
        "sql": tree.accept(generator),
        "params": generator.params
    };
};

exports.setUp = function() {
    store = new Store(Store.initConnectionPool(runner.getDbProps()));
    Author = store.defineEntity("Author", MAPPING_AUTHOR);
    Book = store.defineEntity("Book", MAPPING_BOOK);
    store.syncTables();
};

exports.tearDown = function() {
    utils.drop(store, Author, Book);
    store.close();
};

const testQueries = function(queries, options) {
    queries.forEach(function({query, sql, values}) {
        let tree = null;
        try {
            tree = Parser.parse(query, options || {});
        } catch (e) {
            console.error("Parsing query '" + query + "' failed, reason:", e);
        }
        if (tree !== null) {
            let generator = new store.dialect.SqlGenerator(store);
            let resultSql = tree.accept(generator);
            let params = generator.params;
            if (typeof(sql) === "object" && !!sql) {
                sql = sql[store.dialect.type] || sql.common;
            }
            assert.strictEqual(resultSql, getExpectedSql(sql), "Query: " + query);
            if (values) {
                assert.deepEqual(params, values, "Query: " + query);
            }
        }
    });
};

const getExpectedSql = function(str) {
    return str.replace(/\$(\w+)(?:\.(\w+))?/g, function(match, table, property) {
        const mapping = store.getEntityMapping(table);
        if (!property) {
            return store.dialect.quote(mapping.tableName, mapping.schemaName);
        }
        const propMapping = mapping.getMapping(property);
        return store.dialect.quote(propMapping.column, mapping.tableName);
    });
};

exports.testExpression = function() {
    const queries = [
        {
            "query": "Author.id",
            "sql": "$Author.id"
        },
        {
            "query": "Author.id - 2",
            "sql": "($Author.id - ?)",
            "values": [{"dataType": dataTypes.long, "value": 2}]
        },
        {
            "query": "Author.id + 2",
            "sql": "($Author.id + ?)",
            "values": [{"dataType": dataTypes.long, "value": 2}]
        },
        {
            "query": "Author.id % 2",
            "sql": {
                "oracle": "MOD($Author.id, ?)",
                "common": "($Author.id % ?)"
            },
            "values": [{"dataType": dataTypes.long, "value": 2}]
        }
    ];

    testQueries(queries);
};

exports.testSelectClause = function() {
    const queries = [
        {
            "query": "select Author from Author",
            "sql": "SELECT $Author.id FROM $Author"
        },
        {
            "query": "select Author.name from Author",
            "sql": "SELECT $Author.name FROM $Author"
        },
        {
            "query": "select Author.* from Author",
            "sql": "SELECT $Author.id, $Author.name FROM $Author"
        },
        {
            "query": "select Author.name, max(Author.id) - min(Author.id) as authors from Author",
            "sql": "SELECT $Author.name, (MAX($Author.id) - MIN($Author.id)) FROM $Author"
        },
        // simple select
        {
            "query": "from Author",
            "sql": "SELECT $Author.id FROM $Author"
        },
        {
            "query": "from Author, Book",
            "sql": "SELECT $Author.id, $Book.id FROM $Author, $Book"
        }
    ];

    testQueries(queries);
};

exports.testAggregation = function() {
    const queries = [
        {
            "query": "select max(Author.id) from Author",
            "sql": "SELECT MAX($Author.id) FROM $Author"
        },
        {
            "query": "select min(Author.id) from Author",
            "sql": "SELECT MIN($Author.id) FROM $Author"
        },
        {
            "query": "select sum(Author.id) from Author",
            "sql": "SELECT SUM($Author.id) FROM $Author"
        },
        {
            "query": "select avg(Author.id) from Author",
            "sql": "SELECT AVG($Author.id) FROM $Author"
        },
        {
            "query": "select avg(distinct Author.id) from Author",
            "sql": "SELECT AVG(DISTINCT $Author.id) FROM $Author"
        },
        {
            "query": "select count(Author.id) from Author",
            "sql": "SELECT COUNT($Author.id) FROM $Author"
        },
        {
            "query": "select count(distinct Author.id) from Author",
            "sql": "SELECT COUNT(DISTINCT $Author.id) FROM $Author"
        }
    ];

    testQueries(queries);
};

exports.testWhereClause = function() {
    const queries = [
        // testing default entity
        {
            "query": "from Author where Author.id = 1",
            "sql": "SELECT $Author.id FROM $Author WHERE $Author.id = ?"
        },
        {
            "query": "from Author, Book where Author.id = 1",
            "sql": "SELECT $Author.id, $Book.id FROM $Author, $Book WHERE $Author.id = ?"
        },
        {
            "query": "from Book, Author where Book.title = 'test'",
            "sql": "SELECT $Book.id, $Author.id FROM $Book, $Author WHERE $Book.title = ?"
        },
        {
            "query": "from Author where Author.id > (select avg(Author.id) from Author)",
            "sql": "SELECT $Author.id FROM $Author WHERE $Author.id > (SELECT AVG($Author.id) FROM $Author)"
        },
        {
            "query": "from Author where Author.id > all (select avg(Author.id) from Author)",
            "sql": "SELECT $Author.id FROM $Author WHERE $Author.id > ALL (SELECT AVG($Author.id) FROM $Author)"
        }
    ];

    testQueries(queries);
};

exports.testParenthesis = function() {
    const queries = [
        {
            "query": "Author.id = 1",
            "sql": "$Author.id = ?"
        },
        {
            "query": "(Author.id = 1)",
            "sql": "$Author.id = ?"
        },
        {
            "query": "Author.id = 1 or Author.id = 2",
            "sql": "($Author.id = ? OR $Author.id = ?)"
        },
        {
            "query": "Author.id = 1 and Author.id = 2",
            "sql": "($Author.id = ? AND $Author.id = ?)"
        },
        {
            "query": "Author.id = 1 or (Author.id = 2 and Author.id = 3)",
            "sql": "($Author.id = ? OR ($Author.id = ? AND $Author.id = ?))"
        },
        {
            "query": "Author.id = 1 and (Author.id = 2 or Author.id = 3)",
            "sql": "($Author.id = ? AND ($Author.id = ? OR $Author.id = ?))"
        },
        {
            "query": "Author.id = 1 and (Author.id = 2 and Author.id = 3)",
            "sql": "($Author.id = ? AND ($Author.id = ? AND $Author.id = ?))"
        },
        {
            "query": "Author.id = 1 and (Author.id = 2 or Author.id = 3 or Author.id = 4)",
            "sql": "($Author.id = ? AND ($Author.id = ? OR $Author.id = ? OR $Author.id = ?))"
        },
        {
            "query": "Author.id = 1 or (Author.id = 2 and (Author.id = 3 or Author.id = 4))",
            "sql": "($Author.id = ? OR ($Author.id = ? AND ($Author.id = ? OR $Author.id = ?)))"
        },
        {
            "query": "Author.id = 1 and Author.id = 2 and (Author.id = 3 or Author.id = 4)",
            "sql": "($Author.id = ? AND $Author.id = ? AND ($Author.id = ? OR $Author.id = ?))"
        },
        {
            "query": "(Author.id = 1 or Author.id = 2) or (Author.id = 3)",
            "sql": "(($Author.id = ? OR $Author.id = ?) OR $Author.id = ?)"
        }
    ];

    testQueries(queries);
};

exports.testBetweenCondition = function() {
    const queries = [
        {
            "query": "between 1 and 10",
            "sql": "BETWEEN ? AND ?",
            "params": [1, 10]
        },
        {
            "query": "not between 1 and 10",
            "sql": "NOT BETWEEN ? AND ?",
            "params": [1, 10]
        },
        {
            "query": "between 'A' and 'D'",
            "sql": "BETWEEN ? AND ?",
            "params": ["A", "D"]
        }
    ];

    testQueries(queries, {"startRule": "condition_rhs"});
};

exports.testIsNullCondition = function() {
    const queries = [
        {
            "query": "is null",
            "sql": "IS NULL"
        },
        {
            "query": "is NOT null",
            "sql": "IS NOT NULL"
        }
    ];

    testQueries(queries, {"startRule": "condition_rhs"});
};

exports.testInCondition = function() {
    const queries = [
        {
            "query": "in (1,2,3)",
            "sql": "IN (?, ?, ?)",
            "params": [1, 2, 3]
        },
        {
            "query": "not in (1,2,3)",
            "sql": "NOT IN (?, ?, ?)",
            "params": [1, 2, 3]
        },
        {
            "query": 'in ("A","B","C")',
            "sql": "IN (?, ?, ?)",
            "params": ["A", "B", "C"]
        },
        {
            "query": 'in ( select Author.id from Author)',
            "sql": "IN (SELECT $Author.id FROM $Author)"
        },
        {
            "query": 'in ( select Author.id from Author where (Author.id = 123))',
            "sql": "IN (SELECT $Author.id FROM $Author WHERE $Author.id = ?)",
            "params": [123]
        },
        {
            "query": 'in ( select Author.id from Author where Author.id = 123 or Author.name like "John%")',
            "sql": "IN (SELECT $Author.id FROM $Author WHERE ($Author.id = ? OR $Author.name LIKE ?))",
            "params": [123, "John%"]
        }
    ];

    testQueries(queries, {"startRule": "condition_rhs"});
};

exports.testLikeCondition = function() {
    const queries = [
        {
            "query": "like 'John%'",
            "sql": "LIKE ?",
            "params": ["John%"]
        },
        {
            "query": 'like "%ohn%"',
            "sql": "LIKE ?",
            "params": ["%ohn%"]
        },
        {
            "query": 'not like "John%"',
            "sql": "NOT LIKE ?",
            "params": ["John%"]
        }
    ];

    testQueries(queries, {"startRule": "condition_rhs"});
};

exports.testNotCondition  = function() {

    const queries = [
        {
            "query": "not Author.id = 1",
            "sql": "NOT $Author.id = ?",
            "params": [1]
        }
    ];

    testQueries(queries, {"startRule": "condition"});
};

exports.testExistsCondition = function() {
    const queries = [
        {
            "query": "exists (from Author)",
            "sql": "EXISTS (SELECT $Author.id FROM $Author)"
        },
        {
            "query": "exists (select Author.id from Author)",
            "sql": "EXISTS (SELECT $Author.id FROM $Author)"
        },
        {
            "query": "exists (from Author where Author.id = 1)",
            "sql": "EXISTS (SELECT $Author.id FROM $Author WHERE $Author.id = ?)"
        }
    ];
    testQueries(queries, {"startRule": "condition"});
};

exports.testOperand = function() {
    const queries = [
        {
            "query": "select Author.id || ' - ' || Author.name as key from Author",
            "sql": {
                "oracle": "SELECT CONCAT($Author.id, CONCAT(?, $Author.name)) FROM $Author",
                "common": "SELECT CONCAT($Author.id, ?, $Author.name) FROM $Author"
            }
        }
    ];
    testQueries(queries);
};

exports.testOrderByClause = function() {
    const queries = [
        {
            "query": "order by Author.id",
            "sql": "ORDER BY $Author.id ASC"
        },
        {
            "query": "order by Author.id asc",
            "sql": "ORDER BY $Author.id ASC"
        },
        {
            "query": "order by Author.id desc",
            "sql": "ORDER BY $Author.id DESC"
        },
        {
            "query": "order by Author.id, Book.title",
            "sql": "ORDER BY $Author.id ASC, $Book.title ASC"
        },
        {
            "query": "order by Author.id desc, Book.title asc",
            "sql": "ORDER BY $Author.id DESC, $Book.title ASC"
        },
        {
            "query": "order by min(Author.id) desc",
            "sql": "ORDER BY MIN($Author.id) DESC"
        },
        {
            "query": "order by min(Author.id) + 1 desc",
            "sql": "ORDER BY (MIN($Author.id) + ?) DESC"
        },
        {
            "query": "order by Author.id nulls first",
            "sql": "ORDER BY $Author.id ASC NULLS FIRST"
        },
        {
            "query": "order by Author.id desc nulls last",
            "sql": "ORDER BY $Author.id DESC NULLS LAST"
        }
    ];

    testQueries(queries, {"startRule": "orderByClause"});
};

exports.testGroupByClause = function() {
    const queries = [
        {
            "query": "group by Author.name",
            "sql": "GROUP BY $Author.name"
        },
        {
            "query": "group by Author.id, Book.title",
            "sql": "GROUP BY $Author.id, $Book.title"
        }
    ];

    testQueries(queries, {"startRule": "groupByClause"});
};

exports.testHavingClause = function() {
    const queries = [
        {
            "query": "having Author.id > 10",
            "sql": "HAVING $Author.id > ?",
            "params": [10]
        },
        {
            "query": "having max(Author.id) > 10",
            "sql": "HAVING MAX($Author.id) > ?",
            "params": [10]
        },
        {
            "query": "having max(Author.id) > 10 and min(Author.id) < 20",
            "sql": "HAVING (MAX($Author.id) > ? AND MIN($Author.id) < ?)",
            "params": [10, 20]
        }
    ];

    testQueries(queries, {"startRule": "havingClause"});
};

exports.testFromClause = function() {
    const queries = [
        {
            "query": "from Author",
            "sql": "FROM $Author"
        },
        {
            "query": "from Author, Book",
            "sql": "FROM $Author, $Book"
        },
        {
            "query": "from Author as author, Book as book",
            "sql": "FROM $Author author, $Book book"
        }
    ];

    testQueries(queries, {"startRule": "fromClause"});
};

exports.testInnerJoin = function() {
    const queries = [
        {
            "query": "inner join Book on Author.id = Book.author",
            "sql": "INNER JOIN $Book ON $Author.id = $Book.author"
        },
        {
            "query": "join Book on Author.id = Book.author",
            "sql": "INNER JOIN $Book ON $Author.id = $Book.author"
        }
    ];

    testQueries(queries, {"startRule": "innerJoin"});
};

exports.testOuterJoin = function() {
    const queries = [
        {
            "query": "left outer join Book on Author.id = Book.author",
            "sql": "LEFT OUTER JOIN $Book ON $Author.id = $Book.author"
        },
        {
            "query": "right outer join Book on Author.id = Book.author",
            "sql": "RIGHT OUTER JOIN $Book ON $Author.id = $Book.author"
        }
    ];

    testQueries(queries, {"startRule": "outerJoin"});
};

exports.testNamedParameter = function() {
    const queries = [
        {
            "query": "Book.id = :id",
            "sql": "$Book.id = ?",
            "values": ["id"]
        },
        {
            "query": "Book.id = :price",
            "sql": "$Book.id = ?",
            "values": ["price"]
        },
        {
            "query": "Book.title like :title",
            "sql": "$Book.title LIKE ?",
            "values": ["title"]
        }
    ];
    testQueries(queries);
};

exports.testStorableAsNamedParameter = function() {
    const queries = [
        {
            "query": "Book = :book",
            "sql": "$Book.id = ?",
            "values": ["book"]
        }
    ];
    testQueries(queries);
};

exports.testSelectExpression = function() {
    const queries = [
        {
            "query": "Author.id",
            "sql": "$Author.id"
        },
        {
            "query": "Author.id authorId",
            "sql": "$Author.id"
        },
        {
            "query": "Author.id as authorId",
            "sql": "$Author.id"
        },
        {
            "query": "count( Author.id ) as cnt",
            "sql": "COUNT($Author.id)"
        },
        {
            "query": "max(Author.id) - min(Author.id) as authors",
            "sql": "(MAX($Author.id) - MIN($Author.id))"
        },
        {
            "query": "Author.id || ' - ' || Author.name as key",
            "sql": {
                "oracle": "CONCAT($Author.id, CONCAT(?, $Author.name))",
                "common": "CONCAT($Author.id, ?, $Author.name)"
            }
        }
    ];
    testQueries(queries, {"startRule": "selectExpression"});
};

exports.testAliases = function() {
    const mapping = Author.mapping;
    const idColumn = store.dialect.quote(mapping.getMapping("id").column);
    const authorIdColumn = store.dialect.quote(Book.mapping.getMapping("author").column);
    const nameColumn = store.dialect.quote(mapping.getMapping("name").column);
    const queries = [
        {
            "query": "select a.id as authorId from Author as a",
            "sql": "SELECT a." + idColumn + " FROM $Author a"
        },
        {
            "query": "select count(a.id) as authorId from Author as a",
            "sql": "SELECT COUNT(a." + idColumn + ") FROM $Author a"
        },
        {
            "query": "select author from Author as author",
            "sql": "SELECT author." + idColumn + " FROM $Author author"
        },
        {
            "query": "select author.* from Author as author",
            "sql": "SELECT author." + idColumn + ", author." + nameColumn + " FROM $Author author"
        },
        {
            "query": "select Author.* as author from Author",
            "sql": "SELECT $Author.id, $Author.name FROM $Author"
        },
        {
            "query": "from Author as author",
            "sql": "SELECT author." + idColumn + " FROM $Author author"
        },
        {
            "query": "from Author as a inner join Book as b on a.id = b.author",
            "sql": "SELECT a." + idColumn + " FROM $Author a INNER JOIN $Book b ON a." + idColumn + " = b." + authorIdColumn
        }
    ];
    testQueries(queries);
};

exports.testEntities = function() {
    const queries = [
        {
            "query": "select id from Author",
            "sql": "SELECT $Author.id FROM $Author"
        },
        {
            "query": "select id, name from Author",
            "sql": "SELECT $Author.id, $Author.name FROM $Author"
        },
        {
            "query": "select id from Author where name = 'johndoe'",
            "sql": "SELECT $Author.id FROM $Author WHERE $Author.name = ?"
        },
        {
            "query": "select id from Author order by name desc",
            "sql": "SELECT $Author.id FROM $Author ORDER BY $Author.name DESC"
        },
        {
            "query": "select id from Author having id > 10",
            "sql": "SELECT $Author.id FROM $Author HAVING $Author.id > ?"
        },
        {
            "query": "select id from Author, Book where author = id",
            "sql": "SELECT $Author.id FROM $Author, $Book WHERE $Book.author = $Author.id"
        },
        {
            "query": "from Author, Book where author = id",
            "sql": "SELECT $Author.id, $Book.id FROM $Author, $Book WHERE $Book.author = $Author.id"
        },
        {
            "query": "from Author join Book on author = id where title = 'test'",
            "sql": "SELECT $Author.id FROM $Author INNER JOIN $Book ON $Book.author = $Author.id WHERE $Book.title = ?"
        }
    ];
    testQueries(queries);
};

exports.testSubSelect = function() {
    const queries = [];
    ["", "all", "any", "some"].forEach(function(range) {
        queries.push({
            "query": "from Author where Author.id = " + range +
                    "(select avg(Author.id) from Author)",
            "sql": "SELECT $Author.id FROM $Author WHERE $Author.id = " +
                    (range ? range.toUpperCase() + " " : "") +
                    "(SELECT AVG($Author.id) FROM $Author)"
        })
    });
    testQueries(queries);
};

exports.testComplexQueries = function() {
    const queries = [
        {
            "query": "select Author.name, count(Book.id) from Author, Book where Book.author = Author.id group by Author.id order by Author.name",
            "sql": "SELECT $Author.name, COUNT($Book.id) FROM $Author, $Book WHERE $Book.author = $Author.id GROUP BY $Author.id ORDER BY $Author.name ASC"
        }
    ];
    testQueries(queries);
};

exports.testOffset = function() {
    let tree = Parser.parse("select Author from Author offset 10");
    let sqlBuf = [getExpectedSql("SELECT $Author.id FROM $Author")];
    store.dialect.addSqlOffset(sqlBuf, 10);

    let generated = generateSql(store, tree);
    assert.strictEqual(generated.sql, sqlBuf.join(""));
    // parameter value as offset
    tree = Parser.parse("select Author from Author offset :offset");
    sqlBuf = [getExpectedSql("SELECT $Author.id FROM $Author")];
    store.dialect.addSqlOffset(sqlBuf, "?");
    generated = generateSql(store, tree);
    assert.strictEqual(generated.sql, sqlBuf.join(""));
    assert.strictEqual(generated.params.length, 1);
    assert.strictEqual(generated.params[0], "offset");
};

exports.testLimit = function() {
    let tree = Parser.parse("select Author from Author limit 100");
    let sqlBuf = [getExpectedSql("SELECT $Author.id FROM $Author")];
    store.dialect.addSqlLimit(sqlBuf, 100);

    let generated = generateSql(store, tree);
    assert.strictEqual(generated.sql, sqlBuf.join(""));
    // parameter value as limit
    tree = Parser.parse("select Author from Author limit :limit");
    sqlBuf = [getExpectedSql("SELECT $Author.id FROM $Author")];
    store.dialect.addSqlLimit(sqlBuf, "?");
    generated = generateSql(store, tree);
    assert.strictEqual(generated.sql, sqlBuf.join(""));
    assert.strictEqual(generated.params.length, 1);
    assert.strictEqual(generated.params[0], "limit");
};

exports.testRange = function() {
    let tree = Parser.parse("select Author from Author offset 10 limit 100");
    let sqlBuf = [getExpectedSql("SELECT $Author.id FROM $Author")];
    store.dialect.addSqlRange(sqlBuf, 10, 100);

    let generated = generateSql(store, tree);
    assert.strictEqual(generated.sql, sqlBuf.join(""));
    // reverse offset/limit definition
    tree = Parser.parse("select Author from Author limit 100 offset 10");
    sqlBuf = [getExpectedSql("SELECT $Author.id FROM $Author")];
    store.dialect.addSqlRange(sqlBuf, 10, 100);
    generated = generateSql(store, tree);
    assert.strictEqual(generated.sql, sqlBuf.join(""));
    // parameter value as offset/limit
    tree = Parser.parse("select Author from Author offset :offset limit :limit");
    sqlBuf = [getExpectedSql("SELECT $Author.id FROM $Author")];
    store.dialect.addSqlRange(sqlBuf, "?", "?");
    generated = generateSql(store, tree);
    assert.strictEqual(generated.sql, sqlBuf.join(""));
    assert.strictEqual(generated.params.length, 2);
    assert.strictEqual(generated.params[0], "limit");
    assert.strictEqual(generated.params[1], "offset");
    tree = Parser.parse("select Author from Author limit :limit offset :offset");
    generated = generateSql(store, tree);
    assert.strictEqual(generated.sql, sqlBuf.join(""));
    assert.strictEqual(generated.params[0], "limit");
    assert.strictEqual(generated.params[1], "offset");
};

exports.testSelectModifier = function() {
    const mapping = Author.mapping;
    const idColumn = store.dialect.quote(mapping.getMapping("id").column);
    let tree = Parser.parse("select distinct a from Author as a");
    let expectedSql = getExpectedSql("SELECT DISTINCT a." + idColumn +
            " FROM $Author a");
    let {sql} = generateSql(store, tree);
    assert.strictEqual(sql, expectedSql);
    tree = Parser.parse("select all a from Author as a");
    expectedSql = getExpectedSql("SELECT ALL a." + idColumn +
            " FROM $Author a");
    sql = generateSql(store, tree).sql;
    assert.strictEqual(sql, expectedSql);
};

exports.testIssue32 = function() {
    const Notification = store.defineEntity("Notification", {"properties": {}});
    const query = "from Notification where Notification.id > :id";
    const expectedSql = getExpectedSql("SELECT $Notification.id FROM $Notification WHERE $Notification.id > ?");
    try {
        const tree = Parser.parse(query);
        const {sql} = generateSql(store, tree);
        assert.strictEqual(sql, expectedSql);
    } finally {
        utils.drop(store, Notification);
    }
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
