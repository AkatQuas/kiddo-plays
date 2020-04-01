# Web App in Dart

A collection of Web Apps projects in Dart.

# TL; DR

**If I have to write a web app in Dart, I prefer [AngularDart](https://webdev.dartlang.org/angular).**

---

## Web App in low level Dart

Here is a [official tutorial](https://webdev.dartlang.org/tutorials/low-level-html/connect-dart-html) project **[low-level-web-in-dart](low-level-web-in-dart)**.

The low way, I think, is the vanilla way 🤣.

Much like JavaScript manipulating HTML: you find the nodes via selectors and change their attributes or add/remove the event listener attached.

Read more about [dart:html](https://webdev.dartlang.org/guides/html-library-tour), you can find how to:

- Manipulating the DOM

    - Finding elements: `querySelector`, `querySelectorAll`
    - Manipulating elements: manipulating its attributes
    - Creating elements: [element class](https://api.dartlang.org/stable/2.1.0/dart-html/Element-class.html)
    - Adding, replacing, and removing nodes
    - Manipulating CSS styles
    - Handling events

- Using HTTP resources with HttpRequest

- Using WebSocket

And more libraries for more specialized web APIS, such as [web audio](https://api.dartlang.org/stable/dart-web_audio/dart-web_audio-library.html), [WebGL](https://api.dartlang.org/stable/dart-web_gl/dart-web_gl-library.html), etc.

Overview on [Web libraries](https://webdev.dartlang.org/guides/web-programming).

Yeah, it is so brute to write the whole web app in the low vanilla way. But you need to understand what the truth is behind those frameworks.

## Angular Dart

Here is an [official tutorial](https://webdev.dartlang.org/angular/guide/learning-angular). project **[dart-ng-heroes](dart-ng-heroes)**.

Almost every concept, like [data-binding](https://webdev.dartlang.org/angular/guide/displaying-data), [template syntax](https://webdev.dartlang.org/angular/guide/template-syntax), [dependency injection](https://webdev.dartlang.org/angular/guide/dependency-injection), [http client](https://webdev.dartlang.org/angular/guide/server-communication), [router](https://webdev.dartlang.org/angular/guide/router), [dircetives](https://webdev.dartlang.org/angular/guide/structural-directives), etc, is the same as that in [Angular](https://angular.io/guide/quickstart) in TypeScript.

There seems no pain if you want to migrate the project from TypeScript to Dart.

### Keep up with the official document

Read the [document](https://webdev.dartlang.org/angular/guide) carefully to find what you need.

[Other official tutorial samples](https://github.com/dart-lang/dart-tutorials-samples).

### Setup for Development

1. Get the dependencies: `pub get`
1. Get the webdev tool: `pub global activate webdev`
1. Launch a development server: `webdev serve`
1. In a browser, open [http://localhost:8080](http://localhost:8080)

### Build and depolyment

Here is the [guide](https://webdev.dartlang.org/angular/guide/deployment) for build and depolyment.

### What not covered?

Testing is not covered in this project.

However you can find the [guide](https://webdev.dartlang.org/angular/guide/testing) for testing in the official document.

> Personally, I really love writing dart web project in angular.

## React in Dart

[OverReact](https://workiva.github.io/over_react/) which is a library for building statically-typed React UI components using Dart. Take a look at an example `Tag` component class:

```dart
part of over_react.web.demo_components;

/// Bootstrap's `Tag` component renders a small and adaptive tag
/// for adding context to just about any content.
///
/// See: <http://v4-alpha.getbootstrap.com/components/tag/>
@Factory()
// ignore: undefined_identifier
UiFactory<TagProps> Tag = $Tag;

@Props()
class _$TagProps extends UiProps {

TagSkin skin;

bool isPill;
}

@Component()
class TagComponent extends UiComponent<TagProps> {
@override
Map getDefaultProps() => (newProps()
    ..skin = TagSkin.DEFAULT
    ..isPill = false
);

@override
render() {
    var classes = forwardingClassNameBuilder()
    ..add('tag')
    ..add('tag-pill', props.isPill)
    ..add(props.skin.className);

    return (Dom.span()
    ..addProps(copyUnconsumedDomProps())
    ..className = classes.toClassName()
    )(props.children);
}
}

/// Contextual skin options for a [Tag] component.
class TagSkin extends ClassNameConstant {
const TagSkin._(String name, String className) : super(name, className);

/// [className] value: 'tag-default'
static const TagSkin DEFAULT =
    const TagSkin._('DEFAULT', 'tag-default');

/// ...

/// [className] value: 'tag-info'
static const TagSkin INFO =
    const TagSkin._('INFO', 'tag-info');
}

// AF-3369 This will be removed once the transition to Dart 2 is complete.
// ignore: mixin_of_non_class, undefined_class
class TagProps extends _$TagProps with _$TagPropsAccessorsMixin {
    // ignore: undefined_identifier, undefined_class, const_initialized_with_non_constant_value
    static const PropsMeta meta = $metaForTagProps;
}
```

Obviously, it loses the flexibility of JavaScript when writing React. Almost every API functions such as lifecycle methods in `Component` needs to be `override` if you want to use it.

And worse, it breaks the `JSX` syntax sugar, let the `React.createElement` thing on the surface. It takes pains to write things like `React.creatElement()` or `Dom.Span()`.

Besides, you need the `@Factory` decorator for your components. And every part of the component, like `Props`, `State` are separated. Ughhhhhh.

## Vue in Dart

[VueDart](https://refi64.com/vuedart/) is a library that lets you build your Vue web apps using Dart. If you ever try writing vue project in TypeScript, you would find some similariites.

```dart
@VueComponent(template: '<p>{{uppercaseName}}</p>')
class ShowName extends VueComponentBase {
    ShowName(context): super(context);

    @prop
    String name;

    @computed
    String get uppercaseName => name.toUpperCase();
}
```

Still, you need some decorators for the `props`, `computed`, `watch`, `event`, `methods` attributes. And `override` those lifecycle methods.

The template cound either separated in other files, or directly string in the parameters in the `@VueComponent` decorator. Well, that's not so bad.

```dart
@VueComponent(template: '<<show_name.html')
class ShowName extends VueComponentBase {
    @prop
    String name;
}

@VueComponent(template: '<p>Your name is: {{name}}</p>')
class ShowName extends VueComponentBase {
    @prop
    String name;
}
```
