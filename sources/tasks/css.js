//
// CSS
// ----------------------------------------------------------------------------

'use strict';

const gulp         = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const sourcemaps   = require('gulp-sourcemaps');
const concat       = require('gulp-concat');
const livereload = require('gulp-livereload');

const dir_sources = "./";
const dir_target = "../public/assets/";



// make:css
// Compile les css
// ----------------------------------------------------------------------------

gulp.task('make:css',  () => {
  return gulp.src(dir_sources + 'sass/main.scss')
  .pipe(sourcemaps.init({loadMaps: true}))
  .pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
  .pipe(concat('all.css'))
  .pipe(sourcemaps.write('.'))
  .pipe(gulp.dest(dir_target + 'css/'))
  .pipe(livereload())
  .on("end",function(){ 
    console.log("Make css ✨");
  });
});
