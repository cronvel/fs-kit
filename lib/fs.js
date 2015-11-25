/*
	The Cedric's Swiss Knife (CSK) - CSK Filesystem toolbox

	Copyright (c) 2015 Cédric Ronvel 
	
	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/



// Load modules
var fs = require( 'fs' ) ;
var path = require( 'path' ) ;

var mkdirp = require( './mkdirp.js' ) ;
var rimraf = require( 'rimraf' ) ;



var fsKit = {} ;
module.exports = fsKit ;



fsKit.ensurePath = mkdirp ;
fsKit.ensurePathSync = mkdirp.sync ;

fsKit.deltree = rimraf ;
fsKit.deltreeSync = rimraf.sync ;



fsKit.recursiveParentSearch = function recursiveParentSearch( leftPart , rightPart , callback )
{
	if ( arguments.length < 3 )
	{
		callback = rightPart ;
		rightPart = path.basename( leftPart ) ;
		leftPart = path.dirname( leftPart ) ;
	}
	
	if ( ! path.isAbsolute( leftPart ) ) { leftPart = process.cwd() + '/' + leftPart ; }
	leftPart = path.normalize( leftPart ) ;
	rightPart = path.normalize( rightPart ) ;
	
	fs.realpath( leftPart , function( error , leftPart_ ) {
		if ( error ) { callback( error ) ; return ; }
		leftPart = leftPart ;
		recursiveParentSearch_( leftPart , rightPart , callback )
	} ) ;
} ;

function recursiveParentSearch_( leftPart , rightPart , callback )
{
	var searchPath = path.normalize( leftPart + '/' + rightPart ) ;
	
	fs.exists( searchPath , function( exists ) {
		if ( exists ) { callback( undefined , searchPath ) ; return ; }
		var nextLeftPart = path.dirname( leftPart ) ;
		if ( nextLeftPart === leftPart ) { callback( new Error( 'recursiveParentSearch(): file not found' ) ) ; return ; }
		recursiveParentSearch_( nextLeftPart , rightPart , callback )
	} ) ;
}
