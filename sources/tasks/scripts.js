'use strict';

const gulp         = require('gulp');
const dir_sources = "./";
const dir_target = "../public/assets/";
const sourcemaps   = require('gulp-sourcemaps');
const livereload = require('gulp-livereload');
const concat       = require('gulp-concat');

// make:js
// Concaténation des scripts du projet (scripts/)
// ----------------------------------------------------------------------------

gulp.task('make:js', () => {
  // Définir l'ordre explicite des fichiers
  return gulp.src([
    dir_sources + 'js/formHandler.js',     // Chargé en premier
    dir_sources + 'js/projectHandler.js',   // Chargé ensuite
    dir_sources + 'js/learning.js',         // Puis learning
    dir_sources + 'js/audit.js',            // Et enfin audit.js
    dir_sources + 'js/*.js'                 // Tous les autres fichiers JS
  ])
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

