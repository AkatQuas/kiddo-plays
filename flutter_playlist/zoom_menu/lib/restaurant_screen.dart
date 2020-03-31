import 'package:flutter/material.dart';

import './screen.dart';

import './restaurant_card.dart';

final Screen restaurantScreen = Screen(
    title: '',
    background: DecorationImage(
      image: AssetImage('assets/wood_bk.jpg'),
      fit: BoxFit.cover,
    ),
    contentBuilder: (BuildContext context) {
      return ListView(
        children: <Widget>[
          RestaurantCard(
            headImageAssetPath: 'assets/eggs_in_skillet.jpg',
            icon: Icons.fastfood,
            iconBackgroundColor: Colors.orange,
            title: 'il domacca',
            subtitle: '78 5TH AVENUE, NEW YORK',
            heartCount: 84,
          ),
          RestaurantCard(
            headImageAssetPath: 'assets/steak_on_cooktop.jpg',
            icon: Icons.local_dining,
            iconBackgroundColor: Colors.red,
            title: 'Mc Grady',
            subtitle: '88 S JULIETTE AVENUE, MANHATTAN',
            heartCount: 97,
          ),
          RestaurantCard(
            headImageAssetPath: 'assets/spoons_of_spices.jpg',
            icon: Icons.local_drink,
            iconBackgroundColor: Colors.purpleAccent,
            title: 'Sugar & Spice',
            subtitle: '9 HAMILTON STREET, PHILADELPHIA',
            heartCount: 100,
          ),
        ],
      );
    });
