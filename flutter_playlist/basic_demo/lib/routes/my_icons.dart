import 'package:flutter/material.dart';

class MyIconsRoute extends StatelessWidget {
  static const routeName = "/my_icons";
  final String imagePath = "assets/24731539.jpeg";
  final List<_IconWithColor> list = [
    _IconWithColor(MyIcons.admin, Colors.red),
    _IconWithColor(MyIcons.adminLogin, Colors.blueAccent),
    _IconWithColor(MyIcons.test1, Colors.purpleAccent),
    _IconWithColor(MyIcons.test2, Colors.orange),
    _IconWithColor(MyIcons.test3, Colors.green),
    _IconWithColor(MyIcons.test4, Colors.yellow),
  ];

  @override
  Widget build(BuildContext context) {
    Widget divider1 = Divider(
      color: Colors.blue[900],
      indent: 20.0,
      height: 20.0,
    );
    Widget divider2 = Divider(
      color: Colors.green[900],
      thickness: 5.0,
      endIndent: 10.0,
    );
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'My Icons',
        ),
      ),
      body: Column(
        children: <Widget>[
          Container(
            padding: const EdgeInsets.only(bottom: 10.0),
            child: Text('Register iconfont in pubspec.yaml'),
          ),
          Expanded(
            child: ListView.separated(
              itemCount: list.length,
              itemBuilder: (BuildContext context, int index) {
                final item = list[index];
                return Icon(
                  item.icon,
                  color: item.color,
                  size: 40.0,
                );
              },
              separatorBuilder: (BuildContext context, int index) {
                return index % 2 == 0 ? divider1 : divider2;
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _IconWithColor {
  final IconData icon;
  final Color color;

  _IconWithColor(this.icon, this.color);
}

class MyIcons {
  static const IconData adminLogin = const IconData(
    0xe620,
    fontFamily: 'MyIcon',
    matchTextDirection: true,
  );

  static const IconData admin = const IconData(
    0xe709,
    fontFamily: 'MyIcon',
    matchTextDirection: true,
  );

  static const IconData test1 = const IconData(
    0xe64d,
    fontFamily: 'MyIcon',
    matchTextDirection: true,
  );

  static const IconData test2 = const IconData(
    0xe64f,
    fontFamily: 'MyIcon',
    matchTextDirection: true,
  );

  static const IconData test3 = const IconData(
    0xe65e,
    fontFamily: 'MyIcon',
    matchTextDirection: true,
  );

  static const IconData test4 = const IconData(
    0xe65f,
    fontFamily: 'MyIcon',
    matchTextDirection: true,
  );
}
