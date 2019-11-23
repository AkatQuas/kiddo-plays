# Differences between Grunt and Gulp

- **The way you configure your tasks.** Grunt is configuration-based. Gulp is stream-based.
- **The way they run your tasks.** Grunt runs the processes you want to execute in a sequential manner. Gulp tries to run them with maximum concurrency, meaning it will try to execute processes in parallel if possible.

Using stream, Gulp saves a lot time on disk I/O.

> Looking at the workflows: 
>
> Gulp
> <div style="text-align:center">
>   <image src="./docs/images/gulp-workflow.png">
> </div>
> 
> Grunt
> <div style="text-align:center">
>   <image src="./docs/images/grunt-workflow.png">
> </div>


# In the End

**So, Grunt or Gulp?**

Honestly, it depends on the situation and it’s up to you.

One isn’t better than the other. They’re the same type of tool that can do the same job. So it will come down to personal preferences.

However, Grunt config format is a mess. As for me, I choose Gulp!

# References

- [official - Grunt](https://gruntjs.com/getting-started)

- [official - Gulp@3.9.1](https://github.com/gulpjs/gulp/blob/v3.9.1/docs/README.md)
- [official - Gulp Plugins](https://gulpjs.com/plugins/)

- [Gulp - a good getting-started guide](https://markgoodyear.com/2014/01/getting-started-with-gulp/)

- [Gulp Cheatsheet](https://github.com/osscafe/gulp-cheatsheet)

<div style="text-align:center">
<image src="./docs/images/gulp-cheatsheet.png">
</div>

- [Gulp vs Grunt. Why one? Why the Other?](https://medium.com/@preslavrachev/gulp-vs-grunt-why-one-why-the-other-f5d3b398edc4) @Medium.com on Jan 7, 2015.

- [Grunt vs Gulp - Beyond the Numbers](https://jaysoo.ca/2014/01/27/gruntjs-vs-gulpjs/) on Jan 27, 2014.


- [Grunt vs Gulp: Which Web Developer Automation Tool Should You Use?](https://www.webpagefx.com/blog/web-design/grunt-vs-gulp/)

- [Introduction to Node.js Stream](https://github.com/substack/stream-handbook)

- [Automate Your Tasks Easily with Gulp.js](https://scotch.io/tutorials/automate-your-tasks-easily-with-gulp-js)

- [Gulp - recipes](https://github.com/gulpjs/gulp/tree/v3.9.1/docs/recipes)

# TODOS

What I learned is just build the code based on src directory, however, Gulp can do more, linting, uploading, continuous integration, etc.
