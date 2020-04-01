import 'package:flutter/material.dart';
import '../services/world_time.dart';

class Selection extends StatelessWidget {
  _select(BuildContext context, int index) async {
    final instance = WorldTimeList[index];
    await instance.getTime();
    Navigator.pop(context, {
      'location': instance.location,
      'flag': instance.flag,
      'time': instance.time,
      'isDayTime': instance.isDayTime,
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[200],
      appBar: AppBar(
        title: Text('Choose a location'),
      ),
      body: ListView.builder(
        itemExtent: 70.0,
        itemCount: WorldTimeList.length,
        itemBuilder: (BuildContext context, int index) {
          final item = WorldTimeList[index];
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 2.0, horizontal: 4.0),
            child: Card(
              color: Colors.lightBlue[100],
              child: ListTile(
                onTap: () {
                  _select(context, index);
                },
                title: Text(item.location),
                leading: CircleAvatar(
                  backgroundImage: AssetImage('assets/${item.flag}'),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
