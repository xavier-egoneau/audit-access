//
// Scripts
// ----------------------------------------------------------------------------

'use strict';

const gulp         = require('gulp');
const dir_sources = "./";
const dir_target = "../public/assets/";
const sourcemaps   = require('gulp-sourcemaps');
const livereload = require('gulp-livereload');
const concat       = require('gulp-concat');
//const console.log        = require("gulp-console.log");

// make:js
// Concaténation des scripts du projet (scripts/)
// ----------------------------------------------------------------------------

gulp.task('make:js', () => {
  return gulp.src([dir_sources + 'js/*.js'])
    
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(concat('all.js'))
    //.pipe(minify())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(dir_target + 'js/'))
    .pipe(livereload())
    .on('end', () => { 
      console.log("build script. 🎉")
    });
});


