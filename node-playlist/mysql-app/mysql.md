# Names
A small manual recording the very basic commands in mysql.

# Commands

1. every sql statement ends with `;`
1. `mysqld`, to start the MySQL server
1. `mysql -h $host -u $user -p`, `-h` means the host server, `-u` means the username to login, `-p` means using password to login
1. `STATUS;`, show the detailed info about the connection and the server
1. `SHOW DATABASES;`, when logged in to show the databases in the SQL server.
1. `SELECT database();`, show the database used right now
1. `USE $database;`, use the database whose name is $database
1. `SHOW TABLES;`, show the tables in the chosen database 
1. `SHOW $columns FROM $table;`, show the $columns in the chosen $table
1. `SHOW INDEX FROM $table;`, show the indexes in the chosen $table, including the `PRIMARY KEY`
1. `CREATE DATABASE $database;`, create a database named $database
1. `DROP DATABASE $database;`, drop the database named $database
1. There are many kinds of data types, number, date, time, string. Each has different properties.
1. `CREATE TABLE [IF NOT EXISTS] $table ( $column $data_type [$attributes], ... ) [ENGINE = MariaDB DEFAULT CHARSET=utf8];`, create columns in the $table specifying the column data type and $attributes[Not null | default value | auto_increment | primary_key | unique], and specifying the engine or charset if needed
1. `CREATE INDEX $index_name on $table ($cols)`
1. `FOREIGN KEY ($col) REFERENCES FROM $table ($col) on delete cascade`, create a foreign key which will be dropped if the references is dropped
1. `INSERT INTO $table ($col1, $col2,...) VALUES ($val1, $val2,...);`, insert some data into the specified columns, string data should go inside the quotation marks
1. `SELECT $col1, $col2, ... FROM $table [WHERE Clause] [OFFSET m] [LIMIT n];`, select query, query somethings in these columns in the $table, using `*` will return all the columns in that table. `where clause`, `offset m`, `limit n` help to filter these data.
1. `[WHERE Clause]`, expand to `[WHERE $condition1 [[AND|OR] $condition2] ...]`, $condition is a conditonal statement using `[= | != | > | < | >= | <=]`
1. `UPDATE $table SET $col=$val WHERE $condition;`, update or change the value in specified column
1. `DELETE FROM $table [WHERE Clause];`, delete the rows in the $table if meet the $condition
1. `%` stands for any character used in `LIKE` query statement, `_` stands for only one character.
1. `SELECT $exp1, $exp2,... FROM $table1 [WHERE $condition1] UNION [ALL | DISTINCT] SELECT $exp1, $exp2,... FROM $table2 [WHERE $condition2]`, hard to understand, ugh...
1. `SELECT $col1, $col2,... FROM $table ORDER BY $col1, [$col2,...] [ASC| DESC] ...`, sort the results in the name of $col1 the $col2,... and `[asc | desc]` means ascend and descend separately. 
1. `SELECT $col1, $col2, ... FROM $table GROUP BY $colx`, 
1. `ALERT TABLE $table ADD $column $data_type [AFTER $columnX];`, add a column into one existing $table, and when using `after`, the $column would be inserted after the $colunX
1. `ALTER TABLE $table DROP COLUMN $col`
1. `ALTER TABLE $table CHANGE COLUMN $col $new_attribute`
1. `ALTER TABLE $table RENAME AS $new_table`, `RENAME TABLE $table TO $new_table`
1. `SELECT $col FROM $table WHERE $col REGEXP "regexp"`, use regular expression to search the target
1. `REGEXP $regexp`, `($reg1|$reg2)`, `[1-9]`,`[^acb]`
1. `SELECT CONCAT($col1, ",", $col2) as $new_col FROM $table`, create a new column for a short time usage 
1. `DROP TABLE $table`, drop the $table
1. `SELECT $col1, $col2,... FROM $table WHERE Match($target_col) Against("+$text -$text2" IN BOOLEAN MODE)`
1. `INSERT INTO $table($col1,$col2,...) SELECT ($col1_mir,$col2_mir,...) FROM $mir_table`, used for copying columns from one table to another
1. `CREATE VIEW $view_name AS SELECT $col1,$col2,... FROM $table [WHERE clause]`
1. `CREATE VIEW $view_name AS SELECT CONCAT($col1,"-",$col2) AS $new_col FROM $table`

TODO mysql union statement



# Users in SQL

    GRANT $permissions
    On $database.$tables
    TO $username@$permittedhost
    IDENTIFIED BY $password
    WITH GRANT OPTION;

The last statement `WITH GRANT OPTION` is optional which is used when you want this $username to have the right to give options grant to others users.

    REVOKE $permissions 
    ON $database.$tables
    FROM $username@$host

Revoke the $permissions from the $user on $database.$tables

    SELECT $tbl1.$col1, $tbl1.$col2, ...  $tbl2.$col1, $tbl2.$col2,...  
    FROM $tbl1, $tbl2
    WHERE $condition

This is a join query statement to find some cross-product in two tables.
Besides, the statement can be written in this way:

    SELECT $tbl1.$col1, $tbl1.$col2, ... $tbl2.$col1, $tbl2.$col2 
    FROM $tbl1
    INNER JOIN $tbl2
    ON $condition

`INNER JOIN`, `LEFT OUTER JOIN` and `RIGHT OUTER JOIN`

`DROP USER $username@$host`, drop the $user on the $host

Transaction

    BEGIN;
    $QUERY STATEMENT1,
    $QUERY STATEMENT2,
    ...

    COMMIT;

    ROLLBACK;

SQL Functions

    COUNT($col)
    AVG($col)
    SUM($col)
    MAX($col)
    MIN($col)
    SUBSTRING($col, start, end)
    LOWER($col)
    UPPER($col)
    INSTR($col,$patter)
    CONCAT($col1,$col2,...)
    TRIM($col)
    Now()
    DATE_FORMAT($col, '%w %d %m %y')

