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
    // TODO: change to ringo binary
    var out = ByteArrayOutputStream();
    var buffer = new ByteArray(2048);
    var read = -1;
    while ((read = inStream.read(buffer)) > -1) {
        out.write(buffer, 0, read);
    }
    return out.toByteArray();
};

/**
 * Sets the column value in the prepared statement
 * @param {java.sql.PreparedStatement} preparedStatement The statement
 * @param {Number} idx The 1-based index position of the column
 * @param {Object} value The value
 */
exports.set = function(preparedStatement, idx, value) {
    if (value.getClass().getComponentType().equals(java.lang.Byte.TYPE)) {
        try {
            preparedStatement.setBytes(idx, value);
        } catch (e) {
            // TODO: change to ringo binary/io
            var buf = (new java.lang.String(value)).getBytes();
            var stream = new java.io.ByteArrayInputStream(buf);
            preparedStatement.setBinaryStream(idx, stream, buf.length);
        }
    } else {
        throw new Error("Expected byte[] for binary column");
    }
};
