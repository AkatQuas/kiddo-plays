import { strings } from '@angular-devkit/core';
import {
  apply,
  mergeWith,
  move,
  Rule,
  SchematicContext,
  SchematicsException,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';
import * as ts from '@schematics/angular/third_party/github.com/Microsoft/TypeScript/lib/typescript';
import { addDeclarationToModule } from '@schematics/angular/utility/ast-utils';
import { InsertChange } from '@schematics/angular/utility/change';
import {
  buildRelativePath,
  findModuleFromOptions,
  ModuleOptions,
} from '@schematics/angular/utility/find-module';
import { parseName } from '@schematics/angular/utility/parse-name';
import { validateHtmlSelector } from '@schematics/angular/utility/validation';
import {
  buildDefaultPath,
  createDefaultPath,
  getWorkspace,
} from '@schematics/angular/utility/workspace';
import { readIntoSourceFile } from '../utils';
import { HelloNGSchematics } from './schema';

export function helloWorldNG(options: HelloNGSchematics): Rule {
  return async (tree: Tree, _context: SchematicContext) => {
    const workspace = await getWorkspace(tree);
    const project = workspace.projects.get(options.project);
    if (!project) {
      throw new SchematicsException(
        `Project "${options.project}" does not exist.`
      );
    }
    const projectPath = buildDefaultPath(project);

    const parsedPath = parseName(projectPath, options.name);
    // override `name` in `options`
    options.name = parsedPath.name;

    validateHtmlSelector(`hello-${strings.dasherize(parsedPath.name)}`);

    const moduleOptions: ModuleOptions = {
      name: parsedPath.name,
      path: parsedPath.path,
    };
    // find most related module.ts
    const modulePath = findModuleFromOptions(tree, moduleOptions) ?? '';

    const componentPath = `${parsedPath.path}/hello-${strings.dasherize(
      parsedPath.name
    )}.component`;
    const classifiedName = `Hello${strings.classify(parsedPath.name)}Component`;

    // build import path
    const relativePath = buildRelativePath(modulePath, componentPath);

    // create changes
    const declarationChanges = addDeclarationToModule(
      readIntoSourceFile(tree, modulePath),
      modulePath,
      classifiedName,
      relativePath
    );

    // apply update
    const declarationRecorder = tree.beginUpdate(modulePath);
    for (const change of declarationChanges) {
      if (change instanceof InsertChange) {
        declarationRecorder.insertLeft(change.pos, change.toAdd);
        // print change
        // console.log({ change });
      }
    }
    tree.commitUpdate(declarationRecorder);

    // update virtual files tree
    const sourceParametrizedTemplates = apply(url('./files'), [
      template({
        ...options,
        // strings deal with template interpolation syntax
        ...strings,
      }),
      move(parsedPath.path), // move created file to correct folder
    ]);

    return mergeWith(sourceParametrizedTemplates);
  };
}

/**
 * Parse AST and insert text manually, the hard way
 */
export function helloWorldNG2(options: HelloNGSchematics): Rule {
  return async (tree: Tree, _context: SchematicContext) => {
    // read angular.json
    const workspaceConfigBuffer = tree.read('angular.json');
    if (!workspaceConfigBuffer) {
      throw new SchematicsException('Must run in an Angular CLI workspace.');
    }

    const workspaceConfig = JSON.parse(workspaceConfigBuffer.toString());
    const projectName = options.project || workspaceConfig.defaultProject;
    const projectPath = await createDefaultPath(tree, projectName);
    const parsedPath = parseName(projectPath, options.name);
    // override `name` in `options`
    options.name = parsedPath.name;

    let importPath = '';
    if (parsedPath.path === projectPath) {
      importPath = './';
    } else {
      importPath = parsedPath.path.replace(projectPath, '.') + '/';
    }
    importPath += `hello-${strings.dasherize(parsedPath.name)}.component`;

    const appModulePath = `.${projectPath}/app.module.ts`;
    const appText = tree.read(appModulePath) || [];

    const sourceFile = ts.createSourceFile(
      'test.ts',
      appText.toString(),
      ts.ScriptTarget.Latest,
      true
    );

    // https://ts-ast-viewer.com/#code/JYWwDg9gTgLgBAbzgOQOYFkIBMCuAbAUzgF84AzKCEOAcgAEBDAO1XwagHoBjaAmgbgBQoSLERwAQpQDuAZwJRMuQiXKVq9ZqzzsOYHTDLQQAWgBGM+VAGDh4aPCQBBMGADCVSEwJN4pClS0AHQcDK5BPPbevjaCdGhK+AQAFAiCcHBYBFw6UAwwwBBMsgBccADa6RlwLu6eRT4wVQC6ADRVIg6lFVUZUhByComELe0ZYJQAbsBZUN3lbVVmEBAwsjB5YGXltR5Rjc2CxACUggQAHqLwOQyysjWuw0RIxEA
    const classDeclaration = sourceFile.statements.find((node) =>
      ts.isClassDeclaration(node)
    )! as ts.ClassDeclaration;
    const decorator = classDeclaration.decorators![0] as ts.Decorator;
    const callExpression = decorator.expression as ts.CallExpression;
    const objectLiteralExpression = callExpression
      .arguments[0] as ts.ObjectLiteralExpression;
    const propertyAssignment = objectLiteralExpression.properties.find(
      (property: ts.PropertyAssignment) => {
        return (property.name as ts.Identifier).text === 'declarations';
      }
    )! as ts.PropertyAssignment;
    const arrayLiteralExpression =
      propertyAssignment.initializer as ts.ArrayLiteralExpression;
    const identifier = arrayLiteralExpression.elements[0] as ts.Identifier;

    const declarationRecorder = tree.beginUpdate(appModulePath);
    const changeText = identifier.getFullText();
    const classifyName = strings.classify(parsedPath.name);
    const componentName = `Hello${classifyName}Component`;
    let toInsert = '';
    if (changeText.match(/^\r?\r?\n/)) {
      toInsert = `,${changeText.match(/^\r?\n\s*/)![0]}${componentName}`;
    } else {
      toInsert = `, ${componentName}`;
    }

    declarationRecorder.insertLeft(identifier.end, toInsert);

    const allImports = sourceFile.statements.filter((node) =>
      ts.isImportDeclaration(node)
    )! as ts.ImportDeclaration[];
    let lastImport: ts.Node | undefined;
    for (const importNode of allImports) {
      if (!lastImport) {
        lastImport = importNode;
        continue;
      }
      if (importNode.getStart() > lastImport.getStart()) {
        lastImport = importNode;
      }
    }

    const importInsert = `\nimport { ${componentName} } from '${importPath}';`;
    declarationRecorder.insertLeft(lastImport!.end, importInsert);

    tree.commitUpdate(declarationRecorder);
    // print updated file content
    // console.log(tree.read(appModulePath)!.toString());

    const sourceParametrizedTemplates = apply(url('./files'), [
      template({
        ...options,
        // strings deal with template interpolation syntax
        ...strings,
      }),
      move(parsedPath.path), // move created file to correct folder
    ]);

    return mergeWith(sourceParametrizedTemplates);
  };
}
