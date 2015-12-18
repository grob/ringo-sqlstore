/**
 * Called to retrieve the value from a resultset
 * @param {java.sql.ResultSet} resultSet The resultset to retrieve the value from
 * @param {Number} idx The 1-based index position of the column
 * @returns {Date} The result set value at the given column index position
 */
exports.get = function(resultSet, idx) {
    var date = resultSet.getDate(idx);
    if (date !== null) {
        return new Date(date.getTime());
    }
    return null;
};

/**
 * Sets the column value in the prepared statement
 * @param {java.sql.PreparedStatement} preparedStatement The statement
 * @param {Number} idx The 1-based index position of the column
 * @param {Object} value The value
 */
exports.set = function(preparedStatement, idx, value) {
    var date = new java.sql.Date(value.getTime());
    return preparedStatement.setDate(idx, date);
};
