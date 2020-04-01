import 'package:flutter/material.dart';

class ClipsRoute extends StatelessWidget {
  static const routeName = "/clips";

  @override
  Widget build(BuildContext context) {
    Widget avatar = Container(
      decoration: BoxDecoration(
        border: Border.all(
          color: Colors.purple,
        ),
      ),
      child: Image.asset(
        "assets/24731539.jpeg",
        width: 60.0,
      ),
    );
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Clips',
        ),
      ),
      body: Column(
        mainAxisAlignment: MainAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              avatar,
              Text('No clip'),
            ],
          ),
          Row(
            children: <Widget>[
              ClipOval(child: avatar),
              Text('Clip to circle '),
            ],
          ),
          Row(
            children: <Widget>[
              ClipRRect(
                borderRadius: BorderRadius.circular(5.0),
                child: avatar,
              ),
              Text('Clip to RoundedRectangle'),
            ],
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Align(
                alignment: Alignment.topLeft,
                widthFactor: .5,
                child: avatar,
              ),
              Text(
                "你好世界",
                style: TextStyle(color: Colors.green),
              ),
              Text('half width, overflowed'),
            ],
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              ClipRect(
                child: Align(
                  alignment: Alignment.topLeft,
                  widthFactor: .5,
                  child: avatar,
                ),
              ),
              Text(
                "你好世界",
                style: TextStyle(color: Colors.green),
              ),
              Text('half width, but cliped'),
            ],
          ),
          Text('You can implemented your own clipper by using CustomClipper.'),
        ],
      ),
    );
  }
}
