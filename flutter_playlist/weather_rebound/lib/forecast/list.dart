import 'package:flutter/material.dart';

import './radial_list.dart';

final RadialListViewModel forecastRadialList = RadialListViewModel(
  items: [
    RadialListItemViewModel(
      icon: AssetImage('assets/ic_rain.png'),
      title: '11:30',
      subtitle: 'Light Rain',
      isSelected: true,
    ),
    RadialListItemViewModel(
      icon: AssetImage('assets/ic_rain.png'),
      title: '12:30',
      subtitle: 'Light Rain',
      isSelected: false,
    ),
    RadialListItemViewModel(
      icon: AssetImage('assets/ic_cloudy.png'),
      title: '13:30',
      subtitle: 'Cloudy',
      isSelected: false,
    ),
    RadialListItemViewModel(
      icon: AssetImage('assets/ic_sunny.png'),
      title: '14:30',
      subtitle: 'Sunny',
      isSelected: false,
    ),
    RadialListItemViewModel(
      icon: AssetImage('assets/ic_sunny.png'),
      title: '15:30',
      subtitle: 'Sunny',
      isSelected: false,
    ),
  ],
);
