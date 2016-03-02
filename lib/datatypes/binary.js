var {Byte} = java.lang;
var {ByteArrayOutputStream} = java.io;

/**
 * Called to retrieve the value from a resultset
 * @param {java.sql.ResultSet} resultSet The resultset to retrieve the value from
 * @param {Number} idx The 1-based index position of the column
 * @returns {ByteArray} The result set value at the given column index position
 */
exports.get = function(resultSet, idx) {
    var inStream = resultSet.getBinaryStream(idx);
    if (inStream == null) {
        return null;
    }
    var out = new ByteArrayOutputStream();
    var buffer = new ByteArray(2048);
    var read = -1;
    while ((read = inStream.read(buffer)) > -1) {
        out.write(buffer, 0, read);
    }
    return ByteArray.wrap(out.toByteArray());
};

/**
 * Sets the column value in the prepared statement
 * @param {java.sql.PreparedStatement} preparedStatement The statement
 * @param {ByteArray} value The byte array
 * @param {Number} idx The 1-based index position of the column
 */
exports.set = function(preparedStatement, idx, value) {
    if (value instanceof ByteArray || value.getClass().getComponentType().equals(Byte.TYPE)) {
        preparedStatement.setBytes(idx, value);
    } else {
        throw new Error("Expected byte[] for binary column");
    }
};
