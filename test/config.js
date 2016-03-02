exports.h2 = {
    "url": "jdbc:h2:mem:test;MVCC=TRUE",
    "driver": "org.h2.Driver",
    "minimumIdle": 10,
    "maximumPoolSize": 30
};

exports.mysql = {
//    "url": "jdbc:mysql://localhost/test?jdbcCompliantTruncation=false&elideSetAutoCommits=true&dontTrackOpenResources=true&enableQueryTimeouts=false&useLocalSessionState=true&cachePrepStmts=true&cacheCallableStmts=true&alwaysSendSetIsolation=false&prepStmtCacheSize=1024&cacheServerConfiguration=true&prepStmtCacheSqlLimit=2048&zeroDateTimeBehavior=convertToNull&traceProtocol=false&useUnbufferedInput=false&useReadAheadInput=true&maintainTimeStats=false&useServerPrepStmts=true&cacheRSMetadata=true&poolPreparedStatements=true&maxOpenPreparedStatements=100",
//    "url": "jdbc:mysql://localhost/test?cachePrepStmts=true&prepStmtCacheSize=50&cacheResultSetMetadata=true&cacheServerConfiguration=true&dontTrackOpenResources=true&elideSetAutoCommits=true",
    "url": "jdbc:mysql://localhost/test",
    "driver": "com.mysql.jdbc.Driver",
    "user": "test",
    "password": "test"
};

exports.oracle = {
    "url": "jdbc:oracle:thin:@192.164.192.176:1523:ORFON4",
    "driver": "oracle.jdbc.OracleDriver",
    "user": "orf_sqlstore",
    "password": "rh!n0",
    "minimumIdle": 10,
    "maximumPoolSize": 30
};

exports.postgresql = {
    "url": "jdbc:postgresql://localhost/test",
    "driver": "org.postgresql.Driver",
    "user": "test",
    "password": "test",
    "autoCommit": true,
    "readOnly": true,
    "minimumIdle": 10,
    "maximumPoolSize": 30
};
