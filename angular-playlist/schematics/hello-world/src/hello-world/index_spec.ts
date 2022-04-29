import { strings } from '@angular-devkit/core';
import { Tree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { HelloSchematics } from './schema';

const collectionPath = path.join(__dirname, '../collection.json');
describe('hello-world', () => {
  const runner = new SchematicTestRunner('schematics', collectionPath);

  const createTree = async (
    options: HelloSchematics
  ): Promise<UnitTestTree> => {
    return await runner
      .runSchematicAsync('hello-world', options, Tree.empty())
      .toPromise();
  };

  it('works with name=LeoChen suffix=true ', async () => {
    const name = 'LeoChen';
    const tree = await createTree({
      name,
      suffix: true,
    });
    const fileName = `/hello-${strings.dasherize(name)}.component.ts`;
    expect(tree.files).toContain(fileName);
    const fileContent = tree.readContent(fileName);
    expect(fileContent).toMatch(/suffix: boolean = true;/);
  });
  it('works with name=LeoChen suffix=false message=42 ', async () => {
    const name = 'LeoChen';
    const tree = await createTree({
      name,
      message: '42',
      suffix: false,
    });
    const fileName = `/hello-${strings.dasherize(name)}.component.ts`;
    expect(tree.files).toContain(fileName);
    const fileContent = tree.readContent(fileName);
    // exclamation
    expect(fileContent).toMatch(/from LeoChen!/);
    // selector tag
    expect(fileContent).toMatch(/hello-leo-chen/);
    expect(fileContent).toMatch(/class HelloLeoChenComponent/);
    expect(fileContent).toMatch(/suffix: boolean = false;/);
  });
});
