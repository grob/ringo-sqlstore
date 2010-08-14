About Ringo SQLstore
===============

Ringo SQLstore is a storage implementation allowing [RingoJS] applications to store data in a relational database. It is entirely implemented in Javascript and uses standard JDBC for interactions with the underlying database. Main features are:

* Creation of tables and sequences
* Transaction support
* Lazy loading
* Simple one-to-one and one-to-many mappings (see below)
* Connection pooling
* Easy addition of other databases or custom column mappings
* Switching between databases just by modifying the connection properties
* Multiple SQL stores simultaneously in one application

Currently supported databases are H2, MySQL 5.x and Oracle XE. PostgreSQL will follow soon.

SQLstore was heavily inspired by
* [ringo-hibernate] by Robert Thurnher
* [Hibernate] Project
* [Helma] (the predecessor of RingoJS)

Status
======

Ringo SQL-Store should be considered Beta, and you should expect bugs hindering you when using it. Most likely also the mapping format will change (slightly) in the near future.

Supported data types
====================

Ringo SQLstore currently supports the following data types for use in mappings:

* integer
* long
* short
* float
* double
* character
* string
* byte
* boolean
* date
* time
* timestamp
* binary
* text

See the various [database] files for details about the mapping of these data types to column types.

Mapping Definition
==================

Basics
------

A basic mapping definition looks like:

{
	"table": "mytable",
	"schema": "myschema", // optional, is not created on-the-fly
	"id": { // optional
		"column": "mytable_id", // optional, defaults to "id"
		"sequence": "mytable_id_seq", // optional
	},
	"properties": {
		"myprop": {
			"type": "string",
			"column": "mytable_string", // optional
			"length": 255, // optional
			"nullable": false, // optional
			"default": "nada" // optional, currently only works for strings
		}
	}
}

One-to-one Mappings (aka. Object-Mappings)
------------------------------------------

SQLstore supports simple one-to-one mappings, which can be defined as

"properties": {
	"author": {
		"type": "object",
		"entity": "Author",
		"column": "book_f_author", // optional
		"foreignProperty": "book_id" // optional, defaults to "id"
	}
}

These mappings are loaded lazily, meaning that only an empty entity is created during resolving, and the entity is only loaded when accessing a property at the first time.

One-to-many Mappings (aka. Collections)
---------------------------------------

SQLstore supports simple one-to-many mappings:

"properties": {
	"books": {
		"type": "collection",
		"entity": "Book",
		"localProperty": "id", // optional, defaults to "id"
		"foreignProperty": "author"
	}
}

Collections are also loaded lazily, so they are only populated when accessed for the first time. Note that while collections mimick arrays, it's currently not possible to access objects in a collection using collection[idx] notation. Instead retrieving objects by index position can be done through the get(idx) method of collection instances.

Also supported is iterating over collections using for, for each and forEach.

Known Issues
============

* SQLstore is currently missing an entity and/or query cache, which is why it's issuing redundant queries when using object or collection mappings
* scale/precision options for numeric data types doesn't work for all supported databases

Coming Next
===========

* PostgreSQL support
* Entity and/or query cache
* "Filter" functionality, allowing to narrow down object- and collection mappings
* Many-to-many collections (w. intermediate relation tables)

 [RingoJS]: http://ringojs.org/
 [ringo-hibernate]: http://github.com/robi42/ringo-hibernate/
 [Hibernate]: http://hibernate.org/
 [Helma]: http://helma.org
 [database]: http://github.com/grob/ringo-sqlstore/tree/master/lib/ringo/storage/sql/databases/
