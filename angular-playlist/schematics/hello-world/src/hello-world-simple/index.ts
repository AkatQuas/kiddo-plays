import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';
import { SimpleSchema } from './schema';

export function helloWorldSimple(options: SimpleSchema): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    // create an file with `--name`
    tree.create(options.name || 'hello-simple', '42');

    return tree;
  };
}
