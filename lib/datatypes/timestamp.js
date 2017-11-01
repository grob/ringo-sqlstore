/**
 * Called to retrieve the value from a resultset
 * @param {java.sql.ResultSet} resultSet The resultset to retrieve the value from
 * @param {Number} idx The 1-based index position of the column
 * @returns {Date} The result set value at the given column index position
 */
exports.get = function(resultSet, idx) {
    const timestamp = resultSet.getTimestamp(idx);
    if (timestamp !== null) {
        return new Date(timestamp.getTime());
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
    return preparedStatement.setTimestamp(idx,
            new java.sql.Timestamp(value.getTime()));
};
