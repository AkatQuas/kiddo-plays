import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';

const collectionPath = path.join(__dirname, '../collection.json');

describe('hello-world-simple', () => {
  const expectResult = async (fileName: string = '') => {
    const params = { name: fileName };
    const runner = new SchematicTestRunner('schematics', collectionPath);
    const tree = await runner
      .runSchematicAsync('hello-world-simple', params, Tree.empty())
      .toPromise();
    const fullName = `/${fileName || 'hello-simple'}`;
    expect(tree.files).toContain(fullName);
    expect(tree.readContent(fullName)).toEqual('42');
  };

  it('works', async () => {
    expectResult();
  });
  it('work with given name', async () => {
    expectResult('yyx');
  });
});
