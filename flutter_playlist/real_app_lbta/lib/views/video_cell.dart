import 'package:flutter/material.dart';
import './video_detail.dart';

class VideoCell extends StatelessWidget {
  VideoCell(this.video);

  final video;

  @override
  Widget build(BuildContext context) {
    return FlatButton(
      child: Column(
        children: <Widget>[
          Container(
            padding: EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Image.network(video['imageUrl']),
                Container(height: 8.0),
                Text(
                  video['name'],
                  style: TextStyle(
                    fontSize: 16.0,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          Divider(),
        ],
      ),
      onPressed: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) {
              return VideoDetail(video);
            },
          ),
        );
      },
    );
  }
}
