require([
    'gitbook',
    'jquery'
], function(gitbook, $) {
    var MAX_RESULTS = 15;
    var MAX_DESCRIPTION_SIZE = 500;

    var usePushState = (typeof history.pushState !== 'undefined');

    // DOM Elements
    var $body = $('body');
    var $bookSearchResults;
    var $searchInput;
    var $searchList;
    var $searchTitle;
    var $searchResultsCount;
    var $searchQuery;

    // Throttle search
    function throttle(fn, wait) {
        var timeout;

        return function() {
            var ctx = this, args = arguments;
            if (!timeout) {
                timeout = setTimeout(function() {
                    timeout = null;
                    fn.apply(ctx, args);
                }, wait);
            }
        };
    }

    function debounce(func, wait, immediate) {
        var timeout;
        return function () {
            var context = this, args = arguments;
            var later = function () {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    };

    function displayResults(res) {
        hideErrorMsg()
        $bookSearchResults.addClass('open');

        var noResults = res.count == 0;
        $bookSearchResults.toggleClass('no-results', noResults);

        // Clear old results
        $searchList.empty();

        // Display title for research
        $searchResultsCount.text(res.count);
        $searchQuery.text(res.query);
        var query = res.query

        // Create an <li> element for each result
        res.results.forEach(function(res) {
            var $li = $('<li>', {
                'class': 'search-results-item'
            });

            var $title = $('<h3>');

            var href = getRelativePath(location.pathname, res.url)
            if (href.indexOf('?') > -1) {
                href += '&search-key=' + encodeURIComponent(query)
            } else {
                href += '?search-key=' + encodeURIComponent(query)
            }

            var $link = $('<a>', {
                // 'href': gitbook.state.basePath + '/' + res.url,
                'href': href,
                'text': filterTitle(res.title)
            });

            var content = filterContent(res.body.trim())
            if (content.length > MAX_DESCRIPTION_SIZE) {
                content = content.slice(0, MAX_DESCRIPTION_SIZE).trim()+'...'
            }
            var $content = $('<p>').html(content)

            $link.appendTo($title);
            $title.appendTo($li);
            $content.appendTo($li);
            $li.appendTo($searchList);
        });
    }

    function filterTitle(title) {
        return filterContent(title.replace(/<em>/g, '').replace(/<\/em>/g, ''))
    }

    function filterContent(content) {
        return content.replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/&amp;/g, '&')
            .replace(/&lt;em&gt;/g, '<em>')
            .replace(/&lt;\/em&gt;/g, '</em>')
    }

    function launchSearch(q) {
        // Add class for loading
        $body.addClass('with-search');
        $body.addClass('search-loading');

        // Launch search query
        /*
        throttle(gitbook.search.query(q, 0, MAX_RESULTS)
        .then(function(results) {
            displayResults(results);
        })
        .always(function() {
            $body.removeClass('search-loading');
        }), 1000);
        */

        debouncedWXSearch(q)
    }

    /**
     * {
     *  count: 2,
     *  query: 'api',
     *  results: [{
     *    title: '',
     *    body: '',
     *    url: 'api/api-login.html',
     *  }]
     * }
     */
    function wxSearch(q) {
        $.ajax({
            url: '/search?action=detail',
            dataType: 'json',
            data: {
                page: 0,
                limit: 30,
                blogcategory: 2048,
                search_type: 1,
                query: q,
            },
            success: function (data) {
                if (data.base_resp) {
                    if (data.base_resp.ret == 0) {
                        var list = data.wxadoc_list

                        var results = []
                        for (var i = 0; i < list.length; i++) {
                            results.push({
                                title: list[i].title,
                                url: list[i].path,
                                body: list[i].content,
                            })
                        }

                        // mock
                        /*
                        results = [{
                            title: 'wx.createCanvasContext',
                            url: '/miniprogram/dev/api/canvas/create-canvas-context.html',
                            body: 'body',
                        }, {
                            title: 'rich-text',
                            url: '/miniprogram/dev/component/rich-text.html',
                            body: 'body',
                        }, {
                            title: '简易教程',
                            url: '/miniprogram/dev/',
                            body: 'body',
                        }, {
                            title: '快速上手',
                            url: '/minigame/dev/index.html',
                            body: 'body',
                        }, {
                            title: 'media-background-audio',
                            url: '/miniprogram/dev/api/media-background-audio.html#wxonbackgroundaudiostopcallback',
                            body: 'body',  
                        }, {
                            title: 'SystemInfo wx.getSystemInfoSync()',
                            url: '/minigame/dev/document/system/system-info/wx.getSystemInfoSync.htm',
                            body: 'body',
                        }, {
                            title: '减少输入',
                            url: '/miniprogram/design/#减少输入',
                            body: 'body',
                        }]
                        */

                        window.results = results
                        displayResults({
                            count: results.length,
                            query: q,
                            results: results,
                        })

                    } else if (data.base_resp.ret == 200013) {
                        // freq limit
                        showErrorMsg('搜索太频繁，请稍后再试')
                    }
                } else {
                    // unknown
                    showErrorMsg('未知错误，请稍后重试')
                }
            },
            complete: function(jqXHR) {
                $body.removeClass('search-loading');
            }
        })
    }
    var debouncedWXSearch = debounce(wxSearch, 500)
    $('.search-results .no-results').append('<h1 class="search-results-title js_errmsg" style="display: none"></h1>')

    /**
     * Example: 
     *      from /miniprogram/analysis/regular/index.html?search-input=常规
     *      to   /minigame/dev/document/render/canvas/wx.createCanvas.html
     *      =>   ../../../minigame/dev/document/render/canvas/wx.createCanvas.html
     * 
     *      from /miniprogram/dev/api/?search-input=ap
     *      to   /miniprogram/dev/devtools/notsupport.html
     *      =>   ../devtools/notsupport.html
     * 
     *      from /miniprogram/dev/api/?search-input=ap
     *      to   /miniprogram/dev/api/canvas/notsupport.html
     *      =>   ./canvas/notsupport.html
     * 
     *      from /miniprogram/dev/api/?search-input=ap
     *      to   /miniprogram/dev/
     *      =>   ../
     * 
     *      from /
     *      to   /miniprogram/dev/
     *      =>   ./miniprogram/dev/
     * 
     * @param {*} from URL
     * @param {*} to URL
     */
    function getRelativePath(from, to) {
        var i
        from = normalizePath(from)
        to = normalizePath(to)

        var fromPathSegments = getPathMidSegments(from)
        var toPathSegments = getPathMidSegments(to)

        var segDiffFromInd = 0
        for (; segDiffFromInd < fromPathSegments.length; segDiffFromInd++) {
            if (segDiffFromInd >= toPathSegments.length) {
                break
            }
            if (fromPathSegments[segDiffFromInd] != toPathSegments[segDiffFromInd]) {
                break
            }
        }

        var fromPathSegmentsLength = fromPathSegments.length
        var sameSegCount = segDiffFromInd

        var relativePathSegments = []
        for (i = 0; i < fromPathSegmentsLength - sameSegCount; i++) {
            relativePathSegments.push('..')
        }

        var toPathFullSegments = getPathSegmenets(to)
        for (i = sameSegCount; i < toPathFullSegments; i++) {
            relativePathSegments.push(toPathFullSegments[i])
        }

        return '/' + toPathFullSegments.join('/')
    }

    function normalizePath(path) {
       // add prefix / if needed
       if (!/^\//.test(path)) {
           path = '/' + path
       }

       // remove query
       path = path.split('?')[0]

       return path
    }

    /**
     * example
     *      /miniprogram/dev/api/index.html => ["miniprogram", "dev", "api"]
     * @param {*} path 
     */
    function getPathMidSegments(path) {
        return path.split('/').slice(1, -1)
    }

    /**
     * example
     *      /miniprogram/dev/api/index.html => ["miniprogram", "dev", "api", "index.html"]
     * @param {*} path 
     */
    function getPathSegmenets(path) {
        return path.split('/').slice(1)
    }

    function identity(x) {
        return x
    }

    function hideErrorMsg() {
        $('.js_errmsg').hide() 
    }

    function showErrorMsg(msg) {
        displayResults({
            count: 0,
            query: '',
            results: [],
        })
        $('.search-results .no-results .search-results-title').hide()
        $('.js_errmsg').text(msg).show()
    }

    function closeSearch() {
        $body.removeClass('with-search');
        $bookSearchResults.removeClass('open');
    }

    function launchSearchFromQueryString() {
        var q = getParameterByName('q');
        if (q && q.length > 0) {
            // Update search input
            $searchInput.val(q);

            // Launch search
            launchSearch(q);
        }
    }

    function jumpToSearchKey() {
        var key = getParameterByName('search-key')
        if (key && key.length > 0) {
            key = decodeURIComponent(key)
            
            if (window.find && window.getSelection) {
                document.designMode = "on";
                let sel = window.getSelection();
                sel.collapse(document.body, 0);

                var hadFindFirstDom = false
                while (window.find(key)) {
                    if (!hadFindFirstDom) {
                        //查找最近父级dom，并计算offsetTop高度
                        let node = sel.anchorNode;
                        while (!node.tagName) {
                            node = node.parentElement;
                            if (node === document || node === document.body) {
                                break;
                            }
                        }
                        let offset = $(node).offset();
                        if (!!offset && !!offset.top) {
                            hadFindFirstDom = true;
                            setTimeout(function () {
                                $('.book-body').animate({
                                    scrollTop: offset.top - 100
                                });
                            }, 100);
                        }
                    }

                    //渲染背景色
                    document.execCommand("foreColor", false, "#44B549");
                    sel.collapseToEnd();
                }
                document.designMode = "off";
            }
        }
    }

    function bindSearch() {
        // Bind DOM
        $searchInput        = $('#book-search-input input');
        $bookSearchResults  = $('#book-search-results');
        $searchList         = $bookSearchResults.find('.search-results-list');
        $searchTitle        = $bookSearchResults.find('.search-results-title');
        $searchResultsCount = $searchTitle.find('.search-results-count');
        $searchQuery        = $searchTitle.find('.search-query');

        // Launch query based on input content
        function handleUpdate() {
            var q = $searchInput.val();

            if (q.length == 0) {
                closeSearch();
            }
            else {
                launchSearch(q);
            }
        }

        // Detect true content change in search input
        // Workaround for IE < 9
        var propertyChangeUnbound = false;
        $searchInput.on('propertychange', function(e) {
            if (e.originalEvent.propertyName == 'value') {
                handleUpdate();
            }
        });

        // HTML5 (IE9 & others)
        $searchInput.on('input', function(e) {
            // Unbind propertychange event for IE9+
            if (!propertyChangeUnbound) {
                $(this).unbind('propertychange');
                propertyChangeUnbound = true;
            }

            handleUpdate();
        });

        // Push to history on blur
        $searchInput.on('blur', function(e) {
            // Update history state
            if (usePushState) {
                var uri = updateQueryString('q', $(this).val());
                history.pushState({ path: uri }, null, uri);
            }
        });
    }

    document.addEventListener('page.change', function () {
        setTimeout(function() {
            bindSearch();
            closeSearch();
            setTimeout(function() {
                jumpToSearchKey();
            }, 100)
        })
    })

    gitbook.events.on('page.change', function() {
        setTimeout(function() {
            bindSearch();
            closeSearch();
            // Launch search based on query parameter
            if (gitbook.search.isInitialized()) {
                launchSearchFromQueryString();
            }
        })
    });

    gitbook.events.on('search.ready', function() {
        setTimeout(function() {
            bindSearch();
            // Launch search from query param at start
            launchSearchFromQueryString();
        })
    });

    function getParameterByName(name) {
        var url = window.location.href;
        name = name.replace(/[\[\]]/g, '\\$&');
        var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)', 'i'),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }

    function updateQueryString(key, value) {
        value = encodeURIComponent(value);

        var url = window.location.href;
        var re = new RegExp('([?&])' + key + '=.*?(&|#|$)(.*)', 'gi'),
            hash;

        if (re.test(url)) {
            if (typeof value !== 'undefined' && value !== null)
                return url.replace(re, '$1' + key + '=' + value + '$2$3');
            else {
                hash = url.split('#');
                url = hash[0].replace(re, '$1$3').replace(/(&|\?)$/, '');
                if (typeof hash[1] !== 'undefined' && hash[1] !== null)
                    url += '#' + hash[1];
                return url;
            }
        }
        else {
            if (typeof value !== 'undefined' && value !== null) {
                var separator = url.indexOf('?') !== -1 ? '&' : '?';
                hash = url.split('#');
                url = hash[0] + separator + key + '=' + value;
                if (typeof hash[1] !== 'undefined' && hash[1] !== null)
                    url += '#' + hash[1];
                return url;
            }
            else
                return url;
        }
    }
});
