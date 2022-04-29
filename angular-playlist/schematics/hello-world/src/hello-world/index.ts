import { strings } from '@angular-devkit/core';
import {
  apply,
  mergeWith,
  Rule,
  SchematicContext,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';
import { HelloSchematics } from './schema';

export function helloWorld(options: HelloSchematics): Rule {
  return (_tree: Tree, _context: SchematicContext) => {
    const sourceParametrizedTemplates = apply(url('./files'), [
      template({
        ...options,
        // strings deal with template interpolation syntax
        ...strings,

        addExclamation,
      }),
    ]);

    return mergeWith(sourceParametrizedTemplates);
  };
}

// custom template interpolation function
function addExclamation(value: string): string {
  return value + '!';
}

/*

<% if (routing) { %>
import { AppRoutingModule } from './app-routing.module';<% } %>

---

<ul>
<% for ( let item of list) { %>
  <li><%= item %></li>
<% } %>
</ul>

*/
