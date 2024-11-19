'use strict';

const gulp        = require('gulp');
const livereload = require('gulp-livereload');
const dir_sources = "./";
const dir_target = "../public/";




gulp.task('dev',gulp.series([],function() {
	livereload.listen();
  	gulp.watch( dir_sources+"sass/**/*.scss", gulp.series('make:css'));
  	//gulp.watch( dir_sources+"img/", gulp.series('copy:img')).on('change', browserSync.reload);
  	gulp.watch( dir_sources+"js/**/*.js", gulp.series('make:js'));

}));
