import { Injectable, ComponentFactoryResolver, ApplicationRef, Injector, ComponentRef, EmbeddedViewRef } from '@angular/core';

interface childConfig {
  inputs: object;
  outputs: object;
}

@Injectable({
  providedIn: 'root'
})
export class DomService {
  private childComponentRef: any;

  constructor(
    private componentFactoryResolver: ComponentFactoryResolver,
    private appRef: ApplicationRef,
    private injector: Injector,
  ) { }

  /**
   * appendComponentTo
   */
  public appendComponentTo(parentId: string, child: any, childConfig?: childConfig) {
    // create a component reference from the component
    const childComponentRef = this.componentFactoryResolver
      .resolveComponentFactory(child)
      .create(this.injector);

    // attach the config to the child (inputs and outputs)
    this.attachConfig(childConfig, childComponentRef);

    this.childComponentRef = childComponentRef;

    // attach component to the appRef so that it's inside the ng component tree
    this.appRef.attachView(childComponentRef.hostView);

    // get DOM element from component
    const childDom = (childComponentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;

    // append DOM element to the body
    document.getElementById(parentId).appendChild(childDom);
  }

  /**
   * removeComponent
   */
  public removeComponent() {
    this.appRef.detachView(this.childComponentRef.hostView);
    this.childComponentRef.destroy();
  }

  private attachConfig(config: childConfig, componentRef) {
    // what is this
    const inputs = config.inputs;
    const outputs = config.outputs;

    for (const key in inputs) {
      if (inputs.hasOwnProperty(key)) {
        componentRef.instance[key] = inputs[key];
      }
    }
    for (const key in outputs) {
      if (outputs.hasOwnProperty(key)) {
        componentRef.instance[key] = outputs[key];
      }
    }
  }
}
