import { SchematicsException, Tree } from '@angular-devkit/schematics';
import * as ts from '@schematics/angular/third_party/github.com/Microsoft/TypeScript/lib/typescript';
import { WorkspaceSchema } from '@schematics/angular/utility/workspace-models';

export function readIntoSourceFile(
  host: Tree,
  modulePath: string
): ts.SourceFile {
  const text = host.read(modulePath);
  if (text === null) {
    throw new SchematicsException(`File ${modulePath} does not exist.`);
  }
  const sourceText = text.toString('utf-8');
  return ts.createSourceFile(
    modulePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );
}

export const getWorkspaceConfig = (host: Tree): WorkspaceSchema => {
  // read angular.json
  const workspaceConfigBuffer = host.read('angular.json');
  if (!workspaceConfigBuffer) {
    throw new SchematicsException('Must run in an Angular CLI workspace.');
  }

  const workspaceConfig = JSON.parse(workspaceConfigBuffer.toString());
  return workspaceConfig as WorkspaceSchema;
};
