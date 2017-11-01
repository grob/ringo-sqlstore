/**
 * Called to retrieve the value from a resultset
 * @param {java.sql.ResultSet} resultSet The resultset to retrieve the value from
 * @param {Number} idx The 1-based index position of the column
 * @returns {Number} The result set value at the given column index position
 */
exports.get = function(resultSet, idx) {
    const value = resultSet.getDouble(idx);
    if (resultSet.wasNull()) {
        return null;
    }
    return value;
};

/**
 * Sets the column value in the prepared statement
 * @param {java.sql.PreparedStatement} preparedStatement The statement
 * @param {Number} idx The 1-based index position of the column
 * @param {Object} value The value
 */
exports.set = function(preparedStatement, idx, value) {
    return preparedStatement.setDouble(idx, value);
};
