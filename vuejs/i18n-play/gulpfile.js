const gulp = require('gulp');

const shell = require('gulp-shell')

gulp.task('g', shell.task('npm run build:locales'))

gulp.task('watch', function () {
    gulp.watch('locales/**/*.json', ['g'])

})