/**
 * @module dialects/oracle/sqlgenerator
 */

const SqlGenerator = require("../../query/sqlgenerator");

const OracleSqlGenerator = module.exports = function(store) {
    SqlGenerator.apply(this, arguments);
    return this;
};

OracleSqlGenerator.prototype = Object.create(SqlGenerator.prototype, {});
OracleSqlGenerator.prototype.constructor = OracleSqlGenerator;

/**
 * Returns the SQL representation of the summand passed as argument
 * @param {Summand} node The summand node
 * @returns {String} The SQL representation
 */
OracleSqlGenerator.prototype.visitFactor = function(node) {
    if (node.operand === "%") {
        // Oracle doesn't understand '%' as modulo operator, instead demands
        // calling the MOD(x, y) function
        return ["MOD(", node.left.accept(this), ", ",
            node.right.accept(this), ")"].join("");
    }
    return ["(",
        node.left.accept(this), " ", node.operand, " ", node.right.accept(this),
    ")"].join("");
};

OracleSqlGenerator.prototype.visitOperand = function(node) {
    return node.summands.reduceRight((function(prev, curr, idx, arr) {
        if (idx === arr.length - 1) {
            return curr.accept(this);
        }
        return ["CONCAT(", curr.accept(this), ", ", prev, ")"].join("");
    }).bind(this), null);
};
