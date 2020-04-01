import 'dart:convert';
import 'package:intl/intl.dart';

import 'package:http/http.dart';

class WorldTime {
  String location;
  String time;
  String flag;

  String url;

  bool isDayTime;

  WorldTime({
    this.location,
    this.flag,
    this.url,
  });

  Future<void> getTime() async {
    try {
      Response response =
          await get('http://worldtimeapi.org/api/timezone/$url');
      Map data = jsonDecode(response.body);
      // print(data);
      String datetime = data['datetime'];
      String offset = data['utc_offset'];
      int hourDiff = int.parse(offset.substring(1, 3));
      bool hourMore = offset[0] == '+';

      // the parsed is UTC time
      DateTime now = DateTime.parse(datetime);
      now = now.add(Duration(
        hours: hourMore ? hourDiff : -hourDiff,
      ));
      isDayTime = now.hour > 6 && now.hour < 18;
      time = DateFormat.jm().format(now);
    } catch (e) {
      time = 'could not get time now';
    }
  }
}

final WorldTimeList = [
  WorldTime(url: 'Europe/London', location: 'London', flag: 'uk.png'),
  WorldTime(url: 'Europe/Berlin', location: 'Athens', flag: 'greece.png'),
  WorldTime(url: 'Africa/Cairo', location: 'Cairo', flag: 'egypt.png'),
  WorldTime(url: 'Africa/Nairobi', location: 'Nairobi', flag: 'kenya.png'),
  WorldTime(url: 'America/Chicago', location: 'Chicago', flag: 'usa.png'),
  WorldTime(url: 'America/New_York', location: 'New York', flag: 'usa.png'),
  WorldTime(url: 'Asia/Seoul', location: 'Seoul', flag: 'south_korea.png'),
  WorldTime(url: 'Asia/Jakarta', location: 'Jakarta', flag: 'indonesia.png'),
];
