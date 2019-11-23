# Overview

A play on i18next and jQuery, not awesowe practise because you need to update the content manually after retriving the locales json files.

# Quickshot

```html
<head>
<!-- ... -->
<script src="./jquery.min.js"></script>
<script src="./i18next.min.js"></script>
<script src="./j-i18next.min.js"></script>
<script src="./i18nextXHRBackend.min.js"></script>
</head>
<body>
<!-- ... -->

<script>
    i18next
        .use(i18nextXHRBackend)
        .init({
            lng: 'en',
            debug: true,
            fallbackLng: 'en',
            ns: ['translation', 'nav', 'outer'],
            backend: {
                loadPath: '/locales/{{lng}}/{{ns}}.json',
                addPath: 'locales/add/{{lng}}/{{ns}}',
                crossDomain: true
            },
        }, function (err, t) {
            jqueryI18next.init(i18next, $);

            $('.nav').localize();
            $('.content').localize();
            $('.outer').localize();
        });
    $(document).ready(function () {
        var langs = [
            {
                l: 'en',
                t: 'English'
            }, {
                l: 'cn',
                t: 'CHINESE'
            }
        ];

        var spans = $.map(langs, function (item, index) {
            var span = $('<span />').attr('class','lang-item').text(item.t).on('click', item, function (e) {
                i18next.changeLanguage(e.data.l, function (err, t) {
                    if (err) return console.log('something wrong with the translating', err);

                    // update the translation manually
                    $('.nav').localize();
                    $('.content').localize();
                    $('.outer').localize();
                });

            });
            return span;
        });

        $('#languages').append(spans)
    });
</script>

</body>
```