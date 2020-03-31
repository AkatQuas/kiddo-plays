import 'package:flutter/material.dart';

class ImageBlendRoute extends StatelessWidget {
  static const routeName = "/image_blend";
  final String imagePath = "assets/24731539.jpeg";
  final List<BlendMode> list = [
    BlendMode.darken,
    BlendMode.lighten,
    BlendMode.luminosity,
    BlendMode.multiply,
    BlendMode.softLight,
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Image Blend effective',
        ),
      ),
      body: Column(
        children: <Widget>[
          Text.rich(
            TextSpan(
              text: '"colorBlendMode" should be used with specific ',
              children: [
                TextSpan(
                  text: 'color',
                  style: TextStyle(
                    backgroundColor: Colors.orangeAccent,
                  ),
                ),
                TextSpan(text: '.'),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
                itemCount: list.length,
                itemExtent: 100.0,
                itemBuilder: (BuildContext context, int index) {
                  final item = list[index];
                  return Row(children: <Widget>[
                    Container(
                      margin: const EdgeInsets.only(right: 10.0),
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: Colors.redAccent,
                        ),
                      ),
                      width: 70.0,
                      height: 70.0,
                      child: Image.asset(
                        imagePath,
                        color: Colors.orangeAccent,
                        colorBlendMode: item,
                      ),
                    ),
                    Text(item.toString()),
                  ]);
                }),
          ),
        ],
      ),
    );
  }
}
