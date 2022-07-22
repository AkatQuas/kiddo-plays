import * as UI from "../../legacy/legacy.js";
import { DataGridController } from "./DataGridController.js";
export class DataGridControllerIntegrator extends UI.Widget.VBox {
  dataGrid;
  constructor(data) {
    super(true, true);
    this.dataGrid = new DataGridController();
    this.dataGrid.data = data;
    this.contentElement.appendChild(this.dataGrid);
  }
  data() {
    return this.dataGrid.data;
  }
  update(data) {
    this.dataGrid.data = data;
  }
}
//# sourceMappingURL=DataGridControllerIntegrator.js.map
