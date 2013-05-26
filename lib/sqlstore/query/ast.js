/**
 * @fileoverview AST implementation used by the query parser to convert queries
 * into a tree of nodes.
 */

/**
 * The base class of AST nodes
 * @class Instances of this prototype represent an AST node
 * @returns A newly created Node instance
 * @constructor
 */
var Node = function Node() {
    return this;
};

/** @ignore */
Node.prototype.toString = function() {
    return "[" + this.constructor.name + "]";
};

/**
 * Calls the appropriate visiting method of the visitor passed as argument.
 * This method must be overridden by extending prototypes.
 * @param {Visitor} visitor The visitor implementing the visiting method
 * @throws Error
 */
Node.prototype.accept = function(visitor) {
    throw new Error(this.constructor.name + " doesn't implement accept(visitor)");
};


/**
 * Base class for value AST nodes
 * @class Instances of this class represent a value within a query
 * @returns A newly created Value instance
 * @constructor
 * @see #StringValue
 * @see #IntValue
 * @see #BooleanValue
 * @see #NullValue
 * @see #ParameterValue
 */
var Value = exports.Value = function Value() {
    return this;
};
/** @ignore */
Value.prototype = Object.create(Node.prototype);
/** @ignore */
Value.prototype.constructor = Value;

/**
 * Calls the method `visitValue` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
Value.prototype.accept = function(visitor) {
    return visitor.visitValue(this);
};


/**
 * Creates a new StringValue instance
 * @class Instances of this class represent a string value in a query
 * @param {String} value The value
 * @returns A newly created StringValue instance
 * @constructor
 * @extends Value
 * @see #Value
 */
var StringValue = exports.StringValue = function StringValue(value) {
    Object.defineProperties(this, {
        /**
         * The type of this value ("string")
         * @type String
         */
        "type": {"value": "string", "enumerable": true},
        /**
         * The value of this StringValue instance
         * @type String
         */
        "value": {"value": value, "enumerable": true}
    });
    return this;
};
/** @ignore */
StringValue.prototype = Object.create(Value.prototype);
/** @ignore */
StringValue.prototype.constructor = StringValue;

/**
 * Creates a new IntValue instance
 * @class Instances of this class represent an integer value in a query
 * @param {Number} value The value
 * @returns A newly created IntValue instance
 * @constructor
 * @extends Value
 * @see #Value
 */
var IntValue = exports.IntValue = function IntValue(value) {
    Object.defineProperties(this, {
        /**
         * The type of this value ("long")
         * @type String
         */
        "type": {"value": "long", "enumerable": true},
        /**
         * The value of this IntValue instance
         * @type Number
         */
        "value": {"value": value, "enumerable": true}
    });
    return this;
};
/** @ignore */
IntValue.prototype = Object.create(Value.prototype);
/** @ignore */
IntValue.prototype.constructor = IntValue;

/**
 * Creates a new DecimalValue instance
 * @class Instances of this class represent a float value in a query
 * @param {Number} value The value
 * @returns A newly created DecimalValue instance
 * @constructor
 * @extends Value
 * @see #Value
 */
var DecimalValue = exports.DecimalValue = function DecimalValue(value) {
    Object.defineProperties(this, {
        /**
         * The type of this value ("float")
         * @type String
         */
        "type": {"value": "float", "enumerable": true},
        /**
         * The value of this DecimalValue instance
         * @type Number
         */
        "value": {"value": value, "enumerable": true}
    });
    return this;
};
/** @ignore */
DecimalValue.prototype = Object.create(Value.prototype);
/** @ignore */
DecimalValue.prototype.constructor = DecimalValue;


/**
 * Creates a new BooleanValue instance
 * @class Instances of this class represent a boolean value in a query
 * @param {Number} value The value
 * @returns A newly created BooleanValue instance
 * @constructor
 * @extends Value
 * @see #Value
 */
var BooleanValue = exports.BooleanValue = function BooleanValue(value) {
    Object.defineProperties(this, {
        /**
         * The type of this value ("boolean")
         * @type String
         */
        "type": {"value": "boolean", "enumerable": true},
        /**
         * The value of this BooleanValue instance
         * @type Number
         */
        "value": {"value": value, "enumerable": true}
    });
    return this;
};
/** @ignore */
BooleanValue.prototype = Object.create(Value.prototype);
/** @ignore */
BooleanValue.prototype.constructor = BooleanValue;


/**
 * Creates a new NullValue instance
 * @class Instances of this class represent a null value in a query
 * @param {Number} value The value
 * @returns A newly created NullValue instance
 * @constructor
 * @extends Value
 * @see #Value
 */
var NullValue = exports.NullValue = function NullValue() {
    Object.defineProperties(this, {
        /**
         * The type of this value ("null")
         * @type String
         */
        "type": {"value": "null", "enumerable": true},
        /**
         * The value of this NullValue instance
         * @type null
         */
        "value": {"value": null, "enumerable": true}
    });
    return this;
};
/** @ignore */
NullValue.prototype = Object.create(Value.prototype);
/** @ignore */
NullValue.prototype.constructor = NullValue;


/**
 * Creates a new ParameterValue instance
 * @class Instances of this class represent a named parameter value in a query
 * @param {Number} value The value
 * @returns A newly created ParameterValue instance
 * @constructor
 * @extends Value
 * @see #Value
 */
var ParameterValue = exports.ParameterValue = function ParameterValue(name) {
    Object.defineProperties(this, {
        /**
         * The type of this value ("parameter")
         * @type String
         */
        "type": {"value": "parameter", "enumerable": true},
        /**
         * The parameter name
         * @type null
         */
        "value": {"value": name, "enumerable": true}
    });
    return this;
};
/** @ignore */
ParameterValue.prototype = Object.create(Value.prototype);
/** @ignore */
ParameterValue.prototype.constructor = ParameterValue;

/**
 * Calls the method `visitParameterValue` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
ParameterValue.prototype.accept = function(visitor) {
    return visitor.visitParameterValue(this);
};

/**
 * Creates a new Summand instance
 * @class Instances of this class represent a summand expression in a query
 * @param {Node} left The left side of the summand
 * @param {String} operand The operand
 * @param {Node} right The right side of the summand
 * @returns A newly created Summand instance
 * @constructor
 */
var Summand = exports.Summand = function Summand(left, operand, right) {
    Object.defineProperties(this, {
        /**
         * The left side of this summand
         * @type Node
         */
        "left": {"value": left, "enumerable": true},
        /**
         * The operand
         * @type String
         */
        "operand": {"value": operand, "enumerable": true},
        /**
         * The right side of this summand
         * @type Node
         */
        "right": {"value": right, "enumerable": true}
    });
    return this;
};
/** @ignore */
Summand.prototype = Object.create(Node.prototype);
/** @ignore */
Summand.prototype.constructor = Summand;

/**
 * Calls the method `visitSummand` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
Summand.prototype.accept = function(visitor) {
    return visitor.visitSummand(this);
};


/**
 * Creates a new Factor instance
 * @class Instances of this class represent a factor expression in a query
 * @param {Node} left The left side of the factor
 * @param {String} operand The operand
 * @param {Node} right The right side of the factor
 * @returns A newly created Factor instance
 * @constructor
 */
var Factor = exports.Factor = function Factor(left, operand, right) {
    Object.defineProperties(this, {
        /**
         * The left side of this factor
         * @type Node
         */
        "left": {"value": left, "enumerable": true},
        /**
         * The operand
         * @type String
         */
        "operand": {"value": operand, "enumerable": true},
        /**
         * The right side of this factor
         * @type Node
         */
        "right": {"value": right, "enumerable": true}
    });
    return this;
};
/** @ignore */
Factor.prototype = Object.create(Node.prototype);
/** @ignore */
Factor.prototype.constructor = Factor;

/**
 * Calls the method `visitFactor` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
Factor.prototype.accept = function(visitor) {
    return visitor.visitFactor(this);
};


/**
 * Creates a new Entity instance
 * @class Instances of this class represent an entity reference in a query
 * @param {String} name The name of the entity
 * @param {String} alias The alias of the entity in the query (optional)
 * @returns A newly created Entity instance
 * @constructor
 */
var Entity = exports.Entity = function Entity(name, alias) {
    Object.defineProperties(this, {
        /**
         * The name of the entity
         * @type String
         */
        "name": {"value": name, "enumerable": true},
        /**
         * The property of the entity to use ("id")
         * @type String
         */
        "property": {"value": "id", "enumerable": true},
        /**
         * The alias of the entity in the query
         * @type String
         */
        "alias": {"value": alias, "enumerable": true}
    });
    return this;
};
/** @ignore */
Entity.prototype = Object.create(Node.prototype);
/** @ignore */
Entity.prototype.constructor = Entity;

/**
 * Calls the method `visitEntity` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
Entity.prototype.accept = function(visitor) {
    return visitor.visitEntity(this);
};


/**
 * Creates a new Ident instance
 * @class Instances of this class represent an ident reference in a query (i.e.
 * an Entity.property reference)
 * @param {String} name The name of the entity
 * @param {String} property The name of the property (optional)
 * @returns A newly created Ident instance
 * @constructor
 */
var Ident = exports.Ident = function Ident(entity, property) {
    Object.defineProperties(this, {
        /**
         * The name of the entity
         * @type String
         */
        "entity": {"value": entity, "enumerable": true},
        /**
         * The property of the entity to use ("id")
         * @type String
         */
        "property": {"value": property || null, "enumerable": true}
    });
    return this;
};
/** @ignore */
Ident.prototype = Object.create(Node.prototype);
/** @ignore */
Ident.prototype.constructor = Ident;

/**
 * Calls the method `visitIdent` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
Ident.prototype.accept = function(visitor) {
    return visitor.visitIdent(this);
};


/**
 * Creates a new Comparison instance
 * @class Instances of this class represent a comparison expression in a query
 * @param {String} operator The operator
 * @param {Value} value The value
 * @returns A newly created Comparison instance
 * @constructor
 */
var Comparison = exports.Comparison = function Comparison(operator, value) {
    Object.defineProperties(this, {
        /**
         * The operator
         * @type String
         */
        "operator": {"value": operator, "enumerable": true},
        /**
         * The value of this comparison
         * @type Value
         */
        "value": {"value": value, "enumerable": true}
    });
    return this;
};
/** @ignore */
Comparison.prototype = Object.create(Node.prototype);
/** @ignore */
Comparison.prototype.constructor = Comparison;

/**
 * Calls the method `visitComparison` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
Comparison.prototype.accept = function(visitor) {
    return visitor.visitComparison(this);
};


/**
 * Creates a new Condition instance
 * @class Instances of this class represent a condition expression in a query
 * @param {Node} left The left side of the condition
 * @param {Node} right The right side of the condition
 * @returns A newly created Condition instance
 * @constructor
 */
var Condition = exports.Condition = function Condition(left, right) {
    Object.defineProperties(this, {
        /**
         * The left side
         * @type Node
         */
        "left": {"value": left, "enumerable": true},
        /**
         * The right side
         * @type Node
         */
        "right": {"value": right, "enumerable": true}
    });
    return this;
};
/** @ignore */
Condition.prototype = Object.create(Node.prototype);
/** @ignore */
Condition.prototype.constructor = Condition;

/**
 * Calls the method `visitCondition` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
Condition.prototype.accept = function(visitor) {
    return visitor.visitCondition(this);
};


/**
 * Creates a new NotCondition instance
 * @class Instances of this class represent a "not" condition in a query
 * @param {Value} value The value
 * @returns A newly created NotCondition instance
 * @constructor
 */
var NotCondition = exports.NotCondition = function NotCondition(value) {
    Object.defineProperties(this, {
        /**
         * The value
         * @type Value
         */
        "value": {"value": value, "enumerable": true}
    });
    return this;
};
/** @ignore */
NotCondition.prototype = Object.create(Node.prototype);
/** @ignore */
NotCondition.prototype.constructor = NotCondition;

/**
 * Calls the method `visitNotCondition` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
NotCondition.prototype.accept = function(visitor) {
    return visitor.visitNotCondition(this);
};


/**
 * Creates a new ExistsCondition instance
 * @class Instances of this class represent an "exists" condition in a query
 * @param {Select} select The select expression
 * @returns A newly created ExistsCondition instance
 * @constructor
 */
var ExistsCondition = exports.ExistsCondition = function ExistsCondition(select) {
    Object.defineProperties(this, {
        /**
         * The select expression
         * @type Select
         */
        "select": {"value": select, "enumerable": true}
    });
    return this;
};
/** @ignore */
ExistsCondition.prototype = Object.create(Node.prototype);
/** @ignore */
ExistsCondition.prototype.constructor = ExistsCondition;

/**
 * Calls the method `visitExistCondition` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
ExistsCondition.prototype.accept = function(visitor) {
    return visitor.visitExistCondition(this);
};


/**
 * Creates a new IsNullCondition instance
 * @class Instances of this class represent an "is null" condition in a query
 * @param {Boolean} not True or false
 * @returns A newly created IsNullCondition instance
 * @constructor
 */
var IsNullCondition = exports.IsNullCondition = function IsNullCondition(not) {
    Object.defineProperties(this, {
        /**
         * Contains true for "is not" conditions
         * @type Boolean
         */
        "isNot": {"value": not === true, "enumerable": true}
    });
    return this;
};
/** @ignore */
IsNullCondition.prototype = Object.create(Node.prototype);
/** @ignore */
IsNullCondition.prototype.constructor = IsNullCondition;

/**
 * Calls the method `visitIsNullCondition` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
IsNullCondition.prototype.accept = function(visitor) {
    return visitor.visitIsNullCondition(this);
};


/**
 * Creates a new BetweenCondition instance
 * @class Instances of this class represent an "between" condition in a query
 * @param {Value} start The start value
 * @param {Value} end The end value
 * @param {Boolean} not True for "not between" conditions
 * @returns A newly created BetweenCondition instance
 * @constructor
 */
var BetweenCondition = exports.BetweenCondition = function BetweenCondition(start, end, not) {
    Object.defineProperties(this, {
        /**
         * True for "not between" conditions
         * @type Boolean
         */
        "isNot": {"value": not === true, "enumerable": true},
        /**
         * The start value
         * @type Value
         */
        "start": {"value": start, "enumerable": true},
        /**
         * The end value
         * @type Value
         */
        "end": {"value": end, "enumerable": true}
    });
    return this;
};
/** @ignore */
BetweenCondition.prototype = Object.create(Node.prototype);
/** @ignore */
BetweenCondition.prototype.constructor = BetweenCondition;

/**
 * Calls the method `visitBetweenCondition` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
BetweenCondition.prototype.accept = function(visitor) {
    return visitor.visitBetweenCondition(this);
};


/**
 * Creates a new InCondition instance
 * @class Instances of this class represent an "in" condition in a query
 * @param {Array} values An array containing Value instances
 * @param {Boolean} not True for "not in" conditions
 * @returns A newly created InCondition instance
 * @constructor
 */
var InCondition = exports.InCondition = function InCondition(values, not) {
    Object.defineProperties(this, {
        /**
         * True for "not in" conditions
         * @type Boolean
         */
        "isNot": {"value": not === true, "enumerable": true},
        /**
         * The values of this InCondition
         * @type Array
         */
        "values": {"value": values, "enumerable": true}
    });
    return this;
};
/** @ignore */
InCondition.prototype = Object.create(Node.prototype);
/** @ignore */
InCondition.prototype.constructor = InCondition;

/**
 * Calls the method `visitInCondition` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
InCondition.prototype.accept = function(visitor) {
    return visitor.visitInCondition(this);
};


/**
 * Creates a new LikeCondition instance
 * @class Instances of this class represent a "like" condition in a query
 * @param {Value} value The value of the condition
 * @param {Boolean} not True for "not like" conditions
 * @returns A newly created LikeCondition instance
 * @constructor
 */
var LikeCondition = exports.LikeCondition = function LikeCondition(value, not) {
    Object.defineProperties(this, {
        /**
         * True for "not like" conditions
         * @type Boolean
         */
        "isNot": {"value": not === true, "enumerable": true},
        /**
         * The value of this condition
         * @type Value
         */
        "value": {"value": value, "enumerable": true}
    });
    return this;
};
/** @ignore */
LikeCondition.prototype = Object.create(Node.prototype);
/** @ignore */
LikeCondition.prototype.constructor = LikeCondition;

/**
 * Calls the method `visitLikeCondition` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
LikeCondition.prototype.accept = function(visitor) {
    return visitor.visitLikeCondition(this);
};


/**
 * Creates a new ConditionList instance
 * @class Instances of this class represent a list of conditions in a query
 * @param {Array} conditions An array containing conditions
 * @returns A newly created ConditionList instance
 * @constructor
 */
var ConditionList = exports.ConditionList = function ConditionList(conditions) {
    Object.defineProperties(this, {
        /**
         * The list of conditions
         * @type Array
         */
        "conditions": {"value": conditions, "enumerable": true},
        /**
         * Contains the number of conditions of this list
         * @type Number
         */
        "length": {
            "get": function() {
                return conditions.length;
            },
            "enumerable": true
        }
    });
    return this;
};
/** @ignore */
ConditionList.prototype = Object.create(Node.prototype);
/** @ignore */
ConditionList.prototype.constructor = ConditionList;

/**
 * Calls the method `visitConditionList` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
ConditionList.prototype.accept = function(visitor) {
    return visitor.visitConditionList(this);
};


/**
 * Creates a new Expression instance
 * @class Instances of this class represent an expression in a query
 * @param {Array} andConditions An array containing `AND` combined conditions
 * @param {Array} orConditions An array containing `OR` combined conditions
 * @returns A newly created Expression instance
 * @constructor
 */
var Expression = exports.Expression = function Expression(andConditions, orConditions) {
    Object.defineProperties(this, {
        /**
         * The list of `AND` conditions
         * @type Array
         */
        "andConditions": {"value": andConditions, "enumerable": true},
        /**
         * The list of `OR` conditions
         * @type Array
         */
        "orConditions": {"value": orConditions, "enumerable": true}
    });
    return this;
};
/** @ignore */
Expression.prototype = Object.create(Node.prototype);
/** @ignore */
Expression.prototype.constructor = Expression;

/**
 * Calls the method `visitExpression` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
Expression.prototype.accept = function(visitor) {
    return visitor.visitExpression(this);
};


/**
 * Creates a new HavingClause instance
 * @class Instances of this class represent a "having" clause in a query
 * @param {Expression} expression The expression
 * @returns A newly created HavingClause instance
 * @constructor
 */
var HavingClause = exports.HavingClause = function HavingClause(expression) {
    Object.defineProperties(this, {
        /**
         * The expression of this clause
         * @type Expression
         */
        "value": {"value": expression, "enumerable": true}
    });
    return this;
};
/** @ignore */
HavingClause.prototype = Object.create(Node.prototype);
/** @ignore */
HavingClause.prototype.constructor = HavingClause;

/**
 * Calls the method `visitHavingClause` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
HavingClause.prototype.accept = function(visitor) {
    return visitor.visitHavingClause(this);
};


/**
 * Creates a new OrderBy instance
 * @class Instances of this class represent an "order by" expression in a query
 * @param {Expression} expression The expression
 * @param {Boolean} isReverse True if the ordering is descending
 * @param {Boolean} nulls True if nulls should be sorted at the beginning
 * @returns A newly created OrderBy instance
 * @constructor
 */
var OrderBy = exports.OrderBy = function OrderBy(expression, isReverse, nulls) {
    Object.defineProperties(this, {
        /**
         * The expression of this clause
         * @type Expression
         */
        "value": {"value": expression, "enumerable": true},
        /**
         * True if the ordering is reverse (i.e. descending)
         * @type Boolean
         */
        "isReverse": {"value": isReverse, "enumerable": true},
        /**
         * True if nulls should be sorted to the beginning
         * @type Boolean
         */
        "nulls": {"value": nulls || null, "enumerable": true}
    });
    return this;
};
/** @ignore */
OrderBy.prototype = Object.create(Node.prototype);
/** @ignore */
OrderBy.prototype.constructor = OrderBy;

/**
 * Calls the method `visitOrderBy` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
OrderBy.prototype.accept = function(visitor) {
    return visitor.visitOrderBy(this);
};


/**
 * Creates a new OrderByClause instance
 * @class Instances of this class represent an "order by" clause in a query
 * @param {Array} list The list of OrderBy instances forming this clause
 * @returns A newly created OrderByClause instance
 * @constructor
 */
var OrderByClause = exports.OrderByClause = function OrderByClause(list) {
    Object.defineProperties(this, {
        /**
         * The list of OrderBy expressions
         * @type Array
         */
        "list": {"value": list, "enumerable": true}
    });
    return this;
};
/** @ignore */
OrderByClause.prototype = Object.create(Node.prototype);
/** @ignore */
OrderByClause.prototype.constructor = OrderByClause;

/**
 * Calls the method `visitOrderByClause` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
OrderByClause.prototype.accept = function(visitor) {
    return visitor.visitOrderByClause(this);
};


/**
 * Creates a new GroupByClause instance
 * @class Instances of this class represent an "group by" clause in a query
 * @param {Array} list The list of expressions forming this clause
 * @returns A newly created GroupByClause instance
 * @constructor
 */
var GroupByClause = exports.GroupByClause = function GroupByClause(list) {
    Object.defineProperties(this, {
        /**
         * The list of expressions
         * @type Array
         */
        "list": {"value": list, "enumerable": true}
    });
    return this;
};
/** @ignore */
GroupByClause.prototype = Object.create(Node.prototype);
/** @ignore */
GroupByClause.prototype.constructor = GroupByClause;

/**
 * Calls the method `visitGroupByClause` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
GroupByClause.prototype.accept = function(visitor) {
    return visitor.visitGroupByClause(this);
};


/**
 * Creates a new WhereClause instance
 * @class Instances of this class represent a "where" clause in a query
 * @param {Expression} expression The expressions forming this clause
 * @returns A newly created WhereClause instance
 * @constructor
 */
var WhereClause = exports.WhereClause = function WhereClause(expression) {
    Object.defineProperties(this, {
        /**
         * The expression
         * @type Expression
         */
        "value": {"value": expression, "enumerable": true}
    });
    return this;
};
/** @ignore */
WhereClause.prototype = Object.create(Node.prototype);
/** @ignore */
WhereClause.prototype.constructor = WhereClause;

/**
 * Calls the method `visitWhereClause` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
WhereClause.prototype.accept = function(visitor) {
    return visitor.visitWhereClause(this);
};


/**
 * Creates a new FromClause instance
 * @class Instances of this class represent a "from" clause in a query
 * @param {Array} list An array containing Entity instances
 * @returns A newly created FromClause instance
 * @constructor
 */
var FromClause = exports.FromClause = function FromClause(list) {
    Object.defineProperties(this, {
        /**
         * The list of references forming the clause
         * @type Array
         */
        "list": {"value": list, "enumerable": true},
        /**
         * Returns the entity reference at the given index position
         * @param {Number} idx The index position
         * @returns {Entity} The entity reference at the given position
         */
        "get": {
            "value": function(idx) {
                return list[idx];
            },
            "enumerable": true
        },
        /**
         * Contains the number of entity references in this clause
         * @type Number
         */
        "length": {
            "get": function() {
                return list.length;
            },
            "enumerable": true
        }
    });
    return this;
};
/** @ignore */
FromClause.prototype = Object.create(Node.prototype);
/** @ignore */
FromClause.prototype.constructor = FromClause;

/**
 * Calls the method `visitFromClause` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
FromClause.prototype.accept = function(visitor) {
    return visitor.visitFromClause(this);
};


/**
 * Creates a new JoinClause instance
 * @class Instances of this class represent a join clause in a query
 * @param {Array} list An array containing InnerJoin and or OuterJoin instances
 * @returns A newly created JoinClause instance
 * @constructor
 */
var JoinClause = exports.JoinClause = function JoinClause(list) {
    Object.defineProperties(this, {
        /**
         * The list of joins
         * @type Array
         */
        "list": {"value": list, "enumerable": true},
        /**
         * Returns the join at the given index position
         * @param {Number} idx The index position
         * @returns {InnerJoin|OuterJoin} The join
         */
        "get": {
            "value": function(idx) {
                return list[idx];
            },
            "enumerable": true
        },
        /**
         * Contains the number of joins in this clause
         * @type Number
         */
        "length": {
            "get": function() {
                return list.length;
            },
            "enumerable": true
        }
    });
    return this;
};
/** @ignore */
JoinClause.prototype = Object.create(Node.prototype);
/** @ignore */
JoinClause.prototype.constructor = JoinClause;

/**
 * Calls the method `visitJoinClause` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
JoinClause.prototype.accept = function(visitor) {
    return visitor.visitJoinClause(this);
};


/**
 * Creates a new InnerJoin instance
 * @class Instances of this class represent an inner join in a query
 * @param {Entity} entity The entity to join with
 * @param {Expression} predicate The join predicate
 * @returns A newly created InnerJoin instance
 * @constructor
 */
var InnerJoin = exports.InnerJoin = function InnerJoin(entity, predicate) {
    Object.defineProperties(this, {
        /**
         * The entity to join with
         * @type Entity
         */
        "entity": {"value": entity, "enumerable": true},
        /**
         * The join predicate
         * @type Expression
         */
        "predicate": {"value": predicate, "enumerable": true}
    });
    return this;
};
/** @ignore */
InnerJoin.prototype = Object.create(Node.prototype);
/** @ignore */
InnerJoin.prototype.constructor = InnerJoin;

/**
 * Calls the method `visitInnerJoin` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
InnerJoin.prototype.accept = function(visitor) {
    return visitor.visitInnerJoin(this);
};


/**
 * Creates a new OuterJoin instance
 * @class Instances of this class represent an outer join in a query
 * @param {Entity} entity The entity to join with
 * @param {Expression} predicate The join predicate
 * @param {String} side The side of the outer join
 * @returns A newly created OuterJoin instance
 * @constructor
 */
var OuterJoin = exports.OuterJoin = function OuterJoin(entity, predicate, side) {
    Object.defineProperties(this, {
        /**
         * The entity to join with
         * @type Entity
         */
        "entity": {"value": entity, "enumerable": true},
        /**
         * The join predicate
         * @type Expression
         */
        "predicate": {"value": predicate, "enumerable": true},
        /**
         * The side of the outer join
         * @type String
         */
        "side": {"value": side, "enumerable": true}
    });
    return this;
};
OuterJoin.LEFT = "LEFT";
OuterJoin.RIGHT = "RIGHT";
/** @ignore */
OuterJoin.prototype = Object.create(Node.prototype);
/** @ignore */
OuterJoin.prototype.constructor = OuterJoin;

/**
 * Calls the method `visitOuterJoin` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
OuterJoin.prototype.accept = function(visitor) {
    return visitor.visitOuterJoin(this);
};


/**
 * Creates a new RangeClause instance
 * @class Instances of this class represent a range clause in a query
 * @param {Number} offset The offset
 * @param {Number} limit The limit
 * @returns A newly created RangeClause instance
 * @constructor
 */
var RangeClause = exports.RangeClause = function RangeClause(offset, limit) {
    Object.defineProperties(this, {
        /**
         * The offset (defaults to zero)
         * @type Number
         */
        "offset": {"value": offset || 0, "enumerable": true},
        /**
         * The limit (defaults to zero, i.e. no limit)
         * @type Number
         */
        "limit": {"value": limit || 0, "enumerable": true}
    });
    return this;
};
/** @ignore */
RangeClause.prototype = Object.create(Node.prototype);
/** @ignore */
RangeClause.prototype.constructor = RangeClause;

/**
 * Calls the method `visitRangeClause` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
RangeClause.prototype.accept = function(visitor) {
    return visitor.visitRangeClause(this);
};


/**
 * Creates a new SelectClause instance
 * @class Instances of this class represent a "select" clause in a query
 * @param {Array} list An array containing the select expressions
 * @returns A newly created SelectClause instance
 * @constructor
 */
var SelectClause = exports.SelectClause = function SelectClause(list) {
    Object.defineProperties(this, {
        /**
         * The list of select expressions
         * @type Array
         */
        "list": {"value": list, "enumerable": true},
        /**
         * Returns the select expression at the given index position
         * @param {Number} idx The index position
         * @returns {SelectExpression} The select expression
         */
        "get": {
            "value": function(idx) {
                return list[idx];
            },
            "enumerable": true
        },
        /**
         * Contains the number of select expressions in this clause
         * @type Number
         */
        "length": {
            "get": function() {
                return list.length;
            },
            "enumerable": true
        }
    });
    return this;
};
/** @ignore */
SelectClause.prototype = Object.create(Node.prototype);
/** @ignore */
SelectClause.prototype.constructor = SelectClause;

/**
 * Calls the method `visitSelectClause` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
SelectClause.prototype.accept = function(visitor) {
    return visitor.visitSelectClause(this);
};


/**
 * Creates a new SelectExpression instance
 * @class Instances of this class represent a single "select" expression in a query
 * @param {Expression} expression The expression
 * @param {String} alias Optional alias for the expression
 * @returns A newly created SelectExpression instance
 * @constructor
 */
var SelectExpression = exports.SelectExpression = function SelectExpression(expression, alias) {
    Object.defineProperties(this, {
        /**
         * The expression
         * @type Expression
         */
        "expression": {"value": expression, "enumerable": true},
        /**
         * The alias of the expression
         * @type String
         */
        "alias": {"value": alias, "enumerable": true}
    });
    return this;
};
/** @ignore */
SelectExpression.prototype = Object.create(Node.prototype);
/** @ignore */
SelectExpression.prototype.constructor = SelectExpression;

/**
 * Calls the method `visitSelectExpression` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
SelectExpression.prototype.accept = function(visitor) {
    return visitor.visitSelectExpression(this);
};

/**
 * Creates a new SelectEntity instance
 * @class Instances of this class represent an entity reference within a
 * select expression in a query
 * @param {String} name The name of the entity to select
 * @returns A newly created SelectExpression instance
 * @constructor
 */
var SelectEntity = exports.SelectEntity = function SelectEntity(name) {
    Object.defineProperties(this, {
        /**
         * Contains the name of the entity to select
         * @type String
         */
        "name": {"value": name, "enumerable": true},
        /**
         * Contains the name of the entity property to select ("id")
         * @type String
         */
        "property": {"value": "id", "enumerable": true}
    });
    return this;
};
/** @ignore */
SelectEntity.prototype = Object.create(Node.prototype);
/** @ignore */
SelectEntity.prototype.constructor = SelectEntity;

/**
 * Calls the method `visitSelectEntity` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
SelectEntity.prototype.accept = function(visitor) {
    return visitor.visitSelectEntity(this);
};

/**
 * Creates a new Aggregation instance
 * @class Instances of this class represent an aggregation within a query
 * @param {String} type The type of aggregation
 * @param {Ident} ident The ident
 * @param {Boolean} isDistinct True for distinct aggregations
 * @returns A newly created Aggregation instance
 * @constructor
 */
var Aggregation = exports.Aggregation = function Aggregation(type, ident, isDistinct) {
    Object.defineProperties(this, {
        /**
         * Contains the type of aggregation
         * @type String
         */
        "type": {"value": type, "enumerable": true},
        /**
         * The ident to aggregate
         * @type Ident
         */
        "value": {"value": ident, "enumerable": true},
        /**
         * True for distinct aggregation
         * @type Boolean
         */
        "isDistinct": {"value": isDistinct === true, "enumerable": true}
    });
    return this;
};
/**
 * `MAX` aggregation
 * @type String
 */
Aggregation.MAX = "MAX";
/**
 * `MIN` aggregation
 * @type String
 */
Aggregation.MIN = "MIN";
/**
 * `SUM` aggregation
 * @type String
 */
Aggregation.SUM = "SUM";
/**
 * `COUNT` aggregation
 * @type String
 */
Aggregation.COUNT = "COUNT";
/** @ignore */
Aggregation.prototype = Object.create(Node.prototype);
/** @ignore */
Aggregation.prototype.constructor = Aggregation;

/**
 * Calls the method `visitAggregation` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
Aggregation.prototype.accept = function(visitor) {
    return visitor.visitAggregation(this);
};


/**
 * Creates a new Select instance
 * @class Instances of this class represent a select statement
 * @param {Array} aliases An array containing all aliases within this statement
 * @param {SelectClause} select The select clause
 * @param {FromClause} from The from clause
 * @param {JoinClause} join The join clause
 * @param {WhereClause} where The where clause
 * @param {GroupByClause} groupBy The group by expression
 * @param {HavingClause} having The having clause
 * @param {OrderByClause} orderBy The order by clause
 * @param {RangeClause} range The range clause
 * @param {Boolean} isDistinct True if the select is distinct
 * @returns A newly created Select instance
 * @constructor
 */
var Select = exports.Select = function Select(aliases, select, from, join, where, groupBy, having, orderBy, range, isDistinct) {
    Object.defineProperties(this, {
        /**
         * Contains the select clause
         * @type SelectClause
         */
        "select": {"value": select, "enumerable": true},
        /**
         * Contains the from clause
         * @type FromClause
         */
        "from": {"value": from, "enumerable": true},
        /**
         * Contains the join clause
         * @type JoinClause
         */
        "join": {"value": join, "enumerable": true},
        /**
         * Contains the where clause
         * @type WhereClause
         */
        "where": {"value": where, "enumerable": true},
        /**
         * Contains the group by clause
         * @type GroupByClause
         */
        "groupBy": {"value": groupBy, "enumerable": true},
        /**
         * Contains the having clause
         * @type HavingClause
         */
        "having": {"value": having, "enumerable": true},
        /**
         * Contains the order by clause
         * @type OrderByClause
         */
        "orderBy": {"value": orderBy, "enumerable": true},
        /**
         * Contains the range clause
         * @type RangeClause
         */
        "range": {"value": range, "enumerable": true},
        /**
         * True for distinct select statements
         * @type Boolean
         */
        "isDistinct": {"value": isDistinct === true, "enumerable": true},
        /**
         * The list of aliases of this select statement
         * @type Array
         */
        "aliases": {"value": aliases, "enumerable": true}
    });
    return this;
};
/** @ignore */
Select.prototype = Object.create(Node.prototype);
/** @ignore */
Select.prototype.constructor = Select;

/**
 * Calls the method `visitSelect` of the visitor passed as argument, passing
 * this instance as argument.
 * @param {Object} visitor The visitor
 * @returns The value returned by the visitor
 */
Select.prototype.accept = function(visitor) {
    return visitor.visitSelect(this);
};
