# Why do I learn jQuery ?

Because we have an official website that needs to be reachable on IE 8+. 

😇 What a chanllenge!

# Beautiful Snippets

## extend object

```javascript
var newObject = $.extend({},firstObject, secondObject);
console.log('new ', newObject);
console.log('first ', firstObject);
console.log('second ', secondObject);
```

## create element and put into DOM

``` javascript
$('<div />').attr({ 'class': 'append' }).text('an appended div').appendTo('#content');

$('<div />').attr({ 'class': 'append' }).text('an insert before div').insertBefore('#content');

$('<div />').attr({ 'class': 'append' }).text('an insert after div').insertAfter('#content');

$('#content').append($('<div />').attr('class', 'append').text('parent called append'));
```

## event management with delegation, default parameters

```javascript
$('#one').on('click', 'span', { foo: 'bark' }, function (e) {
    e.stopPropagation()
    e.preventDefault();
    console.log(e.pageX, e.pageY)
    console.log(e.type)
    console.log(e.data)
    console.log($(this))
    console.log('click p#one')
});
```

## custom events

```javascript
// bad 
$('.switch, .clapper').on('click', function () {
    var light = $(this).closest('.room').find('.lightbulb')
    if (light.is('.on')) {
        light.removeClass('on').addClass('off')
    } else {
        light.removeClass('off').addClass('on')
    }
})

// better
$('.lightbulb').on('light:toggle', function (e) {
    var light = $(this);
    if (light.is('.on')) {
        light.removeClass('on').addClass('off');
    } else {
        light.removeClass('off').addClass('on');
    }
}).on('light:on', function (e) {
    $(this).removeClass('off').addClass('on');
}).on('light:off', function (e) {
    $(this).removeClass('on').addClass('off');
});

$('.switch, .clapper').click(function () {
    var room = $(this).closest('.room')
    room.find('.lightbulb').trigger('light:toggle')
});
```

## ajax requets

```javascript
$.getJSON('foo.json', function (json) {
    console.log(json);
    $("<h1>").text(json.title).appendTo("body");
    $("<div class=\"content\">").html(json.html).appendTo("body");
}).fail(function (xhr, status, errorThrown) {
    alert("Sorry, there was a problem!");
    console.log("Error: " + errorThrown);
    console.log("Status: " + status);
    console.dir(xhr);
}).always(function (xhr, status) {
    alert('Sec request complete with status: ' + status);
});
```

## effects / animation

```javascript
$("div.funtimes").animate(
    {
        width: ["+=50", 'swing'],
        opacity: [0.25,'linear']
    },

    // Duration
    800,

    // Callback to invoke when the animation is finished
    function () {
        $('div.funtimes').animate(
            {height: '+= 50'},
            500
        ).queue(function (next) {
            $(this).text('funtimes queue');
            $(this).dequeue();

            // or call next to dequeue automatically
            // next();
        });
    }
);
```

## plugins

```javascript
// Plugin defaults – added as a property on our plugin function.
$.fn.hilight.defaults = {
    foreground: "red",
    background: "yellow"
};

$.fn.hilight = function (options) {

    // Extend our default options with those provided.
    // Note that the first argument to extend is an empty
    // object – this is to keep from overriding our "defaults" object.
    var opts = $.extend({}, $.fn.hilight.defaults, options);

    // Our plugin implementation code goes here.
    
    // todo 
};

$.fn.showLinkLocation = function () {

    /*
    // ok
    this.filter("a").each(function () {
        var link = $(this);
        link.append(" -> " + link.attr("href"));
    });
    */

    // better
    this.filter('a').append(function () {
        return " -> " + this.href;
    })

    return this;
};


// using optinos to minimize plugin
// bad
$.fn.openPopup = function () {
    // Open popup code.
};

$.fn.closePopup = function () {
    // Close popup code.
};

// good
$.fn.popup = function (action) {

    if (action === "open") {
        // Open popup code.
    }

    if (action === "close") {
        // Close popup code.
    }

};
```

# Useful References

- [DOM]

    - [selection](https://learn.jquery.com/using-jquery-core/selecting-elements/)

    - [elements manipulating](https://learn.jquery.com/using-jquery-core/manipulating-elements/)

    - [Understanding the jQuery-Object](https://learn.jquery.com/using-jquery-core/jquery-object/)

    - [Traversing among the elements](https://learn.jquery.com/using-jquery-core/traversing/)

    - [jQuery Utility Methods](https://learn.jquery.com/using-jquery-core/utility-methods/)
        - [more](http://api.jquery.com/category/utilities/)

    - [FAQ examples](https://learn.jquery.com/using-jquery-core/faq/)

- [Events]

    - [events binding basics](https://learn.jquery.com/events/event-basics/)

    - [events handling examples](https://learn.jquery.com/events/handling-events/)

    - [event delegation](https://learn.jquery.com/events/event-delegation/)

    - [custom events](https://learn.jquery.com/events/introduction-to-custom-events/)
    
    - [**event extensinos**](https://learn.jquery.com/events/event-extensions/)

- [Ajax](https://learn.jquery.com/ajax/)

    - [Ajax Events](http://api.jquery.com/Ajax_Events/)

- [Plugins](https://learn.jquery.com/plugins/basic-plugin-creation/)

    - [Stateful Plugins](https://learn.jquery.com/plugins/stateful-plugins-with-widget-factory/)

- [Performance](https://learn.jquery.com/performance/): minimize the operation on dom tree, most jobs should be done with in JavaScript

    - [Detach Elements to Work with Them](https://learn.jquery.com/performance/detach-elements-before-work-with-them/)

    - [Optimize selectors](https://learn.jquery.com/performance/optimize-selectors/)

- [Code Organization](https://learn.jquery.com/code-organization/)

- [jQuery UI, tl;dr](https://learn.jquery.com/jquery-ui/)

- [jQuery Mobile](https://learn.jquery.com/jquery-mobile/)
