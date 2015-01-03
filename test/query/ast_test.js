var runner = require("../runner");
var assert = require("assert");
var system = require("system");

var {Parser} = require("../../lib/sqlstore/query/parser");
var ast = require("../../lib/sqlstore/query/ast");

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
    value = Parser.parse("User as u", "entity");
    assert.strictEqual(value.alias, "u");
};

exports.testSelectEntity = function() {
    var value = Parser.parse("User.*", "selectEntity");
    assert.isTrue(value instanceof ast.SelectEntity);
    assert.strictEqual(value.name, "User");
};

exports.testAggregation = function() {
    var rule = "aggregation";
    for each (var type in ["max", "min", "sum", "avg", "count"]) {
        let value = Parser.parse(type + " ( User.id )", rule);
        assert.isTrue(value instanceof ast.Aggregation, "Aggregation " + type);
        assert.strictEqual(value.type, type.toUpperCase(), "Aggregation " + type);
        value = Parser.parse(type + " (distinct User.id )", rule);
        assert.isTrue(value.isDistinct);
    }
};

exports.testSelectExpression = function() {
    var rule = "selectExpression";
    var value;
    // non-aliased ident
    value = Parser.parse("Author.id", rule);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.isTrue(value.expression instanceof ast.Ident);
    // aliased ident
    value = Parser.parse("a.id", rule);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.isTrue(value.expression instanceof ast.Ident);
    // result property name set
    value = Parser.parse("Author.id authorId", rule);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.isTrue(value.expression instanceof ast.Ident);
    assert.strictEqual(value.alias, "authorId");
    value = Parser.parse("Author.id as authorId", rule);
    assert.strictEqual(value.alias, "authorId");
    value = Parser.parse("a.id as authorId", rule);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.isTrue(value.expression instanceof ast.Ident);
    assert.strictEqual(value.alias, "authorId");

    // non-aliased entity
    value = Parser.parse("Author", rule);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.isTrue(value.expression instanceof ast.Ident);
    value = Parser.parse("Author.*", rule);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.isTrue(value.expression instanceof ast.SelectEntity);
    // result property name set
    value = Parser.parse("Author as author", rule);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.isTrue(value.expression instanceof ast.Ident);
    assert.strictEqual(value.alias, "author");
    value = Parser.parse("Author.* as author", rule);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.isTrue(value.expression instanceof ast.SelectEntity);
    assert.strictEqual(value.alias, "author");

    // aliased entity
    value = Parser.parse("a", rule);
    assert.isTrue(value instanceof ast.SelectExpression);
    value = Parser.parse("a.*", rule);
    assert.isTrue(value instanceof ast.SelectExpression);
    // result property name set
    value = Parser.parse("a as author", rule);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.strictEqual(value.alias, "author");
    value = Parser.parse("a.* as author", rule);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.strictEqual(value.alias, "author");

    // aggregation
    value = Parser.parse("count(Author.id)", rule);
    assert.isTrue(value instanceof ast.SelectExpression);
    value = Parser.parse("count(Author.id) as cnt", rule);
    assert.isTrue(value instanceof ast.SelectExpression);
    assert.strictEqual(value.alias, "cnt");

    // summand
    value = Parser.parse("Author.id - 2", rule);
    assert.isTrue(value.expression instanceof ast.Summand);
    value = Parser.parse("Author.id - (Author.id / 2)", rule);
    assert.isTrue(value.expression instanceof ast.Summand);
    assert.isTrue(value.expression.right instanceof ast.Expression);
    value = Parser.parse("max(Author.id) - min(Author.id)", rule)
    assert.isTrue(value.expression instanceof ast.Summand);
    assert.isTrue(value.expression.left instanceof ast.Aggregation);
    assert.isTrue(value.expression.right instanceof ast.Aggregation);
    value = Parser.parse("max(Author.id) - min(Author.id) as test", rule)
    assert.strictEqual(value.alias, "test");

    // factor
    value = Parser.parse("Author.id / 2", rule);
    assert.isTrue(value.expression instanceof ast.Factor);
    value = Parser.parse("Author.id / 2 as test", rule);
    assert.strictEqual(value.alias, "test");

    // operand
    value = Parser.parse("'Author#' || Author.id as key", rule);
    assert.isTrue(value.expression instanceof ast.Operand);
    assert.strictEqual(value.expression.summands.length, 2);
    assert.isTrue(value.expression.summands[0] instanceof ast.StringValue);
    assert.isTrue(value.expression.summands[1] instanceof ast.Ident);
    assert.strictEqual(value.alias, "key");
};

exports.testIdent = function() {
    var rule = "ident";
    var value = Parser.parse("User.id", rule);
    assert.strictEqual(value.entity, "User");
    assert.strictEqual(value.property, "id");
    // TODO: assert.strictEqual(Parser.parse("id", rule).entity, null);
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
    assert.isFalse(value.isNot);
    value = Parser.parse("not between 1 and 10", rule);
    assert.isTrue(value instanceof ast.BetweenCondition);
    assert.isTrue(value.isNot);
};

exports.testInCondition = function() {
    var rule = "condition_rhs";
    var value = Parser.parse("in (1,2,3)", rule);
    assert.isTrue(value instanceof ast.InCondition);
    assert.strictEqual(value.values.length, 3);
    assert.isFalse(value.isNot);
    value.values.forEach(function(val) {
        assert.isTrue(val instanceof ast.IntValue);
    });
    value = Parser.parse("not in (1,2,3)", rule);
    assert.isTrue(value instanceof ast.InCondition);
    assert.isTrue(value.isNot);
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
    assert.isNull(value.andConditions);
    assert.isTrue(value.orConditions instanceof ast.ConditionList);
    assert.strictEqual(value.orConditions.length, 2);
    value = Parser.parse("Author.id = 1 and (Author.id = 2 or Author.id = 3 or Author.id = 4)", rule);
    assert.strictEqual(value.andConditions.length, 2);
    assert.isNull(value.orConditions);
    var conditionList = value.andConditions.conditions;
    assert.isTrue(conditionList[0] instanceof ast.Condition);
    assert.isTrue(conditionList[1] instanceof ast.Condition);
    assert.isTrue(conditionList[1].left instanceof ast.Expression);
    assert.isNull(conditionList[1].right);
    var expression = conditionList[1].left;
    assert.isNull(expression.andConditions);
    assert.isTrue(expression.orConditions instanceof ast.ConditionList);
    assert.strictEqual(expression.orConditions.length, 3);

    // summands
    value = Parser.parse("Author.id - 2", rule);
    assert.isTrue(value.andConditions.conditions[0].left instanceof ast.Summand);
    assert.isTrue(value.andConditions.conditions[0].left.left instanceof ast.Ident);
    assert.strictEqual(value.andConditions.conditions[0].left.operand, "-");
    assert.isTrue(value.andConditions.conditions[0].left.right instanceof ast.Value);

    // factors
    value = Parser.parse("Author.id / 2", rule);
    assert.isTrue(value.andConditions.conditions[0].left.left instanceof ast.Ident);
    assert.strictEqual(value.andConditions.conditions[0].left.operand, "/");
    assert.isTrue(value.andConditions.conditions[0].left.right instanceof ast.Value);
};

exports.testOrderBy = function() {
    var rule = "order";
    var value = Parser.parse("Author.id", rule);
    assert.isTrue(value instanceof ast.OrderBy);
    assert.isTrue(value.value instanceof ast.Expression);
    Parser.parse("min(Author.id)", rule);
    Parser.parse("Author.id % 2");
    Parser.parse("Author.a + Author.b");
    Parser.parse("(Author.id % 2) + 1");
    assert.isFalse(value.isReverse);
    assert.isFalse(Parser.parse("Author.id asc", rule).isReverse);
    assert.isTrue(Parser.parse("Author.id desc", rule).isReverse);
    assert.isNull(value.nulls);
    assert.strictEqual(Parser.parse("Author.id nulls first", rule).nulls, -1);
    assert.strictEqual(Parser.parse("Author.id asc nulls first", rule).nulls, -1);
    assert.strictEqual(Parser.parse("Author.id nulls last", rule).nulls, 1);
    assert.strictEqual(Parser.parse("Author.id desc nulls last", rule).nulls, 1);
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
    assert.strictEqual(value.value.andConditions.length, 1);
    var condition = value.value.andConditions.conditions[0];
    assert.isTrue(condition.left instanceof ast.Ident);
    assert.isTrue(condition.right instanceof ast.Comparison);
    value = Parser.parse("having max(Author.id) > 10", rule);
    condition = value.value.andConditions.conditions[0];
    assert.isTrue(condition.left instanceof ast.Aggregation);
    assert.strictEqual(condition.left.type, "MAX");
    // multiple having conditions
    value = Parser.parse("having max(Author.id) > 10 and min(Author.id) < 20", rule);
    assert.strictEqual(value.value.andConditions.length, 2);
    for each (let condition in value.value.andConditions.conditions) {
        assert.isTrue(condition.left instanceof ast.Aggregation);
    }
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
    assert.isTrue(value.list[0] instanceof ast.SelectExpression);
    assert.isTrue(value.list[1] instanceof ast.SelectExpression);
    // multiple entities
    value = Parser.parse("Author, Book", rule);
    assert.strictEqual(value.list.length, 2);
    assert.isTrue(value.list[0] instanceof ast.SelectExpression);
    assert.isTrue(value.list[1] instanceof ast.SelectExpression);
    // multiple aggregations
    value = Parser.parse("count(Author.id), min(Book.id)", rule);
    assert.strictEqual(value.list.length, 2);
    assert.isTrue(value.list[0].expression instanceof ast.Aggregation);
    assert.isTrue(value.list[1].expression instanceof ast.Aggregation);
};

exports.testJoinClause = function() {
    var rule = "joinClause";
    var value = Parser.parse("join Book on Author.id = Book.author", rule);
    assert.isTrue(value instanceof ast.JoinClause);
    assert.strictEqual(value.length, 1);
    assert.isTrue(value.get(0) instanceof ast.InnerJoin);
    // multiple joins
    value = Parser.parse("join Book on Author.id = Book.author join Store on Book.store = Store.id", rule);
    assert.strictEqual(value.length, 2);
};

exports.testInnerJoin = function() {
    var rule = "innerJoin";
    var value = Parser.parse("inner join Book on Author.id = Book.author", rule);
    assert.isTrue(value instanceof ast.InnerJoin);
    assert.isTrue(value.entity instanceof ast.Entity);
    assert.isTrue(value.predicate instanceof ast.Expression);
    value = Parser.parse("join Book on Author.id = Book.author", rule);
    assert.isTrue(value instanceof ast.InnerJoin);
    // with parenthesis
    value = Parser.parse("inner join Book on (Author.id = Book.author)", rule);
    assert.isTrue(value instanceof ast.InnerJoin);
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
    value = Parser.parse("left join Book on Author.id = Book.author", rule);
    assert.isTrue(value instanceof ast.OuterJoin);
};

exports.testRangeClause = function() {
    var rule = "rangeClause";
    var value = Parser.parse("limit 100", rule);
    assert.isTrue(value instanceof ast.RangeClause);
    assert.strictEqual(value.limit, 100);
    assert.strictEqual(value.offset, 0);
    value = Parser.parse("limit :limit", rule);
    assert.isTrue(value.limit instanceof ast.ParameterValue);
    assert.strictEqual(value.limit.value, "limit");
    value = Parser.parse("offset 10", rule);
    assert.isTrue(value instanceof ast.RangeClause);
    assert.strictEqual(value.limit, 0);
    assert.strictEqual(value.offset, 10);
    value = Parser.parse("offset :offset", rule);
    assert.isTrue(value.offset instanceof ast.ParameterValue);
    assert.strictEqual(value.offset.value, "offset");
    value = Parser.parse("offset 10 limit 100", rule);
    assert.strictEqual(value.offset, 10);
    assert.strictEqual(value.limit, 100);
    value = Parser.parse("limit 100 offset 10", rule);
    assert.strictEqual(value.offset, 10);
    assert.strictEqual(value.limit, 100);
    // parameter values for offset and limit are allowed too
};

exports.testDistinct = function() {
    var value = Parser.parse("select distinct a from Author as a");
    assert.isTrue(value instanceof ast.Select);
    assert.isTrue(value.isDistinct);
};

exports.testAllSome = function() {
    var rule = "condition";
    var value = Parser.parse("Author.salary > all(select avg(Author.salary) from Author)", rule);
    assert.isTrue(value.left instanceof ast.Ident);
    assert.isTrue(value.right instanceof ast.Comparison);
    assert.isTrue(value.right.value instanceof ast.AllSome);
    assert.strictEqual(value.right.value.range, "ALL");
    assert.isTrue(value.right.value.select instanceof ast.Select);
}

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(runner.run(exports, arguments));
}
