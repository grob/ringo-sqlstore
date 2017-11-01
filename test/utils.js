const dbSchema = require("../lib/database/schema");

exports.drop = function(store) {
    const entities = Array.prototype.slice.call(arguments, 1);
    const conn = store.getConnection();
    try {
        entities.forEach(function(Entity) {
            const {tableName, schemaName, id} = Entity.mapping;
            dbSchema.dropTable(conn, store.dialect, tableName, schemaName);
            if (id.sequence && store.dialect.hasSequenceSupport) {
                dbSchema.dropSequence(conn, store.dialect, id.sequence);
            }
        });
    } finally {
        conn.close();
    }
};
