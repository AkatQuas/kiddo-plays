const gulp = require('gulp')
const less = require('gulp-less')
const sourcemaps = require('gulp-sourcemaps')
const autoprefixer = require('gulp-autoprefixer')
const cssnano = require('gulp-cssnano')
const uglify = require('gulp-uglify')
const imagemin = require('gulp-imagemin')
const rename = require('gulp-rename')
const concat = require('gulp-concat')
const cache = require('gulp-cache')
const del = require('del')
const fileinclude = require('gulp-file-include')

const srcs = {
    images: 'src/images/**/*',
    scripts: 'src/scripts/**/*.js',
    less: 'src/less/**/*.less',
    views: 'src/views/**/*.html',
    viewsEn: 'src/views-en/**/*.html',
    locales: 'src/locales/**/*.json'
}

const dests = {
    images: 'dist/static/images',
    scripts: 'dist/static/js',
    less: 'dist/static/css',
    views: 'dist/'
}


gulp.task('less', function () {
    return gulp.src(srcs.less)
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
        .pipe(cssnano())
        .pipe(gulp.dest(dests.less))
})

gulp.task('scripts', function () {
    return gulp.src(srcs.scripts)
        .pipe(gulp.dest(dests.scripts))
        .pipe(rename({ suffix: '.min' }))
        .pipe(uglify())
        .pipe(gulp.dest(dests.scripts))
})

gulp.task('images', function () {
    return gulp.src(srcs.images)
        .pipe(cache(imagemin({ optimizationLevel: 7, progressive: true, interlaced: true })))
        .pipe(gulp.dest(dests.images))
})

gulp.task('compile:cn', function () {
    return gulp.src(srcs.views)
        .pipe(fileinclude({
            basepath: 'src/snippets',
            context: {
                webRoot: 'http://fe.com/h-p'
            }
        }))
        .pipe(gulp.dest(dests.views))
})

gulp.task('compile:en', function () {
    return gulp.src(srcs.viewsEn)
        .pipe(fileinclude({
            basepath: 'src/snippets',
            context: {
                webRoot: 'http://fe.com/h-p'
            }
        }))
        .pipe(rename({ suffix: '-en' }))
        .pipe(gulp.dest(dests.views))
})

gulp.task('clean', function () {
    cache.clearAll();
    del.sync(['dist']);
})

gulp.task('build', ['clean'], function () {
    gulp.start(['less', 'scripts', 'images', 'compile:cn', 'compile:en'])
})

gulp.task('default', ['build'])
