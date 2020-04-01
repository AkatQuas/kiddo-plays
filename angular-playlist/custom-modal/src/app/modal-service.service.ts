import { Injectable } from '@angular/core';
import { DomService } from './dom-service.service';

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private modalElementId = 'modal-container';
  private overlayElementId = 'modal-overlay';

  constructor(
    private domService: DomService
  ) { }

  init(component: any, inputs: object, outputs: object) {
    const componentConfig = {
      inputs,
      outputs,
    };
    this.domService.appendComponentTo(this.modalElementId, component, componentConfig);
    document.getElementById(this.overlayElementId).className = 'show';
    document.getElementById(this.modalElementId).className = 'show';
  }

  destroy() {
    this.domService.removeComponent();
    document.getElementById(this.overlayElementId).className = 'hidden';
    document.getElementById(this.modalElementId).className = 'hidden';
  }
}
