import 'package:flutter/material.dart';

class ImageFitRoute extends StatelessWidget {
  static const routeName = "/image_fit";
  final String imagePath = "assets/24731539.jpeg";
  final List<BoxFit> list = [
    BoxFit.contain,
    BoxFit.cover,
    BoxFit.fill,
    BoxFit.fitHeight,
    BoxFit.fitWidth,
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Image fit effective',
        ),
      ),
      body: ListView.builder(
          itemCount: list.length,
          itemExtent: 100.0,
          itemBuilder: (BuildContext context, int index) {
            final item = list[index];
            return Row(children: <Widget>[
              Container(
                margin: const EdgeInsets.only(right: 10.0),
                decoration: BoxDecoration(
                  border: Border.all(
                    color: Colors.blueAccent,
                  ),
                  color: Colors.green,
                ),
                width: 70.0,
                height: 90.0,
                child: Image.asset(
                  imagePath,
                  fit: item,
                ),
              ),
              Text(item.toString()),
            ]);
          }),
    );
  }
}
