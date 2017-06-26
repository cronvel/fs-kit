/*
	File System Kit
	
	Copyright (c) 2015 - 2017 Cédric Ronvel
	
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
var touch = require( 'touch' ) ;
var ncp = require( 'ncp' ) ;



var fsKit = {} ;
module.exports = fsKit ;



/*
	ensurePath( directoryPath , [mode] , callback )
	ensurePath( directoryPath , [options] , callback )
	
	Ensure a path exist, using mkdirp to create it.
	Arguments:
		* directoryPath
		* mode `number` octal permission, e.g. 0777, t defaults to 0777 & (~process.umask())
		* options `Object` options, where:
			* mode `number` octal permission, e.g. 0777, it defaults to 0777 & (~process.umask())
			* fs `Object` an alternate fs module
		* callback( error )
*/
fsKit.ensurePath = mkdirp ;

/*
	ensurePathSync( directoryPath , [mode] )
	ensurePathSync( directoryPath , [options] )
	
	Ensure a path exist synchronously, using mkdirp to create it.
	Arguments:
		* directoryPath
		* mode `number` octal permission, e.g. 0777, t defaults to 0777 & (~process.umask())
		* options `Object` options, where:
			* mode `number` octal permission, e.g. 0777, it defaults to 0777 & (~process.umask())
			* fs `Object` an alternate fs module
*/
fsKit.ensurePathSync = mkdirp.sync ;



/*
	deltree( globalFile , [options] , callback )
	
	Options:
		unlink, chmod, stat, lstat, rmdir, readdir, unlinkSync, chmodSync, statSync, lstatSync, rmdirSync, readdirSync:
			In order to use a custom file system library, you can override specific fs functions on the options object.
			If any of these functions are present on the options object, then the supplied function will be used instead
			of the default fs method.
		maxBusyTries: If an EBUSY, ENOTEMPTY, or EPERM error code is encountered on Windows systems, then rimraf will
			retry with a linear backoff wait of 100ms longer on each try. The default maxBusyTries is 3.
		emfileWait: If an EMFILE error is encountered, then rimraf will retry repeatedly with a linear backoff of 1ms longer
			on each try, until the timeout counter hits this max. The default limit is 1000.
			If you repeatedly encounter EMFILE errors, then consider using graceful-fs in your program.
		glob: Set to false to disable glob pattern matching. Set to an object to pass options to the glob module.
			The default glob options are { nosort: true, silent: true }. Glob version 6 is used in this module.
		disableGlob: Set to any non-falsey value to disable globbing entirely. (Equivalent to setting glob: false.)
	
	Delete a file or many files (using glob wildcard)
*/
fsKit.deltree = rimraf ;

/*
	deltreeSync( globalFile , [options] )
	
	Delete a file or many files (using glob wildcard)
	
	Same options than fsKit.deltree().
*/
fsKit.deltreeSync = rimraf.sync ;



/*
	touch( filename , [options] , callback )
	
	Like the unix command 'touch'.
	
	Options:
		force: like touch -f Boolean
		time: like touch -t <date> Can be a Date object, or any parseable Date string, or epoch ms number.
		atime: like touch -a Can be either a Boolean, or a Date.
		mtime: like touch -m Can be either a Boolean, or a Date.
		ref: like touch -r <file> Must be path to a file.
		nocreate: like touch -c Boolean
*/
fsKit.touch = touch ;

/*
	touchSync( filename , [options] )
	
	Like the unix command 'touch', synchronously.
	
	Same options than fsKit.touch().
*/
fsKit.touchSync = touch.sync ;



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
		leftPart = leftPart_ ;
		recursiveParentSearch_( leftPart , rightPart , callback ) ;
	} ) ;
} ;



function recursiveParentSearch_( leftPart , rightPart , callback )
{
	var searchPath = path.normalize( leftPart + '/' + rightPart ) ;
	
	fs.exists( searchPath , function( exists ) {
		if ( exists ) { callback( undefined , searchPath ) ; return ; }
		var nextLeftPart = path.dirname( leftPart ) ;
		if ( nextLeftPart === leftPart ) { callback( new Error( 'recursiveParentSearch(): file not found' ) ) ; return ; }
		recursiveParentSearch_( nextLeftPart , rightPart , callback ) ;
	} ) ;
}



/*
	Like fs.readdir(), but with more options.
	Eventually perform few fs.stat().
	Options:
		slash: `boolean` add an extra slash character to directories
		files: `undefined` or `boolean` filter out files/non-file
		directories: `undefined` or `boolean` filter out directories/non-directories
		exe: `undefined` or `boolean` filter out exe/non-exe, if the target is a file
*/
fsKit.readdir = function readdir( dirPath , options , callback )
{
	if ( arguments.length < 3 )
	{
		callback = options ;
		options = null ;
	}
	
	options = options || {} ;
	
	var fsStatNeeded = options.slash ||
		options.directories !== undefined || options.files !== undefined ||
		options.exe !== undefined ;
	
	fs.readdir( dirPath , options , ( error , files ) => {
		if ( error || ! fsStatNeeded || ! files || ! files.length ) { callback( error , files ) ; return ; }
		
		var remaining = files.length ;
		var outFiles = [] ;
		var triggered = false ;
		
		var triggerCallback = error => {
			if ( triggered ) { return ; }
			triggered = true ;
			
			if ( error ) { callback( error ) ; return ; }
			
			callback( undefined , outFiles ) ;
		} ;
		
		files.forEach( file => {
			
			fs.stat( path.join( dirPath , file ) , ( error , stats ) => {
				remaining -- ;
				
				if ( error )
				{
					// Dead links produce fs.stat() error, so ignore error for now
					//triggerCallback( error ) ;
					if ( remaining <= 0 ) { triggerCallback() ; }
					return ;
				}
				
				readdirFiltering( outFiles , file , stats , options ) ;
				
				if ( remaining <= 0 ) { triggerCallback() ; }
			} );
		} ) ;
	} ) ;
} ;



/*
	Sync variant.
*/
fsKit.readdirSync = function readdirSync( dirPath , options )
{
	options = options || {} ;
	
	var fsStatNeeded = options.slash ||
		options.directories !== undefined || options.files !== undefined ||
		options.exe !== undefined ;
	
	var files = fs.readdirSync( dirPath , options ) ;
	
	if ( ! fsStatNeeded ) { return files ; }
	
	var outFiles = [] ;
	
	files.forEach( file => {
		
		var stats ;
		
		try {
			stats = fs.statSync( path.join( dirPath , file ) ) ;
		}
		catch ( error ) {
			// Dead links produce fs.stat() error, so ignore error for now
			return ;
		}
		
		readdirFiltering( outFiles , file , stats , options ) ;
	} ) ;
	
	return outFiles ;
} ;



function readdirFiltering( outFiles , file , stats , options )
{
	if ( stats.isDirectory() )
	{
		if ( options.directories === false ) { return ; }
		outFiles.push( options.slash ? file + '/' : file ) ;
	}
	else if ( stats.isFile() )
	{
		if ( options.files === false ) { return ; }
		if ( options.exe !== undefined && options.exe !== fsKit.statsHasExe( stats ) ) { return ; }
		outFiles.push( file ) ;
	}
}



// See also github: kevva/executable (by Kevin Mårtensson)
fsKit.statsHasExe = function statsHasExe( stats )
{
	if ( process.platform === 'win32' ) { return true ; }
	
	var groupMatch = stats.gid ? process.getgid && stats.gid === process.getgid() : true ;
	var userMatch = stats.uid ? process.getuid && stats.uid === process.getuid() : true ;
	
	return !! ( ( stats.mode & 0o001 ) || ( groupMatch && ( stats.mode & 0o010 ) ) || ( userMatch && ( stats.mode & 0o100 ) ) ) ;
} ;



// Copy a file
fsKit.copy = function copy( source , target , callback )
{
	var triggered = false ;
	
	var finish = error => {
		if ( triggered ) { return ; }
		triggered = true ;
		callback( error ) ;
	} ;
	
	// Create read and write stream
	var readStream = fs.createReadStream( source ) ;
	var writeStream = fs.createWriteStream( target ) ;
	
	// Manage events
	readStream.on( 'error' , finish ) ;
	writeStream.on( 'error' , finish ) ;
	writeStream.on( 'close', () => finish() ) ;
	
	// Copy!
	readStream.pipe( writeStream ) ;
} ;





/*
	copyDir( source , target , [options] , callback )
	
	*source
	* target
	* options, where:
		* filter: RegExp instance, against which each file name is tested to determine whether to copy it or not,
		  or a function taking single parameter: copied file name, returning true or false, determining whether
		  to copy file or not.
		* transform: function: function (read, write) { read.pipe(write) } used to apply streaming transforms while copying.
		* clobber: boolean (default: true), if set to false, ncp will not overwrite destination files that already exist.
		* dereference: boolean (default: false), if set to true, ncp will follow symbolic links. For example,
		  a symlink in the source tree pointing to a regular file will become a regular file in the destination tree.
		  Broken symlinks will result in errors.
		* stopOnErr: boolean (default: false). If set to true, ncp will behave like cp -r, and stop on the first error
		  it encounters. By default, ncp continues copying, logging all errors and returning an array.
		* errs: stream. If options.stopOnErr is false, a stream can be provided, and errors will be written to this stream.
	* callback( error )
*/
fsKit.copyDir = ncp ;


