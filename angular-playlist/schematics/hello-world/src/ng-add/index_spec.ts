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
import { HelloNGAddSchematics } from './schema';

const collectionPath = path.join(__dirname, '../collection.json');

describe('ng-add', () => {
  const runner = new SchematicTestRunner('schematics', collectionPath);
  const workspaceOption: WorkspaceSchema = {
    name: 'random-workspace',
    newProjectRoot: 'projects-root',
    version: '0.1.0-random',
  };

  const appOption: ApplicationSchema = {
    name: 'random-app',
    inlineStyle: true,
    inlineTemplate: false,
    routing: false,
    style: Style.Less,
    skipTests: true,
    skipPackageJson: true,
  };
  const defaultOptions: HelloNGAddSchematics = {
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
  it('works', async () => {
    const tree = await runner
      .runSchematicAsync('ng-add', { ...defaultOptions }, appTree)
      .toPromise();

    const moduleContent = tree.readContent(
      '/projects-root/random-app/src/app/app.module.ts'
    );
    expect(moduleContent).toMatch(
      /import.*FontAwesomeModule.*from '@fortawesome\/angular-fontawesome'/
    );
    expect(moduleContent).toMatch(
      /imports:\s*\[[^\]]+?,\r?\n\s+FontAwesomeModule\r?\n/m
    );

    const componentContent = tree.readContent(
      '/projects-root/random-app/src/app/app.component.ts'
    );
    expect(componentContent).toMatch(
      /import.*faCoffee.*from '@fortawesome\/free-solid-svg-icons'/
    );
    expect(componentContent).toContain('faCoffee = faCoffee');

    const htmlContent = tree.readContent(
      '/projects-root/random-app/src/app/app.component.html'
    );
    expect(htmlContent).toContain('<fa-icon [icon]="faCoffee"></fa-icon>');

    // verify dependencies in package.json
    const packageJson = JSON.parse(tree.readContent('/package.json'));
    const dependencies = packageJson.dependencies;
    expect(dependencies['@fortawesome/fontawesome-svg-core']).toBeDefined();
    expect(dependencies['@fortawesome/free-solid-svg-icons']).toBeDefined();
    expect(dependencies['@fortawesome/angular-fontawesome']).toBeDefined();

    expect(runner.tasks.some((task) => task.name === 'node-package')).toBe(
      true
    );
  });
});
