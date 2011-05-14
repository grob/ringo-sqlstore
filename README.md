About Ringo SQLstore
===============

Ringo SQLstore is a lightweight ORM/storage implementation for [RingoJS]. It uses JDBC for communication with databases. Current features are:

* Creation of tables and sequences
* Transaction support
* Lazy loading
* One-to-one, one-to-many and many-to-many mappings
* Connection pooling
* Entity cache

Supported databases are H2, MySQL (5.x), Oracle (XE) and PostgreSQL (8.x). H2 is part of the package, so one can start right off using it without the hassle of installing and configuring a database.

SQLstore is heavily inspired by

* [ringo-hibernate] by Robert Thurnher
* [Helma] (the predecessor of RingoJS)
* [Hibernate] Project

Status
======

Ringo SQLstore is experimental beta, so expect bugs and performance issues as well as significant API changes.

Documentation
====================

Documentation is available at https://github.com/grob/ringo-sqlstore/wiki


 [RingoJS]: http://ringojs.org/
 [ringo-hibernate]: http://github.com/robi42/ringo-hibernate/
 [Helma]: http://helma.org
 [Hibernate]: http://hibernate.org/
 [database]: http://github.com/grob/ringo-sqlstore/tree/master/lib/ringo/storage/sql/databases/
