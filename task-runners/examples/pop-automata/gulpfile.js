const gulp = require('gulp');
const zip = require('gulp-zip');
const rename = require('gulp-rename');
const htmlmin = require('gulp-htmlmin');
const del = require('del');
const replace = require('gulp-replace');
// const shell = require('gulp-shell')
// const argv = require('minimist')(process.argv.slice(2))
const data = require('./gen/data')

gulp.task('html', ['image'], _ => {
    if (data.url) {
        return gulp.src('src/template.html')
            .pipe(rename('index.html'))
            .pipe(replace('{{acturl}}', data.url))
            .pipe(htmlmin({ minifyCSS: true, minifyJS: true, collapseWhitespace: true }))
            .pipe(gulp.dest('temp'))
    } else {
        throw Error('not enough params, please check the data.js')
    }
});

gulp.task('image', ['clean:temp', 'clean:dist'], _ =>
    gulp.src('gen/poper.png')
        .pipe(gulp.dest('temp'))
)

gulp.task('zip', ['html'], _ => {
    const x = new Date();

    const timestamp = '-' + x.toLocaleDateString().replace(/\//g, '-') + '-' + x.toLocaleTimeString().replace(/[:\s]/g, '-');
    const tmp = data.name.split('.')
    const name = tmp.length > 1 ? tmp.slice(0, -1).join('-') : tmp[0];
    const zipname = name + timestamp + '.zip'
    return gulp.src('temp/*')
        .pipe(zip(zipname))
        .pipe(gulp.dest('dist'))
});

gulp.task('clean:dist', _ => del(['dist']))

gulp.task('clean:temp', _ => del(['temp']))

gulp.task('default', ['zip'], _ => {
    gulp.start('clean:temp')
})