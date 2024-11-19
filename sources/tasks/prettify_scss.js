//
// clean scss
// ----------------------------------------------------------------------------

'use strict';

const gulp        = require('gulp');
const prettify      = require('gulp-jsbeautifier');
const dir_sources = "./";
const dir_target = "../public/assets/";

var optionsPrettify = {
	"indent_size": 2,
	"indent_with_tabs": true, 
	"indent_level": 0,
	"preserve_newlines": false,
	"wrap_line_length": 0,
	"indent_empty_lines": false,
	"end_with_newline": true
}


// live
// reformate le code scss proprement
// ----------------------------------------------------------------------------
gulp.task('clean:scss', () => {

	return gulp.src([dir_sources+"scss/**/*.scss",dir_sources+"scss/*.scss"])
	.pipe(prettify(optionsPrettify))
	.pipe(gulp.dest(dir_sources+"scss/"))
	.on("end",function(){ 
    	console.log("SCSS files cleaned 🎨");
  	});
  });