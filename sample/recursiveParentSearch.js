

fsKit = require( '../lib/fs.js' ) ;

if ( process.argv[ 3 ] )
{
	console.log( 'Searching for: %s   from: %s' , process.argv[ 3 ] , process.argv[ 2 ] ) ;
	
	fsKit.recursiveParentSearch( process.argv[ 2 ] , process.argv[ 3 ] , function( error , path ) {
		if ( error ) { console.log( error ) ; return ; }
		console.log( 'Found:' , path ) ;
	} ) ;
}
else
{
	console.log( 'Searching for:' , process.argv[ 2 ] ) ;
	
	fsKit.recursiveParentSearch( process.argv[ 2 ] , function( error , path ) {
		if ( error ) { console.log( error ) ; return ; }
		console.log( 'Found:' , path ) ;
	} ) ;
}