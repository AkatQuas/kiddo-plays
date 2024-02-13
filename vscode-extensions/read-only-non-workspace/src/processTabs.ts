import * as vscode from 'vscode';
import * as utilities from './utilities';

export async function setTabsToReadOnly(tabGroups: vscode.TabGroups) {
  tabGroups.all.forEach((group) => {
    console.debug('\x1B[97;100;1m --- column --- \x1B[m', '\n', group.isActive);
    group.tabs.forEach(async (tab) => {
      console.debug('\x1B[97;100;1m --- tabs --- \x1B[m', '\n', {
        input: tab.input,
        label: tab.label,
      });
      // tab.input could be:
      // - undefined
      // - webviewType
      // - TabInputText
      // - imagePreview.previewEditor
      // - python notebook
      if (tab.input instanceof vscode.TabInputText) {
        // scheme could be:
        // - trustedDomains
        // - vscode-userdata
        // - vscode-settings
        // - file
        if (
          tab.input.uri.scheme !== 'vscode-userdata' &&
          tab.input.uri.scheme !== 'vscode-settings'
        ) {
          if (await isNonWorkspace(tab.input.uri))
            await setTabToReadOnly(tab.input.uri, tab.isActive);
        }
      }
    });
  });
  const activeTabs: vscode.Tab[] = await getActiveTabs(tabGroups);
  if (activeTabs) {
    const activeGroup = tabGroups.activeTabGroup;
    await resetActiveTabs(tabGroups, activeGroup, activeTabs as vscode.Tab[]);
  }
}

export async function setTabToReadOnly(uri: vscode.Uri, active: boolean) {
  // check if activeGroup too?
  if (uri.scheme !== 'vscode-userdata' && uri.scheme !== 'vscode-settings') {
    // if not the active tab
    if (!active) {
      await vscode.commands.executeCommand('vscode.open', uri);
    }
    await vscode.commands.executeCommand(
      'workbench.action.files.setActiveEditorReadonlyInSession'
    );
  }
}

export async function getActiveTabs(
  tabGroups: vscode.TabGroups
): Promise<vscode.Tab[]> {
  return tabGroups.all.map((group, index) => group.activeTab) as vscode.Tab[];
}

export async function resetActiveTabs(
  tabGroups: vscode.TabGroups,
  activeGroup: vscode.TabGroup,
  activeTabs: vscode.Tab[]
) {
  let index = 0;

  for await (const group of tabGroups.all) {
    const openOptions = { preserveFocus: false, viewColumn: group.viewColumn };
    const tab = activeTabs[index];

    if (tab.input instanceof vscode.TabInputText) {
      vscode.commands.executeCommand('vscode.open', tab.input.uri, openOptions); // this is failing silently
    }
    index++;
  }

  const focusGroupCommand = await utilities.getFocusGroupCommand(
    activeGroup.viewColumn
  );
  await vscode.commands.executeCommand(focusGroupCommand);

  // let showOptions: vscode.TextDocumentShowOptions = { viewColumn: group.viewColumn, preserveFocus: false, preview: tab.isPreview };

  // if (group.activeTab.input instanceof vscode.TabInputText)  // added this, TODO test
  //   await vscode.window.showTextDocument(tab.input?.uri, showOptions);

  // await vscode.commands.executeCommand('vscode.open', uri);
}

export async function isNonWorkspace(Uri: vscode.Uri): Promise<boolean> {
  // folder is undefined if uri not in workspace
  const folder = vscode.workspace.getWorkspaceFolder(Uri);
  return !folder ? false : true;
}
