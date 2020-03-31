# zoom_menu

A new Flutter project.

Target

[See the following image](#target)

Reality

![](./screenshot.gif)

# What is in this project

### findAncestorStateOfType

If a child widget want's to get access to the state of its ancestors, the `findAncestorStateOfType` comes to help.

[Example](./lib/zoom_scaffold.dart#L167) show the power of retriving the state.

### Customized TickProvider and AnimationController

`TickProvider` and `AnimationController` are the helpful classes to animate the widget.

[Example](./lib/zoom_scaffold.dart#L190) show how we controll the animation controller and report the change to upper widget by using `ChangeNotifier` class.

### DecorationImage

`DecorationImage` could be used as a background image for `BoxDecoration` of `Containter`.

[Example usage](./lib/menu_screen.dart#L48).

### ImplicitlyAnimatedWidget

`ImplicitlyAnimatedWidget` is another way of animating the widget.

[Example](./lib/menu_screen.dart#L157) shows how we get the dynamical value of position and opacity to style the widget.

### Interval & Curve

`Interval` provide a continuing from `begin`, to `end` using some easing functions.

We can retrive some value at the specific percentage of the instance by its `transform` method, which is very helpful in animation.

# Acknowledgement

<a id="target"></a>
Original design could be searched by [here](https://dribbble.com/search/paleo%20paddock).

![](https://cdn.dribbble.com/users/5576/screenshots/2729372/menu-opt.gif)


**Bebas Neue**: This font comes from [here](https://www.dafont.com/bebas-neue.font).

**Mermaid**: This font comes from [here](https://www.dafontfree.net/freefonts-mermaid-f21276.htm)


## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Lab: Write your first Flutter app](https://flutter.dev/docs/get-started/codelab)
- [Cookbook: Useful Flutter samples](https://flutter.dev/docs/cookbook)

For help getting started with Flutter, view our
[online documentation](https://flutter.dev/docs), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
