module.exports = function (grunt) {
    grunt.initConfig({
        sass: {
            dist: {
                options: { style: 'expanded' },
                files: {
                    'dist-grunt/styles/main.css': 'src/styles/main.scss'
                }
            },
        },

        autoprefixer: {
            options: {
                browsers: [
                    'last 2 version'
                ]
            },
            dist: {
                src: 'dist-grunt/styles/main.css'
            }
        },

        cssmin: {
            dist: {
                files: {
                    'dist-grunt/styles/main.min.css': 'dist-grunt/styles/main.css'
                }
            }
        },

        jshint: {
            files: ['src/script/**/*.js'],
            options: {
                jshintrc: '.jshintrc'
            }
        },

        concat: {
            js: {
                src: ['src/scripts/**/*.js'],
                dest: 'dist-grunt/scripts/main.js'
            },
        },

        uglify: {
            dist: {
                src: 'dist-grunt/scripts/main.js',
                dest: 'dist-grunt/scripts/main.min.js'
            }
        },

        imagemin: {
            dist: {
                option: {
                    optimizationLevel: 3,
                    progressive: true,
                    interlaced: true
                },
                files: [{
                    expand: true,
                    cwd: 'src/images',
                    src: ['**/*.{png,jpg,gif}'],
                    dest: 'dist-grunt/images'
                }]
            }
        },

        clean: {
            build: ['dist-grunt/styles', 'dist-grunt/scripts', 'dist-grunt/images']
        },

        notify: {
            styles: {
                options: {
                    message: 'Style task complete',
                }
            },
            scripts: {
                options: {
                    message: 'Scripts task complete',
                }
            },
            images: {
                options: {
                    message: 'Images task complete'
                }
            }
        },

        watch: {
            styles: {
                files: 'src/style/**/*.scss',
                tasks: ['sass', 'autoprefixer', 'cssmin', 'notify:styles'],
            },
            scripts: {
                files: 'src/scripts/**/*.js',
                tasks: ['concat', 'uglify', 'notify:scripts']
            },
            images: {
                files: 'src/images/**/*',
                tasks: ['imagemin', 'notify:images']
            },
            livereload: {
                options: { livereload: true },
                files: [
                    'dist-grunt/styles/**/*.css',
                    'dist-grunt/scripts/**/*.js',
                    'dist-grunt/images/**/*'
                ]
            }
        }
    });
    grunt.registerTask('default', [
        'jshint',
        'clean',
        'concat',
        'uglify',
        'sass',
        'autoprefixer',
        'cssmin',
        'imagemin'
    ]);

    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-autoprefixer');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-imagemin');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-notify');
}