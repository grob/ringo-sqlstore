var log = require("ringo/logging").getLogger(module.id);

/**
 * Excutes a DDL update using the connection and SQL string
 * passed as arguments
 * @param {java.sql.Connection} conn The connection to use
 * @param {String} sql The SQL string
 * @returns {boolean} True if the operation was successful
 */
exports.executeUpdate = function(conn, sql) {
    var statement;
    try {
        if (log.isDebugEnabled()) {
            log.debug("Executing", sql);
        }
        if (conn.isReadOnly()) {
            conn.setReadOnly(false);
        }
        statement = conn.createStatement();
        return statement.executeUpdate(sql) === 0;
    } finally {
        statement && statement.close();
    }
};

/**
 * Excutes a query using the connection and SQL query string
 * passed as arguments. The collection argument receives the
 * resultSet received as single argument and is responsible
 * for collecting the data therein.
 * @param {java.sql.Connection} conn The connection to use
 * @param {String} sql The SQL string
 * @param {Function} collector A function receiving the query
 * result set as single argument
 * @returns {Array} An array containing the data collected
 */
exports.executeQuery = function(conn, sql, collector) {
    var statement;
    try {
        if (log.isDebugEnabled()) {
            log.debug("Executing", sql);
        }
        statement = conn.createStatement();
        return collector(statement.executeQuery(sql));
    } finally {
        statement && statement.close();
    }
};

