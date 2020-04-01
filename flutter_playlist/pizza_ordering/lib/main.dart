import 'package:flutter/material.dart';
import 'package:pizza_ordering/screen/home.dart';
import 'package:pizza_ordering/screen/order.dart';
import 'package:pizza_ordering/screen/review.dart';

void main() => runApp(MyApp());

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Navigation',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      routes: <String, WidgetBuilder>{
        Home.routeName: (BuildContext context) => Home(),
        Order.routeName: (BuildContext context) => Order(),
        Review.routeName: (BuildContext context) {
          ReviewRouteArguments arguments =
              ModalRoute.of(context).settings.arguments;
          return Review(order: arguments.order);
        },
      },
    );
  }
}
