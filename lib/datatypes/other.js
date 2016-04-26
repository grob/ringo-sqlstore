/**
 * Called to retrieve the value from a resultset
 * @param {java.sql.ResultSet} resultSet The resultset to retrieve the value from
 * @param {Number} idx The 1-based index position of the column
 * @returns {String} The result set value at the given column index position
 */
exports.get = function(resultSet, idx) {
    var obj = resultSet.getObject(idx);

    if (obj !== null) {
        // Postgres special types not covered by JDBC
        if (obj instanceof Packages.org.postgresql.util.PGobject) {
            var type = obj.getType();
            switch (type) {
                case "json":
                case "jsonb":
                    obj = JSON.parse(obj.toString());
                    break;
                default:
                    throw new Error("Unsupported data type: " + type);
            }
            return obj;
        } else {
            throw new Error("Unsupported object data type: " + obj.toString());
        }
    }
    return obj;
};

/**
 * Sets the column value in the prepared statement
 * @param {java.sql.PreparedStatement} preparedStatement The statement
 * @param {Number} idx The 1-based index position of the column
 * @param {Object} value The value
 */
exports.set = function(preparedStatement, idx, value) {
    // toString() is the default representation
    var sqlValueString = value.toString();

    // check if JSON should be used
    if (value != null && typeof value == "object") {
        if (Array.isArray(value) || Object.prototype.toString.call(value) === "[object Object]") {
            sqlValueString = JSON.stringify(value);
        }
    }

    preparedStatement.setObject(idx, sqlValueString, java.sql.Types.OTHER);
};