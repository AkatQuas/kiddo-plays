"use strict";
const chalk = require("chalk");
const extend = require("deep-extend");
const mkdirp = require("mkdirp");
const path = require("path");
const Generator = require("yeoman-generator");
const yosay = require("yosay");

module.exports = class extends Generator {
  constructor(args, opts) {
    super(args, opts);
    this.props = {};

    // This makes `name` an optional argument.
    this.argument("name", { type: String, description: "Package Name" });
    this.props.name = this.options.name;

    // This method adds support for a `--install` flag
    this.option("skipInstall", {
      type: Boolean,
      description: "Skip installing dependencies after generation done.",
      default: true,
    });
  }

  // Step 1
  initializing() {
    this.log(yosay(`--- ${chalk.default.yellow("initializing")} --- `));
  }

  // Step 2
  prompting() {
    this.log(yosay(`--- ${chalk.default.yellow("prompting")} --- `));
    this.log(
      yosay(
        `Welcome to the striking ${chalk.red(
          "generator-npm-ts-package"
        )} generator!`
      )
    );

    const prompts = [
      {
        name: "name",
        message: "What the name of the new package?",
        when: this.props.name === undefined,
      },
      {
        name: "description",
        message: "Description",
      },
      {
        name: "authorName",
        message: "Author's Name",
        default: this.user.git.name(),
        store: true,
      },
      {
        name: "authorEmail",
        message: "Author's Email",
        default: this.user.git.email(),
        store: true,
      },
      {
        name: "authorUrl",
        message: "Author's Homepage",
        store: true,
      },
      {
        name: "keywords",
        message: "Package keywords (comma to split)",
        filter(words) {
          return words.split(/\s*,\s*/g);
        },
      },
    ];

    return this.prompt(prompts).then((props) => {
      Object.assign(this.props, props);
      Object.assign(this.props, parseScopedName(this.props.name));
    });
  }

  // Step 3
  configuring() {
    this.log(yosay(`--- ${chalk.default.yellow("configuring")} --- `));
  }

  hey3() {
    this.log(yosay(`--- ${chalk.default.blue("hey3")} --- `));
  }

  // Step 4
  default() {
    this.log(yosay(`--- ${chalk.default.yellow("default")} --- `));
    if (path.basename(this.destinationPath()) !== this.props.localName) {
      this.log(
        `Your package is not inside a folder named ${this.props.localName}\nI'll automatically create this folder.`
      );
      mkdirp.sync(this.props.localName);
      this.destinationRoot(this.destinationPath(this.props.localName));
    }
  }

  hey1() {
    this.log(yosay(`--- ${chalk.default.blue("hey1")} --- `));
  }

  hey2() {
    this.log(yosay(`--- ${chalk.default.blue("hey2")} --- `));
  }

  // Step 5
  writing() {
    this.log(yosay(`--- ${chalk.default.yellow("writing")} --- `));
    this.fs.copy(
      [
        ".github",
        "src",
        "test",
        ".gitignore",
        ".mocharc.json",
        "tsconfig*json",
      ].map((a) => this.templatePath(a)),
      this.destinationPath()
    );
    this.fs.copyTpl(
      this.templatePath("README.md"),
      this.destinationPath("README.md"),
      {
        name: this.props.name,
        description: this.props.description,
      }
    );

    const pkg = this.fs.readJSON(this.templatePath("dot_package.json"));

    extend(pkg, {
      name: this.props.name,
      description: this.props.description,
      keywords: this.props.keywords.concat("npm-ts-package"),
      author: {
        name: this.props.authorName,
        email: this.props.authorEmail,
        url: this.props.authorUrl,
      },
    });
    this.fs.writeJSON(this.destinationPath("package.json"), pkg);
  }

  // Step 6
  conflicts() {
    this.log(yosay(`--- ${chalk.default.yellow("conflicts")} --- `));
  }

  // Step 7
  install() {
    this.log(yosay(`--- ${chalk.default.yellow("install")} --- `));
  }

  // Step 8
  end() {
    this.log(yosay(`--- ${chalk.default.yellow("end")} --- `));
    if (this.options.skipInstall) {
      this.log(
        yosay(
          `Install dependencies with your favorite package manager. ${chalk.default.green(
            "Let' do it!"
          )}`
        )
      );
    } else {
      this.spawnCommandSync(["pnpm"], ["install"]);
    }
  }
};

/* --- inner --- */
/**
 *
 * @param {string} name
 * @returns {{scopeName: string, localName: string}}
 */
function parseScopedName(name) {
  const nameFragments = name.split("/");
  const parsed = {
    scopeName: "",
    localName: name,
  };

  if (nameFragments.length > 1) {
    parsed.scopeName = nameFragments[0];
    parsed.localName = nameFragments[1];
  }

  return parsed;
}
