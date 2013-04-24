exports.h2 = {
    "url": "jdbc:h2:mem:test;MVCC=TRUE",
    "driver": "org.h2.Driver"
};

exports.mysql = {
    "url": "jdbc:mysql://localhost/test",
    "driver": "com.mysql.jdbc.Driver",
    "user": "test",
    "password": "test"
};

exports.oracle = {
    "url": "jdbc:oracle:thin:@192.168.1.25:1521:XE",
    "driver": "oracle.jdbc.driver.OracleDriver",
    "user": "test",
    "password": "test"
};

exports.postgresql = {
    "url": "jdbc:postgresql://localhost/test",
    "driver": "org.postgresql.Driver",
    "user": "test",
    "password": "test"
};
