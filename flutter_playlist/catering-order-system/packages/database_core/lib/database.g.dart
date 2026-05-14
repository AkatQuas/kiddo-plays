// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'database.dart';

// ignore_for_file: type=lint
class $DishesTable extends Dishes with TableInfo<$DishesTable, Dishe> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DishesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      hasAutoIncrement: true,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'));
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
      'name', aliasedName, false,
      additionalChecks:
          GeneratedColumn.checkTextLength(minTextLength: 1, maxTextLength: 100),
      type: DriftSqlType.string,
      requiredDuringInsert: true);
  static const VerificationMeta _priceMeta = const VerificationMeta('price');
  @override
  late final GeneratedColumn<int> price = GeneratedColumn<int>(
      'price', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _imagePathMeta =
      const VerificationMeta('imagePath');
  @override
  late final GeneratedColumn<String> imagePath = GeneratedColumn<String>(
      'image_path', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
      'status', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('available'));
  static const VerificationMeta _stockMeta = const VerificationMeta('stock');
  @override
  late final GeneratedColumn<int> stock = GeneratedColumn<int>(
      'stock', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(100));
  static const VerificationMeta _soldCountMeta =
      const VerificationMeta('soldCount');
  @override
  late final GeneratedColumn<int> soldCount = GeneratedColumn<int>(
      'sold_count', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  static const VerificationMeta _updatedAtMeta =
      const VerificationMeta('updatedAt');
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
      'updated_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  static const VerificationMeta _isDeletedMeta =
      const VerificationMeta('isDeleted');
  @override
  late final GeneratedColumn<bool> isDeleted = GeneratedColumn<bool>(
      'is_deleted', aliasedName, false,
      type: DriftSqlType.bool,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('CHECK ("is_deleted" IN (0, 1))'),
      defaultValue: const Constant(false));
  @override
  List<GeneratedColumn> get $columns => [
        id,
        name,
        price,
        imagePath,
        status,
        stock,
        soldCount,
        createdAt,
        updatedAt,
        isDeleted
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'dishes';
  @override
  VerificationContext validateIntegrity(Insertable<Dishe> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('name')) {
      context.handle(
          _nameMeta, name.isAcceptableOrUnknown(data['name']!, _nameMeta));
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('price')) {
      context.handle(
          _priceMeta, price.isAcceptableOrUnknown(data['price']!, _priceMeta));
    } else if (isInserting) {
      context.missing(_priceMeta);
    }
    if (data.containsKey('image_path')) {
      context.handle(_imagePathMeta,
          imagePath.isAcceptableOrUnknown(data['image_path']!, _imagePathMeta));
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    }
    if (data.containsKey('stock')) {
      context.handle(
          _stockMeta, stock.isAcceptableOrUnknown(data['stock']!, _stockMeta));
    }
    if (data.containsKey('sold_count')) {
      context.handle(_soldCountMeta,
          soldCount.isAcceptableOrUnknown(data['sold_count']!, _soldCountMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    }
    if (data.containsKey('updated_at')) {
      context.handle(_updatedAtMeta,
          updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta));
    }
    if (data.containsKey('is_deleted')) {
      context.handle(_isDeletedMeta,
          isDeleted.isAcceptableOrUnknown(data['is_deleted']!, _isDeletedMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Dishe map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Dishe(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      name: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}name'])!,
      price: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}price'])!,
      imagePath: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}image_path']),
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status'])!,
      stock: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}stock'])!,
      soldCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}sold_count'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      updatedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}updated_at'])!,
      isDeleted: attachedDatabase.typeMapping
          .read(DriftSqlType.bool, data['${effectivePrefix}is_deleted'])!,
    );
  }

  @override
  $DishesTable createAlias(String alias) {
    return $DishesTable(attachedDatabase, alias);
  }
}

class Dishe extends DataClass implements Insertable<Dishe> {
  final int id;
  final String name;
  final int price;
  final String? imagePath;
  final String status;
  final int stock;
  final int soldCount;
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool isDeleted;
  const Dishe(
      {required this.id,
      required this.name,
      required this.price,
      this.imagePath,
      required this.status,
      required this.stock,
      required this.soldCount,
      required this.createdAt,
      required this.updatedAt,
      required this.isDeleted});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['name'] = Variable<String>(name);
    map['price'] = Variable<int>(price);
    if (!nullToAbsent || imagePath != null) {
      map['image_path'] = Variable<String>(imagePath);
    }
    map['status'] = Variable<String>(status);
    map['stock'] = Variable<int>(stock);
    map['sold_count'] = Variable<int>(soldCount);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    map['is_deleted'] = Variable<bool>(isDeleted);
    return map;
  }

  DishesCompanion toCompanion(bool nullToAbsent) {
    return DishesCompanion(
      id: Value(id),
      name: Value(name),
      price: Value(price),
      imagePath: imagePath == null && nullToAbsent
          ? const Value.absent()
          : Value(imagePath),
      status: Value(status),
      stock: Value(stock),
      soldCount: Value(soldCount),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
      isDeleted: Value(isDeleted),
    );
  }

  factory Dishe.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Dishe(
      id: serializer.fromJson<int>(json['id']),
      name: serializer.fromJson<String>(json['name']),
      price: serializer.fromJson<int>(json['price']),
      imagePath: serializer.fromJson<String?>(json['imagePath']),
      status: serializer.fromJson<String>(json['status']),
      stock: serializer.fromJson<int>(json['stock']),
      soldCount: serializer.fromJson<int>(json['soldCount']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
      isDeleted: serializer.fromJson<bool>(json['isDeleted']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'name': serializer.toJson<String>(name),
      'price': serializer.toJson<int>(price),
      'imagePath': serializer.toJson<String?>(imagePath),
      'status': serializer.toJson<String>(status),
      'stock': serializer.toJson<int>(stock),
      'soldCount': serializer.toJson<int>(soldCount),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
      'isDeleted': serializer.toJson<bool>(isDeleted),
    };
  }

  Dishe copyWith(
          {int? id,
          String? name,
          int? price,
          Value<String?> imagePath = const Value.absent(),
          String? status,
          int? stock,
          int? soldCount,
          DateTime? createdAt,
          DateTime? updatedAt,
          bool? isDeleted}) =>
      Dishe(
        id: id ?? this.id,
        name: name ?? this.name,
        price: price ?? this.price,
        imagePath: imagePath.present ? imagePath.value : this.imagePath,
        status: status ?? this.status,
        stock: stock ?? this.stock,
        soldCount: soldCount ?? this.soldCount,
        createdAt: createdAt ?? this.createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
        isDeleted: isDeleted ?? this.isDeleted,
      );
  Dishe copyWithCompanion(DishesCompanion data) {
    return Dishe(
      id: data.id.present ? data.id.value : this.id,
      name: data.name.present ? data.name.value : this.name,
      price: data.price.present ? data.price.value : this.price,
      imagePath: data.imagePath.present ? data.imagePath.value : this.imagePath,
      status: data.status.present ? data.status.value : this.status,
      stock: data.stock.present ? data.stock.value : this.stock,
      soldCount: data.soldCount.present ? data.soldCount.value : this.soldCount,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      isDeleted: data.isDeleted.present ? data.isDeleted.value : this.isDeleted,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Dishe(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('price: $price, ')
          ..write('imagePath: $imagePath, ')
          ..write('status: $status, ')
          ..write('stock: $stock, ')
          ..write('soldCount: $soldCount, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('isDeleted: $isDeleted')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, name, price, imagePath, status, stock,
      soldCount, createdAt, updatedAt, isDeleted);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Dishe &&
          other.id == this.id &&
          other.name == this.name &&
          other.price == this.price &&
          other.imagePath == this.imagePath &&
          other.status == this.status &&
          other.stock == this.stock &&
          other.soldCount == this.soldCount &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.isDeleted == this.isDeleted);
}

class DishesCompanion extends UpdateCompanion<Dishe> {
  final Value<int> id;
  final Value<String> name;
  final Value<int> price;
  final Value<String?> imagePath;
  final Value<String> status;
  final Value<int> stock;
  final Value<int> soldCount;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<bool> isDeleted;
  const DishesCompanion({
    this.id = const Value.absent(),
    this.name = const Value.absent(),
    this.price = const Value.absent(),
    this.imagePath = const Value.absent(),
    this.status = const Value.absent(),
    this.stock = const Value.absent(),
    this.soldCount = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.isDeleted = const Value.absent(),
  });
  DishesCompanion.insert({
    this.id = const Value.absent(),
    required String name,
    required int price,
    this.imagePath = const Value.absent(),
    this.status = const Value.absent(),
    this.stock = const Value.absent(),
    this.soldCount = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.isDeleted = const Value.absent(),
  })  : name = Value(name),
        price = Value(price);
  static Insertable<Dishe> custom({
    Expression<int>? id,
    Expression<String>? name,
    Expression<int>? price,
    Expression<String>? imagePath,
    Expression<String>? status,
    Expression<int>? stock,
    Expression<int>? soldCount,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<bool>? isDeleted,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (name != null) 'name': name,
      if (price != null) 'price': price,
      if (imagePath != null) 'image_path': imagePath,
      if (status != null) 'status': status,
      if (stock != null) 'stock': stock,
      if (soldCount != null) 'sold_count': soldCount,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (isDeleted != null) 'is_deleted': isDeleted,
    });
  }

  DishesCompanion copyWith(
      {Value<int>? id,
      Value<String>? name,
      Value<int>? price,
      Value<String?>? imagePath,
      Value<String>? status,
      Value<int>? stock,
      Value<int>? soldCount,
      Value<DateTime>? createdAt,
      Value<DateTime>? updatedAt,
      Value<bool>? isDeleted}) {
    return DishesCompanion(
      id: id ?? this.id,
      name: name ?? this.name,
      price: price ?? this.price,
      imagePath: imagePath ?? this.imagePath,
      status: status ?? this.status,
      stock: stock ?? this.stock,
      soldCount: soldCount ?? this.soldCount,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      isDeleted: isDeleted ?? this.isDeleted,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (price.present) {
      map['price'] = Variable<int>(price.value);
    }
    if (imagePath.present) {
      map['image_path'] = Variable<String>(imagePath.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (stock.present) {
      map['stock'] = Variable<int>(stock.value);
    }
    if (soldCount.present) {
      map['sold_count'] = Variable<int>(soldCount.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (isDeleted.present) {
      map['is_deleted'] = Variable<bool>(isDeleted.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DishesCompanion(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('price: $price, ')
          ..write('imagePath: $imagePath, ')
          ..write('status: $status, ')
          ..write('stock: $stock, ')
          ..write('soldCount: $soldCount, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('isDeleted: $isDeleted')
          ..write(')'))
        .toString();
  }
}

class $OrdersTable extends Orders with TableInfo<$OrdersTable, Order> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OrdersTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      hasAutoIncrement: true,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'));
  static const VerificationMeta _orderNumberMeta =
      const VerificationMeta('orderNumber');
  @override
  late final GeneratedColumn<String> orderNumber = GeneratedColumn<String>(
      'order_number', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: true,
      defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'));
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
      'status', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('pending'));
  static const VerificationMeta _totalAmountMeta =
      const VerificationMeta('totalAmount');
  @override
  late final GeneratedColumn<int> totalAmount = GeneratedColumn<int>(
      'total_amount', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _discountAmountMeta =
      const VerificationMeta('discountAmount');
  @override
  late final GeneratedColumn<int> discountAmount = GeneratedColumn<int>(
      'discount_amount', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _finalAmountMeta =
      const VerificationMeta('finalAmount');
  @override
  late final GeneratedColumn<int> finalAmount = GeneratedColumn<int>(
      'final_amount', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _tableNumberMeta =
      const VerificationMeta('tableNumber');
  @override
  late final GeneratedColumn<String> tableNumber = GeneratedColumn<String>(
      'table_number', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _remarkMeta = const VerificationMeta('remark');
  @override
  late final GeneratedColumn<String> remark = GeneratedColumn<String>(
      'remark', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _cartIndexMeta =
      const VerificationMeta('cartIndex');
  @override
  late final GeneratedColumn<int> cartIndex = GeneratedColumn<int>(
      'cart_index', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  static const VerificationMeta _updatedAtMeta =
      const VerificationMeta('updatedAt');
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
      'updated_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  static const VerificationMeta _completedAtMeta =
      const VerificationMeta('completedAt');
  @override
  late final GeneratedColumn<DateTime> completedAt = GeneratedColumn<DateTime>(
      'completed_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        orderNumber,
        status,
        totalAmount,
        discountAmount,
        finalAmount,
        tableNumber,
        remark,
        cartIndex,
        createdAt,
        updatedAt,
        completedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'orders';
  @override
  VerificationContext validateIntegrity(Insertable<Order> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('order_number')) {
      context.handle(
          _orderNumberMeta,
          orderNumber.isAcceptableOrUnknown(
              data['order_number']!, _orderNumberMeta));
    } else if (isInserting) {
      context.missing(_orderNumberMeta);
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    }
    if (data.containsKey('total_amount')) {
      context.handle(
          _totalAmountMeta,
          totalAmount.isAcceptableOrUnknown(
              data['total_amount']!, _totalAmountMeta));
    } else if (isInserting) {
      context.missing(_totalAmountMeta);
    }
    if (data.containsKey('discount_amount')) {
      context.handle(
          _discountAmountMeta,
          discountAmount.isAcceptableOrUnknown(
              data['discount_amount']!, _discountAmountMeta));
    }
    if (data.containsKey('final_amount')) {
      context.handle(
          _finalAmountMeta,
          finalAmount.isAcceptableOrUnknown(
              data['final_amount']!, _finalAmountMeta));
    } else if (isInserting) {
      context.missing(_finalAmountMeta);
    }
    if (data.containsKey('table_number')) {
      context.handle(
          _tableNumberMeta,
          tableNumber.isAcceptableOrUnknown(
              data['table_number']!, _tableNumberMeta));
    }
    if (data.containsKey('remark')) {
      context.handle(_remarkMeta,
          remark.isAcceptableOrUnknown(data['remark']!, _remarkMeta));
    }
    if (data.containsKey('cart_index')) {
      context.handle(_cartIndexMeta,
          cartIndex.isAcceptableOrUnknown(data['cart_index']!, _cartIndexMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    }
    if (data.containsKey('updated_at')) {
      context.handle(_updatedAtMeta,
          updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta));
    }
    if (data.containsKey('completed_at')) {
      context.handle(
          _completedAtMeta,
          completedAt.isAcceptableOrUnknown(
              data['completed_at']!, _completedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Order map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Order(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      orderNumber: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}order_number'])!,
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status'])!,
      totalAmount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}total_amount'])!,
      discountAmount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}discount_amount'])!,
      finalAmount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}final_amount'])!,
      tableNumber: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}table_number']),
      remark: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}remark']),
      cartIndex: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}cart_index'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      updatedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}updated_at'])!,
      completedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}completed_at']),
    );
  }

  @override
  $OrdersTable createAlias(String alias) {
    return $OrdersTable(attachedDatabase, alias);
  }
}

class Order extends DataClass implements Insertable<Order> {
  final int id;
  final String orderNumber;
  final String status;
  final int totalAmount;
  final int discountAmount;
  final int finalAmount;
  final String? tableNumber;
  final String? remark;
  final int cartIndex;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? completedAt;
  const Order(
      {required this.id,
      required this.orderNumber,
      required this.status,
      required this.totalAmount,
      required this.discountAmount,
      required this.finalAmount,
      this.tableNumber,
      this.remark,
      required this.cartIndex,
      required this.createdAt,
      required this.updatedAt,
      this.completedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['order_number'] = Variable<String>(orderNumber);
    map['status'] = Variable<String>(status);
    map['total_amount'] = Variable<int>(totalAmount);
    map['discount_amount'] = Variable<int>(discountAmount);
    map['final_amount'] = Variable<int>(finalAmount);
    if (!nullToAbsent || tableNumber != null) {
      map['table_number'] = Variable<String>(tableNumber);
    }
    if (!nullToAbsent || remark != null) {
      map['remark'] = Variable<String>(remark);
    }
    map['cart_index'] = Variable<int>(cartIndex);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    if (!nullToAbsent || completedAt != null) {
      map['completed_at'] = Variable<DateTime>(completedAt);
    }
    return map;
  }

  OrdersCompanion toCompanion(bool nullToAbsent) {
    return OrdersCompanion(
      id: Value(id),
      orderNumber: Value(orderNumber),
      status: Value(status),
      totalAmount: Value(totalAmount),
      discountAmount: Value(discountAmount),
      finalAmount: Value(finalAmount),
      tableNumber: tableNumber == null && nullToAbsent
          ? const Value.absent()
          : Value(tableNumber),
      remark:
          remark == null && nullToAbsent ? const Value.absent() : Value(remark),
      cartIndex: Value(cartIndex),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
      completedAt: completedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(completedAt),
    );
  }

  factory Order.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Order(
      id: serializer.fromJson<int>(json['id']),
      orderNumber: serializer.fromJson<String>(json['orderNumber']),
      status: serializer.fromJson<String>(json['status']),
      totalAmount: serializer.fromJson<int>(json['totalAmount']),
      discountAmount: serializer.fromJson<int>(json['discountAmount']),
      finalAmount: serializer.fromJson<int>(json['finalAmount']),
      tableNumber: serializer.fromJson<String?>(json['tableNumber']),
      remark: serializer.fromJson<String?>(json['remark']),
      cartIndex: serializer.fromJson<int>(json['cartIndex']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
      completedAt: serializer.fromJson<DateTime?>(json['completedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'orderNumber': serializer.toJson<String>(orderNumber),
      'status': serializer.toJson<String>(status),
      'totalAmount': serializer.toJson<int>(totalAmount),
      'discountAmount': serializer.toJson<int>(discountAmount),
      'finalAmount': serializer.toJson<int>(finalAmount),
      'tableNumber': serializer.toJson<String?>(tableNumber),
      'remark': serializer.toJson<String?>(remark),
      'cartIndex': serializer.toJson<int>(cartIndex),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
      'completedAt': serializer.toJson<DateTime?>(completedAt),
    };
  }

  Order copyWith(
          {int? id,
          String? orderNumber,
          String? status,
          int? totalAmount,
          int? discountAmount,
          int? finalAmount,
          Value<String?> tableNumber = const Value.absent(),
          Value<String?> remark = const Value.absent(),
          int? cartIndex,
          DateTime? createdAt,
          DateTime? updatedAt,
          Value<DateTime?> completedAt = const Value.absent()}) =>
      Order(
        id: id ?? this.id,
        orderNumber: orderNumber ?? this.orderNumber,
        status: status ?? this.status,
        totalAmount: totalAmount ?? this.totalAmount,
        discountAmount: discountAmount ?? this.discountAmount,
        finalAmount: finalAmount ?? this.finalAmount,
        tableNumber: tableNumber.present ? tableNumber.value : this.tableNumber,
        remark: remark.present ? remark.value : this.remark,
        cartIndex: cartIndex ?? this.cartIndex,
        createdAt: createdAt ?? this.createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
        completedAt: completedAt.present ? completedAt.value : this.completedAt,
      );
  Order copyWithCompanion(OrdersCompanion data) {
    return Order(
      id: data.id.present ? data.id.value : this.id,
      orderNumber:
          data.orderNumber.present ? data.orderNumber.value : this.orderNumber,
      status: data.status.present ? data.status.value : this.status,
      totalAmount:
          data.totalAmount.present ? data.totalAmount.value : this.totalAmount,
      discountAmount: data.discountAmount.present
          ? data.discountAmount.value
          : this.discountAmount,
      finalAmount:
          data.finalAmount.present ? data.finalAmount.value : this.finalAmount,
      tableNumber:
          data.tableNumber.present ? data.tableNumber.value : this.tableNumber,
      remark: data.remark.present ? data.remark.value : this.remark,
      cartIndex: data.cartIndex.present ? data.cartIndex.value : this.cartIndex,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      completedAt:
          data.completedAt.present ? data.completedAt.value : this.completedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Order(')
          ..write('id: $id, ')
          ..write('orderNumber: $orderNumber, ')
          ..write('status: $status, ')
          ..write('totalAmount: $totalAmount, ')
          ..write('discountAmount: $discountAmount, ')
          ..write('finalAmount: $finalAmount, ')
          ..write('tableNumber: $tableNumber, ')
          ..write('remark: $remark, ')
          ..write('cartIndex: $cartIndex, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('completedAt: $completedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id,
      orderNumber,
      status,
      totalAmount,
      discountAmount,
      finalAmount,
      tableNumber,
      remark,
      cartIndex,
      createdAt,
      updatedAt,
      completedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Order &&
          other.id == this.id &&
          other.orderNumber == this.orderNumber &&
          other.status == this.status &&
          other.totalAmount == this.totalAmount &&
          other.discountAmount == this.discountAmount &&
          other.finalAmount == this.finalAmount &&
          other.tableNumber == this.tableNumber &&
          other.remark == this.remark &&
          other.cartIndex == this.cartIndex &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.completedAt == this.completedAt);
}

class OrdersCompanion extends UpdateCompanion<Order> {
  final Value<int> id;
  final Value<String> orderNumber;
  final Value<String> status;
  final Value<int> totalAmount;
  final Value<int> discountAmount;
  final Value<int> finalAmount;
  final Value<String?> tableNumber;
  final Value<String?> remark;
  final Value<int> cartIndex;
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<DateTime?> completedAt;
  const OrdersCompanion({
    this.id = const Value.absent(),
    this.orderNumber = const Value.absent(),
    this.status = const Value.absent(),
    this.totalAmount = const Value.absent(),
    this.discountAmount = const Value.absent(),
    this.finalAmount = const Value.absent(),
    this.tableNumber = const Value.absent(),
    this.remark = const Value.absent(),
    this.cartIndex = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.completedAt = const Value.absent(),
  });
  OrdersCompanion.insert({
    this.id = const Value.absent(),
    required String orderNumber,
    this.status = const Value.absent(),
    required int totalAmount,
    this.discountAmount = const Value.absent(),
    required int finalAmount,
    this.tableNumber = const Value.absent(),
    this.remark = const Value.absent(),
    this.cartIndex = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.completedAt = const Value.absent(),
  })  : orderNumber = Value(orderNumber),
        totalAmount = Value(totalAmount),
        finalAmount = Value(finalAmount);
  static Insertable<Order> custom({
    Expression<int>? id,
    Expression<String>? orderNumber,
    Expression<String>? status,
    Expression<int>? totalAmount,
    Expression<int>? discountAmount,
    Expression<int>? finalAmount,
    Expression<String>? tableNumber,
    Expression<String>? remark,
    Expression<int>? cartIndex,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<DateTime>? completedAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (orderNumber != null) 'order_number': orderNumber,
      if (status != null) 'status': status,
      if (totalAmount != null) 'total_amount': totalAmount,
      if (discountAmount != null) 'discount_amount': discountAmount,
      if (finalAmount != null) 'final_amount': finalAmount,
      if (tableNumber != null) 'table_number': tableNumber,
      if (remark != null) 'remark': remark,
      if (cartIndex != null) 'cart_index': cartIndex,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (completedAt != null) 'completed_at': completedAt,
    });
  }

  OrdersCompanion copyWith(
      {Value<int>? id,
      Value<String>? orderNumber,
      Value<String>? status,
      Value<int>? totalAmount,
      Value<int>? discountAmount,
      Value<int>? finalAmount,
      Value<String?>? tableNumber,
      Value<String?>? remark,
      Value<int>? cartIndex,
      Value<DateTime>? createdAt,
      Value<DateTime>? updatedAt,
      Value<DateTime?>? completedAt}) {
    return OrdersCompanion(
      id: id ?? this.id,
      orderNumber: orderNumber ?? this.orderNumber,
      status: status ?? this.status,
      totalAmount: totalAmount ?? this.totalAmount,
      discountAmount: discountAmount ?? this.discountAmount,
      finalAmount: finalAmount ?? this.finalAmount,
      tableNumber: tableNumber ?? this.tableNumber,
      remark: remark ?? this.remark,
      cartIndex: cartIndex ?? this.cartIndex,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      completedAt: completedAt ?? this.completedAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (orderNumber.present) {
      map['order_number'] = Variable<String>(orderNumber.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (totalAmount.present) {
      map['total_amount'] = Variable<int>(totalAmount.value);
    }
    if (discountAmount.present) {
      map['discount_amount'] = Variable<int>(discountAmount.value);
    }
    if (finalAmount.present) {
      map['final_amount'] = Variable<int>(finalAmount.value);
    }
    if (tableNumber.present) {
      map['table_number'] = Variable<String>(tableNumber.value);
    }
    if (remark.present) {
      map['remark'] = Variable<String>(remark.value);
    }
    if (cartIndex.present) {
      map['cart_index'] = Variable<int>(cartIndex.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (completedAt.present) {
      map['completed_at'] = Variable<DateTime>(completedAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OrdersCompanion(')
          ..write('id: $id, ')
          ..write('orderNumber: $orderNumber, ')
          ..write('status: $status, ')
          ..write('totalAmount: $totalAmount, ')
          ..write('discountAmount: $discountAmount, ')
          ..write('finalAmount: $finalAmount, ')
          ..write('tableNumber: $tableNumber, ')
          ..write('remark: $remark, ')
          ..write('cartIndex: $cartIndex, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('completedAt: $completedAt')
          ..write(')'))
        .toString();
  }
}

class $OrderItemsTable extends OrderItems
    with TableInfo<$OrderItemsTable, OrderItem> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OrderItemsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      hasAutoIncrement: true,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'));
  static const VerificationMeta _orderIdMeta =
      const VerificationMeta('orderId');
  @override
  late final GeneratedColumn<int> orderId = GeneratedColumn<int>(
      'order_id', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: true,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('REFERENCES orders (id)'));
  static const VerificationMeta _dishIdMeta = const VerificationMeta('dishId');
  @override
  late final GeneratedColumn<int> dishId = GeneratedColumn<int>(
      'dish_id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _dishNameMeta =
      const VerificationMeta('dishName');
  @override
  late final GeneratedColumn<String> dishName = GeneratedColumn<String>(
      'dish_name', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _unitPriceMeta =
      const VerificationMeta('unitPrice');
  @override
  late final GeneratedColumn<int> unitPrice = GeneratedColumn<int>(
      'unit_price', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _quantityMeta =
      const VerificationMeta('quantity');
  @override
  late final GeneratedColumn<int> quantity = GeneratedColumn<int>(
      'quantity', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _subtotalMeta =
      const VerificationMeta('subtotal');
  @override
  late final GeneratedColumn<int> subtotal = GeneratedColumn<int>(
      'subtotal', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns =>
      [id, orderId, dishId, dishName, unitPrice, quantity, subtotal];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'order_items';
  @override
  VerificationContext validateIntegrity(Insertable<OrderItem> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('order_id')) {
      context.handle(_orderIdMeta,
          orderId.isAcceptableOrUnknown(data['order_id']!, _orderIdMeta));
    } else if (isInserting) {
      context.missing(_orderIdMeta);
    }
    if (data.containsKey('dish_id')) {
      context.handle(_dishIdMeta,
          dishId.isAcceptableOrUnknown(data['dish_id']!, _dishIdMeta));
    } else if (isInserting) {
      context.missing(_dishIdMeta);
    }
    if (data.containsKey('dish_name')) {
      context.handle(_dishNameMeta,
          dishName.isAcceptableOrUnknown(data['dish_name']!, _dishNameMeta));
    } else if (isInserting) {
      context.missing(_dishNameMeta);
    }
    if (data.containsKey('unit_price')) {
      context.handle(_unitPriceMeta,
          unitPrice.isAcceptableOrUnknown(data['unit_price']!, _unitPriceMeta));
    } else if (isInserting) {
      context.missing(_unitPriceMeta);
    }
    if (data.containsKey('quantity')) {
      context.handle(_quantityMeta,
          quantity.isAcceptableOrUnknown(data['quantity']!, _quantityMeta));
    } else if (isInserting) {
      context.missing(_quantityMeta);
    }
    if (data.containsKey('subtotal')) {
      context.handle(_subtotalMeta,
          subtotal.isAcceptableOrUnknown(data['subtotal']!, _subtotalMeta));
    } else if (isInserting) {
      context.missing(_subtotalMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  OrderItem map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OrderItem(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      orderId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}order_id'])!,
      dishId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}dish_id'])!,
      dishName: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}dish_name'])!,
      unitPrice: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}unit_price'])!,
      quantity: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}quantity'])!,
      subtotal: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}subtotal'])!,
    );
  }

  @override
  $OrderItemsTable createAlias(String alias) {
    return $OrderItemsTable(attachedDatabase, alias);
  }
}

class OrderItem extends DataClass implements Insertable<OrderItem> {
  final int id;
  final int orderId;
  final int dishId;
  final String dishName;
  final int unitPrice;
  final int quantity;
  final int subtotal;
  const OrderItem(
      {required this.id,
      required this.orderId,
      required this.dishId,
      required this.dishName,
      required this.unitPrice,
      required this.quantity,
      required this.subtotal});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['order_id'] = Variable<int>(orderId);
    map['dish_id'] = Variable<int>(dishId);
    map['dish_name'] = Variable<String>(dishName);
    map['unit_price'] = Variable<int>(unitPrice);
    map['quantity'] = Variable<int>(quantity);
    map['subtotal'] = Variable<int>(subtotal);
    return map;
  }

  OrderItemsCompanion toCompanion(bool nullToAbsent) {
    return OrderItemsCompanion(
      id: Value(id),
      orderId: Value(orderId),
      dishId: Value(dishId),
      dishName: Value(dishName),
      unitPrice: Value(unitPrice),
      quantity: Value(quantity),
      subtotal: Value(subtotal),
    );
  }

  factory OrderItem.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OrderItem(
      id: serializer.fromJson<int>(json['id']),
      orderId: serializer.fromJson<int>(json['orderId']),
      dishId: serializer.fromJson<int>(json['dishId']),
      dishName: serializer.fromJson<String>(json['dishName']),
      unitPrice: serializer.fromJson<int>(json['unitPrice']),
      quantity: serializer.fromJson<int>(json['quantity']),
      subtotal: serializer.fromJson<int>(json['subtotal']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'orderId': serializer.toJson<int>(orderId),
      'dishId': serializer.toJson<int>(dishId),
      'dishName': serializer.toJson<String>(dishName),
      'unitPrice': serializer.toJson<int>(unitPrice),
      'quantity': serializer.toJson<int>(quantity),
      'subtotal': serializer.toJson<int>(subtotal),
    };
  }

  OrderItem copyWith(
          {int? id,
          int? orderId,
          int? dishId,
          String? dishName,
          int? unitPrice,
          int? quantity,
          int? subtotal}) =>
      OrderItem(
        id: id ?? this.id,
        orderId: orderId ?? this.orderId,
        dishId: dishId ?? this.dishId,
        dishName: dishName ?? this.dishName,
        unitPrice: unitPrice ?? this.unitPrice,
        quantity: quantity ?? this.quantity,
        subtotal: subtotal ?? this.subtotal,
      );
  OrderItem copyWithCompanion(OrderItemsCompanion data) {
    return OrderItem(
      id: data.id.present ? data.id.value : this.id,
      orderId: data.orderId.present ? data.orderId.value : this.orderId,
      dishId: data.dishId.present ? data.dishId.value : this.dishId,
      dishName: data.dishName.present ? data.dishName.value : this.dishName,
      unitPrice: data.unitPrice.present ? data.unitPrice.value : this.unitPrice,
      quantity: data.quantity.present ? data.quantity.value : this.quantity,
      subtotal: data.subtotal.present ? data.subtotal.value : this.subtotal,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OrderItem(')
          ..write('id: $id, ')
          ..write('orderId: $orderId, ')
          ..write('dishId: $dishId, ')
          ..write('dishName: $dishName, ')
          ..write('unitPrice: $unitPrice, ')
          ..write('quantity: $quantity, ')
          ..write('subtotal: $subtotal')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, orderId, dishId, dishName, unitPrice, quantity, subtotal);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OrderItem &&
          other.id == this.id &&
          other.orderId == this.orderId &&
          other.dishId == this.dishId &&
          other.dishName == this.dishName &&
          other.unitPrice == this.unitPrice &&
          other.quantity == this.quantity &&
          other.subtotal == this.subtotal);
}

class OrderItemsCompanion extends UpdateCompanion<OrderItem> {
  final Value<int> id;
  final Value<int> orderId;
  final Value<int> dishId;
  final Value<String> dishName;
  final Value<int> unitPrice;
  final Value<int> quantity;
  final Value<int> subtotal;
  const OrderItemsCompanion({
    this.id = const Value.absent(),
    this.orderId = const Value.absent(),
    this.dishId = const Value.absent(),
    this.dishName = const Value.absent(),
    this.unitPrice = const Value.absent(),
    this.quantity = const Value.absent(),
    this.subtotal = const Value.absent(),
  });
  OrderItemsCompanion.insert({
    this.id = const Value.absent(),
    required int orderId,
    required int dishId,
    required String dishName,
    required int unitPrice,
    required int quantity,
    required int subtotal,
  })  : orderId = Value(orderId),
        dishId = Value(dishId),
        dishName = Value(dishName),
        unitPrice = Value(unitPrice),
        quantity = Value(quantity),
        subtotal = Value(subtotal);
  static Insertable<OrderItem> custom({
    Expression<int>? id,
    Expression<int>? orderId,
    Expression<int>? dishId,
    Expression<String>? dishName,
    Expression<int>? unitPrice,
    Expression<int>? quantity,
    Expression<int>? subtotal,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (orderId != null) 'order_id': orderId,
      if (dishId != null) 'dish_id': dishId,
      if (dishName != null) 'dish_name': dishName,
      if (unitPrice != null) 'unit_price': unitPrice,
      if (quantity != null) 'quantity': quantity,
      if (subtotal != null) 'subtotal': subtotal,
    });
  }

  OrderItemsCompanion copyWith(
      {Value<int>? id,
      Value<int>? orderId,
      Value<int>? dishId,
      Value<String>? dishName,
      Value<int>? unitPrice,
      Value<int>? quantity,
      Value<int>? subtotal}) {
    return OrderItemsCompanion(
      id: id ?? this.id,
      orderId: orderId ?? this.orderId,
      dishId: dishId ?? this.dishId,
      dishName: dishName ?? this.dishName,
      unitPrice: unitPrice ?? this.unitPrice,
      quantity: quantity ?? this.quantity,
      subtotal: subtotal ?? this.subtotal,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (orderId.present) {
      map['order_id'] = Variable<int>(orderId.value);
    }
    if (dishId.present) {
      map['dish_id'] = Variable<int>(dishId.value);
    }
    if (dishName.present) {
      map['dish_name'] = Variable<String>(dishName.value);
    }
    if (unitPrice.present) {
      map['unit_price'] = Variable<int>(unitPrice.value);
    }
    if (quantity.present) {
      map['quantity'] = Variable<int>(quantity.value);
    }
    if (subtotal.present) {
      map['subtotal'] = Variable<int>(subtotal.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OrderItemsCompanion(')
          ..write('id: $id, ')
          ..write('orderId: $orderId, ')
          ..write('dishId: $dishId, ')
          ..write('dishName: $dishName, ')
          ..write('unitPrice: $unitPrice, ')
          ..write('quantity: $quantity, ')
          ..write('subtotal: $subtotal')
          ..write(')'))
        .toString();
  }
}

class $SystemConfigTable extends SystemConfig
    with TableInfo<$SystemConfigTable, SystemConfigData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SystemConfigTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      hasAutoIncrement: true,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'));
  static const VerificationMeta _keyMeta = const VerificationMeta('key');
  @override
  late final GeneratedColumn<String> key = GeneratedColumn<String>(
      'key', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: true,
      defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'));
  static const VerificationMeta _valueMeta = const VerificationMeta('value');
  @override
  late final GeneratedColumn<String> value = GeneratedColumn<String>(
      'value', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _updatedAtMeta =
      const VerificationMeta('updatedAt');
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
      'updated_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns => [id, key, value, updatedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'system_config';
  @override
  VerificationContext validateIntegrity(Insertable<SystemConfigData> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('key')) {
      context.handle(
          _keyMeta, key.isAcceptableOrUnknown(data['key']!, _keyMeta));
    } else if (isInserting) {
      context.missing(_keyMeta);
    }
    if (data.containsKey('value')) {
      context.handle(
          _valueMeta, value.isAcceptableOrUnknown(data['value']!, _valueMeta));
    } else if (isInserting) {
      context.missing(_valueMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(_updatedAtMeta,
          updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  SystemConfigData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SystemConfigData(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      key: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}key'])!,
      value: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}value'])!,
      updatedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}updated_at'])!,
    );
  }

  @override
  $SystemConfigTable createAlias(String alias) {
    return $SystemConfigTable(attachedDatabase, alias);
  }
}

class SystemConfigData extends DataClass
    implements Insertable<SystemConfigData> {
  final int id;
  final String key;
  final String value;
  final DateTime updatedAt;
  const SystemConfigData(
      {required this.id,
      required this.key,
      required this.value,
      required this.updatedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['key'] = Variable<String>(key);
    map['value'] = Variable<String>(value);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  SystemConfigCompanion toCompanion(bool nullToAbsent) {
    return SystemConfigCompanion(
      id: Value(id),
      key: Value(key),
      value: Value(value),
      updatedAt: Value(updatedAt),
    );
  }

  factory SystemConfigData.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SystemConfigData(
      id: serializer.fromJson<int>(json['id']),
      key: serializer.fromJson<String>(json['key']),
      value: serializer.fromJson<String>(json['value']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'key': serializer.toJson<String>(key),
      'value': serializer.toJson<String>(value),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  SystemConfigData copyWith(
          {int? id, String? key, String? value, DateTime? updatedAt}) =>
      SystemConfigData(
        id: id ?? this.id,
        key: key ?? this.key,
        value: value ?? this.value,
        updatedAt: updatedAt ?? this.updatedAt,
      );
  SystemConfigData copyWithCompanion(SystemConfigCompanion data) {
    return SystemConfigData(
      id: data.id.present ? data.id.value : this.id,
      key: data.key.present ? data.key.value : this.key,
      value: data.value.present ? data.value.value : this.value,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SystemConfigData(')
          ..write('id: $id, ')
          ..write('key: $key, ')
          ..write('value: $value, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, key, value, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SystemConfigData &&
          other.id == this.id &&
          other.key == this.key &&
          other.value == this.value &&
          other.updatedAt == this.updatedAt);
}

class SystemConfigCompanion extends UpdateCompanion<SystemConfigData> {
  final Value<int> id;
  final Value<String> key;
  final Value<String> value;
  final Value<DateTime> updatedAt;
  const SystemConfigCompanion({
    this.id = const Value.absent(),
    this.key = const Value.absent(),
    this.value = const Value.absent(),
    this.updatedAt = const Value.absent(),
  });
  SystemConfigCompanion.insert({
    this.id = const Value.absent(),
    required String key,
    required String value,
    this.updatedAt = const Value.absent(),
  })  : key = Value(key),
        value = Value(value);
  static Insertable<SystemConfigData> custom({
    Expression<int>? id,
    Expression<String>? key,
    Expression<String>? value,
    Expression<DateTime>? updatedAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (key != null) 'key': key,
      if (value != null) 'value': value,
      if (updatedAt != null) 'updated_at': updatedAt,
    });
  }

  SystemConfigCompanion copyWith(
      {Value<int>? id,
      Value<String>? key,
      Value<String>? value,
      Value<DateTime>? updatedAt}) {
    return SystemConfigCompanion(
      id: id ?? this.id,
      key: key ?? this.key,
      value: value ?? this.value,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (key.present) {
      map['key'] = Variable<String>(key.value);
    }
    if (value.present) {
      map['value'] = Variable<String>(value.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SystemConfigCompanion(')
          ..write('id: $id, ')
          ..write('key: $key, ')
          ..write('value: $value, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }
}

class $DailyStatisticsTable extends DailyStatistics
    with TableInfo<$DailyStatisticsTable, DailyStatistic> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DailyStatisticsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      hasAutoIncrement: true,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'));
  static const VerificationMeta _statDateMeta =
      const VerificationMeta('statDate');
  @override
  late final GeneratedColumn<DateTime> statDate = GeneratedColumn<DateTime>(
      'stat_date', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _orderCountMeta =
      const VerificationMeta('orderCount');
  @override
  late final GeneratedColumn<int> orderCount = GeneratedColumn<int>(
      'order_count', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _totalRevenueMeta =
      const VerificationMeta('totalRevenue');
  @override
  late final GeneratedColumn<int> totalRevenue = GeneratedColumn<int>(
      'total_revenue', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _refundCountMeta =
      const VerificationMeta('refundCount');
  @override
  late final GeneratedColumn<int> refundCount = GeneratedColumn<int>(
      'refund_count', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _refundAmountMeta =
      const VerificationMeta('refundAmount');
  @override
  late final GeneratedColumn<int> refundAmount = GeneratedColumn<int>(
      'refund_amount', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _netRevenueMeta =
      const VerificationMeta('netRevenue');
  @override
  late final GeneratedColumn<int> netRevenue = GeneratedColumn<int>(
      'net_revenue', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _avgOrderAmountMeta =
      const VerificationMeta('avgOrderAmount');
  @override
  late final GeneratedColumn<double> avgOrderAmount = GeneratedColumn<double>(
      'avg_order_amount', aliasedName, false,
      type: DriftSqlType.double,
      requiredDuringInsert: false,
      defaultValue: const Constant(0.0));
  static const VerificationMeta _completedCountMeta =
      const VerificationMeta('completedCount');
  @override
  late final GeneratedColumn<int> completedCount = GeneratedColumn<int>(
      'completed_count', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _pendingCountMeta =
      const VerificationMeta('pendingCount');
  @override
  late final GeneratedColumn<int> pendingCount = GeneratedColumn<int>(
      'pending_count', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        statDate,
        orderCount,
        totalRevenue,
        refundCount,
        refundAmount,
        netRevenue,
        avgOrderAmount,
        completedCount,
        pendingCount,
        createdAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'daily_statistics';
  @override
  VerificationContext validateIntegrity(Insertable<DailyStatistic> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('stat_date')) {
      context.handle(_statDateMeta,
          statDate.isAcceptableOrUnknown(data['stat_date']!, _statDateMeta));
    } else if (isInserting) {
      context.missing(_statDateMeta);
    }
    if (data.containsKey('order_count')) {
      context.handle(
          _orderCountMeta,
          orderCount.isAcceptableOrUnknown(
              data['order_count']!, _orderCountMeta));
    }
    if (data.containsKey('total_revenue')) {
      context.handle(
          _totalRevenueMeta,
          totalRevenue.isAcceptableOrUnknown(
              data['total_revenue']!, _totalRevenueMeta));
    }
    if (data.containsKey('refund_count')) {
      context.handle(
          _refundCountMeta,
          refundCount.isAcceptableOrUnknown(
              data['refund_count']!, _refundCountMeta));
    }
    if (data.containsKey('refund_amount')) {
      context.handle(
          _refundAmountMeta,
          refundAmount.isAcceptableOrUnknown(
              data['refund_amount']!, _refundAmountMeta));
    }
    if (data.containsKey('net_revenue')) {
      context.handle(
          _netRevenueMeta,
          netRevenue.isAcceptableOrUnknown(
              data['net_revenue']!, _netRevenueMeta));
    }
    if (data.containsKey('avg_order_amount')) {
      context.handle(
          _avgOrderAmountMeta,
          avgOrderAmount.isAcceptableOrUnknown(
              data['avg_order_amount']!, _avgOrderAmountMeta));
    }
    if (data.containsKey('completed_count')) {
      context.handle(
          _completedCountMeta,
          completedCount.isAcceptableOrUnknown(
              data['completed_count']!, _completedCountMeta));
    }
    if (data.containsKey('pending_count')) {
      context.handle(
          _pendingCountMeta,
          pendingCount.isAcceptableOrUnknown(
              data['pending_count']!, _pendingCountMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  DailyStatistic map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DailyStatistic(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      statDate: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}stat_date'])!,
      orderCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}order_count'])!,
      totalRevenue: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}total_revenue'])!,
      refundCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}refund_count'])!,
      refundAmount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}refund_amount'])!,
      netRevenue: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}net_revenue'])!,
      avgOrderAmount: attachedDatabase.typeMapping.read(
          DriftSqlType.double, data['${effectivePrefix}avg_order_amount'])!,
      completedCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}completed_count'])!,
      pendingCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}pending_count'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
    );
  }

  @override
  $DailyStatisticsTable createAlias(String alias) {
    return $DailyStatisticsTable(attachedDatabase, alias);
  }
}

class DailyStatistic extends DataClass implements Insertable<DailyStatistic> {
  final int id;
  final DateTime statDate;
  final int orderCount;
  final int totalRevenue;
  final int refundCount;
  final int refundAmount;
  final int netRevenue;
  final double avgOrderAmount;
  final int completedCount;
  final int pendingCount;
  final DateTime createdAt;
  const DailyStatistic(
      {required this.id,
      required this.statDate,
      required this.orderCount,
      required this.totalRevenue,
      required this.refundCount,
      required this.refundAmount,
      required this.netRevenue,
      required this.avgOrderAmount,
      required this.completedCount,
      required this.pendingCount,
      required this.createdAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['stat_date'] = Variable<DateTime>(statDate);
    map['order_count'] = Variable<int>(orderCount);
    map['total_revenue'] = Variable<int>(totalRevenue);
    map['refund_count'] = Variable<int>(refundCount);
    map['refund_amount'] = Variable<int>(refundAmount);
    map['net_revenue'] = Variable<int>(netRevenue);
    map['avg_order_amount'] = Variable<double>(avgOrderAmount);
    map['completed_count'] = Variable<int>(completedCount);
    map['pending_count'] = Variable<int>(pendingCount);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  DailyStatisticsCompanion toCompanion(bool nullToAbsent) {
    return DailyStatisticsCompanion(
      id: Value(id),
      statDate: Value(statDate),
      orderCount: Value(orderCount),
      totalRevenue: Value(totalRevenue),
      refundCount: Value(refundCount),
      refundAmount: Value(refundAmount),
      netRevenue: Value(netRevenue),
      avgOrderAmount: Value(avgOrderAmount),
      completedCount: Value(completedCount),
      pendingCount: Value(pendingCount),
      createdAt: Value(createdAt),
    );
  }

  factory DailyStatistic.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DailyStatistic(
      id: serializer.fromJson<int>(json['id']),
      statDate: serializer.fromJson<DateTime>(json['statDate']),
      orderCount: serializer.fromJson<int>(json['orderCount']),
      totalRevenue: serializer.fromJson<int>(json['totalRevenue']),
      refundCount: serializer.fromJson<int>(json['refundCount']),
      refundAmount: serializer.fromJson<int>(json['refundAmount']),
      netRevenue: serializer.fromJson<int>(json['netRevenue']),
      avgOrderAmount: serializer.fromJson<double>(json['avgOrderAmount']),
      completedCount: serializer.fromJson<int>(json['completedCount']),
      pendingCount: serializer.fromJson<int>(json['pendingCount']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'statDate': serializer.toJson<DateTime>(statDate),
      'orderCount': serializer.toJson<int>(orderCount),
      'totalRevenue': serializer.toJson<int>(totalRevenue),
      'refundCount': serializer.toJson<int>(refundCount),
      'refundAmount': serializer.toJson<int>(refundAmount),
      'netRevenue': serializer.toJson<int>(netRevenue),
      'avgOrderAmount': serializer.toJson<double>(avgOrderAmount),
      'completedCount': serializer.toJson<int>(completedCount),
      'pendingCount': serializer.toJson<int>(pendingCount),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  DailyStatistic copyWith(
          {int? id,
          DateTime? statDate,
          int? orderCount,
          int? totalRevenue,
          int? refundCount,
          int? refundAmount,
          int? netRevenue,
          double? avgOrderAmount,
          int? completedCount,
          int? pendingCount,
          DateTime? createdAt}) =>
      DailyStatistic(
        id: id ?? this.id,
        statDate: statDate ?? this.statDate,
        orderCount: orderCount ?? this.orderCount,
        totalRevenue: totalRevenue ?? this.totalRevenue,
        refundCount: refundCount ?? this.refundCount,
        refundAmount: refundAmount ?? this.refundAmount,
        netRevenue: netRevenue ?? this.netRevenue,
        avgOrderAmount: avgOrderAmount ?? this.avgOrderAmount,
        completedCount: completedCount ?? this.completedCount,
        pendingCount: pendingCount ?? this.pendingCount,
        createdAt: createdAt ?? this.createdAt,
      );
  DailyStatistic copyWithCompanion(DailyStatisticsCompanion data) {
    return DailyStatistic(
      id: data.id.present ? data.id.value : this.id,
      statDate: data.statDate.present ? data.statDate.value : this.statDate,
      orderCount:
          data.orderCount.present ? data.orderCount.value : this.orderCount,
      totalRevenue: data.totalRevenue.present
          ? data.totalRevenue.value
          : this.totalRevenue,
      refundCount:
          data.refundCount.present ? data.refundCount.value : this.refundCount,
      refundAmount: data.refundAmount.present
          ? data.refundAmount.value
          : this.refundAmount,
      netRevenue:
          data.netRevenue.present ? data.netRevenue.value : this.netRevenue,
      avgOrderAmount: data.avgOrderAmount.present
          ? data.avgOrderAmount.value
          : this.avgOrderAmount,
      completedCount: data.completedCount.present
          ? data.completedCount.value
          : this.completedCount,
      pendingCount: data.pendingCount.present
          ? data.pendingCount.value
          : this.pendingCount,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DailyStatistic(')
          ..write('id: $id, ')
          ..write('statDate: $statDate, ')
          ..write('orderCount: $orderCount, ')
          ..write('totalRevenue: $totalRevenue, ')
          ..write('refundCount: $refundCount, ')
          ..write('refundAmount: $refundAmount, ')
          ..write('netRevenue: $netRevenue, ')
          ..write('avgOrderAmount: $avgOrderAmount, ')
          ..write('completedCount: $completedCount, ')
          ..write('pendingCount: $pendingCount, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id,
      statDate,
      orderCount,
      totalRevenue,
      refundCount,
      refundAmount,
      netRevenue,
      avgOrderAmount,
      completedCount,
      pendingCount,
      createdAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DailyStatistic &&
          other.id == this.id &&
          other.statDate == this.statDate &&
          other.orderCount == this.orderCount &&
          other.totalRevenue == this.totalRevenue &&
          other.refundCount == this.refundCount &&
          other.refundAmount == this.refundAmount &&
          other.netRevenue == this.netRevenue &&
          other.avgOrderAmount == this.avgOrderAmount &&
          other.completedCount == this.completedCount &&
          other.pendingCount == this.pendingCount &&
          other.createdAt == this.createdAt);
}

class DailyStatisticsCompanion extends UpdateCompanion<DailyStatistic> {
  final Value<int> id;
  final Value<DateTime> statDate;
  final Value<int> orderCount;
  final Value<int> totalRevenue;
  final Value<int> refundCount;
  final Value<int> refundAmount;
  final Value<int> netRevenue;
  final Value<double> avgOrderAmount;
  final Value<int> completedCount;
  final Value<int> pendingCount;
  final Value<DateTime> createdAt;
  const DailyStatisticsCompanion({
    this.id = const Value.absent(),
    this.statDate = const Value.absent(),
    this.orderCount = const Value.absent(),
    this.totalRevenue = const Value.absent(),
    this.refundCount = const Value.absent(),
    this.refundAmount = const Value.absent(),
    this.netRevenue = const Value.absent(),
    this.avgOrderAmount = const Value.absent(),
    this.completedCount = const Value.absent(),
    this.pendingCount = const Value.absent(),
    this.createdAt = const Value.absent(),
  });
  DailyStatisticsCompanion.insert({
    this.id = const Value.absent(),
    required DateTime statDate,
    this.orderCount = const Value.absent(),
    this.totalRevenue = const Value.absent(),
    this.refundCount = const Value.absent(),
    this.refundAmount = const Value.absent(),
    this.netRevenue = const Value.absent(),
    this.avgOrderAmount = const Value.absent(),
    this.completedCount = const Value.absent(),
    this.pendingCount = const Value.absent(),
    this.createdAt = const Value.absent(),
  }) : statDate = Value(statDate);
  static Insertable<DailyStatistic> custom({
    Expression<int>? id,
    Expression<DateTime>? statDate,
    Expression<int>? orderCount,
    Expression<int>? totalRevenue,
    Expression<int>? refundCount,
    Expression<int>? refundAmount,
    Expression<int>? netRevenue,
    Expression<double>? avgOrderAmount,
    Expression<int>? completedCount,
    Expression<int>? pendingCount,
    Expression<DateTime>? createdAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (statDate != null) 'stat_date': statDate,
      if (orderCount != null) 'order_count': orderCount,
      if (totalRevenue != null) 'total_revenue': totalRevenue,
      if (refundCount != null) 'refund_count': refundCount,
      if (refundAmount != null) 'refund_amount': refundAmount,
      if (netRevenue != null) 'net_revenue': netRevenue,
      if (avgOrderAmount != null) 'avg_order_amount': avgOrderAmount,
      if (completedCount != null) 'completed_count': completedCount,
      if (pendingCount != null) 'pending_count': pendingCount,
      if (createdAt != null) 'created_at': createdAt,
    });
  }

  DailyStatisticsCompanion copyWith(
      {Value<int>? id,
      Value<DateTime>? statDate,
      Value<int>? orderCount,
      Value<int>? totalRevenue,
      Value<int>? refundCount,
      Value<int>? refundAmount,
      Value<int>? netRevenue,
      Value<double>? avgOrderAmount,
      Value<int>? completedCount,
      Value<int>? pendingCount,
      Value<DateTime>? createdAt}) {
    return DailyStatisticsCompanion(
      id: id ?? this.id,
      statDate: statDate ?? this.statDate,
      orderCount: orderCount ?? this.orderCount,
      totalRevenue: totalRevenue ?? this.totalRevenue,
      refundCount: refundCount ?? this.refundCount,
      refundAmount: refundAmount ?? this.refundAmount,
      netRevenue: netRevenue ?? this.netRevenue,
      avgOrderAmount: avgOrderAmount ?? this.avgOrderAmount,
      completedCount: completedCount ?? this.completedCount,
      pendingCount: pendingCount ?? this.pendingCount,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (statDate.present) {
      map['stat_date'] = Variable<DateTime>(statDate.value);
    }
    if (orderCount.present) {
      map['order_count'] = Variable<int>(orderCount.value);
    }
    if (totalRevenue.present) {
      map['total_revenue'] = Variable<int>(totalRevenue.value);
    }
    if (refundCount.present) {
      map['refund_count'] = Variable<int>(refundCount.value);
    }
    if (refundAmount.present) {
      map['refund_amount'] = Variable<int>(refundAmount.value);
    }
    if (netRevenue.present) {
      map['net_revenue'] = Variable<int>(netRevenue.value);
    }
    if (avgOrderAmount.present) {
      map['avg_order_amount'] = Variable<double>(avgOrderAmount.value);
    }
    if (completedCount.present) {
      map['completed_count'] = Variable<int>(completedCount.value);
    }
    if (pendingCount.present) {
      map['pending_count'] = Variable<int>(pendingCount.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DailyStatisticsCompanion(')
          ..write('id: $id, ')
          ..write('statDate: $statDate, ')
          ..write('orderCount: $orderCount, ')
          ..write('totalRevenue: $totalRevenue, ')
          ..write('refundCount: $refundCount, ')
          ..write('refundAmount: $refundAmount, ')
          ..write('netRevenue: $netRevenue, ')
          ..write('avgOrderAmount: $avgOrderAmount, ')
          ..write('completedCount: $completedCount, ')
          ..write('pendingCount: $pendingCount, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }
}

class $DishDailyStatisticsTable extends DishDailyStatistics
    with TableInfo<$DishDailyStatisticsTable, DishDailyStatistic> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DishDailyStatisticsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      hasAutoIncrement: true,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'));
  static const VerificationMeta _dishIdMeta = const VerificationMeta('dishId');
  @override
  late final GeneratedColumn<int> dishId = GeneratedColumn<int>(
      'dish_id', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _dishNameMeta =
      const VerificationMeta('dishName');
  @override
  late final GeneratedColumn<String> dishName = GeneratedColumn<String>(
      'dish_name', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _statDateMeta =
      const VerificationMeta('statDate');
  @override
  late final GeneratedColumn<DateTime> statDate = GeneratedColumn<DateTime>(
      'stat_date', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _soldCountMeta =
      const VerificationMeta('soldCount');
  @override
  late final GeneratedColumn<int> soldCount = GeneratedColumn<int>(
      'sold_count', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _revenueMeta =
      const VerificationMeta('revenue');
  @override
  late final GeneratedColumn<int> revenue = GeneratedColumn<int>(
      'revenue', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _refundCountMeta =
      const VerificationMeta('refundCount');
  @override
  late final GeneratedColumn<int> refundCount = GeneratedColumn<int>(
      'refund_count', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _refundAmountMeta =
      const VerificationMeta('refundAmount');
  @override
  late final GeneratedColumn<int> refundAmount = GeneratedColumn<int>(
      'refund_amount', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        dishId,
        dishName,
        statDate,
        soldCount,
        revenue,
        refundCount,
        refundAmount,
        createdAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'dish_daily_statistics';
  @override
  VerificationContext validateIntegrity(Insertable<DishDailyStatistic> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('dish_id')) {
      context.handle(_dishIdMeta,
          dishId.isAcceptableOrUnknown(data['dish_id']!, _dishIdMeta));
    } else if (isInserting) {
      context.missing(_dishIdMeta);
    }
    if (data.containsKey('dish_name')) {
      context.handle(_dishNameMeta,
          dishName.isAcceptableOrUnknown(data['dish_name']!, _dishNameMeta));
    } else if (isInserting) {
      context.missing(_dishNameMeta);
    }
    if (data.containsKey('stat_date')) {
      context.handle(_statDateMeta,
          statDate.isAcceptableOrUnknown(data['stat_date']!, _statDateMeta));
    } else if (isInserting) {
      context.missing(_statDateMeta);
    }
    if (data.containsKey('sold_count')) {
      context.handle(_soldCountMeta,
          soldCount.isAcceptableOrUnknown(data['sold_count']!, _soldCountMeta));
    }
    if (data.containsKey('revenue')) {
      context.handle(_revenueMeta,
          revenue.isAcceptableOrUnknown(data['revenue']!, _revenueMeta));
    }
    if (data.containsKey('refund_count')) {
      context.handle(
          _refundCountMeta,
          refundCount.isAcceptableOrUnknown(
              data['refund_count']!, _refundCountMeta));
    }
    if (data.containsKey('refund_amount')) {
      context.handle(
          _refundAmountMeta,
          refundAmount.isAcceptableOrUnknown(
              data['refund_amount']!, _refundAmountMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  DishDailyStatistic map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DishDailyStatistic(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      dishId: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}dish_id'])!,
      dishName: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}dish_name'])!,
      statDate: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}stat_date'])!,
      soldCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}sold_count'])!,
      revenue: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}revenue'])!,
      refundCount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}refund_count'])!,
      refundAmount: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}refund_amount'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
    );
  }

  @override
  $DishDailyStatisticsTable createAlias(String alias) {
    return $DishDailyStatisticsTable(attachedDatabase, alias);
  }
}

class DishDailyStatistic extends DataClass
    implements Insertable<DishDailyStatistic> {
  final int id;
  final int dishId;
  final String dishName;
  final DateTime statDate;
  final int soldCount;
  final int revenue;
  final int refundCount;
  final int refundAmount;
  final DateTime createdAt;
  const DishDailyStatistic(
      {required this.id,
      required this.dishId,
      required this.dishName,
      required this.statDate,
      required this.soldCount,
      required this.revenue,
      required this.refundCount,
      required this.refundAmount,
      required this.createdAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['dish_id'] = Variable<int>(dishId);
    map['dish_name'] = Variable<String>(dishName);
    map['stat_date'] = Variable<DateTime>(statDate);
    map['sold_count'] = Variable<int>(soldCount);
    map['revenue'] = Variable<int>(revenue);
    map['refund_count'] = Variable<int>(refundCount);
    map['refund_amount'] = Variable<int>(refundAmount);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  DishDailyStatisticsCompanion toCompanion(bool nullToAbsent) {
    return DishDailyStatisticsCompanion(
      id: Value(id),
      dishId: Value(dishId),
      dishName: Value(dishName),
      statDate: Value(statDate),
      soldCount: Value(soldCount),
      revenue: Value(revenue),
      refundCount: Value(refundCount),
      refundAmount: Value(refundAmount),
      createdAt: Value(createdAt),
    );
  }

  factory DishDailyStatistic.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DishDailyStatistic(
      id: serializer.fromJson<int>(json['id']),
      dishId: serializer.fromJson<int>(json['dishId']),
      dishName: serializer.fromJson<String>(json['dishName']),
      statDate: serializer.fromJson<DateTime>(json['statDate']),
      soldCount: serializer.fromJson<int>(json['soldCount']),
      revenue: serializer.fromJson<int>(json['revenue']),
      refundCount: serializer.fromJson<int>(json['refundCount']),
      refundAmount: serializer.fromJson<int>(json['refundAmount']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'dishId': serializer.toJson<int>(dishId),
      'dishName': serializer.toJson<String>(dishName),
      'statDate': serializer.toJson<DateTime>(statDate),
      'soldCount': serializer.toJson<int>(soldCount),
      'revenue': serializer.toJson<int>(revenue),
      'refundCount': serializer.toJson<int>(refundCount),
      'refundAmount': serializer.toJson<int>(refundAmount),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  DishDailyStatistic copyWith(
          {int? id,
          int? dishId,
          String? dishName,
          DateTime? statDate,
          int? soldCount,
          int? revenue,
          int? refundCount,
          int? refundAmount,
          DateTime? createdAt}) =>
      DishDailyStatistic(
        id: id ?? this.id,
        dishId: dishId ?? this.dishId,
        dishName: dishName ?? this.dishName,
        statDate: statDate ?? this.statDate,
        soldCount: soldCount ?? this.soldCount,
        revenue: revenue ?? this.revenue,
        refundCount: refundCount ?? this.refundCount,
        refundAmount: refundAmount ?? this.refundAmount,
        createdAt: createdAt ?? this.createdAt,
      );
  DishDailyStatistic copyWithCompanion(DishDailyStatisticsCompanion data) {
    return DishDailyStatistic(
      id: data.id.present ? data.id.value : this.id,
      dishId: data.dishId.present ? data.dishId.value : this.dishId,
      dishName: data.dishName.present ? data.dishName.value : this.dishName,
      statDate: data.statDate.present ? data.statDate.value : this.statDate,
      soldCount: data.soldCount.present ? data.soldCount.value : this.soldCount,
      revenue: data.revenue.present ? data.revenue.value : this.revenue,
      refundCount:
          data.refundCount.present ? data.refundCount.value : this.refundCount,
      refundAmount: data.refundAmount.present
          ? data.refundAmount.value
          : this.refundAmount,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DishDailyStatistic(')
          ..write('id: $id, ')
          ..write('dishId: $dishId, ')
          ..write('dishName: $dishName, ')
          ..write('statDate: $statDate, ')
          ..write('soldCount: $soldCount, ')
          ..write('revenue: $revenue, ')
          ..write('refundCount: $refundCount, ')
          ..write('refundAmount: $refundAmount, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, dishId, dishName, statDate, soldCount,
      revenue, refundCount, refundAmount, createdAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DishDailyStatistic &&
          other.id == this.id &&
          other.dishId == this.dishId &&
          other.dishName == this.dishName &&
          other.statDate == this.statDate &&
          other.soldCount == this.soldCount &&
          other.revenue == this.revenue &&
          other.refundCount == this.refundCount &&
          other.refundAmount == this.refundAmount &&
          other.createdAt == this.createdAt);
}

class DishDailyStatisticsCompanion extends UpdateCompanion<DishDailyStatistic> {
  final Value<int> id;
  final Value<int> dishId;
  final Value<String> dishName;
  final Value<DateTime> statDate;
  final Value<int> soldCount;
  final Value<int> revenue;
  final Value<int> refundCount;
  final Value<int> refundAmount;
  final Value<DateTime> createdAt;
  const DishDailyStatisticsCompanion({
    this.id = const Value.absent(),
    this.dishId = const Value.absent(),
    this.dishName = const Value.absent(),
    this.statDate = const Value.absent(),
    this.soldCount = const Value.absent(),
    this.revenue = const Value.absent(),
    this.refundCount = const Value.absent(),
    this.refundAmount = const Value.absent(),
    this.createdAt = const Value.absent(),
  });
  DishDailyStatisticsCompanion.insert({
    this.id = const Value.absent(),
    required int dishId,
    required String dishName,
    required DateTime statDate,
    this.soldCount = const Value.absent(),
    this.revenue = const Value.absent(),
    this.refundCount = const Value.absent(),
    this.refundAmount = const Value.absent(),
    this.createdAt = const Value.absent(),
  })  : dishId = Value(dishId),
        dishName = Value(dishName),
        statDate = Value(statDate);
  static Insertable<DishDailyStatistic> custom({
    Expression<int>? id,
    Expression<int>? dishId,
    Expression<String>? dishName,
    Expression<DateTime>? statDate,
    Expression<int>? soldCount,
    Expression<int>? revenue,
    Expression<int>? refundCount,
    Expression<int>? refundAmount,
    Expression<DateTime>? createdAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (dishId != null) 'dish_id': dishId,
      if (dishName != null) 'dish_name': dishName,
      if (statDate != null) 'stat_date': statDate,
      if (soldCount != null) 'sold_count': soldCount,
      if (revenue != null) 'revenue': revenue,
      if (refundCount != null) 'refund_count': refundCount,
      if (refundAmount != null) 'refund_amount': refundAmount,
      if (createdAt != null) 'created_at': createdAt,
    });
  }

  DishDailyStatisticsCompanion copyWith(
      {Value<int>? id,
      Value<int>? dishId,
      Value<String>? dishName,
      Value<DateTime>? statDate,
      Value<int>? soldCount,
      Value<int>? revenue,
      Value<int>? refundCount,
      Value<int>? refundAmount,
      Value<DateTime>? createdAt}) {
    return DishDailyStatisticsCompanion(
      id: id ?? this.id,
      dishId: dishId ?? this.dishId,
      dishName: dishName ?? this.dishName,
      statDate: statDate ?? this.statDate,
      soldCount: soldCount ?? this.soldCount,
      revenue: revenue ?? this.revenue,
      refundCount: refundCount ?? this.refundCount,
      refundAmount: refundAmount ?? this.refundAmount,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (dishId.present) {
      map['dish_id'] = Variable<int>(dishId.value);
    }
    if (dishName.present) {
      map['dish_name'] = Variable<String>(dishName.value);
    }
    if (statDate.present) {
      map['stat_date'] = Variable<DateTime>(statDate.value);
    }
    if (soldCount.present) {
      map['sold_count'] = Variable<int>(soldCount.value);
    }
    if (revenue.present) {
      map['revenue'] = Variable<int>(revenue.value);
    }
    if (refundCount.present) {
      map['refund_count'] = Variable<int>(refundCount.value);
    }
    if (refundAmount.present) {
      map['refund_amount'] = Variable<int>(refundAmount.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DishDailyStatisticsCompanion(')
          ..write('id: $id, ')
          ..write('dishId: $dishId, ')
          ..write('dishName: $dishName, ')
          ..write('statDate: $statDate, ')
          ..write('soldCount: $soldCount, ')
          ..write('revenue: $revenue, ')
          ..write('refundCount: $refundCount, ')
          ..write('refundAmount: $refundAmount, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }
}

class $ArchiveLockTable extends ArchiveLock
    with TableInfo<$ArchiveLockTable, ArchiveLockData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ArchiveLockTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      hasAutoIncrement: true,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'));
  static const VerificationMeta _lockDateMeta =
      const VerificationMeta('lockDate');
  @override
  late final GeneratedColumn<DateTime> lockDate = GeneratedColumn<DateTime>(
      'lock_date', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _lockedAtMeta =
      const VerificationMeta('lockedAt');
  @override
  late final GeneratedColumn<DateTime> lockedAt = GeneratedColumn<DateTime>(
      'locked_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns => [id, lockDate, lockedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'archive_lock';
  @override
  VerificationContext validateIntegrity(Insertable<ArchiveLockData> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('lock_date')) {
      context.handle(_lockDateMeta,
          lockDate.isAcceptableOrUnknown(data['lock_date']!, _lockDateMeta));
    } else if (isInserting) {
      context.missing(_lockDateMeta);
    }
    if (data.containsKey('locked_at')) {
      context.handle(_lockedAtMeta,
          lockedAt.isAcceptableOrUnknown(data['locked_at']!, _lockedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  ArchiveLockData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ArchiveLockData(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      lockDate: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}lock_date'])!,
      lockedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}locked_at'])!,
    );
  }

  @override
  $ArchiveLockTable createAlias(String alias) {
    return $ArchiveLockTable(attachedDatabase, alias);
  }
}

class ArchiveLockData extends DataClass implements Insertable<ArchiveLockData> {
  final int id;
  final DateTime lockDate;
  final DateTime lockedAt;
  const ArchiveLockData(
      {required this.id, required this.lockDate, required this.lockedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['lock_date'] = Variable<DateTime>(lockDate);
    map['locked_at'] = Variable<DateTime>(lockedAt);
    return map;
  }

  ArchiveLockCompanion toCompanion(bool nullToAbsent) {
    return ArchiveLockCompanion(
      id: Value(id),
      lockDate: Value(lockDate),
      lockedAt: Value(lockedAt),
    );
  }

  factory ArchiveLockData.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ArchiveLockData(
      id: serializer.fromJson<int>(json['id']),
      lockDate: serializer.fromJson<DateTime>(json['lockDate']),
      lockedAt: serializer.fromJson<DateTime>(json['lockedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'lockDate': serializer.toJson<DateTime>(lockDate),
      'lockedAt': serializer.toJson<DateTime>(lockedAt),
    };
  }

  ArchiveLockData copyWith({int? id, DateTime? lockDate, DateTime? lockedAt}) =>
      ArchiveLockData(
        id: id ?? this.id,
        lockDate: lockDate ?? this.lockDate,
        lockedAt: lockedAt ?? this.lockedAt,
      );
  ArchiveLockData copyWithCompanion(ArchiveLockCompanion data) {
    return ArchiveLockData(
      id: data.id.present ? data.id.value : this.id,
      lockDate: data.lockDate.present ? data.lockDate.value : this.lockDate,
      lockedAt: data.lockedAt.present ? data.lockedAt.value : this.lockedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ArchiveLockData(')
          ..write('id: $id, ')
          ..write('lockDate: $lockDate, ')
          ..write('lockedAt: $lockedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, lockDate, lockedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ArchiveLockData &&
          other.id == this.id &&
          other.lockDate == this.lockDate &&
          other.lockedAt == this.lockedAt);
}

class ArchiveLockCompanion extends UpdateCompanion<ArchiveLockData> {
  final Value<int> id;
  final Value<DateTime> lockDate;
  final Value<DateTime> lockedAt;
  const ArchiveLockCompanion({
    this.id = const Value.absent(),
    this.lockDate = const Value.absent(),
    this.lockedAt = const Value.absent(),
  });
  ArchiveLockCompanion.insert({
    this.id = const Value.absent(),
    required DateTime lockDate,
    this.lockedAt = const Value.absent(),
  }) : lockDate = Value(lockDate);
  static Insertable<ArchiveLockData> custom({
    Expression<int>? id,
    Expression<DateTime>? lockDate,
    Expression<DateTime>? lockedAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (lockDate != null) 'lock_date': lockDate,
      if (lockedAt != null) 'locked_at': lockedAt,
    });
  }

  ArchiveLockCompanion copyWith(
      {Value<int>? id, Value<DateTime>? lockDate, Value<DateTime>? lockedAt}) {
    return ArchiveLockCompanion(
      id: id ?? this.id,
      lockDate: lockDate ?? this.lockDate,
      lockedAt: lockedAt ?? this.lockedAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (lockDate.present) {
      map['lock_date'] = Variable<DateTime>(lockDate.value);
    }
    if (lockedAt.present) {
      map['locked_at'] = Variable<DateTime>(lockedAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ArchiveLockCompanion(')
          ..write('id: $id, ')
          ..write('lockDate: $lockDate, ')
          ..write('lockedAt: $lockedAt')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $DishesTable dishes = $DishesTable(this);
  late final $OrdersTable orders = $OrdersTable(this);
  late final $OrderItemsTable orderItems = $OrderItemsTable(this);
  late final $SystemConfigTable systemConfig = $SystemConfigTable(this);
  late final $DailyStatisticsTable dailyStatistics =
      $DailyStatisticsTable(this);
  late final $DishDailyStatisticsTable dishDailyStatistics =
      $DishDailyStatisticsTable(this);
  late final $ArchiveLockTable archiveLock = $ArchiveLockTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
        dishes,
        orders,
        orderItems,
        systemConfig,
        dailyStatistics,
        dishDailyStatistics,
        archiveLock
      ];
}

typedef $$DishesTableCreateCompanionBuilder = DishesCompanion Function({
  Value<int> id,
  required String name,
  required int price,
  Value<String?> imagePath,
  Value<String> status,
  Value<int> stock,
  Value<int> soldCount,
  Value<DateTime> createdAt,
  Value<DateTime> updatedAt,
  Value<bool> isDeleted,
});
typedef $$DishesTableUpdateCompanionBuilder = DishesCompanion Function({
  Value<int> id,
  Value<String> name,
  Value<int> price,
  Value<String?> imagePath,
  Value<String> status,
  Value<int> stock,
  Value<int> soldCount,
  Value<DateTime> createdAt,
  Value<DateTime> updatedAt,
  Value<bool> isDeleted,
});

class $$DishesTableFilterComposer
    extends Composer<_$AppDatabase, $DishesTable> {
  $$DishesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get price => $composableBuilder(
      column: $table.price, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get imagePath => $composableBuilder(
      column: $table.imagePath, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get stock => $composableBuilder(
      column: $table.stock, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get soldCount => $composableBuilder(
      column: $table.soldCount, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<bool> get isDeleted => $composableBuilder(
      column: $table.isDeleted, builder: (column) => ColumnFilters(column));
}

class $$DishesTableOrderingComposer
    extends Composer<_$AppDatabase, $DishesTable> {
  $$DishesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get price => $composableBuilder(
      column: $table.price, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get imagePath => $composableBuilder(
      column: $table.imagePath, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get stock => $composableBuilder(
      column: $table.stock, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get soldCount => $composableBuilder(
      column: $table.soldCount, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<bool> get isDeleted => $composableBuilder(
      column: $table.isDeleted, builder: (column) => ColumnOrderings(column));
}

class $$DishesTableAnnotationComposer
    extends Composer<_$AppDatabase, $DishesTable> {
  $$DishesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<int> get price =>
      $composableBuilder(column: $table.price, builder: (column) => column);

  GeneratedColumn<String> get imagePath =>
      $composableBuilder(column: $table.imagePath, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get stock =>
      $composableBuilder(column: $table.stock, builder: (column) => column);

  GeneratedColumn<int> get soldCount =>
      $composableBuilder(column: $table.soldCount, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<bool> get isDeleted =>
      $composableBuilder(column: $table.isDeleted, builder: (column) => column);
}

class $$DishesTableTableManager extends RootTableManager<
    _$AppDatabase,
    $DishesTable,
    Dishe,
    $$DishesTableFilterComposer,
    $$DishesTableOrderingComposer,
    $$DishesTableAnnotationComposer,
    $$DishesTableCreateCompanionBuilder,
    $$DishesTableUpdateCompanionBuilder,
    (Dishe, BaseReferences<_$AppDatabase, $DishesTable, Dishe>),
    Dishe,
    PrefetchHooks Function()> {
  $$DishesTableTableManager(_$AppDatabase db, $DishesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DishesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DishesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DishesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<String> name = const Value.absent(),
            Value<int> price = const Value.absent(),
            Value<String?> imagePath = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<int> stock = const Value.absent(),
            Value<int> soldCount = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime> updatedAt = const Value.absent(),
            Value<bool> isDeleted = const Value.absent(),
          }) =>
              DishesCompanion(
            id: id,
            name: name,
            price: price,
            imagePath: imagePath,
            status: status,
            stock: stock,
            soldCount: soldCount,
            createdAt: createdAt,
            updatedAt: updatedAt,
            isDeleted: isDeleted,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required String name,
            required int price,
            Value<String?> imagePath = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<int> stock = const Value.absent(),
            Value<int> soldCount = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime> updatedAt = const Value.absent(),
            Value<bool> isDeleted = const Value.absent(),
          }) =>
              DishesCompanion.insert(
            id: id,
            name: name,
            price: price,
            imagePath: imagePath,
            status: status,
            stock: stock,
            soldCount: soldCount,
            createdAt: createdAt,
            updatedAt: updatedAt,
            isDeleted: isDeleted,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$DishesTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $DishesTable,
    Dishe,
    $$DishesTableFilterComposer,
    $$DishesTableOrderingComposer,
    $$DishesTableAnnotationComposer,
    $$DishesTableCreateCompanionBuilder,
    $$DishesTableUpdateCompanionBuilder,
    (Dishe, BaseReferences<_$AppDatabase, $DishesTable, Dishe>),
    Dishe,
    PrefetchHooks Function()>;
typedef $$OrdersTableCreateCompanionBuilder = OrdersCompanion Function({
  Value<int> id,
  required String orderNumber,
  Value<String> status,
  required int totalAmount,
  Value<int> discountAmount,
  required int finalAmount,
  Value<String?> tableNumber,
  Value<String?> remark,
  Value<int> cartIndex,
  Value<DateTime> createdAt,
  Value<DateTime> updatedAt,
  Value<DateTime?> completedAt,
});
typedef $$OrdersTableUpdateCompanionBuilder = OrdersCompanion Function({
  Value<int> id,
  Value<String> orderNumber,
  Value<String> status,
  Value<int> totalAmount,
  Value<int> discountAmount,
  Value<int> finalAmount,
  Value<String?> tableNumber,
  Value<String?> remark,
  Value<int> cartIndex,
  Value<DateTime> createdAt,
  Value<DateTime> updatedAt,
  Value<DateTime?> completedAt,
});

final class $$OrdersTableReferences
    extends BaseReferences<_$AppDatabase, $OrdersTable, Order> {
  $$OrdersTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<$OrderItemsTable, List<OrderItem>>
      _orderItemsRefsTable(_$AppDatabase db) => MultiTypedResultKey.fromTable(
          db.orderItems,
          aliasName: $_aliasNameGenerator(db.orders.id, db.orderItems.orderId));

  $$OrderItemsTableProcessedTableManager get orderItemsRefs {
    final manager = $$OrderItemsTableTableManager($_db, $_db.orderItems)
        .filter((f) => f.orderId.id.sqlEquals($_itemColumn<int>('id')!));

    final cache = $_typedResult.readTableOrNull(_orderItemsRefsTable($_db));
    return ProcessedTableManager(
        manager.$state.copyWith(prefetchedData: cache));
  }
}

class $$OrdersTableFilterComposer
    extends Composer<_$AppDatabase, $OrdersTable> {
  $$OrdersTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get orderNumber => $composableBuilder(
      column: $table.orderNumber, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get totalAmount => $composableBuilder(
      column: $table.totalAmount, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get discountAmount => $composableBuilder(
      column: $table.discountAmount,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get finalAmount => $composableBuilder(
      column: $table.finalAmount, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get tableNumber => $composableBuilder(
      column: $table.tableNumber, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get remark => $composableBuilder(
      column: $table.remark, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get cartIndex => $composableBuilder(
      column: $table.cartIndex, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get completedAt => $composableBuilder(
      column: $table.completedAt, builder: (column) => ColumnFilters(column));

  Expression<bool> orderItemsRefs(
      Expression<bool> Function($$OrderItemsTableFilterComposer f) f) {
    final $$OrderItemsTableFilterComposer composer = $composerBuilder(
        composer: this,
        getCurrentColumn: (t) => t.id,
        referencedTable: $db.orderItems,
        getReferencedColumn: (t) => t.orderId,
        builder: (joinBuilder,
                {$addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer}) =>
            $$OrderItemsTableFilterComposer(
              $db: $db,
              $table: $db.orderItems,
              $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
              joinBuilder: joinBuilder,
              $removeJoinBuilderFromRootComposer:
                  $removeJoinBuilderFromRootComposer,
            ));
    return f(composer);
  }
}

class $$OrdersTableOrderingComposer
    extends Composer<_$AppDatabase, $OrdersTable> {
  $$OrdersTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get orderNumber => $composableBuilder(
      column: $table.orderNumber, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get totalAmount => $composableBuilder(
      column: $table.totalAmount, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get discountAmount => $composableBuilder(
      column: $table.discountAmount,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get finalAmount => $composableBuilder(
      column: $table.finalAmount, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get tableNumber => $composableBuilder(
      column: $table.tableNumber, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get remark => $composableBuilder(
      column: $table.remark, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get cartIndex => $composableBuilder(
      column: $table.cartIndex, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get completedAt => $composableBuilder(
      column: $table.completedAt, builder: (column) => ColumnOrderings(column));
}

class $$OrdersTableAnnotationComposer
    extends Composer<_$AppDatabase, $OrdersTable> {
  $$OrdersTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get orderNumber => $composableBuilder(
      column: $table.orderNumber, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get totalAmount => $composableBuilder(
      column: $table.totalAmount, builder: (column) => column);

  GeneratedColumn<int> get discountAmount => $composableBuilder(
      column: $table.discountAmount, builder: (column) => column);

  GeneratedColumn<int> get finalAmount => $composableBuilder(
      column: $table.finalAmount, builder: (column) => column);

  GeneratedColumn<String> get tableNumber => $composableBuilder(
      column: $table.tableNumber, builder: (column) => column);

  GeneratedColumn<String> get remark =>
      $composableBuilder(column: $table.remark, builder: (column) => column);

  GeneratedColumn<int> get cartIndex =>
      $composableBuilder(column: $table.cartIndex, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get completedAt => $composableBuilder(
      column: $table.completedAt, builder: (column) => column);

  Expression<T> orderItemsRefs<T extends Object>(
      Expression<T> Function($$OrderItemsTableAnnotationComposer a) f) {
    final $$OrderItemsTableAnnotationComposer composer = $composerBuilder(
        composer: this,
        getCurrentColumn: (t) => t.id,
        referencedTable: $db.orderItems,
        getReferencedColumn: (t) => t.orderId,
        builder: (joinBuilder,
                {$addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer}) =>
            $$OrderItemsTableAnnotationComposer(
              $db: $db,
              $table: $db.orderItems,
              $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
              joinBuilder: joinBuilder,
              $removeJoinBuilderFromRootComposer:
                  $removeJoinBuilderFromRootComposer,
            ));
    return f(composer);
  }
}

class $$OrdersTableTableManager extends RootTableManager<
    _$AppDatabase,
    $OrdersTable,
    Order,
    $$OrdersTableFilterComposer,
    $$OrdersTableOrderingComposer,
    $$OrdersTableAnnotationComposer,
    $$OrdersTableCreateCompanionBuilder,
    $$OrdersTableUpdateCompanionBuilder,
    (Order, $$OrdersTableReferences),
    Order,
    PrefetchHooks Function({bool orderItemsRefs})> {
  $$OrdersTableTableManager(_$AppDatabase db, $OrdersTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OrdersTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OrdersTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OrdersTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<String> orderNumber = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<int> totalAmount = const Value.absent(),
            Value<int> discountAmount = const Value.absent(),
            Value<int> finalAmount = const Value.absent(),
            Value<String?> tableNumber = const Value.absent(),
            Value<String?> remark = const Value.absent(),
            Value<int> cartIndex = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime> updatedAt = const Value.absent(),
            Value<DateTime?> completedAt = const Value.absent(),
          }) =>
              OrdersCompanion(
            id: id,
            orderNumber: orderNumber,
            status: status,
            totalAmount: totalAmount,
            discountAmount: discountAmount,
            finalAmount: finalAmount,
            tableNumber: tableNumber,
            remark: remark,
            cartIndex: cartIndex,
            createdAt: createdAt,
            updatedAt: updatedAt,
            completedAt: completedAt,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required String orderNumber,
            Value<String> status = const Value.absent(),
            required int totalAmount,
            Value<int> discountAmount = const Value.absent(),
            required int finalAmount,
            Value<String?> tableNumber = const Value.absent(),
            Value<String?> remark = const Value.absent(),
            Value<int> cartIndex = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime> updatedAt = const Value.absent(),
            Value<DateTime?> completedAt = const Value.absent(),
          }) =>
              OrdersCompanion.insert(
            id: id,
            orderNumber: orderNumber,
            status: status,
            totalAmount: totalAmount,
            discountAmount: discountAmount,
            finalAmount: finalAmount,
            tableNumber: tableNumber,
            remark: remark,
            cartIndex: cartIndex,
            createdAt: createdAt,
            updatedAt: updatedAt,
            completedAt: completedAt,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) =>
                  (e.readTable(table), $$OrdersTableReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: ({orderItemsRefs = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [if (orderItemsRefs) db.orderItems],
              addJoins: null,
              getPrefetchedDataCallback: (items) async {
                return [
                  if (orderItemsRefs)
                    await $_getPrefetchedData<Order, $OrdersTable, OrderItem>(
                        currentTable: table,
                        referencedTable:
                            $$OrdersTableReferences._orderItemsRefsTable(db),
                        managerFromTypedResult: (p0) =>
                            $$OrdersTableReferences(db, table, p0)
                                .orderItemsRefs,
                        referencedItemsForCurrentItem: (item,
                                referencedItems) =>
                            referencedItems.where((e) => e.orderId == item.id),
                        typedResults: items)
                ];
              },
            );
          },
        ));
}

typedef $$OrdersTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $OrdersTable,
    Order,
    $$OrdersTableFilterComposer,
    $$OrdersTableOrderingComposer,
    $$OrdersTableAnnotationComposer,
    $$OrdersTableCreateCompanionBuilder,
    $$OrdersTableUpdateCompanionBuilder,
    (Order, $$OrdersTableReferences),
    Order,
    PrefetchHooks Function({bool orderItemsRefs})>;
typedef $$OrderItemsTableCreateCompanionBuilder = OrderItemsCompanion Function({
  Value<int> id,
  required int orderId,
  required int dishId,
  required String dishName,
  required int unitPrice,
  required int quantity,
  required int subtotal,
});
typedef $$OrderItemsTableUpdateCompanionBuilder = OrderItemsCompanion Function({
  Value<int> id,
  Value<int> orderId,
  Value<int> dishId,
  Value<String> dishName,
  Value<int> unitPrice,
  Value<int> quantity,
  Value<int> subtotal,
});

final class $$OrderItemsTableReferences
    extends BaseReferences<_$AppDatabase, $OrderItemsTable, OrderItem> {
  $$OrderItemsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static $OrdersTable _orderIdTable(_$AppDatabase db) => db.orders
      .createAlias($_aliasNameGenerator(db.orderItems.orderId, db.orders.id));

  $$OrdersTableProcessedTableManager get orderId {
    final $_column = $_itemColumn<int>('order_id')!;

    final manager = $$OrdersTableTableManager($_db, $_db.orders)
        .filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_orderIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
        manager.$state.copyWith(prefetchedData: [item]));
  }
}

class $$OrderItemsTableFilterComposer
    extends Composer<_$AppDatabase, $OrderItemsTable> {
  $$OrderItemsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get dishId => $composableBuilder(
      column: $table.dishId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get dishName => $composableBuilder(
      column: $table.dishName, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get unitPrice => $composableBuilder(
      column: $table.unitPrice, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get quantity => $composableBuilder(
      column: $table.quantity, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get subtotal => $composableBuilder(
      column: $table.subtotal, builder: (column) => ColumnFilters(column));

  $$OrdersTableFilterComposer get orderId {
    final $$OrdersTableFilterComposer composer = $composerBuilder(
        composer: this,
        getCurrentColumn: (t) => t.orderId,
        referencedTable: $db.orders,
        getReferencedColumn: (t) => t.id,
        builder: (joinBuilder,
                {$addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer}) =>
            $$OrdersTableFilterComposer(
              $db: $db,
              $table: $db.orders,
              $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
              joinBuilder: joinBuilder,
              $removeJoinBuilderFromRootComposer:
                  $removeJoinBuilderFromRootComposer,
            ));
    return composer;
  }
}

class $$OrderItemsTableOrderingComposer
    extends Composer<_$AppDatabase, $OrderItemsTable> {
  $$OrderItemsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get dishId => $composableBuilder(
      column: $table.dishId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get dishName => $composableBuilder(
      column: $table.dishName, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get unitPrice => $composableBuilder(
      column: $table.unitPrice, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get quantity => $composableBuilder(
      column: $table.quantity, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get subtotal => $composableBuilder(
      column: $table.subtotal, builder: (column) => ColumnOrderings(column));

  $$OrdersTableOrderingComposer get orderId {
    final $$OrdersTableOrderingComposer composer = $composerBuilder(
        composer: this,
        getCurrentColumn: (t) => t.orderId,
        referencedTable: $db.orders,
        getReferencedColumn: (t) => t.id,
        builder: (joinBuilder,
                {$addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer}) =>
            $$OrdersTableOrderingComposer(
              $db: $db,
              $table: $db.orders,
              $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
              joinBuilder: joinBuilder,
              $removeJoinBuilderFromRootComposer:
                  $removeJoinBuilderFromRootComposer,
            ));
    return composer;
  }
}

class $$OrderItemsTableAnnotationComposer
    extends Composer<_$AppDatabase, $OrderItemsTable> {
  $$OrderItemsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get dishId =>
      $composableBuilder(column: $table.dishId, builder: (column) => column);

  GeneratedColumn<String> get dishName =>
      $composableBuilder(column: $table.dishName, builder: (column) => column);

  GeneratedColumn<int> get unitPrice =>
      $composableBuilder(column: $table.unitPrice, builder: (column) => column);

  GeneratedColumn<int> get quantity =>
      $composableBuilder(column: $table.quantity, builder: (column) => column);

  GeneratedColumn<int> get subtotal =>
      $composableBuilder(column: $table.subtotal, builder: (column) => column);

  $$OrdersTableAnnotationComposer get orderId {
    final $$OrdersTableAnnotationComposer composer = $composerBuilder(
        composer: this,
        getCurrentColumn: (t) => t.orderId,
        referencedTable: $db.orders,
        getReferencedColumn: (t) => t.id,
        builder: (joinBuilder,
                {$addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer}) =>
            $$OrdersTableAnnotationComposer(
              $db: $db,
              $table: $db.orders,
              $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
              joinBuilder: joinBuilder,
              $removeJoinBuilderFromRootComposer:
                  $removeJoinBuilderFromRootComposer,
            ));
    return composer;
  }
}

class $$OrderItemsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $OrderItemsTable,
    OrderItem,
    $$OrderItemsTableFilterComposer,
    $$OrderItemsTableOrderingComposer,
    $$OrderItemsTableAnnotationComposer,
    $$OrderItemsTableCreateCompanionBuilder,
    $$OrderItemsTableUpdateCompanionBuilder,
    (OrderItem, $$OrderItemsTableReferences),
    OrderItem,
    PrefetchHooks Function({bool orderId})> {
  $$OrderItemsTableTableManager(_$AppDatabase db, $OrderItemsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OrderItemsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OrderItemsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OrderItemsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<int> orderId = const Value.absent(),
            Value<int> dishId = const Value.absent(),
            Value<String> dishName = const Value.absent(),
            Value<int> unitPrice = const Value.absent(),
            Value<int> quantity = const Value.absent(),
            Value<int> subtotal = const Value.absent(),
          }) =>
              OrderItemsCompanion(
            id: id,
            orderId: orderId,
            dishId: dishId,
            dishName: dishName,
            unitPrice: unitPrice,
            quantity: quantity,
            subtotal: subtotal,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required int orderId,
            required int dishId,
            required String dishName,
            required int unitPrice,
            required int quantity,
            required int subtotal,
          }) =>
              OrderItemsCompanion.insert(
            id: id,
            orderId: orderId,
            dishId: dishId,
            dishName: dishName,
            unitPrice: unitPrice,
            quantity: quantity,
            subtotal: subtotal,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (
                    e.readTable(table),
                    $$OrderItemsTableReferences(db, table, e)
                  ))
              .toList(),
          prefetchHooksCallback: ({orderId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins: <
                  T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic>>(state) {
                if (orderId) {
                  state = state.withJoin(
                    currentTable: table,
                    currentColumn: table.orderId,
                    referencedTable:
                        $$OrderItemsTableReferences._orderIdTable(db),
                    referencedColumn:
                        $$OrderItemsTableReferences._orderIdTable(db).id,
                  ) as T;
                }

                return state;
              },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ));
}

typedef $$OrderItemsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $OrderItemsTable,
    OrderItem,
    $$OrderItemsTableFilterComposer,
    $$OrderItemsTableOrderingComposer,
    $$OrderItemsTableAnnotationComposer,
    $$OrderItemsTableCreateCompanionBuilder,
    $$OrderItemsTableUpdateCompanionBuilder,
    (OrderItem, $$OrderItemsTableReferences),
    OrderItem,
    PrefetchHooks Function({bool orderId})>;
typedef $$SystemConfigTableCreateCompanionBuilder = SystemConfigCompanion
    Function({
  Value<int> id,
  required String key,
  required String value,
  Value<DateTime> updatedAt,
});
typedef $$SystemConfigTableUpdateCompanionBuilder = SystemConfigCompanion
    Function({
  Value<int> id,
  Value<String> key,
  Value<String> value,
  Value<DateTime> updatedAt,
});

class $$SystemConfigTableFilterComposer
    extends Composer<_$AppDatabase, $SystemConfigTable> {
  $$SystemConfigTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get key => $composableBuilder(
      column: $table.key, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get value => $composableBuilder(
      column: $table.value, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnFilters(column));
}

class $$SystemConfigTableOrderingComposer
    extends Composer<_$AppDatabase, $SystemConfigTable> {
  $$SystemConfigTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get key => $composableBuilder(
      column: $table.key, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get value => $composableBuilder(
      column: $table.value, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnOrderings(column));
}

class $$SystemConfigTableAnnotationComposer
    extends Composer<_$AppDatabase, $SystemConfigTable> {
  $$SystemConfigTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get key =>
      $composableBuilder(column: $table.key, builder: (column) => column);

  GeneratedColumn<String> get value =>
      $composableBuilder(column: $table.value, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$SystemConfigTableTableManager extends RootTableManager<
    _$AppDatabase,
    $SystemConfigTable,
    SystemConfigData,
    $$SystemConfigTableFilterComposer,
    $$SystemConfigTableOrderingComposer,
    $$SystemConfigTableAnnotationComposer,
    $$SystemConfigTableCreateCompanionBuilder,
    $$SystemConfigTableUpdateCompanionBuilder,
    (
      SystemConfigData,
      BaseReferences<_$AppDatabase, $SystemConfigTable, SystemConfigData>
    ),
    SystemConfigData,
    PrefetchHooks Function()> {
  $$SystemConfigTableTableManager(_$AppDatabase db, $SystemConfigTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SystemConfigTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SystemConfigTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SystemConfigTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<String> key = const Value.absent(),
            Value<String> value = const Value.absent(),
            Value<DateTime> updatedAt = const Value.absent(),
          }) =>
              SystemConfigCompanion(
            id: id,
            key: key,
            value: value,
            updatedAt: updatedAt,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required String key,
            required String value,
            Value<DateTime> updatedAt = const Value.absent(),
          }) =>
              SystemConfigCompanion.insert(
            id: id,
            key: key,
            value: value,
            updatedAt: updatedAt,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$SystemConfigTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $SystemConfigTable,
    SystemConfigData,
    $$SystemConfigTableFilterComposer,
    $$SystemConfigTableOrderingComposer,
    $$SystemConfigTableAnnotationComposer,
    $$SystemConfigTableCreateCompanionBuilder,
    $$SystemConfigTableUpdateCompanionBuilder,
    (
      SystemConfigData,
      BaseReferences<_$AppDatabase, $SystemConfigTable, SystemConfigData>
    ),
    SystemConfigData,
    PrefetchHooks Function()>;
typedef $$DailyStatisticsTableCreateCompanionBuilder = DailyStatisticsCompanion
    Function({
  Value<int> id,
  required DateTime statDate,
  Value<int> orderCount,
  Value<int> totalRevenue,
  Value<int> refundCount,
  Value<int> refundAmount,
  Value<int> netRevenue,
  Value<double> avgOrderAmount,
  Value<int> completedCount,
  Value<int> pendingCount,
  Value<DateTime> createdAt,
});
typedef $$DailyStatisticsTableUpdateCompanionBuilder = DailyStatisticsCompanion
    Function({
  Value<int> id,
  Value<DateTime> statDate,
  Value<int> orderCount,
  Value<int> totalRevenue,
  Value<int> refundCount,
  Value<int> refundAmount,
  Value<int> netRevenue,
  Value<double> avgOrderAmount,
  Value<int> completedCount,
  Value<int> pendingCount,
  Value<DateTime> createdAt,
});

class $$DailyStatisticsTableFilterComposer
    extends Composer<_$AppDatabase, $DailyStatisticsTable> {
  $$DailyStatisticsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get statDate => $composableBuilder(
      column: $table.statDate, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get orderCount => $composableBuilder(
      column: $table.orderCount, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get totalRevenue => $composableBuilder(
      column: $table.totalRevenue, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get refundCount => $composableBuilder(
      column: $table.refundCount, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get refundAmount => $composableBuilder(
      column: $table.refundAmount, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get netRevenue => $composableBuilder(
      column: $table.netRevenue, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get avgOrderAmount => $composableBuilder(
      column: $table.avgOrderAmount,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get completedCount => $composableBuilder(
      column: $table.completedCount,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get pendingCount => $composableBuilder(
      column: $table.pendingCount, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));
}

class $$DailyStatisticsTableOrderingComposer
    extends Composer<_$AppDatabase, $DailyStatisticsTable> {
  $$DailyStatisticsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get statDate => $composableBuilder(
      column: $table.statDate, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get orderCount => $composableBuilder(
      column: $table.orderCount, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get totalRevenue => $composableBuilder(
      column: $table.totalRevenue,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get refundCount => $composableBuilder(
      column: $table.refundCount, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get refundAmount => $composableBuilder(
      column: $table.refundAmount,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get netRevenue => $composableBuilder(
      column: $table.netRevenue, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get avgOrderAmount => $composableBuilder(
      column: $table.avgOrderAmount,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get completedCount => $composableBuilder(
      column: $table.completedCount,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get pendingCount => $composableBuilder(
      column: $table.pendingCount,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));
}

class $$DailyStatisticsTableAnnotationComposer
    extends Composer<_$AppDatabase, $DailyStatisticsTable> {
  $$DailyStatisticsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<DateTime> get statDate =>
      $composableBuilder(column: $table.statDate, builder: (column) => column);

  GeneratedColumn<int> get orderCount => $composableBuilder(
      column: $table.orderCount, builder: (column) => column);

  GeneratedColumn<int> get totalRevenue => $composableBuilder(
      column: $table.totalRevenue, builder: (column) => column);

  GeneratedColumn<int> get refundCount => $composableBuilder(
      column: $table.refundCount, builder: (column) => column);

  GeneratedColumn<int> get refundAmount => $composableBuilder(
      column: $table.refundAmount, builder: (column) => column);

  GeneratedColumn<int> get netRevenue => $composableBuilder(
      column: $table.netRevenue, builder: (column) => column);

  GeneratedColumn<double> get avgOrderAmount => $composableBuilder(
      column: $table.avgOrderAmount, builder: (column) => column);

  GeneratedColumn<int> get completedCount => $composableBuilder(
      column: $table.completedCount, builder: (column) => column);

  GeneratedColumn<int> get pendingCount => $composableBuilder(
      column: $table.pendingCount, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$DailyStatisticsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $DailyStatisticsTable,
    DailyStatistic,
    $$DailyStatisticsTableFilterComposer,
    $$DailyStatisticsTableOrderingComposer,
    $$DailyStatisticsTableAnnotationComposer,
    $$DailyStatisticsTableCreateCompanionBuilder,
    $$DailyStatisticsTableUpdateCompanionBuilder,
    (
      DailyStatistic,
      BaseReferences<_$AppDatabase, $DailyStatisticsTable, DailyStatistic>
    ),
    DailyStatistic,
    PrefetchHooks Function()> {
  $$DailyStatisticsTableTableManager(
      _$AppDatabase db, $DailyStatisticsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DailyStatisticsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DailyStatisticsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DailyStatisticsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<DateTime> statDate = const Value.absent(),
            Value<int> orderCount = const Value.absent(),
            Value<int> totalRevenue = const Value.absent(),
            Value<int> refundCount = const Value.absent(),
            Value<int> refundAmount = const Value.absent(),
            Value<int> netRevenue = const Value.absent(),
            Value<double> avgOrderAmount = const Value.absent(),
            Value<int> completedCount = const Value.absent(),
            Value<int> pendingCount = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
          }) =>
              DailyStatisticsCompanion(
            id: id,
            statDate: statDate,
            orderCount: orderCount,
            totalRevenue: totalRevenue,
            refundCount: refundCount,
            refundAmount: refundAmount,
            netRevenue: netRevenue,
            avgOrderAmount: avgOrderAmount,
            completedCount: completedCount,
            pendingCount: pendingCount,
            createdAt: createdAt,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required DateTime statDate,
            Value<int> orderCount = const Value.absent(),
            Value<int> totalRevenue = const Value.absent(),
            Value<int> refundCount = const Value.absent(),
            Value<int> refundAmount = const Value.absent(),
            Value<int> netRevenue = const Value.absent(),
            Value<double> avgOrderAmount = const Value.absent(),
            Value<int> completedCount = const Value.absent(),
            Value<int> pendingCount = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
          }) =>
              DailyStatisticsCompanion.insert(
            id: id,
            statDate: statDate,
            orderCount: orderCount,
            totalRevenue: totalRevenue,
            refundCount: refundCount,
            refundAmount: refundAmount,
            netRevenue: netRevenue,
            avgOrderAmount: avgOrderAmount,
            completedCount: completedCount,
            pendingCount: pendingCount,
            createdAt: createdAt,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$DailyStatisticsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $DailyStatisticsTable,
    DailyStatistic,
    $$DailyStatisticsTableFilterComposer,
    $$DailyStatisticsTableOrderingComposer,
    $$DailyStatisticsTableAnnotationComposer,
    $$DailyStatisticsTableCreateCompanionBuilder,
    $$DailyStatisticsTableUpdateCompanionBuilder,
    (
      DailyStatistic,
      BaseReferences<_$AppDatabase, $DailyStatisticsTable, DailyStatistic>
    ),
    DailyStatistic,
    PrefetchHooks Function()>;
typedef $$DishDailyStatisticsTableCreateCompanionBuilder
    = DishDailyStatisticsCompanion Function({
  Value<int> id,
  required int dishId,
  required String dishName,
  required DateTime statDate,
  Value<int> soldCount,
  Value<int> revenue,
  Value<int> refundCount,
  Value<int> refundAmount,
  Value<DateTime> createdAt,
});
typedef $$DishDailyStatisticsTableUpdateCompanionBuilder
    = DishDailyStatisticsCompanion Function({
  Value<int> id,
  Value<int> dishId,
  Value<String> dishName,
  Value<DateTime> statDate,
  Value<int> soldCount,
  Value<int> revenue,
  Value<int> refundCount,
  Value<int> refundAmount,
  Value<DateTime> createdAt,
});

class $$DishDailyStatisticsTableFilterComposer
    extends Composer<_$AppDatabase, $DishDailyStatisticsTable> {
  $$DishDailyStatisticsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get dishId => $composableBuilder(
      column: $table.dishId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get dishName => $composableBuilder(
      column: $table.dishName, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get statDate => $composableBuilder(
      column: $table.statDate, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get soldCount => $composableBuilder(
      column: $table.soldCount, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get revenue => $composableBuilder(
      column: $table.revenue, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get refundCount => $composableBuilder(
      column: $table.refundCount, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get refundAmount => $composableBuilder(
      column: $table.refundAmount, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));
}

class $$DishDailyStatisticsTableOrderingComposer
    extends Composer<_$AppDatabase, $DishDailyStatisticsTable> {
  $$DishDailyStatisticsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get dishId => $composableBuilder(
      column: $table.dishId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get dishName => $composableBuilder(
      column: $table.dishName, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get statDate => $composableBuilder(
      column: $table.statDate, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get soldCount => $composableBuilder(
      column: $table.soldCount, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get revenue => $composableBuilder(
      column: $table.revenue, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get refundCount => $composableBuilder(
      column: $table.refundCount, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get refundAmount => $composableBuilder(
      column: $table.refundAmount,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));
}

class $$DishDailyStatisticsTableAnnotationComposer
    extends Composer<_$AppDatabase, $DishDailyStatisticsTable> {
  $$DishDailyStatisticsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get dishId =>
      $composableBuilder(column: $table.dishId, builder: (column) => column);

  GeneratedColumn<String> get dishName =>
      $composableBuilder(column: $table.dishName, builder: (column) => column);

  GeneratedColumn<DateTime> get statDate =>
      $composableBuilder(column: $table.statDate, builder: (column) => column);

  GeneratedColumn<int> get soldCount =>
      $composableBuilder(column: $table.soldCount, builder: (column) => column);

  GeneratedColumn<int> get revenue =>
      $composableBuilder(column: $table.revenue, builder: (column) => column);

  GeneratedColumn<int> get refundCount => $composableBuilder(
      column: $table.refundCount, builder: (column) => column);

  GeneratedColumn<int> get refundAmount => $composableBuilder(
      column: $table.refundAmount, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$DishDailyStatisticsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $DishDailyStatisticsTable,
    DishDailyStatistic,
    $$DishDailyStatisticsTableFilterComposer,
    $$DishDailyStatisticsTableOrderingComposer,
    $$DishDailyStatisticsTableAnnotationComposer,
    $$DishDailyStatisticsTableCreateCompanionBuilder,
    $$DishDailyStatisticsTableUpdateCompanionBuilder,
    (
      DishDailyStatistic,
      BaseReferences<_$AppDatabase, $DishDailyStatisticsTable,
          DishDailyStatistic>
    ),
    DishDailyStatistic,
    PrefetchHooks Function()> {
  $$DishDailyStatisticsTableTableManager(
      _$AppDatabase db, $DishDailyStatisticsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DishDailyStatisticsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DishDailyStatisticsTableOrderingComposer(
                  $db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DishDailyStatisticsTableAnnotationComposer(
                  $db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<int> dishId = const Value.absent(),
            Value<String> dishName = const Value.absent(),
            Value<DateTime> statDate = const Value.absent(),
            Value<int> soldCount = const Value.absent(),
            Value<int> revenue = const Value.absent(),
            Value<int> refundCount = const Value.absent(),
            Value<int> refundAmount = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
          }) =>
              DishDailyStatisticsCompanion(
            id: id,
            dishId: dishId,
            dishName: dishName,
            statDate: statDate,
            soldCount: soldCount,
            revenue: revenue,
            refundCount: refundCount,
            refundAmount: refundAmount,
            createdAt: createdAt,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required int dishId,
            required String dishName,
            required DateTime statDate,
            Value<int> soldCount = const Value.absent(),
            Value<int> revenue = const Value.absent(),
            Value<int> refundCount = const Value.absent(),
            Value<int> refundAmount = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
          }) =>
              DishDailyStatisticsCompanion.insert(
            id: id,
            dishId: dishId,
            dishName: dishName,
            statDate: statDate,
            soldCount: soldCount,
            revenue: revenue,
            refundCount: refundCount,
            refundAmount: refundAmount,
            createdAt: createdAt,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$DishDailyStatisticsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $DishDailyStatisticsTable,
    DishDailyStatistic,
    $$DishDailyStatisticsTableFilterComposer,
    $$DishDailyStatisticsTableOrderingComposer,
    $$DishDailyStatisticsTableAnnotationComposer,
    $$DishDailyStatisticsTableCreateCompanionBuilder,
    $$DishDailyStatisticsTableUpdateCompanionBuilder,
    (
      DishDailyStatistic,
      BaseReferences<_$AppDatabase, $DishDailyStatisticsTable,
          DishDailyStatistic>
    ),
    DishDailyStatistic,
    PrefetchHooks Function()>;
typedef $$ArchiveLockTableCreateCompanionBuilder = ArchiveLockCompanion
    Function({
  Value<int> id,
  required DateTime lockDate,
  Value<DateTime> lockedAt,
});
typedef $$ArchiveLockTableUpdateCompanionBuilder = ArchiveLockCompanion
    Function({
  Value<int> id,
  Value<DateTime> lockDate,
  Value<DateTime> lockedAt,
});

class $$ArchiveLockTableFilterComposer
    extends Composer<_$AppDatabase, $ArchiveLockTable> {
  $$ArchiveLockTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get lockDate => $composableBuilder(
      column: $table.lockDate, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get lockedAt => $composableBuilder(
      column: $table.lockedAt, builder: (column) => ColumnFilters(column));
}

class $$ArchiveLockTableOrderingComposer
    extends Composer<_$AppDatabase, $ArchiveLockTable> {
  $$ArchiveLockTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get lockDate => $composableBuilder(
      column: $table.lockDate, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get lockedAt => $composableBuilder(
      column: $table.lockedAt, builder: (column) => ColumnOrderings(column));
}

class $$ArchiveLockTableAnnotationComposer
    extends Composer<_$AppDatabase, $ArchiveLockTable> {
  $$ArchiveLockTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<DateTime> get lockDate =>
      $composableBuilder(column: $table.lockDate, builder: (column) => column);

  GeneratedColumn<DateTime> get lockedAt =>
      $composableBuilder(column: $table.lockedAt, builder: (column) => column);
}

class $$ArchiveLockTableTableManager extends RootTableManager<
    _$AppDatabase,
    $ArchiveLockTable,
    ArchiveLockData,
    $$ArchiveLockTableFilterComposer,
    $$ArchiveLockTableOrderingComposer,
    $$ArchiveLockTableAnnotationComposer,
    $$ArchiveLockTableCreateCompanionBuilder,
    $$ArchiveLockTableUpdateCompanionBuilder,
    (
      ArchiveLockData,
      BaseReferences<_$AppDatabase, $ArchiveLockTable, ArchiveLockData>
    ),
    ArchiveLockData,
    PrefetchHooks Function()> {
  $$ArchiveLockTableTableManager(_$AppDatabase db, $ArchiveLockTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ArchiveLockTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ArchiveLockTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ArchiveLockTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<DateTime> lockDate = const Value.absent(),
            Value<DateTime> lockedAt = const Value.absent(),
          }) =>
              ArchiveLockCompanion(
            id: id,
            lockDate: lockDate,
            lockedAt: lockedAt,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required DateTime lockDate,
            Value<DateTime> lockedAt = const Value.absent(),
          }) =>
              ArchiveLockCompanion.insert(
            id: id,
            lockDate: lockDate,
            lockedAt: lockedAt,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$ArchiveLockTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $ArchiveLockTable,
    ArchiveLockData,
    $$ArchiveLockTableFilterComposer,
    $$ArchiveLockTableOrderingComposer,
    $$ArchiveLockTableAnnotationComposer,
    $$ArchiveLockTableCreateCompanionBuilder,
    $$ArchiveLockTableUpdateCompanionBuilder,
    (
      ArchiveLockData,
      BaseReferences<_$AppDatabase, $ArchiveLockTable, ArchiveLockData>
    ),
    ArchiveLockData,
    PrefetchHooks Function()>;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$DishesTableTableManager get dishes =>
      $$DishesTableTableManager(_db, _db.dishes);
  $$OrdersTableTableManager get orders =>
      $$OrdersTableTableManager(_db, _db.orders);
  $$OrderItemsTableTableManager get orderItems =>
      $$OrderItemsTableTableManager(_db, _db.orderItems);
  $$SystemConfigTableTableManager get systemConfig =>
      $$SystemConfigTableTableManager(_db, _db.systemConfig);
  $$DailyStatisticsTableTableManager get dailyStatistics =>
      $$DailyStatisticsTableTableManager(_db, _db.dailyStatistics);
  $$DishDailyStatisticsTableTableManager get dishDailyStatistics =>
      $$DishDailyStatisticsTableTableManager(_db, _db.dishDailyStatistics);
  $$ArchiveLockTableTableManager get archiveLock =>
      $$ArchiveLockTableTableManager(_db, _db.archiveLock);
}
