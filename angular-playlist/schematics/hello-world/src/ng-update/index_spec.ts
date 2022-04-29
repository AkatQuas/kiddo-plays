import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import {
  Schema as ApplicationSchema,
  Style,
} from '@schematics/angular/application/schema';
import { Schema as WorkspaceSchema } from '@schematics/angular/workspace/schema';
import * as path from 'path';

const collectionPath = path.join(__dirname, '../collection.json');
const migrationPath = path.join(__dirname, '../migration.json');

describe('ng-update', () => {
  const runner = new SchematicTestRunner('schematics', collectionPath);
  const workspaceOption: WorkspaceSchema = {
    name: 'random-workspace',
    newProjectRoot: 'projects',
    version: '0.1.0-random',
  };

  const appOption: ApplicationSchema = {
    name: 'hello',
    inlineStyle: true,
    inlineTemplate: false,
    routing: false,
    style: Style.Less,
    skipTests: true,
    skipPackageJson: true,
  };
  let appTree: UnitTestTree;
  beforeEach(async () => {
    appTree = await runner
      .runExternalSchematicAsync(
        '@schematics/angular',
        'workspace',
        workspaceOption
      )
      .toPromise();
    appTree = await runner
      .runExternalSchematicAsync(
        '@schematics/angular',
        'application',
        appOption,
        appTree
      )
      .toPromise();
  });
  it('works', async () => {
    const tree = await runner
      .runExternalSchematicAsync(migrationPath, 'migration020', {}, appTree)
      .toPromise();

    const componentContent = tree.readContent(
      '/projects/hello/src/app/app.component.ts'
    );
    expect(componentContent).toContain("title = 'Leo Chen'");

    expect(tree.files.length).toBeGreaterThan(0);
  });
});
