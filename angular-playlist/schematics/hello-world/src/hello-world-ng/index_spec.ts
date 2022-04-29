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
import { HelloNGSchematics } from './schema';

const collectionPath = path.join(__dirname, '../collection.json');

describe('hello-world-ng', () => {
  const runner = new SchematicTestRunner('schematics', collectionPath);
  const workspaceOption: WorkspaceSchema = {
    name: 'random-workspace',
    newProjectRoot: 'projects-root',
    version: '0.1.0-random',
  };

  const appOption: ApplicationSchema = {
    name: 'random-app',
    inlineStyle: true,
    inlineTemplate: true,
    routing: false,
    style: Style.Less,
    skipTests: true,
    skipPackageJson: true,
  };
  const defaultOptions: HelloNGSchematics = {
    name: 'feature/Leo Chen',
    project: appOption.name,
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
  it('works will in project', async () => {
    const tree = await runner
      .runSchematicAsync('hello-world-ng', { ...defaultOptions }, appTree)
      .toPromise();
    expect(tree.files).toContain(
      '/projects-root/random-app/src/app/feature/hello-leo-chen.component.ts'
    );
    const moduleContent = tree.readContent(
      '/projects-root/random-app/src/app/app.module.ts'
    );
    expect(moduleContent).toMatch(
      /import.*HelloLeoChen.*from '\.\/feature\/hello-leo-chen.component'/
    );

    expect(moduleContent).toMatch(
      /declarations:\s*\[[^\]]+?,\r?\n\s+HelloLeoChenComponent\r?\n/m
    );
  });
  it('should failed when project not exist', async () => {
    const project = 'black-hole';
    return expectAsync(
      runner
        .runSchematicAsync(
          'hello-world-ng',
          { ...defaultOptions, project },
          appTree
        )
        .toPromise()
    ).toBeRejectedWithError(`Project "${project}" does not exist.`);
  });
});
