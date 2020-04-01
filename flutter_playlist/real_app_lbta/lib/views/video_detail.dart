import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class VideoDetail extends StatefulWidget {
  VideoDetail(this.video);

  final video;

  @override
  _VideoDetailState createState() => _VideoDetailState();
}

class _VideoDetailState extends State<VideoDetail> {
  var list = [];
  @override
  void initState() {
    super.initState();
    _fetchList();
  }

  _fetchList() async {
    final id = widget.video['id'];
    final url = 'https://api.letsbuildthatapp.com/youtube/course_detail?id=$id';
    final response = await http.get(url);
    if (response.statusCode == 200) {
      final map = json.decode(response.body);
      setState(() {
        list = map;
      });
    } else {
      setState(() {
        list = [];
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('data'),
      ),
      body: ListView.builder(
        itemCount: list.length,
        itemBuilder: (context, i) {
          final course = list[i];
          return Container(
            margin: EdgeInsets.all(10.0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Container(
                  width: 150.0,
                  child: Image.network(course['imageUrl']),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          course['name'],
                          softWrap: true,
                        ),
                        Text(
                          course['duration'],
                          style: TextStyle(
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                        Text(
                          "Episode #${course['number']}",
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
