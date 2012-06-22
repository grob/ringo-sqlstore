var runner = require("../runner");
var assert = require("assert");

var Store = require("../../lib/sqlstore/store").Store;
var sqlUtils = require("../../lib/sqlstore/util");
var {Parser} = require("../../lib/sqlstore/query/parser");
var ast = require("../../lib/sqlstore/query/ast");
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

exports.testStringValue = function() {
    var rule = "value_string";
    var value = Parser.parse('"test"', rule);
    assert.isTrue(value instanceof ast.StringValue);
    assert.strictEqual(value.value, "test");
    // escaped string
    value = Parser.parse('"test \\"again\\""', rule);
    assert.isTrue(value instanceof ast.StringValue);
    assert.strictEqual(value.value, 'test \\"again\\"');
};

exports.testIntValue = function() {
    var rule = "value_int";
    var value = Parser.parse("123", rule);
    assert.isTrue(value instanceof ast.IntValue);
    assert.strictEqual(value.value, 123);
    assert.strictEqual(Parser.parse("10e3", rule).value, 10000);
    assert.strictEqual(Parser.parse("-10", rule).value, -10);
    assert.strictEqual(Parser.parse("+10", rule).value, 10);
};

exports.testDecimalValue = function() {
    var rule = "value_decimal";
    var value = Parser.parse("12.3", rule);
    assert.isTrue(value instanceof ast.DecimalValue);
    assert.strictEqual(value.value, 12.3);
    assert.strictEqual(Parser.parse("1.2e3", rule).value, 1200);
    assert.strictEqual(Parser.parse("-1.1", rule).value, -1.1);
    assert.strictEqual(Parser.parse("+1.1", rule).value, 1.1);
};

exports.testNumericValue = function() {
    var rule = "value_numeric";
    assert.isTrue(Parser.parse("123", rule) instanceof ast.IntValue);
    assert.isTrue(Parser.parse("12.3", rule) instanceof ast.DecimalValue);
};

exports.testNullValue = function() {
    var rule = "NULL";
    var value = Parser.parse("null", rule);
    assert.isTrue(value instanceof ast.NullValue);
    assert.strictEqual(value.value, null);
};

exports.testBooleanValue = function() {
    var rule = "boolean";
    var value = Parser.parse("true", rule);
    assert.isTrue(value instanceof ast.BooleanValue);
    assert.strictEqual(value.value, true);
    assert.strictEqual(Parser.parse("false", rule).value, false);
};

exports.testParameterValue = function() {
    var rule = "value_parameter";
    var value = Parser.parse(":name", rule);
    assert.isTrue(value instanceof ast.ParameterValue);
    assert.strictEqual(value.value, "name");
};

exports.testEntity = function() {
    var value = Parser.parse("User", "entity");
    assert.isTrue(value instanceof ast.Entity);
    assert.strictEqual(value.name, "User");
};

exports.testSelectIdent = function() {
    var rule = "selectIdent";
    var value = Parser.parse("User.id", rule);
    assert.strictEqual(value.entity, "User");
    assert.strictEqual(value.property, "id");
    value = Parser.parse("u.id", rule);
    assert.strictEqual(value.entity, "u");
    assert.strictEqual(value.property, "id");
};

exports.testSelectEntity = function() {
    var value = Parser.parse("User", "selectEntity");
    assert.isTrue(value instanceof ast.SelectEntity);
    assert.strictEqual(value.name, "User");
    assert.isFalse(value.loadAggressive);
    value = Parser.parse("User.*", "selectEntity");
    assert.isTrue(value.loadAggressive);
};

exports.testSelectAggregation = function() {
    var rule = "selectAggregation";
    for each (var type in ["max", "min", "sum", "count"]) {
        let value = Parser.parse(type + " ( User.id )", rule);
        assert.isTrue(value instanceof ast.SelectAggregation, "Aggregation " + type);
        assert.strictEqual(value.type, ast.SelectAggregation[type.toUpperCase()], "Aggregation " + type);
    }
};

exports.testSelectExpression = function() {
    var rule = "selectExpression";
    var value;
    // non-aliased ident
    value = Parser.parse("Author.id", rule);
    assert.isTrue(value instanceof ast.SelectIdent);
    // aliased ident
    value = Parser.parse("a.id", rule);
    assert.isTrue(value instanceof ast.SelectIdent);
    // result property name set
    value = Parser.parse("Author.id as authorId", rule);
    assert.isTrue(value instanceof ast.SelectIdent);
    assert.strictEqual(value.resultName, "authorId");
    value = Parser.parse("a.id as authorId", rule);
    assert.isTrue(value instanceof ast.SelectIdent);
    assert.strictEqual(value.resultName, "authorId");

    // non-aliased entity
    value = Parser.parse("Author", rule);
    assert.isTrue(value instanceof ast.SelectEntity);
    value = Parser.parse("Author.*", rule);
    assert.isTrue(value instanceof ast.SelectEntity);
    assert.isTrue(value.loadAggressive);
    // result property name set
    value = Parser.parse("Author as author", rule);
    assert.isTrue(value instanceof ast.SelectEntity);
    assert.strictEqual(value.resultName, "author");
    value = Parser.parse("Author.* as author", rule);
    assert.isTrue(value instanceof ast.SelectEntity);
    assert.strictEqual(value.resultName, "author");
    assert.isTrue(value.loadAggressive);

    // aliased entity
    value = Parser.parse("a", "selectExpression");
    assert.isTrue(value instanceof ast.SelectEntity);
    value = Parser.parse("a.*", "selectExpression");
    assert.isTrue(value instanceof ast.SelectEntity);
    assert.isTrue(value.loadAggressive);
    // result property name set
    value = Parser.parse("a as author", "selectExpression");
    assert.isTrue(value instanceof ast.SelectEntity);
    assert.strictEqual(value.resultName, "author");
    value = Parser.parse("a.* as author", "selectExpression");
    assert.isTrue(value instanceof ast.SelectEntity);
    assert.strictEqual(value.resultName, "author");
    assert.isTrue(value.loadAggressive);

    // aggregation
    value = Parser.parse("count(Author.id)", "selectExpression");
    assert.isTrue(value instanceof ast.SelectAggregation);
    value = Parser.parse("count(Author.id) as cnt", "selectExpression");
    assert.isTrue(value instanceof ast.SelectAggregation);
    assert.strictEqual(value.resultName, "cnt");
};

exports.testIdent = function() {
    var rule = "ident";
    var value = Parser.parse("User.id", rule);
    assert.strictEqual(value.entity, "User");
    assert.strictEqual(value.property, "id");
    // assert.strictEqual(Parser.parse("id", rule).entity, null);
};

exports.testComparisonOperators = function() {
    var rule = "compare";
    var operators = ["<>", "<=", ">=", "=", "<", ">", "!="];
    for each (let operator in operators) {
        assert.strictEqual(Parser.parse(operator, rule), operator);
    }
};

exports.testComparison = function() {
    var rule = "condition_rhs";
    var value = Parser.parse("= 1", rule);
    assert.isTrue(value instanceof ast.Comparison);
    assert.strictEqual(value.operator, "=");
    assert.isTrue(value.value instanceof ast.IntValue);
};

exports.testIsNullCondition = function() {
    var rule = "condition_rhs";
    var value = Parser.parse("is null", rule);
    assert.isTrue(value instanceof ast.IsNullCondition);
    assert.isFalse(value.isNot);
    // not null
    var value = Parser.parse("is not null", rule);
    assert.isTrue(value.isNot);
};

exports.testBetweenCondition = function() {
    var rule = "condition_rhs";
    var value = Parser.parse("between 1 and 10", rule);
    assert.isTrue(value instanceof ast.BetweenCondition);
    assert.isTrue(value.start instanceof ast.IntValue);
    assert.isTrue(value.end instanceof ast.IntValue);
};

exports.testInCondition = function() {
    var rule = "condition_rhs";
    var value = Parser.parse("in (1,2,3)", rule);
    assert.isTrue(value instanceof ast.InCondition);
    assert.strictEqual(value.values.length, 3);
    value.values.forEach(function(val) {
        assert.isTrue(val instanceof ast.IntValue);
    });
};

exports.testLikeCondition = function() {
    var rule = "condition_rhs";
    var value = Parser.parse("like '%test%'", rule);
    assert.isTrue(value instanceof ast.LikeCondition);
    assert.isFalse(value.isNot);
    assert.isTrue(value.value instanceof ast.StringValue);
    // not like
    value = Parser.parse("not like '%test%'", rule);
    assert.isTrue(value.isNot);
};

exports.testCondition = function() {
    var rule = "condition";
    var value = Parser.parse("User.id", rule);
    assert.isTrue(value instanceof ast.Condition);
    assert.isTrue(value.left instanceof ast.Ident);
    assert.strictEqual(value.right, null);
    value = Parser.parse("User.id > 10", rule);
    assert.isTrue(value.left instanceof ast.Ident);
    assert.isTrue(value.right instanceof ast.Comparison);
};

exports.testNotCondition  = function() {
    var rule = "condition";
    var value = Parser.parse("not Author.id = 1", rule);
    assert.isTrue(value instanceof ast.NotCondition);
    assert.isTrue(value.value instanceof ast.Condition);
};

exports.testExpression = function() {
    var rule = "expression";
    var value = Parser.parse("Author.id = 1", rule);
    assert.isTrue(value instanceof ast.Expression);
    assert.isNotNull(value.andConditions);
    assert.isTrue(value.andConditions instanceof ast.ConditionList);
    assert.strictEqual(value.andConditions.length, 1);
    assert.isNull(value.orConditions);
    value = Parser.parse("Author.id = 1 and Author.id = 2", rule);
    assert.strictEqual(value.andConditions.length, 2);
    value = Parser.parse("Author.id = 1 or Author.id = 2", rule);
    assert.strictEqual(value.andConditions.length, 1);
    assert.isTrue(value.orConditions instanceof ast.ConditionList);
    assert.strictEqual(value.orConditions.length, 1);
    value = Parser.parse("Author.id = 1 and (Author.id = 2 or Author.id = 3)", rule);
    assert.strictEqual(value.andConditions.length, 2);
    assert.isNull(value.orConditions);
    assert.isTrue(value.andConditions.conditions[1].left instanceof ast.Expression);
    assert.isNull(value.andConditions.conditions[1].right);
    assert.strictEqual(value.andConditions.conditions[1].left.andConditions.length, 1);
    assert.strictEqual(value.andConditions.conditions[1].left.orConditions.length, 1);
};

exports.testOrderBy = function() {
    var rule = "order";
    var value = Parser.parse("Author.id", rule);
    assert.isTrue(value instanceof ast.OrderBy);
    assert.isTrue(value.value instanceof ast.Ident);
    assert.isFalse(value.isReverse);
    assert.isFalse(Parser.parse("Author.id asc", rule).isReverse);
    assert.isTrue(Parser.parse("Author.id desc", rule).isReverse);
};

exports.testOrderByClause = function() {
    var rule = "orderByClause";
    var value = Parser.parse("order by Author.id", rule);
    assert.isTrue(value instanceof ast.OrderByClause);
    assert.strictEqual(value.list.length, 1);
    assert.isTrue(value.list[0] instanceof ast.OrderBy);
    value = Parser.parse("order by Author.id desc, Author.name asc", rule);
    assert.strictEqual(value.list.length, 2);
};

exports.testGroupByClause = function() {
    var rule = "groupByClause";
    var value = Parser.parse("group by Author.id", rule);
    assert.isTrue(value instanceof ast.GroupByClause);
    assert.strictEqual(value.list.length, 1);
    assert.isTrue(value.list[0] instanceof ast.Ident);
    value = Parser.parse("group by Author.id, Author.name", rule);
    assert.strictEqual(value.list.length, 2);
};

exports.testHavingClause = function() {
    var rule = "havingClause";
    var value = Parser.parse("having Author.id > 10", rule);
    assert.isTrue(value instanceof ast.HavingClause);
    assert.isTrue(value.value instanceof ast.Expression);
};

exports.testWhereClause = function() {
    var rule = "whereClause";
    var value = Parser.parse("where Author.id > 10", rule);
    assert.isTrue(value instanceof ast.WhereClause);
    assert.isTrue(value.value instanceof ast.Expression);
};

exports.testFromClause = function() {
    var rule = "fromClause";
    var value = Parser.parse("from Author", rule);
    assert.isTrue(value instanceof ast.FromClause);
    assert.isTrue(value.list[0] instanceof ast.Entity);
    assert.strictEqual(value.list.length, 1);
    value = Parser.parse("from Author, Book", rule);
    assert.strictEqual(value.list.length, 2);
    assert.isTrue(value.list[1] instanceof ast.Entity);
};

exports.testSelectClause = function() {
    var rule = "selectClause";
    var value = Parser.parse("User.id", rule);
    assert.isTrue(value instanceof ast.SelectClause);
    assert.strictEqual(value.list.length, 1);
    // multiple idents
    value = Parser.parse("User.id, User.name", rule);
    assert.strictEqual(value.list.length, 2);
    assert.isTrue(value.list[0] instanceof ast.SelectIdent);
    assert.isTrue(value.list[1] instanceof ast.SelectIdent);
    // multiple entities
    value = Parser.parse("Author, Book", rule);
    assert.strictEqual(value.list.length, 2);
    assert.isTrue(value.list[0] instanceof ast.SelectEntity);
    assert.isTrue(value.list[1] instanceof ast.SelectEntity);
    // multiple aggregations
    value = Parser.parse("count(Author.id), min(Book.id)", rule);
    assert.strictEqual(value.list.length, 2);
    assert.isTrue(value.list[0] instanceof ast.SelectAggregation);
    assert.isTrue(value.list[1] instanceof ast.SelectAggregation);
};

exports.testInnerJoin = function() {
    var rule = "innerJoin";
    var value = Parser.parse("inner join Book on Author.id = Book.author", rule);
    assert.isTrue(value instanceof ast.InnerJoin);
    assert.isTrue(value.entity instanceof ast.Entity);
    assert.isTrue(value.predicate instanceof ast.Expression);
    value = Parser.parse("inner join Book as b on Author.id = b.author", rule);
    assert.strictEqual(value.entity.alias, "b");
};

exports.testOuterJoin = function() {
    var rule = "outerJoin";
    var value = Parser.parse("left outer join Book on Author.id = Book.author", rule);
    assert.isTrue(value instanceof ast.OuterJoin);
    assert.strictEqual(value.side, "LEFT");
    assert.isTrue(value.entity instanceof ast.Entity);
    assert.isTrue(value.predicate instanceof ast.Expression);
};

exports.testRangeClause = function() {
    var rule = "rangeClause";
    var value = Parser.parse("limit 100", rule);
    assert.isTrue(value instanceof ast.RangeClause);
    assert.strictEqual(value.limit, 100);
    assert.strictEqual(value.offset, 0);
    value = Parser.parse("offset 10", rule);
    assert.isTrue(value instanceof ast.RangeClause);
    assert.strictEqual(value.limit, 0);
    assert.strictEqual(value.offset, 10);
    value = Parser.parse("offset 10 limit 100", rule);
    assert.strictEqual(value.offset, 10);
    assert.strictEqual(value.limit, 100);
    value = Parser.parse("limit 100 offset 10", rule);
    assert.strictEqual(value.offset, 10);
    assert.strictEqual(value.limit, 100);
};

/*
exports.testSelect = function() {
    assert.isTrue(Parser.parse("select Author from Author").isEntityQuery());
    assert.isTrue(Parser.parse("select Author.* from Author").isEntityQuery());
    assert.isTrue(Parser.parse("from Author").isEntityQuery());
    assert.isTrue(Parser.parse("from Author as author").isEntityQuery());
    assert.isFalse(Parser.parse("select Author.id from Author").isEntityQuery());
    assert.isFalse(Parser.parse("select Author, Book from Author, Book").isEntityQuery());
    assert.isFalse(Parser.parse("select Author, Book.title from Author, Book").isEntityQuery());
    assert.isTrue(Parser.parse("select author from Author as author").isEntityQuery());
    assert.isTrue(Parser.parse("select author.* from Author as author").isEntityQuery());
};
*/

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
