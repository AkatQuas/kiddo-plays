import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class NodeDependenciesProvider
  implements vscode.TreeDataProvider<Dependency>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    Dependency | undefined | null | void
  > = new vscode.EventEmitter<Dependency | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    Dependency | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private workspaceRoot?: string) {}

  getTreeItem(element: Dependency): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Dependency): Thenable<Dependency[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No dependency in empty workspace');
      return Promise.resolve([]);
    }

    if (element) {
      return Promise.resolve(
        this.getDepsInPackageJson(
          path.join(
            this.workspaceRoot,
            'node_modules',
            element.label,
            'package.json'
          )
        )
      );
    }

    const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
    if (existsSync(packageJsonPath)) {
      return Promise.resolve(this.getDepsInPackageJson(packageJsonPath));
    }

    vscode.window.showInformationMessage('Workspace has no package.json');
    return Promise.resolve([]);
  }
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
  deleteEntry(dep: Dependency) {
    throw new Error('Method not implemented.');
  }
  editEntry(dep: Dependency) {
    throw new Error('Method not implemented.');
  }
  addEntry() {
    throw new Error('Method not implemented.');
  }
  private getDepsInPackageJson(packageJsonPath: string): Dependency[] {
    if (!existsSync(packageJsonPath)) {
      return [];
    }
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    const { dependencies, devDependencies } = packageJson;
    const deps = dependencies
      ? Object.keys(dependencies).map((dep) =>
          this.toDep(dep, dependencies[dep])
        )
      : [];
    const devDeps = devDependencies
      ? Object.keys(devDependencies).map((key) =>
          this.toDep(key, devDependencies[key])
        )
      : [];

    return deps.concat(devDeps);
  }
  private toDep(moduleName: string, version: string): Dependency {
    const modulePath = path.join(
      this.workspaceRoot!,
      'node_modules',
      moduleName
    );
    const state = existsSync(modulePath)
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;
    return new Dependency(moduleName, version, state);
  }
}

export class Dependency extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    private version: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}@${this.version}`;
    this.description = `${this.version}`;
  }

  iconPath = {
    light: path.join(__dirname, '..', 'resources', 'light', 'dependency.svg'),
    dark: path.join(__dirname, '..', 'resources', 'dark', 'dependency.svg'),
  };

  contextValue = 'dependency';
}
