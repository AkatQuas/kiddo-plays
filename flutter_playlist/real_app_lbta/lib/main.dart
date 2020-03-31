import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import './views/video_cell.dart';

void main() => runApp(MyApp());

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: RealWorldApp(),
    );
  }
}

class RealWorldApp extends StatefulWidget {
  @override
  _RealWorldAppState createState() => _RealWorldAppState();
}

class _RealWorldAppState extends State<RealWorldApp> {
  var _isLoading = false;
  var videos = [];

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  _fetchData() async {
    if (_isLoading) {
      return;
    }
    setState(() {
      _isLoading = true;
    });
    final url = 'https://api.letsbuildthatapp.com/youtube/home_feed';
    final http.Response response = await http.get(url);
    print(response.statusCode);
    if (response.statusCode == 200) {
      // print(response.body);
      final map = json.decode(response.body);
      setState(() {
        videos = map['videos'];
        _isLoading = false;
      });
    } else {
      setState(() {
        videos = [];
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Real World App Bar'),
        actions: <Widget>[
          IconButton(
            icon: Icon(Icons.refresh),
            onPressed: _fetchData,
          ),
        ],
      ),
      body: Center(
        child: _isLoading
            ? CircularProgressIndicator()
            : ListView.builder(
                itemCount: videos.length + 1,
                itemBuilder: (context, i) {
                  if (i == videos.length) {
                    return Container(
                      alignment: Alignment.center,
                      padding: EdgeInsets.all(8.0),
                      child: Text('End of data'),
                    );
                  }
                  final video = videos.elementAt(i);
                  return VideoCell(video);
                },
              ),
      ),
    );
  }
}
