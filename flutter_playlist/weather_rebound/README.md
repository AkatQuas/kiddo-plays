# weather_rebound

A new Flutter project.

Original design is [here](https://dribbble.com/shots/1212896-Weather-Rebound-gif).

And what we have created is the following, watch out there is rainning in the background.

![](./screenshot.gif)

# What is in this project

### SingleTickerProviderStateMixin

Part of the documentation from the source code.

```dart
/// Provides a single [Ticker] that is configured to only tick while the current
/// tree is enabled, as defined by [TickerMode].
///
/// To create the [AnimationController] in a [State] that only uses a single
/// [AnimationController], mix in this class, then pass `vsync: this`
/// to the animation controller constructor.
///
/// This mixin only supports vending a single ticker. If you might have multiple
/// [AnimationController] objects over the lifetime of the [State], use a full
/// [TickerProviderStateMixin] instead.
mixin SingleTickerProviderStateMixin<T extends StatefulWidget> on State<T> implements TickerProvider {
  /// ... implementation details
}
```

### FractionalTranslation

Part of the documentation from the source code.

Using percentage to transformation the widget, which is scaled the the chid's size.

```dart
/// Applies a translation transformation before painting its child.
///
/// The translation is expressed as a [Offset] scaled to the child's size. For
/// example, an [Offset] with a `dx` of 0.25 will result in a horizontal
/// translation of one quarter the width of the child.
///
/// Hit tests will only be detected inside the bounds of the
/// [FractionalTranslation], even if the contents are offset such that
/// they overflow.
```

[Example](./lib/generic/slide_drawer.dart#L20).

> A small trick in this example, we using a `Stack` to group `GestureDetector` and the other abover content. `GestureDetector` works as an overlay to capture other gestures besides those on the content. It's possible to implement *tap-blank-and-close* action.

### AnimationBuilder

If you already have an animation, you could just use `AnimationBuilder` to quickly create an animated widget without changing the current widget to a `StatefulWidget`.

It requires two arguments `[animation]` and `[builder]`. [More details](https://flutter.dev/docs/development/ui/animations/overview#animation).

[Example 1](./lib/forecast/forecast.dart#L22). [Example 2](./lib/forecast/radial_list.dart#L19).

### SpriteWidget

[SpriteWidget](https://github.com/spritewidget/spritewidget/) is a toolkit for building complex, high performance animations and 2D games with Flutter.

In this project, we create the [raining effect](./lib/forecast/background/rain.dart) using *SpriteWidget*.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Lab: Write your first Flutter app](https://flutter.dev/docs/get-started/codelab)
- [Cookbook: Useful Flutter samples](https://flutter.dev/docs/cookbook)

For help getting started with Flutter, view our
[online documentation](https://flutter.dev/docs), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
