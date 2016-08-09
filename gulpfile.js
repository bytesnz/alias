var gulp = require('gulp');
var eslint = require('gulp-eslint');
var strip = require('gulp-strip-comments');
var uglify = require('gulp-uglify')
var insert = require('gulp-insert');
var browserify = require('gulp-browserify');
var rename = require('gulp-rename');
var lesshint = require('gulp-lesshint');
var less = require('gulp-less');

var fs = require('fs');


var paths = {
  jsSrc: ['src/*.js', 'src/lib/*.js'],
  clientJsSrc: 'src/web/js/*.js',
  clientLessSrc: 'src/web/css/*.less',
  licenceSrc: 'src/header.js',
  dist: './',
};

var licence = fs.readFileSync(paths.licenceSrc);


gulp.task('js:lint', function() {
  return gulp.src(paths.jsSrc, { base: paths.srcBase })
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('client:js', ['client:js:lint']);

gulp.task('client:js:lint', function() {
  return gulp.src(paths.clientJsSrc, { base: paths.srcBase })
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

/*gulp.task('js:compile', ['js:compile:auto', 'js:compile:main']);

gulp.task('js:compile:main', ['js:lint'], function() {
  return gulp.src(paths.mainSrc, { base: paths.srcBase })
    .pipe(gulp.dest(paths.dest))
    .pipe(uglify())
    .pipe(insert.prepend(licence))
    .pipe(rename({
      extname: '.min.js'
    }))
    .pipe(gulp.dest(paths.dest));
});

gulp.task('js:compile:auto', ['js:lint'], function() {
  return gulp.src(paths.autoSrc, { base: paths.srcBase })
    .pipe(browserify())
    .pipe(strip())
    .pipe(insert.prepend(licence))
    .pipe(gulp.dest(paths.dest))
    .pipe(uglify())
    .pipe(insert.prepend(licence))
    .pipe(rename({
      extname: '.min.js'
    }))
    .pipe(gulp.dest(paths.dest));
});*/

gulp.task('client:css', ['client:css:compile']);

gulp.task('client:css:lint', function() {
  return gulp.src(paths.clientLessSrc, { base: paths.srcBase })
    .pipe(lesshint())
    .pipe(lesshint.reporter());
});

gulp.task('client:css:compile', ['client:css:lint'], function() {
});

gulp.task('watch', function() {
  gulp.watch(paths.jsSrc, ['js:lint']);
  gulp.watch(paths.clientJsSrc, ['client:js']);
  gulp.watch(paths.clientLessSrc, ['client:css']);
});

gulp.task('default', ['js:lint', 'client:js', 'client:css', 'watch']);
