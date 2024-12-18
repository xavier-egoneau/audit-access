//
// html
// ----------------------------------------------------------------------------

'use strict';

const gulp          = require('gulp');

const twig          = require('gulp-twig');
const prettify      = require('gulp-jsbeautifier');
const notify        = require("gulp-notify");


const markdown = require('gulp-markdown');

gulp.task('markdown-to-html', () => {
  return gulp.src('./path/to/markdown/files/*.md')
    .pipe(markdown())
    .pipe(gulp.dest('./path/to/output/html'));
});


const dir_sources = "./criteres/";
const dir_target = "../public/criteres/";

// make:html
// Compile twig vers html
// ----------------------------------------------------------------------------
var optionsPrettify = {
	"indent_size": 2,
	"indent_with_tabs": true, 
	"indent_level": 0,
	"preserve_newlines": false,
	"wrap_line_length": 0,
	"indent_empty_lines": false,
	"end_with_newline": true
};

gulp.task('make:html', () => {
  return gulp.src(config.paths.pages+"*.twig" )
    .pipe(twig({
      base: config.paths.templates,
      data: {config},
      cache:false,
			debug:true
    }))
    .pipe(prettify(optionsPrettify))
    .pipe(gulp.dest(config.paths.build))
    .pipe(notify("build & prettify html. 🎉"));
});


// make:html-prettify
// Normalise l'indentation du html
// ----------------------------------------------------------------------------

//gulp.task('make:html-prettify', () => {
//  return gulp.src(config.paths.build + '**/*.html')
//    .pipe(prettify(optionsPrettify))
//    .pipe(gulp.dest(config.paths.build));
//});
