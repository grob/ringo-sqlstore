const runner = require("../runner");
const assert = require("assert");
const system = require("system");

const Parser = require("../../lib/query/parser");
const ast = require("../../lib/query/ast");

exports.testStringValue = function() {
    const options = {"startRule": "value_string"};
    let value = Parser.parse('"test"', options);
    assert.isTrue(value instanceof ast.StringValue);
    assert.strictEqual(value.value, "test");
    // escaped string
    value = Parser.parse('"test \\"again\\""', options);
    assert.isTrue(value instanceof ast.StringValue);
    assert.strictEqual(value.value, 'test \\"again\\"');
};

exports.testIntValue = function() {
    const options = {"startRule": "value_int"};
    const value = Parser.parse("123", options);
    assert.isTrue(value instanceof ast.IntValue);
    assert.strictEqual(value.value, 123);
    assert.strictEqual(Parser.parse("10e3", options).value, 10000);
    assert.strictEqual(Parser.parse("-10", options).value, -10);
    assert.strictEqual(Parser.parse("+10", options).value, 10);
};

exports.testDecimalValue = function() {
    const options = {"startRule": "value_decimal"};
    const value = Parser.parse("12.3", options);
    assert.isTrue(value instanceof ast.DecimalValue);
    assert.strictEqual(value.value, 12.3);
    assert.strictEqual(Parser.parse("1.2e3", options).value, 1200);
    assert.strictEqual(Parser.parse("-1.1", options).value, -1.1);
    assert.strictEqual(Parser.parse("+1.1", options).value, 1.1);
};

exports.testNumericValue = function() {
    const options = {"startRule": "value_numeric"};
    assert.isTrue(Parser.parse("123", options) instanceof ast.IntValue);
    assert.isTrue(Parser.parse("12.3", options) instanceof ast.DecimalValue);
};

exports.testNullValue = function() {
    const options = {"startRule": "NULL"};
    const value = Parser.parse("null", options);
    assert.isTrue(value instanceof ast.NullValue);
    assert.strictEqual(value.value, null);
};

exports.testBooleanValue = function() {
    const options = {"startRule": "boolean"};
    const value = Parser.parse("true", options);
    assert.isTrue(value instanceof ast.BooleanValue);
    assert.strictEqual(value.value, true);
    assert.strictEqual(Parser.parse("false", options).value, false);
};

exports.testParameterValue = function() {
    const options = {"startRule": "value_parameter"};
    const value = Parser.parse(":name", options);
    assert.isTrue(value instanceof ast.ParameterValue);
    assert.strictEqual(value.value, "name");
};

exports.testEntity = function() {
    const options = {"startRule": "entity"};
    let value = Parser.parse("User", options);
    assert.isTrue(value instanceof ast.Entity);
    assert.strictEqual(value.name, "User");
    value = Parser.parse("User as u", options);
    assert.strictEqual(value.alias, "u");
};

exports.testSelectEntity = function() {
    const options = {"startRule": "selectEntity"};
    const value = Parser.parse("User.*", options);
    assert.isTrue(value instanceof ast.SelectEntity);
    assert.strictEqual(value.name, "User");
};

exports.testAggregation = function() {
    const options = {"startRule": "aggregation"};
    ["max", "min", "sum", "avg", "count"].forEach(function(type) {
        let value = Parser.parse(type + " ( User.id )", options);
        assert.isTrue(value instanceof ast.Aggregation, "Aggregation " + type);
        assert.strictEqual(value.type, type.toUpperCase(), "Aggregation " + type);
        value = Parser.parse(type + " (distinct User.id )", options);
        assert.strictEqual(value.distinct, "DISTINCT");
    });
};

exports.testSelectExpression = function() {
    const options = {"startRule": "selectExpression"};
    let value;
    // non-aliased ident
    value = Parser.parse("Author.id", options);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.isTrue(value.expression instanceof ast.Ident);
    // aliased ident
    value = Parser.parse("a.id", options);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.isTrue(value.expression instanceof ast.Ident);
    // result property name set
    value = Parser.parse("Author.id authorId", options);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.isTrue(value.expression instanceof ast.Ident);
    assert.strictEqual(value.alias, "authorId");
    value = Parser.parse("Author.id as authorId", options);
    assert.strictEqual(value.alias, "authorId");
    value = Parser.parse("a.id as authorId", options);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.isTrue(value.expression instanceof ast.Ident);
    assert.strictEqual(value.alias, "authorId");

    // non-aliased entity
    value = Parser.parse("Author", options);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.isTrue(value.expression instanceof ast.Ident);
    value = Parser.parse("Author.*", options);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.isTrue(value.expression instanceof ast.SelectEntity);
    // result property name set
    value = Parser.parse("Author as author", options);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.isTrue(value.expression instanceof ast.Ident);
    assert.strictEqual(value.alias, "author");
    value = Parser.parse("Author.* as author", options);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.isTrue(value.expression instanceof ast.SelectEntity);
    assert.strictEqual(value.alias, "author");

    // aliased entity
    value = Parser.parse("a", options);
    assert.isTrue(value instanceof ast.SelectExpression);
    value = Parser.parse("a.*", options);
    assert.isTrue(value instanceof ast.SelectExpression);
    // result property name set
    value = Parser.parse("a as author", options);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.strictEqual(value.alias, "author");
    value = Parser.parse("a.* as author", options);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.strictEqual(value.alias, "author");

    // aggregation
    value = Parser.parse("count(Author.id)", options);
    assert.isTrue(value instanceof ast.SelectExpression);
    value = Parser.parse("count(Author.id) as cnt", options);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.strictEqual(value.alias, "cnt");

    // summand
    value = Parser.parse("Author.id - 2", options);
    assert.isTrue(value.expression instanceof ast.Summand);
    value = Parser.parse("Author.id - (Author.id / 2)", options);
    assert.isTrue(value.expression instanceof ast.Summand);
    assert.isTrue(value.expression.right instanceof ast.Expression);
    value = Parser.parse("max(Author.id) - min(Author.id)", options);
    assert.isTrue(value.expression instanceof ast.Summand);
    assert.isTrue(value.expression.left instanceof ast.Aggregation);
    assert.isTrue(value.expression.right instanceof ast.Aggregation);
    value = Parser.parse("max(Author.id) - min(Author.id) as test", options);
    assert.strictEqual(value.alias, "test");

    // factor
    value = Parser.parse("Author.id / 2", options);
    assert.isTrue(value.expression instanceof ast.Factor);
    value = Parser.parse("Author.id / 2 as test", options);
    assert.strictEqual(value.alias, "test");

    // operand
    value = Parser.parse("'Author#' || Author.id as key", options);
    assert.isTrue(value.expression instanceof ast.Operand);
    assert.strictEqual(value.expression.summands.length, 2);
    assert.isTrue(value.expression.summands[0] instanceof ast.StringValue);
    assert.isTrue(value.expression.summands[1] instanceof ast.Ident);
    assert.strictEqual(value.alias, "key");
};

exports.testIdent = function() {
    const options = {"startRule": "ident"};
    const value = Parser.parse("User.id", options);
    assert.strictEqual(value.entity, "User");
    assert.strictEqual(value.property, "id");
    // TODO: assert.strictEqual(Parser.parse("id", options).entity, null);
};

exports.testComparisonOperators = function() {
    const options = {"startRule": "compare"};
    ["<>", "<=", ">=", "=", "<", ">", "!="].forEach(function(operator) {
        assert.strictEqual(Parser.parse(operator, options), operator);
    });
};

exports.testComparison = function() {
    const options = {"startRule": "condition_rhs"};
    const value = Parser.parse("= 1", options);
    assert.isTrue(value instanceof ast.Comparison);
    assert.strictEqual(value.operator, "=");
    assert.isTrue(value.value instanceof ast.IntValue);
};

exports.testIsNullCondition = function() {
    const options = {"startRule": "condition_rhs"};
    let value = Parser.parse("is null", options);
    assert.isTrue(value instanceof ast.IsNullCondition);
    assert.isFalse(value.isNot);
    // not null
    value = Parser.parse("is not null", options);
    assert.isTrue(value.isNot);
};

exports.testBetweenCondition = function() {
    const options = {"startRule": "condition_rhs"};
    let value = Parser.parse("between 1 and 10", options);
    assert.isTrue(value instanceof ast.BetweenCondition);
    assert.isTrue(value.start instanceof ast.IntValue);
    assert.isTrue(value.end instanceof ast.IntValue);
    assert.isFalse(value.isNot);
    value = Parser.parse("not between 1 and 10", options);
    assert.isTrue(value instanceof ast.BetweenCondition);
    assert.isTrue(value.isNot);
};

exports.testInCondition = function() {
    const options = {"startRule": "condition_rhs"};
    let value = Parser.parse("in (1,2,3)", options);
    assert.isTrue(value instanceof ast.InCondition);
    assert.strictEqual(value.values.length, 3);
    assert.isFalse(value.isNot);
    value.values.forEach(function(val, idx) {
        assert.isTrue(val instanceof ast.Expression);
        assert.strictEqual(val.andConditions.conditions.length, 1);
        let condition = val.andConditions.conditions[0];
        assert.isTrue(condition.left instanceof ast.IntValue);
        assert.strictEqual(condition.left.value, idx + 1);
    });
    value = Parser.parse("not in (1,2,3)", options);
    assert.isTrue(value instanceof ast.InCondition);
    assert.isTrue(value.isNot);
};

exports.testInConditionExpression = function() {
    const options = {"startRule": "condition_rhs"};
    const value = Parser.parse("in (1 + 2)", options);
    assert.strictEqual(value.values.length, 1);
    assert.isFalse(value.isNot);
    value.values.forEach(function(val, idx) {
        assert.isTrue(val instanceof ast.Expression);
        assert.strictEqual(val.andConditions.conditions.length, 1);
        let condition = val.andConditions.conditions[0];
        assert.isTrue(condition.left instanceof ast.Summand);
        assert.strictEqual(condition.left.left.value, 1);
        assert.strictEqual(condition.left.operand, "+");
        assert.strictEqual(condition.left.right.value, 2);
    });
};

exports.testLikeCondition = function() {
    const options = {"startRule": "condition_rhs"};
    let value = Parser.parse("like '%test%'", options);
    assert.isTrue(value instanceof ast.LikeCondition);
    assert.isFalse(value.isNot);
    assert.isTrue(value.value instanceof ast.StringValue);
    // not like
    value = Parser.parse("not like '%test%'", options);
    assert.isTrue(value.isNot);
};

exports.testCondition = function() {
    const options = {"startRule": "condition"};
    let value = Parser.parse("User.id", options);
    assert.isTrue(value instanceof ast.Condition);
    assert.isTrue(value.left instanceof ast.Ident);
    assert.strictEqual(value.right, null);
    value = Parser.parse("User.id > 10", options);
    assert.isTrue(value.left instanceof ast.Ident);
    assert.isTrue(value.right instanceof ast.Comparison);
};

exports.testNotCondition  = function() {
    const options = {"startRule": "condition"};
    const value = Parser.parse("not Author.id = 1", options);
    assert.isTrue(value instanceof ast.NotCondition);
    assert.isTrue(value.value instanceof ast.Condition);
};

exports.testExpression = function() {
    const options = {"startRule": "expression"};
    let value = Parser.parse("Author.id = 1", options);
    assert.isTrue(value instanceof ast.Expression);
    assert.isNotNull(value.andConditions);
    assert.isTrue(value.andConditions instanceof ast.ConditionList);
    assert.strictEqual(value.andConditions.conditions.length, 1);
    assert.isNull(value.orConditions);
    value = Parser.parse("Author.id = 1 and Author.id = 2", options);
    assert.strictEqual(value.andConditions.conditions.length, 2);
    value = Parser.parse("Author.id = 1 or Author.id = 2", options);
    assert.isNull(value.andConditions);
    assert.isTrue(value.orConditions instanceof ast.ConditionList);
    assert.strictEqual(value.orConditions.conditions.length, 2);
    value = Parser.parse("Author.id = 1 and (Author.id = 2 or Author.id = 3 or Author.id = 4)", options);
    assert.strictEqual(value.andConditions.conditions.length, 2);
    assert.isNull(value.orConditions);
    const conditionList = value.andConditions.conditions;
    assert.isTrue(conditionList[0] instanceof ast.Condition);
    assert.isTrue(conditionList[1] instanceof ast.Condition);
    assert.isTrue(conditionList[1].left instanceof ast.Expression);
    assert.isNull(conditionList[1].right);
    const expression = conditionList[1].left;
    assert.isNull(expression.andConditions);
    assert.isTrue(expression.orConditions instanceof ast.ConditionList);
    assert.strictEqual(expression.orConditions.conditions.length, 3);

    // summands
    value = Parser.parse("Author.id - 2", options);
    assert.isTrue(value.andConditions.conditions[0].left instanceof ast.Summand);
    assert.isTrue(value.andConditions.conditions[0].left.left instanceof ast.Ident);
    assert.strictEqual(value.andConditions.conditions[0].left.operand, "-");
    assert.isTrue(value.andConditions.conditions[0].left.right instanceof ast.Value);

    // factors
    value = Parser.parse("Author.id / 2", options);
    assert.isTrue(value.andConditions.conditions[0].left.left instanceof ast.Ident);
    assert.strictEqual(value.andConditions.conditions[0].left.operand, "/");
    assert.isTrue(value.andConditions.conditions[0].left.right instanceof ast.Value);
};

exports.testOrderBy = function() {
    const options = {"startRule": "order"};
    let value = Parser.parse("Author.id", options);
    assert.isTrue(value instanceof ast.OrderBy);
    assert.isTrue(value.value instanceof ast.Expression);
    Parser.parse("min(Author.id)", options);
    Parser.parse("Author.id % 2");
    Parser.parse("Author.a + Author.b");
    Parser.parse("(Author.id % 2) + 1");
    assert.isFalse(value.isReverse);
    assert.isFalse(Parser.parse("Author.id asc", options).isReverse);
    assert.isTrue(Parser.parse("Author.id desc", options).isReverse);
    assert.isNull(value.nulls);
    assert.strictEqual(Parser.parse("Author.id nulls first", options).nulls, -1);
    assert.strictEqual(Parser.parse("Author.id asc nulls first", options).nulls, -1);
    assert.strictEqual(Parser.parse("Author.id nulls last", options).nulls, 1);
    assert.strictEqual(Parser.parse("Author.id desc nulls last", options).nulls, 1);
};

exports.testOrderByClause = function() {
    const options = {"startRule": "orderByClause"};
    let value = Parser.parse("order by Author.id", options);
    assert.isTrue(value instanceof ast.OrderByClause);
    assert.strictEqual(value.list.length, 1);
    assert.isTrue(value.list[0] instanceof ast.OrderBy);
    value = Parser.parse("order by Author.id desc, Author.name asc", options);
    assert.strictEqual(value.list.length, 2);
};

exports.testGroupByClause = function() {
    const options = {"startRule": "groupByClause"};
    let value = Parser.parse("group by Author.id", options);
    assert.isTrue(value instanceof ast.GroupByClause);
    assert.strictEqual(value.list.length, 1);
    assert.isTrue(value.list[0] instanceof ast.Ident);
    value = Parser.parse("group by Author.id, Author.name", options);
    assert.strictEqual(value.list.length, 2);
};

exports.testHavingClause = function() {
    const options = {"startRule": "havingClause"};
    let value = Parser.parse("having Author.id > 10", options);
    assert.isTrue(value instanceof ast.HavingClause);
    assert.isTrue(value.value instanceof ast.Expression);
    assert.strictEqual(value.value.andConditions.conditions.length, 1);
    let condition = value.value.andConditions.conditions[0];
    assert.isTrue(condition.left instanceof ast.Ident);
    assert.isTrue(condition.right instanceof ast.Comparison);
    value = Parser.parse("having max(Author.id) > 10", options);
    condition = value.value.andConditions.conditions[0];
    assert.isTrue(condition.left instanceof ast.Aggregation);
    assert.strictEqual(condition.left.type, "MAX");
    // multiple having conditions
    value = Parser.parse("having max(Author.id) > 10 and min(Author.id) < 20", options);
    assert.strictEqual(value.value.andConditions.conditions.length, 2);
    value.value.andConditions.conditions.forEach(function(condition) {
        assert.isTrue(condition.left instanceof ast.Aggregation);
    });
};

exports.testWhereClause = function() {
    const options = {"startRule": "whereClause"};
    const value = Parser.parse("where Author.id > 10", options);
    assert.isTrue(value instanceof ast.WhereClause);
    assert.isTrue(value.value instanceof ast.Expression);
};

exports.testFromClause = function() {
    const options = {"startRule": "fromClause"};
    let value = Parser.parse("from Author", options);
    assert.isTrue(value instanceof ast.FromClause);
    assert.isTrue(value.list[0] instanceof ast.Entity);
    assert.strictEqual(value.list.length, 1);
    value = Parser.parse("from Author, Book", options);
    assert.strictEqual(value.list.length, 2);
    assert.isTrue(value.list[1] instanceof ast.Entity);
};

exports.testSelectClause = function() {
    const options = {"startRule": "selectClause"};
    let value = Parser.parse("select User.id", options);
    assert.isTrue(value instanceof ast.SelectClause);
    assert.strictEqual(value.list.length, 1);
    // multiple idents
    value = Parser.parse("select User.id, User.name", options);
    assert.strictEqual(value.list.length, 2);
    assert.isTrue(value.list[0] instanceof ast.SelectExpression);
    assert.isTrue(value.list[1] instanceof ast.SelectExpression);
    // multiple entities
    value = Parser.parse("select Author, Book", options);
    assert.strictEqual(value.list.length, 2);
    assert.isTrue(value.list[0] instanceof ast.SelectExpression);
    assert.isTrue(value.list[1] instanceof ast.SelectExpression);
    // multiple aggregations
    value = Parser.parse("select count(Author.id), min(Book.id)", options);
    assert.strictEqual(value.list.length, 2);
    assert.isTrue(value.list[0].expression instanceof ast.Aggregation);
    assert.isTrue(value.list[1].expression instanceof ast.Aggregation);
};

exports.testJoinClause = function() {
    const options = {"startRule": "joinClause"};
    let value = Parser.parse("join Book on Author.id = Book.author", options);
    assert.isTrue(value instanceof ast.JoinClause);
    assert.strictEqual(value.list.length, 1);
    assert.isTrue(value.list[0] instanceof ast.InnerJoin);
    // multiple joins
    value = Parser.parse("join Book on Author.id = Book.author join Store on Book.store = Store.id", options);
    assert.strictEqual(value.list.length, 2);
};

exports.testInnerJoin = function() {
    const options = {"startRule": "innerJoin"};
    let value = Parser.parse("inner join Book on Author.id = Book.author", options);
    assert.isTrue(value instanceof ast.InnerJoin);
    assert.isTrue(value.entity instanceof ast.Entity);
    assert.isTrue(value.predicate instanceof ast.Expression);
    value = Parser.parse("join Book on Author.id = Book.author", options);
    assert.isTrue(value instanceof ast.InnerJoin);
    // with parenthesis
    value = Parser.parse("inner join Book on (Author.id = Book.author)", options);
    assert.isTrue(value instanceof ast.InnerJoin);
    value = Parser.parse("inner join Book as b on Author.id = b.author", options);
    assert.strictEqual(value.entity.alias, "b");
};

exports.testOuterJoin = function() {
    const options = {"startRule": "outerJoin"};
    let value = Parser.parse("left outer join Book on Author.id = Book.author", options);
    assert.isTrue(value instanceof ast.OuterJoin);
    assert.strictEqual(value.side, "LEFT");
    assert.isTrue(value.entity instanceof ast.Entity);
    assert.isTrue(value.predicate instanceof ast.Expression);
    value = Parser.parse("left join Book on Author.id = Book.author", options);
    assert.isTrue(value instanceof ast.OuterJoin);
};

exports.testRangeClause = function() {
    const options = {"startRule": "rangeClause"};
    let value = Parser.parse("limit 100", options);
    assert.isTrue(value instanceof ast.RangeClause);
    assert.strictEqual(value.limit, 100);
    assert.strictEqual(value.offset, 0);
    value = Parser.parse("limit :limit", options);
    assert.isTrue(value.limit instanceof ast.ParameterValue);
    assert.strictEqual(value.limit.value, "limit");
    value = Parser.parse("offset 10", options);
    assert.isTrue(value instanceof ast.RangeClause);
    assert.strictEqual(value.limit, 0);
    assert.strictEqual(value.offset, 10);
    value = Parser.parse("offset :offset", options);
    assert.isTrue(value.offset instanceof ast.ParameterValue);
    assert.strictEqual(value.offset.value, "offset");
    value = Parser.parse("offset 10 limit 100", options);
    assert.strictEqual(value.offset, 10);
    assert.strictEqual(value.limit, 100);
    value = Parser.parse("limit 100 offset 10", options);
    assert.strictEqual(value.offset, 10);
    assert.strictEqual(value.limit, 100);
    // parameter values for offset and limit are allowed too
};

exports.testModifier = function() {
    const options = {"startRule": "selectClause"};
    ["distinct", "all"].forEach(function(modifier) {
        let value = Parser.parse("select " + modifier + " a", options);
        assert.isTrue(value instanceof ast.SelectClause);
        assert.strictEqual(value.modifier, modifier.toUpperCase());
    });
};

exports.testSubSelect = function() {
    const options = {"startRule": "condition"};
    const value = Parser.parse("Author.salary > all(select avg(Author.salary) from Author)", options);
    assert.isTrue(value.left instanceof ast.Ident);
    assert.isTrue(value.right instanceof ast.Comparison);
    assert.isTrue(value.right.value instanceof ast.SubSelect);
    assert.strictEqual(value.right.value.range, "ALL");
    assert.isTrue(value.right.value.select instanceof ast.Select);
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
