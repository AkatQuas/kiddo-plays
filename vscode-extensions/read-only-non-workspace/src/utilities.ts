// import * as vscode from 'vscode';

export async function getFocusGroupCommand(
  viewColumn: Number
): Promise<string> {
  // viewColumn is 1-based
  switch (viewColumn) {
    case 1:
      return 'workbench.action.focusFirstEditorGroup';
    case 2:
      return 'workbench.action.focusSecondEditorGroup';
    case 3:
      return 'workbench.action.focusThirdEditorGroup';
    case 4:
      return 'workbench.action.focusFourthEditorGroup';
    case 5:
      return 'workbench.action.focusFifthEditorGroup';
    case 6:
      return 'workbench.action.focusSixthEditorGroup';
    case 7:
      return 'workbench.action.focusSeventhEditorGroup';
    case 8:
      return 'workbench.action.focusEighthEditorGroup';

    default:
      return '';
  }
}
