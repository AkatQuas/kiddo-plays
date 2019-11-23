const gulp = require('gulp')
const sass = require('gulp-ruby-sass')
const sourcemaps = require('gulp-sourcemaps')
const autoprefixer = require('gulp-autoprefixer')
const cssnano = require('gulp-cssnano')
const jshint = require('gulp-jshint')
const uglify = require('gulp-uglify')
const imagemin = require('gulp-imagemin')
const rename = require('gulp-rename')
const concat = require('gulp-concat')
const notify = require('gulp-notify')
const cache = require('gulp-cache')
const livereload = require('gulp-livereload')
const del = require('del')

/*
gulp-util is deprecated, see https://medium.com/gulpjs/gulp-util-ca3b1f9f9ac5
*/


/*
// auto load with a plugin
// https://github.com/jackfranklin/gulp-load-plugins

const plugins = require('gulp-load-plugins')();

=== equals ===

plugins.jshint = require('gulp-jshint');
plugins.concat = require('gulp-concat');

*/

gulp.task('styles', function () {
    return sass('src/styles/*.scss',{ style: 'expended', sourcemap: true })
        .pipe(autoprefixer('last 2 version'))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('dist-gulp/assets/css'))
        .pipe(rename({ suffix: '.min' }))
        .pipe(cssnano())
        .pipe(gulp.dest('dist-gulp/assets/css'))
        .pipe(notify({ message: 'Style task complete' }))
})

gulp.task('scripts', function () {
    return gulp.src('src/scripts/**/*.js')
        .pipe(jshint('.jshintrc'))
        .pipe(jshint.reporter('default'))
        .pipe(sourcemaps.init())
        .pipe(concat('main.js'))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('dist-gulp/assets/js'))
        .pipe(rename({ suffix: '.min' }))
        .pipe(uglify())
        .pipe(gulp.dest('dist-gulp/assets/js'))
        .pipe(notify({ message: 'Scripts task complete' }))
})

gulp.task('images', function () {
    return gulp.src('src/images/**/*')
        .pipe(cache(imagemin({ optimizationLevel: 3, progressive: true, interlaced: true })))
        .pipe(gulp.dest('dist-gulp/assets/img'))
        .pipe(notify({ message: 'Images task complete' }))
})

gulp.task('clean', function () {
    return del(['dist-gulp/assets/css', 'dist-gulp/assets/js', 'dist-gulp/assets/img'])
})

gulp.task('default', ['clean'], function () {
    gulp.start('styles', 'scripts', 'images');
})

gulp.task('watch', function () {
    gulp.watch('src/styles/**/*.scss', ['styles'])

    gulp.watch('src/scripts/**/*.js', ['scripts'])

    gulp.watch('src/images/**/*', ['images'])

    livereload.listen();

    gulp.watch(['dist-gulp/**']).on('change', livereload.changed)
})