exports.get = function(resultSet, idx) {
    return null;
};

exports.set = function(preparedStatement, idx) {
    return preparedStatement.setNull(idx, java.sql.Types.NULL);
};