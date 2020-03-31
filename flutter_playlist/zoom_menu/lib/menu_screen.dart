import 'package:flutter/material.dart';
import './screen.dart';
import './zoom_scaffold.dart';

class MenuScreen extends StatefulWidget {
  final Menu menu;
  final Function(MenuItem) onItemSelect;

  const MenuScreen({
    Key key,
    this.menu,
    this.onItemSelect,
  }) : super(key: key);

  @override
  _MenuScreenState createState() => _MenuScreenState();
}

class _MenuScreenState extends State<MenuScreen> with TickerProviderStateMixin {
  AnimationController _animationController;
  String _selectedId = '';

  @override
  void initState() {
    super.initState();
    _selectedId = widget.menu.items[0].id;
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    )..addListener(() {
        setState(() {});
      });
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ZoomScaffoldMenuController(
      builder: (BuildContext contxt, ZoomScaffoldController controller) {
        return Container(
          width: double.infinity,
          height: double.infinity,
          decoration: BoxDecoration(
            image: DecorationImage(
              image: AssetImage('assets/dark_grunge_bk.jpg'),
              fit: BoxFit.cover,
            ),
          ),
          child: Material(
            color: Colors.transparent,
            child: Stack(
              children: <Widget>[
                _createMenuTitle(controller),
                _createMenuList(controller),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _createMenuList(ZoomScaffoldController controller) {
    final list = widget.menu.items;
    final List<Widget> widgetList = [];
    final animationIntervalGap = 0.5;
    final itemAnimationDelay =
        controller.state == ZoomScaffoldState.closing ? 0.0 : 0.15;
    for (var i = 0; i < list.length; i += 1) {
      final animationIntervalStart = itemAnimationDelay * i;
      final item = list[i];
      widgetList.add(
        AnimatedMenuListItem(
          curve: Interval(
            animationIntervalStart,
            animationIntervalStart + animationIntervalGap,
            curve: Curves.easeOut,
          ),
          duration: const Duration(milliseconds: 500),
          zoomScaffoldState: controller.state,
          menuListItem: _MenuListItem(
            isSelected: item.id == _selectedId,
            title: item.title,
            onTap: () {
              setState(() {
                _selectedId = item.id;
                widget.onItemSelect(item);
                controller.close();
              });
            },
          ),
        ),
      );
    }
    return Transform(
      transform: Matrix4.translationValues(
        0,
        225.0,
        0,
      ),
      child: Column(
        children: widgetList,
      ),
    );
  }

  Widget _createMenuTitle(ZoomScaffoldController controller) {
    switch (controller.state) {
      case ZoomScaffoldState.open:
      case ZoomScaffoldState.opening:
        _animationController.forward();
        break;
      case ZoomScaffoldState.closed:
      case ZoomScaffoldState.closing:
        _animationController.reverse();
        break;
    }

    return AnimatedBuilder(
      child: OverflowBox(
        maxWidth: double.infinity,
        alignment: Alignment.topLeft,
        child: Padding(
          padding: const EdgeInsets.all(30.0),
          child: Text(
            'Menu',
            style: TextStyle(
              color: const Color(0x88444444),
              fontSize: 240.0,
              fontFamily: 'mermaid',
            ),
            textAlign: TextAlign.left,
            softWrap: false,
          ),
        ),
      ),
      animation: _animationController,
      builder: (BuildContext context, Widget child) {
        return Transform(
          transform: Matrix4.translationValues(
            150 - _animationController.value * 250.0,
            0.0,
            0.0,
          ),
          child: child,
        );
      },
    );
  }
}

class AnimatedMenuListItem extends ImplicitlyAnimatedWidget {
  final _MenuListItem menuListItem;
  final ZoomScaffoldState zoomScaffoldState;
  final Duration duration;

  AnimatedMenuListItem({
    this.menuListItem,
    this.zoomScaffoldState,
    this.duration,
    curve,
  }) : super(duration: duration, curve: curve);

  @override
  _AnimatedMenuListItemState createState() => _AnimatedMenuListItemState();
}

class _AnimatedMenuListItemState
    extends AnimatedWidgetBaseState<AnimatedMenuListItem> {
  final double closedSlidePosition = 200.0;
  final double openSlidePosition = 0.0;

  Tween<double> _translation;
  Tween<double> _opacity;

  printRenderBoxInfo() {
    final renderBox = context.findRenderObject() as RenderBox;
    if (renderBox != null) {
      final topLeftCoordinate = renderBox.localToGlobal(Offset(0.0, 0.0));
      print('My renderbox topLeft : $topLeftCoordinate');
    }
  }

  @override
  void forEachTween(visitor) {
    var slide, opacity;
    switch (widget.zoomScaffoldState) {
      case ZoomScaffoldState.closed:
      case ZoomScaffoldState.closing:
        slide = closedSlidePosition;
        opacity = 0.0;
        break;
      case ZoomScaffoldState.open:
      case ZoomScaffoldState.opening:
        slide = openSlidePosition;
        opacity = 1.0;
        break;
      default:
    }

    _translation = visitor(
      _translation,
      slide,
      (dynamic value) => Tween<double>(begin: value),
    );

    _opacity = visitor(
      _opacity,
      opacity,
      (dynamic value) => Tween<double>(begin: value),
    );
  }

  @override
  Widget build(BuildContext context) {
    printRenderBoxInfo();

    return Opacity(
      opacity: _opacity.evaluate(animation),
      child: Transform(
        transform: Matrix4.translationValues(
          0.0,
          _translation.evaluate(animation),
          0.0,
        ),
        child: widget.menuListItem,
      ),
    );
  }
}

class _MenuListItem extends StatelessWidget {
  final String title;
  final Function onTap;
  final bool isSelected;

  const _MenuListItem({
    Key key,
    this.title,
    this.onTap,
    this.isSelected,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return InkWell(
      splashColor: const Color(0x44000000),
      onTap: isSelected ? null : onTap,
      child: Container(
        decoration: BoxDecoration(
          border: Border(
            left: BorderSide(
              width: 5.0,
              color: isSelected ? Colors.red : Colors.transparent,
            ),
          ),
        ),
        width: double.infinity,
        padding: const EdgeInsets.only(
          top: 10.0,
          bottom: 10.0,
          left: 30.0,
        ),
        child: Text(
          title,
          style: TextStyle(
            color: isSelected ? Colors.red : Colors.white,
            fontSize: 25.0,
            fontFamily: 'BebasNeue',
            letterSpacing: 2.0,
          ),
        ),
      ),
    );
  }
}

class Menu {
  final List<MenuItem> items;

  Menu({
    this.items,
  });
}

class MenuItem {
  final String id;
  final String title;
  final Screen screen;

  MenuItem({
    this.id,
    this.title,
    this.screen,
  });
}
