import 'package:flutter/material.dart';

class ScoreRoute extends StatelessWidget {
  static const routeName = "/score";
  final Score score;
  ScoreRoute({
    Key key,
    this.score,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final score = this.score ?? Score(-1);
    final String name = ModalRoute.of(context).settings.name;
    return Scaffold(
      appBar: AppBar(
        leading: Container(),
        title: Text('Route $name'),
      ),
      body: ListView(
        children: <Widget>[
          Column(
            children: <Widget>[
              Text('You have scored ${score.value} points'),
              Text('We extract the name from the route.settings'),
              RaisedButton(
                onPressed: () {
                  Navigator.pop(context);
                },
                child: Text('Back <-'),
              ),
            ],
          ),
          Container(
            height: 2.0,
            color: Colors.indigo,
          ),
          Column(
            //测试Row对齐方式，排除Column默认居中对齐的干扰
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  Text(" hello world "),
                  Text(" I am Jack "),
                ],
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  Text(" hello world "),
                  Text(" I am Jack "),
                ],
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                textDirection: TextDirection.rtl,
                children: <Widget>[
                  Text(" hello world "),
                  Text(" I am Jack "),
                ],
              ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                verticalDirection: VerticalDirection.up,
                children: <Widget>[
                  Text(
                    " hello world ",
                    style: TextStyle(fontSize: 30.0),
                  ),
                  Text(" I am Jack "),
                ],
              ),
              Row(
                children: <Widget>[
                  Text('Begin'),
                  Spacer(), // Defaults to a flex of one.
                  Text('Middle'),
                  // Gives twice the space between Middle and End than Begin and Middle.
                  Spacer(
                    flex: 2,
                  ),
                  Text('End'),
                ],
              ),
              Wrap(
                spacing: 8.0, // gap between adjacent chips
                runSpacing: 4.0, // gap between lines
                children: <Widget>[
                  Chip(
                    avatar: CircleAvatar(
                      backgroundColor: Colors.blue.shade100,
                      child: Text('AH'),
                    ),
                    label: Text('Hamilton'),
                  ),
                  Chip(
                    avatar: CircleAvatar(
                      backgroundColor: Colors.red.shade900,
                      child: Text('ML'),
                    ),
                    label: Text('Lafayette'),
                  ),
                  Chip(
                    avatar: CircleAvatar(
                      backgroundColor: Colors.yellow.shade100,
                      child: Text('HI'),
                    ),
                    label: Text('Mulligan'),
                  ),
                  Chip(
                    avatar: CircleAvatar(
                      backgroundColor: Colors.green.shade200,
                      child: Text('JL'),
                    ),
                    label: Text('Laurens'),
                  ),
                ],
              ),
              Text('---' * 15),
              Row(
                children: <Widget>[
                  Text('***' * 15),
                ],
              ),
              Wrap(
                children: <Widget>[
                  Text('###' * 15),
                ],
              ),
              Container(
                height: 120.0,
                width: 120.0,
                color: Colors.blue[50],
                child: Align(
                  // alignment: Alignment.topRight,
                  alignment: Alignment(1.0, .5),
                  child: FlutterLogo(
                    size: 60,
                  ),
                ),
              ),
              ConstrainedBox(
                constraints: BoxConstraints(minWidth: 6.0, minHeight: 60.0), //父
                child: ConstrainedBox(
                  constraints:
                      BoxConstraints(minWidth: 90.0, minHeight: 2.0), //子
                  child: DecoratedBox(
                    decoration: BoxDecoration(color: Colors.red),
                  ),
                ),
              ),
              Container(
                height: 10.0,
              ),
              ConstrainedBox(
                constraints: BoxConstraints(
                  minWidth: 60.0,
                  minHeight: 100.0,
                  maxWidth: 100.0,
                ), //父
                child: Column(
                  children: <Widget>[
                    Container(
                      height: 2.0,
                      color: Colors.amber,
                    ),
                    UnconstrainedBox(
                      //“去除”父级限制
                      child: ConstrainedBox(
                        constraints:
                            BoxConstraints(minWidth: 90.0, minHeight: 20.0), //子
                        child: DecoratedBox(
                          decoration: BoxDecoration(color: Colors.red),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                color: Colors.black,
                child: new Transform(
                  alignment: Alignment.topRight, //相对于坐标系原点的对齐方式
                  transform: new Matrix4.skewY(0.3), //沿Y轴倾斜0.3弧度
                  child: new Container(
                    padding: const EdgeInsets.all(8.0),
                    color: Colors.deepOrange,
                    child: const Text('Apartment for rent!'),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(10.0),
                child: DecoratedBox(
                  decoration: BoxDecoration(color: Colors.red),
                  //默认原点为左上角，左移20像素，向上平移5像素
                  child: Transform.translate(
                    offset: Offset(20.0, -5.0),
                    child: Text("Hello world"),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(
                    vertical: 58.0, horizontal: 10.0),
                child: DecoratedBox(
                  decoration: BoxDecoration(color: Colors.red),
                  child: Transform.rotate(
                    //旋转90度
                    angle: 3.14 / 2,
                    child: Text("Hello world"),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(20.0),
                child: DecoratedBox(
                  decoration: BoxDecoration(color: Colors.red),
                  child: Transform.scale(
                    scale: 1.5, //放大到1.5倍
                    child: Text("Hello world"),
                  ),
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  DecoratedBox(
                      decoration: BoxDecoration(color: Colors.red),
                      child: Transform.scale(
                          scale: 1.5, child: Text("Hello world"))),
                  Text(
                    "你好",
                    style: TextStyle(color: Colors.green, fontSize: 18.0),
                  )
                ],
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  DecoratedBox(
                    decoration: BoxDecoration(color: Colors.red),
                    //将Transform.rotate换成RotatedBox
                    child: RotatedBox(
                      quarterTurns: 1, //旋转90度(1/4圈)
                      child: Transform.rotate(
                        angle: 0.6,
                        child: Text("Hello world"),
                      ),
                    ),
                  ),
                  Text(
                    "你好",
                    style: TextStyle(color: Colors.green, fontSize: 18.0),
                  )
                ],
              ),
              Container(
                margin: EdgeInsets.only(top: 50.0, left: 120.0), //容器外填充
                constraints:
                    BoxConstraints.tightFor(width: 200.0, height: 150.0), //卡片大小
                decoration: BoxDecoration(
                    //背景装饰
                    gradient: RadialGradient(
                        //背景径向渐变
                        colors: [Colors.red, Colors.orange],
                        center: Alignment.topLeft,
                        radius: .98),
                    boxShadow: [
                      //卡片阴影
                      BoxShadow(
                          color: Colors.black54,
                          offset: Offset(2.0, 2.0),
                          blurRadius: 4.0)
                    ]),
                transform: Matrix4.rotationZ(.3), //卡片倾斜变换
                alignment: Alignment.center, //卡片内文字居中
                child: Text(
                  //卡片文字
                  "5.20", style: TextStyle(color: Colors.white, fontSize: 40.0),
                ),
              ),
            ],
          )
        ],
      ),
    );
  }
}

class Score {
  final int value;

  Score(this.value);
}
