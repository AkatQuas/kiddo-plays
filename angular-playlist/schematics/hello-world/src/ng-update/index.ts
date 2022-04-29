/**
 * `ng-update` lives with `migration.json`, not `collection.json`
 *
 * it's different from those generate schematics.
 */
import {
  Rule,
  SchematicContext,
  SchematicsException,
  Tree,
} from '@angular-devkit/schematics';
import * as ts from '@schematics/angular/third_party/github.com/Microsoft/TypeScript/lib/typescript';
import { findNodes } from '@schematics/angular/utility/ast-utils';
import { createDefaultPath } from '@schematics/angular/utility/workspace';
import { getWorkspaceConfig, readIntoSourceFile } from '../utils';

export function updateToV020(): Rule {
  return async (tree: Tree, _context: SchematicContext) => {
    const workspaceConfig = getWorkspaceConfig(tree);
    const projectName = workspaceConfig.defaultProject;
    const projectPath = await createDefaultPath(tree, projectName!);

    const componentPath = `${projectPath}/app.component.ts`;
    const componentSource = readIntoSourceFile(tree, componentPath);
    const classDeclaration = findNodes(
      componentSource,
      (node: ts.Node): node is ts.ClassDeclaration => {
        return (
          ts.isClassDeclaration(node) && node.name?.getText() === 'AppComponent'
        );
      }
    );
    if (!classDeclaration[0]) {
      throw new SchematicsException('Cannot find AppComponent Class');
    }
    const titleProperty = findNodes(
      classDeclaration[0],
      (node: ts.Node): node is ts.PropertyDeclaration => {
        return (
          ts.isPropertyDeclaration(node) && node.name?.getText() === 'title'
        );
      }
    );
    const componentRecorder = tree.beginUpdate(componentPath);

    if (titleProperty.length > 0) {
      // update exist one
      const initialLiteral = titleProperty[0].initializer as ts.StringLiteral;
      const startPos = initialLiteral.getStart();
      componentRecorder.remove(startPos, initialLiteral.getWidth());
      componentRecorder.insertRight(startPos, "'Leo Chen'");
    } else {
      // add new one
      componentRecorder.insertLeft(
        classDeclaration[0].end,
        "title = 'Leo Chen'"
      );
    }
    tree.commitUpdate(componentRecorder);
    return;
  };
}
