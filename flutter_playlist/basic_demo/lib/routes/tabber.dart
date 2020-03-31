import 'package:flutter/material.dart';

class TabberRoute extends StatefulWidget {
  static const routeName = "/tabber";

  @override
  _TabberRouteState createState() => _TabberRouteState();
}

class _TabConfig {
  final String text;
  final IconData icon;
  _TabConfig(this.text, this.icon);
}

class _TabberRouteState extends State<TabberRoute>
    with SingleTickerProviderStateMixin {
  int _selectedIndex = 0;
  List<_TabConfig> tabs = [
    _TabConfig('History', Icons.shop),
    _TabConfig('Physics', Icons.shuffle),
    _TabConfig('Chemical', Icons.radio),
    _TabConfig('English', Icons.art_track),
  ];
  TabController _tabController;

  @override
  initState() {
    super.initState();
    _tabController = TabController(
      length: tabs.length,
      vsync: this,
    )..addListener(() {
        setState(() {});
      });
  }

  @override
  dispose() {
    _tabController.dispose();
    super.dispose();
  }

  _onNavigationItemTap(index) {
    print('$index tapped');
    if (index != _selectedIndex) {
      setState(() {
        _selectedIndex = index;
      });
    }
  }

  _onAdd() {
    print('we need to add');
    Navigator.pop(context);
  }

  _handleTabTap(int idx) {
    print(tabs[idx].icon);
  }

  _buildBottomBar() {
    if (_tabController.index < 2) {
      return BottomAppBar(
        elevation: 10.0,
        color: Colors.teal[100],
        shape: CircularNotchedRectangle(),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: <Widget>[
            Icon(Icons.autorenew),
            IconButton(
              icon: Icon(Icons.assistant),
              onPressed: () {},
            ),
            SizedBox(),
            IconButton(
              icon: Icon(Icons.av_timer),
              onPressed: () {},
            ),
            Icon(Icons.beenhere),
          ],
        ),
      );
    }
    return BottomNavigationBar(
      items: [
        BottomNavigationBarItem(
          icon: Icon(Icons.home),
          title: Text('Home'),
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.business),
          title: Text('Business'),
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.school),
          title: Text('School'),
        ),
      ],
      currentIndex: _selectedIndex,
      fixedColor: Colors.amberAccent,
      onTap: _onNavigationItemTap,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        // leading: Icon(Icons.menu),
        title: Text(
          'Tabber Name',
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: Colors.orange,
          unselectedLabelColor: Colors.purple[800],
          indicatorWeight: 3.0,
          tabs: tabs
              .map((t) => Tab(
                    text: t.text,
                    icon: Icon(t.icon),
                  ))
              .toList(),
          onTap: _handleTabTap,
        ),
        actions: <Widget>[
          Builder(
            builder: (BuildContext context) {
              return IconButton(
                icon: Icon(Icons.share),
                onPressed: () {
                  Scaffold.of(context).openDrawer();
                },
              );
            },
          ),
        ],
      ),
      drawer: MyDrawer(),
      bottomNavigationBar: _buildBottomBar(),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      floatingActionButton: FloatingActionButton(
        //悬浮按钮
        child: Icon(Icons.arrow_back_ios),
        onPressed: _onAdd,
      ),
      body: TabBarView(
        controller: _tabController,
        children: tabs
            .map(
              (config) => Center(
                child: Text(
                  config.text,
                  textScaleFactor: 2,
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class MyDrawer extends StatelessWidget {
  const MyDrawer({
    Key key,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: Column(
        children: <Widget>[
          Row(
            children: <Widget>[
              Image.asset(
                'assets/24731539.jpeg',
                width: 100.0,
              ),
              Text('MyUsername'),
            ],
          ),
          Container(
            color: Colors.purple,
            height: 5.0,
          ),
        ],
      ),
    );
  }
}
