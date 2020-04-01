import 'package:flutter/material.dart';

class Home extends StatefulWidget {
  @override
  _HomeState createState() => _HomeState();
}

class _HomeState extends State<Home> {
  Map params = {};
  @override
  Widget build(BuildContext context) {
    params =
        params.isNotEmpty ? params : ModalRoute.of(context).settings.arguments;

    final bkImagePath =
        params['isDayTime'] ? 'assets/day.png' : 'assets/night.png';

    final bgColor = params['isDayTime'] ? Colors.blueAccent : Colors.blue[900];

    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: Stack(
          children: <Widget>[
            SizedBox.expand(
              child: Image.asset(
                bkImagePath,
                fit: BoxFit.cover,
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 120.0),
              child: Column(
                children: <Widget>[
                  FlatButton.icon(
                    textColor: Colors.white54,
                    onPressed: () async {
                      final result = await Navigator.pushNamed(
                        context,
                        '/selection',
                      );
                      if (result != null) {
                        params = result;
                        setState(() {});
                      }
                    },
                    icon: Icon(Icons.location_on),
                    label: Text('Choose another location'),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: <Widget>[
                      Text(
                        params['location'],
                        style: TextStyle(
                          fontSize: 28.0,
                          letterSpacing: 2.0,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(
                    height: 20.0,
                  ),
                  Text(
                    params['time'],
                    style: TextStyle(
                      fontSize: 60.0,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
