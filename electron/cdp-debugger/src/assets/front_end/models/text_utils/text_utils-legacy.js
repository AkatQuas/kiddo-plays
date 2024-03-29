import * as TextUtilsModule from "./text_utils.js";
self.TextUtils = self.TextUtils || {};
TextUtils = TextUtils || {};
TextUtils.ContentProvider = TextUtilsModule.ContentProvider.ContentProvider;
TextUtils.ContentProvider.SearchMatch = TextUtilsModule.ContentProvider.SearchMatch;
TextUtils.ContentProvider.contentAsDataURL = TextUtilsModule.ContentProvider.contentAsDataURL;
TextUtils.StaticContentProvider = TextUtilsModule.StaticContentProvider.StaticContentProvider;
TextUtils.Text = TextUtilsModule.Text.Text;
TextUtils.TextCursor = TextUtilsModule.TextCursor.TextCursor;
TextUtils.TextRange = TextUtilsModule.TextRange.TextRange;
TextUtils.SourceRange = TextUtilsModule.TextRange.SourceRange;
TextUtils.TextUtils = TextUtilsModule.TextUtils.Utils;
TextUtils.FilterParser = TextUtilsModule.TextUtils.FilterParser;
TextUtils.BalancedJSONTokenizer = TextUtilsModule.TextUtils.BalancedJSONTokenizer;
TextUtils.TokenizerFactory = TextUtilsModule.TextUtils.TokenizerFactory;
TextUtils.isMinified = TextUtilsModule.TextUtils.isMinified;
//# sourceMappingURL=text_utils-legacy.js.map
