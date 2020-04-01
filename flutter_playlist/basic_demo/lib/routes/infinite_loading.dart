import 'package:flutter/material.dart';

class InfiniteLoadingRoute extends StatefulWidget {
  static const routeName = "/infinite_loading";

  @override
  _InfiniteLoadingRouteState createState() => _InfiniteLoadingRouteState();
}

class _InfiniteLoadingRouteState extends State<InfiniteLoadingRoute> {
  List<String> list = [];
  bool get _hasMore => list.length < 600;
  ScrollController _controller;
  bool showToTopBtn = false;
  bool _loading = false;

  @override
  initState() {
    super.initState();
    _controller = ScrollController()
      ..addListener(() {
        // print(_controller.offset);
        if (_controller.offset < 300 && showToTopBtn) {
          setState(() {
            showToTopBtn = false;
          });
        } else if (_controller.offset >= 300 && showToTopBtn == false) {
          setState(() {
            showToTopBtn = true;
          });
        }
      });
  }

  @override
  dispose() {
    _controller.dispose();
    super.dispose();
  }

  _loadMore() {
    if (_hasMore || _loading) {
      _loading = true;
      final List<String> l = [];
      for (var i = 0; i < 18; i += 1) {
        l.add('value $i');
      }
      Future.delayed(const Duration(milliseconds: 600)).then((dynamic _) {
        list.addAll(l);
        _loading = false;
        setState(() {});
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Infinite Loading',
        ),
        actions: <Widget>[
          IconButton(
            onPressed: () {
              list = [];
              setState(() {});
            },
            icon: Icon(Icons.refresh),
          ),
        ],
      ),
      body: ListView.builder(
        controller: _controller,
        itemCount: list.length + 1,
        itemExtent: 60,
        itemBuilder: (BuildContext context, int index) {
          if (index < list.length) {
            return ListTile(
              title: Text(list[index]),
            );
          }
          var child;
          if (_hasMore) {
            _loadMore();
            child = SizedBox(
              height: 24.0,
              width: 24.0,
              child: CircularProgressIndicator(strokeWidth: 2.0),
            );
          } else {
            child = Text('No more');
          }
          return Container(
            padding: const EdgeInsets.all(10.0),
            alignment: Alignment.center,
            child: child,
          );
        },
      ),
      floatingActionButton: showToTopBtn
          ? FloatingActionButton(
              child: Icon(Icons.arrow_drop_up),
              onPressed: () {
                _controller.animateTo(
                  0,
                  duration: Duration(milliseconds: 200),
                  curve: Curves.bounceIn,
                );
              },
            )
          : null,
    );
  }
}
