import 'package:flutter/material.dart';

class GridViewRoute extends StatelessWidget {
  static const routeName = "/grid-view";

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'GridView',
        ),
      ),
      body: Column(
        children: <Widget>[
          Text('You need to setup the height of the parent widget.'),
          Expanded(
            child: GridView(
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                childAspectRatio: 0.5,
                crossAxisSpacing: 10.0,
                mainAxisSpacing: 20.0,
              ),
              children: [
                DecoratedBox(
                  child: Icon(Icons.ac_unit),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: Colors.lime,
                    ),
                  ),
                ),
                DecoratedBox(
                  child: Icon(Icons.airport_shuttle),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: Colors.lime,
                    ),
                  ),
                ),
                DecoratedBox(
                  child: Icon(Icons.all_inclusive),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: Colors.lime,
                    ),
                  ),
                ),
                DecoratedBox(
                  child: Icon(Icons.beach_access),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: Colors.lime,
                    ),
                  ),
                ),
                DecoratedBox(
                  child: Icon(Icons.cake),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: Colors.lime,
                    ),
                  ),
                ),
                DecoratedBox(
                  child: Icon(Icons.free_breakfast),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: Colors.lime,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
