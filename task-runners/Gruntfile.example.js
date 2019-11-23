module.exports = grunt => {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        uglify: {
            opitons: {
                banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
            },
            build: {
                src: 'src/<%= pkg.name %>.js',
                dest: 'build/<%= pkg.name %>.min.js'
            }
        }
    })

    grunt.loadNpmTasks('grunt-contrib-uglify')
    grunt.registerTask('default', ['uglify'])
    grunt.registerTask('mylog', 'Log some stuff', function (a,b) {
        // Usage:
        // grunt mylog
        //   logs: "mylog", undefined, undefined
        // grunt mylog:bar
        //   logs: "mylog", "bar", undefined
        // grunt mylog:bar:baz
        //   logs: "mylog", "bar", "baz" 
        console.log(this.name, a, b)
        grunt.log.write('logging shit here... ').ok();
        grunt.log.write('logging shit here... ').error();
    });
    grunt.registerTask('asyncfoo', ' My AsyncFoo task', function () {
        console.log(this)
        const done = this.async();

        grunt.log.writeln('Processing task...')
        setTimeout(_ => {
            grunt.log.writeln('All done!')
            done();
        }, 1000)
    })
}