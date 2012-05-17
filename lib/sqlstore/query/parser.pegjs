{

    var ast = require("./ast");

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
        return new ast.Select(sc, fc, jc || null, wc || null, gc || null, hc || null, oc || null, rc || null, d.length > 0);
    }

selectShort =
    fc:fromClause jc:joinClause? wc:whereClause? gc:groupByClause? hc:havingClause? oc:orderByClause? rc:rangeClause? {
        var selectEntity = new ast.SelectEntity(fc.get(0).entity.entity);
        var selectExpression = new ast.SelectExpression(selectEntity);
        var sc = new ast.SelectClause([selectExpression]);
        return new ast.Select(sc, fc, jc || null, wc || null, gc || null, hc || null, oc || null, rc || null, false);
    }

selectClause =
    head:selectExpression tail:( comma selectExpression )* {
        return new ast.SelectClause(toArray(head, tail));
    }

selectExpression =
    exp:(aggregation / ident / selectEntity) alias:alias? ws {
        return new ast.SelectExpression(exp, alias || null);
    }

selectEntity =
    entity:name_entity aggressive:(dot star)? {
        return new ast.SelectEntity(entity, aggressive !== "");
    }

alias =
    AS alias:name ws {
        return alias;
    }

aggregation =
    type:(MAX / MIN / SUM / COUNT) LPAREN ident:ident RPAREN {
        return new ast.Aggregation(ast.Aggregation[type], ident);
    }

fromClause =
    FROM head:fromExpression tail:( comma fromExpression )* {
        return new ast.FromClause(toArray(head, tail));
    }

fromExpression =
    entity:entity alias:alias? {
        return new ast.FromExpression(entity, alias || null);
    }

joinClause =
    innerJoin / outerJoin

innerJoin =
    INNER? JOIN entities:joinWith predicate:joinPredicate {
        return new ast.InnerJoinClause(entities, predicate);
    }

outerJoin =
    side:(LEFT / RIGHT)? OUTER JOIN entities:joinWith predicate:joinPredicate {
        return new ast.OuterJoinClause(side, entities, predicate);
    }

joinWith =
    head:entity tail:(comma entity)* {
        return toArray(head, tail);
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
      / left:term right:( condition_rhs )? {
         return new ast.Condition(left, right || null);
      }

term =
    ident:ident {
        return ident;
    }
    / value:value {
        return value;
    }
    / LPAREN expr:expression RPAREN {
        return expr;
    }

condition_rhs =
    compare:compare term:term {
        return new ast.Comparison(compare, term);
    }
    / IS not:NOT? NULL {
        return new ast.IsNullCondition(not.length > 0);
    }
    / BETWEEN start:term AND end:term {
        return new ast.BetweenCondition(start, end);
    }
    / IN LPAREN values:( select / valueList ) RPAREN {
        return new ast.InCondition(values);
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
    entity:name_entity ws {
        return new ast.Entity(entity);
    }

ident =
    entity:name_entity dot property:name_property ws {
        return new ast.Ident(entity, property);
    }
    / alias:name_property dot property:name_property ws {
        return new ast.AliasIdent(alias, property);
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
DISTINCT    = "distinct"i ws { return DISTINCT }
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
