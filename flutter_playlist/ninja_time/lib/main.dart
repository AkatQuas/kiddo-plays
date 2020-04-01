import 'package:flutter/material.dart';
import './routes/home.dart';
import './routes/loading.dart';
import './routes/selection.dart';

void main() => runApp(
      MaterialApp(
        initialRoute: '/',
        theme: ThemeData(
          textTheme: TextTheme(
            body1: TextStyle(
              color: Colors.white,
            ),
          ),
        ),
        routes: {
          "/": (BuildContext context) => Loading(),
          "/home": (BuildContext context) => Home(),
          "/selection": (BuildContext context) => Selection(),
        },
      ),
    );
