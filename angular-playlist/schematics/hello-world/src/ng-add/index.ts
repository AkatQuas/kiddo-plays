import {
  Rule,
  SchematicContext,
  SchematicsException,
  Tree,
} from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import * as ts from '@schematics/angular/third_party/github.com/Microsoft/TypeScript/lib/typescript';
import {
  addImportToModule,
  insertImport,
} from '@schematics/angular/utility/ast-utils';
import { InsertChange } from '@schematics/angular/utility/change';
import {
  addPackageJsonDependency,
  NodeDependency,
  NodeDependencyType,
} from '@schematics/angular/utility/dependencies';
import {
  buildDefaultPath,
  getWorkspace,
} from '@schematics/angular/utility/workspace';
import { readIntoSourceFile } from '../utils';
import { HelloNGAddSchematics } from './schema';

// You don't have to export the function as default. You can also have more than one rule factory
// per file.
export function ngAdd(options: HelloNGAddSchematics): Rule {
  return async (tree: Tree, context: SchematicContext) => {
    const workspace = await getWorkspace(tree);
    const project = workspace.projects.get(options.project);
    if (!project) {
      throw new SchematicsException(
        `Project "${options.project}" does not exist.`
      );
    }
    const projectPath = buildDefaultPath(project);

    // update module.ts
    const modulePath = `${projectPath}/app.module.ts`;
    const importPath = '@fortawesome/angular-fontawesome';
    const moduleName = 'FontAwesomeModule';
    const declarationChanges = addImportToModule(
      readIntoSourceFile(tree, modulePath),
      modulePath,
      moduleName,
      importPath
    );
    const declarationRecorder = tree.beginUpdate(modulePath);
    for (const change of declarationChanges) {
      if (change instanceof InsertChange) {
        declarationRecorder.insertLeft(change.pos, change.toAdd);
        // console.log('declaration', { change });
      }
    }
    tree.commitUpdate(declarationRecorder);
    // print updated file content
    // console.log(tree.read(modulePath)!.toString());

    // update app.component.ts
    const componentPath = `${projectPath}/app.component.ts`;
    const componentSourceFile = readIntoSourceFile(tree, componentPath);

    const importChanges = insertImport(
      componentSourceFile,
      componentPath,
      'faCoffee',
      '@fortawesome/free-solid-svg-icons'
    );
    if (importChanges instanceof InsertChange) {
      const componentRecorder = tree.beginUpdate(componentPath);
      componentRecorder.insertLeft(importChanges.pos, importChanges.toAdd);
      tree.commitUpdate(componentRecorder);
      // print import change
      // console.log({ importChanges });
    }

    const componentRecorder = tree.beginUpdate(componentPath);
    // find ClassDeclaration `class AppComponent`
    const classDeclaration = componentSourceFile.statements.find((node) =>
      ts.isClassDeclaration(node)
    )! as ts.ClassDeclaration;

    // find all properties in `AppComponent`
    const allProperties = classDeclaration.members.filter((node) =>
      ts.isPropertyDeclaration(node)
    )! as ts.PropertyDeclaration[];

    // find last property
    let lastProperty: ts.Node | undefined;
    for (const propertyNode of allProperties) {
      if (!lastProperty || propertyNode.getStart() > propertyNode.getStart()) {
        lastProperty = propertyNode;
      }
    }
    const faCoffeeProperty = 'faCoffee = faCoffee;';
    const changeText = lastProperty ? lastProperty.getFullText() : '';
    let toInsert = '';
    if (changeText.match(/^\r?\r?\n/)) {
      toInsert = `${changeText.match(/^\r?\n\s*/)![0]}${faCoffeeProperty}`;
    } else {
      toInsert = `\n  ${faCoffeeProperty}\n`;
    }

    // insert our property
    if (lastProperty) {
      componentRecorder.insertLeft(lastProperty!.end, toInsert);
    } else {
      componentRecorder.insertLeft(classDeclaration.end - 1, toInsert);
    }
    tree.commitUpdate(componentRecorder);

    // update app.component.html
    const htmlPath = `${projectPath}/app.component.html`;
    const htmlStr = `\n<fa-icon [icon]="faCoffee"></fa-icon>\n`;
    const htmlSourceFile = readIntoSourceFile(tree, htmlPath);
    const htmlRecorder = tree.beginUpdate(htmlPath);
    htmlRecorder.insertLeft(htmlSourceFile.end, htmlStr);
    tree.commitUpdate(htmlRecorder);
    const dependencies = [
      { name: '@fortawesome/fontawesome-svg-core', version: '~1.2.25' },
      { name: '@fortawesome/free-solid-svg-icons', version: '~5.11.2' },
      { name: '@fortawesome/angular-fontawesome', version: '~0.5.0' },
    ];
    context.addTask(
      new NodePackageInstallTask({
        packageName: '',
      })
    );

    dependencies.forEach(({ name, version }) => {
      const nodeDependency: NodeDependency = {
        type: NodeDependencyType.Default,
        name,
        version,
        overwrite: false,
      };
      addPackageJsonDependency(tree, nodeDependency);
    });
    context.addTask(new NodePackageInstallTask());

    // return nothing because we already make changes to the Tree
    return;
  };
}
