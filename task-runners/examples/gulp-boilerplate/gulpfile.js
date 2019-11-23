const gulp = require('gulp')
const less = require('gulp-less')
const autoprefixer = require('gulp-autoprefixer')
const imagemin = require('gulp-imagemin')
const rename = require('gulp-rename')
const cache = require('gulp-cache')
const del = require('del')
const changed = require('gulp-changed')
const fileinclude = require('gulp-file-include')
const browserSync = require('browser-sync').create();

const srcs = {
    images: 'src/images/**/*',
    scripts: 'src/scripts/**/*.js',
    less: 'src/less/**/*.less',
    views: 'src/views/**/*.html',
    viewsEn: 'src/views-en/**/*.html',
    locales: 'src/locales/**/*.json'
}

const dests = {
    images: 'run/static/images',
    scripts: 'run/static/js',
    less: 'run/static/css',
    views: 'run/'
}

gulp.task('less', function () {
    return gulp.src(srcs.less)
        .pipe(changed(dests.less))
        .pipe(less())
        .pipe(autoprefixer({
            browsers: [
                'Firefox >= 20',
                'Safari >= 6',
                'Explorer >= 9',
                'Chrome >= 12',
                'ChromeAndroid >= 4.0',
                'iOS >= 6',
                'not ie < 8'
            ]
        }))
        .pipe(gulp.dest(dests.less))
        .pipe(browserSync.stream())
})

gulp.task('scripts', function () {
    return gulp.src(srcs.scripts)
        .pipe(changed(dests.scripts))
        .pipe(gulp.dest(dests.scripts))
        .pipe(browserSync.stream())
})

gulp.task('images', function () {
    return gulp.src(srcs.images)
        .pipe(changed(dests.images))
        .pipe(cache(imagemin({ optimizationLevel: 7, progressive: true, interlaced: true })))
        .pipe(gulp.dest(dests.images))
        .pipe(browserSync.stream())
})

gulp.task('compile:cn', function () {
    return gulp.src(srcs.views)
        .pipe(changed(dests.views))
        .pipe(fileinclude({
            basepath: 'src/snippets',
            context: {
                webRoot: ''
            }
        }))
        .pipe(gulp.dest(dests.views))
        .pipe(browserSync.stream())
})

gulp.task('compile:en', function () {
    return gulp.src(srcs.viewsEn)
        .pipe(changed(dests.views))
        .pipe(fileinclude({
            basepath: 'src/snippets'
        }))
        .pipe(rename({ suffix: '-en' }))
        .pipe(gulp.dest(dests.views))
        .pipe(browserSync.stream())
})

gulp.task('clean', function () {
    cache.clearAll();
    del.sync(['run/*']);
})

gulp.task('dev', ['less', 'scripts', 'images', 'compile:cn', 'compile:en'])

gulp.task('serve', ['clean'], function () {
    browserSync.init({
        server: 'run'
    });
    gulp.watch('src/**/*', ['dev'])
    gulp.start('dev')
})

gulp.task('default', ['serve'])
