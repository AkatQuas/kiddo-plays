import 'package:flutter/material.dart';

class NavigateButton extends StatelessWidget {
  final Function(BuildContext) builder;
  final String routeName;
  final bool fullscreenDialog;
  final String navigationText;
  final Object arguments;

  NavigateButton({
    Key key,
    this.builder,
    this.routeName,
    this.arguments,
    this.fullscreenDialog = false,
    @required this.navigationText,
  })  : assert(
            builder == null || routeName == null,
            'If the route property is specified, the routeName '
            'cannot be assigned, since it would be redundant.'),
        assert(
            builder != null || routeName != null,
            'Either "builder" or "routeName" should be specifide.'
            'Otherwise, it cannot navigate'),
        super(key: key);

  _navigateAway(context) {
    if (builder != null) {
      Navigator.push(
        context,
        MaterialPageRoute(
          fullscreenDialog: fullscreenDialog,
          builder: builder,
        ),
      );
      return;
    } else {
      Navigator.pushNamed(context, routeName, arguments: arguments);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 5.0, horizontal: 8.0),
      child: RaisedButton(
        child: Text(navigationText),
        onPressed: () {
          _navigateAway(context);
        },
      ),
    );
  }
}
