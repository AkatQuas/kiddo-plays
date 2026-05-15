import 'package:drift/drift.dart';

class ArchiveLock extends Table {
  IntColumn get id => integer().autoIncrement()();
  DateTimeColumn get lockDate => dateTime()();
  DateTimeColumn get lockedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  List<String> get customConstraints => ['UNIQUE(lock_date)'];
}