var {StringBuilder} = java.lang;
var {StringReader} = java.io;

/**
 * Called to retrieve the value from a resultset
 * @param {java.sql.ResultSet} resultSet The resultset to retrieve the value from
 * @param {Number} idx The 1-based index position of the column
 * @returns {String} The result set value at the given column index position
 */
exports.get = function(resultSet, idx) {
    try {
        return resultSet.getString(idx);
    } catch (e) {
        var reader = resultSet.getCharacterStream(idx);
        if (reader == null) {
            return null;
        }
        var out = new StringBuilder();
        var buffer = new java.lang.reflect.Array.newInstance(java.lang.Character.TYPE, 2048);
        var read = -1;
        while ((read = reader.read(buffer, 0, buffer.length)) > -1) {
            out.append(buffer, 0, read);
        }
        return out.toString();
    }
};

/**
 * Sets the column value in the prepared statement
 * @param {java.sql.PreparedStatement} preparedStatement The statement
 * @param {Number} idx The 1-based index position of the column
 * @param {Object} value The value
 */
exports.set = function(preparedStatement, idx, value) {
    try {
        preparedStatement.setString(idx, value);
    } catch (e) {
        var reader = new StringReader(value);
        preparedStatement.setCharacterStream(idx, reader, value.length);
    }
};