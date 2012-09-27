{

    // NOTE: whenever the parser is regenerated, manually place the following
    // on top of the parser.js module:
    //
    // var ast = require("./ast");
    //
    // (see https://github.com/grob/ringo-sqlstore/commit/fc0e0bdfd245)

    var aliases = {};

    var toArray = function(head, tail) {
        if (!(head instanceof Array)) {
            head = [head];
        }
        if (tail.length > 0) {
            return head.concat(tail.map(function(part) {
                return part[1];
            }));
        }
        return head;
    }

}

// START
start =
    select / expression

select =
    selectFull / selectShort

selectFull =
    SELECT d:DISTINCT? sc:selectClause fc:fromClause jc:joinClause? wc:whereClause? gc:groupByClause? hc:havingClause? oc:orderByClause? rc:rangeClause? {
        return new ast.Select(aliases, sc, fc, jc || null, wc || null, gc || null, hc || null, oc || null, rc || null, d === true);
    }

selectShort =
    fc:fromClause jc:joinClause? wc:whereClause? gc:groupByClause? hc:havingClause? oc:orderByClause? rc:rangeClause? {
        var selectEntities = fc.list.map(function(entity) {
            var ident = new ast.Ident(entity.alias || entity.name);
            return new ast.SelectExpression(ident, null);
        });
        var sc = new ast.SelectClause(selectEntities);
        return new ast.Select(aliases, sc, fc, jc || null, wc || null, gc || null, hc || null, oc || null, rc || null, false);
    }

selectClause =
    head:selectExpression tail:( comma selectExpression )* {
        return new ast.SelectClause(toArray(head, tail));
    }

selectExpression =
    expression:(selectEntity / summand) alias:alias? ws {
        return new ast.SelectExpression(expression, alias || null);
    }

selectEntity =
    entity:name dot star ws {
        return new ast.SelectEntity(entity, true);
    }

aggregation =
    type:(MAX / MIN / SUM / COUNT) LPAREN d:DISTINCT? ident:ident RPAREN {
        return new ast.Aggregation(ast.Aggregation[type], ident, d === true);
    }

// FIXME: is this really the only way to not use a reserved word as an alias?
alias =
    AS? alias:(& (FROM / INNER / OUTER / LEFT / RIGHT / JOIN / ON / WHERE / GROUP / HAVING / ORDER / OFFSET / LIMIT) / name) ws {
        return alias;
    }

fromClause =
    FROM head:entity tail:( comma entity )* {
        return new ast.FromClause(toArray(head, tail));
    }

joinClause =
    joins:(innerJoin / outerJoin)+ {
        return new ast.JoinClause(joins);
    }

innerJoin =
    INNER? JOIN entity:entity predicate:joinPredicate {
        return new ast.InnerJoin(entity, predicate);
    }

outerJoin =
    side:(LEFT / RIGHT) OUTER? JOIN entity:entity predicate:joinPredicate {
        return new ast.OuterJoin(entity, predicate, side);
    }
    / OUTER JOIN entity:entity predicate:joinPredicate {
        return new ast.OuterJoin(entity, predicate, ast.OuterJoin.LEFT);
    }


joinPredicate =
    ON expr:expression {
        return expr;
    }

whereClause =
    WHERE expr:expression {
        return new ast.WhereClause(expr);
    }

groupByClause =
    GROUPBY head:ident tail:( comma ident )* {
        return new ast.GroupByClause(toArray(head, tail));
    }

havingClause =
    HAVING expr:expression {
        return new ast.HavingClause(expr);
    }

orderByClause =
    ORDERBY head:order tail:( comma order )* {
        return new ast.OrderByClause(toArray(head, tail));
    }

rangeClause =
    ov:offset lv:limit? {
        return new ast.RangeClause(ov, lv);
    }
    / lv:limit ov:offset? {
        return new ast.RangeClause(ov, lv);
    }

offset =
    OFFSET value:digit ws {
        return value;
    }

limit =
    LIMIT value:digit ws {
        return value;
    }

expression =
    and:condition_and or:( OR condition_and )* {
        if (or.length === 1) {
            or = or[0][1];
        } else if (or.length > 1) {
            or = new ast.ConditionList(or.map(function(c) {
                return c[1];
            }));
        } else {
            or = null;
        }
        return new ast.Expression(and, or);
    }

condition_and =
    head:condition tail:( AND condition )* {
        return new ast.ConditionList(toArray(head, tail));
    }

condition =
    NOT c:condition {
        return new ast.NotCondition(c);
    }
    / EXISTS LPAREN s:select RPAREN {
        return new ast.ExistsCondition(select);
    }
    / left:summand right:condition_rhs? {
        return new ast.Condition(left, right || null);
    }

summand =
    left:factor right:summand_rhs? {
        if (right) {
            return new ast.Summand(left, right[0], right[1]);
        }
        return left;
    }

summand_rhs =
    oper:(PLUS / MINUS) right:factor {
        return [oper, right];
    }

factor =
    left:term right:factor_rhs? {
        if (right) {
            return new ast.Factor(left, right[0], right[1]);
        }
        return left;
    }

factor_rhs =
    oper:(MULTIPLY / DIVISION / MODULO) right:term {
        return [oper, right];
    }

term =
    LPAREN expr:expression RPAREN {
        return expr;
    }
    / expr:(aggregation / value:value / ident:ident) {
        return expr;
    }

condition_rhs =
    IS not:NOT? NULL {
        return new ast.IsNullCondition(not.length > 0);
    }
    / BETWEEN start:term AND end:term {
        return new ast.BetweenCondition(start, end);
    }
    / IN LPAREN values:( select / valueList ) RPAREN {
        return new ast.InCondition(values);
    }
    / compare:compare term:(term / selectExpression) {
        return new ast.Comparison(compare, term);
    }
    / not:NOT? LIKE term:term {
        return new ast.LikeCondition(term, not.length > 0);
    }

valueList =
    head:value tail:( comma value)* {
        return toArray(head, tail);
    }

compare =
    lg / le / ge / eq / lower / greater / neq

order =
    ident:ident sort:( ASC / DESC )? {
        return new ast.OrderBy(ident, sort === -1);
    }

entity =
    entity:name_entity ws alias:alias? {
        if (alias) {
            aliases[alias] = entity;
        }
        return new ast.Entity(entity, alias);
    }

ident =
    entity:name dot property:name_property ws {
        return new ast.Ident(entity, property);
    }
    / entity:name ws {
        return new ast.Ident(entity, null);
    }
    / property:name_property ws {
        return new ast.Ident(null, property);
    }


name_entity =
    first:char_uppercase chars:name? ws {
        return first + chars
    }

name_property =
    first:char_lowercase chars:name? ws {
        return first + chars
    }

value =
    v:(value_string / value_numeric / boolean / NULL / value_parameter) ws {
        return v;
    }

value_string =
    s:( squote ( squote_escaped / [^'] )* squote
        / dquote ( dquote_escaped / [^"] )* dquote )
    {
        return new ast.StringValue(s[1].join(""));
    }

value_numeric =
    value_decimal / value_int

value_int =
    n:( ( plus / minus )? digit exponent? )
    {
        return new ast.IntValue(parseFloat(n[0] + n[1] + n[2], 10));
    }

value_decimal =
    d:( ( plus / minus )? decimal exponent? )
    {
        return new ast.DecimalValue(parseFloat(d[0] + d[1] + d[2], 10));
    }

value_parameter =
    colon name:name
    {
        return new ast.ParameterValue(name);
    }


// comparison operators
lg          = lg:"<>" ws { return lg; }
le          = le:"<=" ws { return le; }
ge          = ge:">=" ws { return ge; }
eq          = eq:"=" ws { return eq; }
lower       = l:"<" ws { return l; }
greater     = g:">" ws { return g; }
neq         = neq:"!=" ws { return neq; }

ws          = [ \t\r\n]* { return " " }
escape_char = "\\"
squote      = "'"
dquote      = '"'
squote_escaped =
    s:( escape_char squote )
    { return s.join("") }
dquote_escaped =
    s:( escape_char dquote )
    { return s.join("") }
plus        = "+" ws { return "+"; }
minus       = "-" ws { return "-"; }
dot         = "."
colon       = ":"
comma       = "," ws { return ","; }
star        = "*" ws { return "*"; }
digit =
    n: [0-9]+
    { return parseInt(n.join(""), 10) }
decimal =
    f:( digit dot digit
         / dot digit )
    { return parseFloat(f.join(""), 10) }
exponent =
    e:(E ( plus / minus )? digit )
    { return e.join("") }
boolean =
    b:( TRUE / FALSE )
    {
        return new ast.BooleanValue(b);
    }

char_uppercase = [A-Z]
char_lowercase = [a-z]
name =
    str:[A-Za-z0-9_\-]+
    { return str.join("") }

// terminals
E           = [Ee] { return "e"; }
TRUE        = "true"i ws { return true; }
FALSE       = "false"i ws { return false; }
NULL        = "null"i ws { return new ast.NullValue(); }
IS          = "is"i ws { return "IS"; }
IN          = "in"i ws { return "IN"; }
NOT         = "not"i ws { return "NOT"; }
LIKE        = "like"i ws { return "LIKE"; }
AND         = "and"i ws { return "AND"; }
OR          = "or"i !"der"i ws { return "OR"; }
LPAREN      = "(" ws { return "("; }
RPAREN      = ")" ws { return ")"; }
BETWEEN     = "between"i ws { return "BETWEEN"; }
DOUBLEPIPE  = "||" ws { return "||"; }
GROUP       = "group"i ws { return "GROUP"; }
BY          = "by"i ws { return "BY"; }
WHERE       = "where"i ws { return "WHERE"; }
GROUPBY     = GROUP ws BY ws { return "GROUP BY" }
ORDER       = "order"i ws { return "ORDER"; }
ORDERBY     = ORDER ws BY ws { return "ORDER BY"; }
ASC         = "asc"i ws { return 1; }
DESC        = "desc"i ws { return -1; }
HAVING      = "having"i ws { return "HAVING"; }
SELECT      = "select"i ws { return "SELECT"; }
AS          = "as"i ws { return "AS"; }
DISTINCT    = "distinct"i ws { return true }
FROM        = "from"i ws { return "FROM"; }
EXISTS      = "exists"i ws { return "EXISTS"; }
INNER       = "inner"i ws { return "INNER"; }
LEFT        = "left"i ws { return "LEFT"; }
RIGHT       = "right"i ws { return "RIGHT"; }
OUTER       = "outer"i ws { return "OUTER"; }
JOIN        = "join"i ws { return "JOIN"; }
ON          = "on"i ws  { return "ON"; }
MAX         = "max"i ws { return "MAX"; }
MIN         = "min"i ws { return "MIN"; }
SUM         = "sum"i ws { return "SUM"; }
COUNT       = "count"i ws { return "COUNT"; }
OFFSET      = "offset"i ws { return "OFFSET"; }
LIMIT       = "limit"i ws { return "LIMIT"; }
AS          = "as"i ws { return "AS"; }
PLUS        = "+" ws { return "+"; }
MINUS       = "-" ws { return "-"; }
MULTIPLY    = "*" ws { return "*"; }
DIVISION    = "/" ws { return "/"; }
MODULO      = "%" ws { return "%"; }
