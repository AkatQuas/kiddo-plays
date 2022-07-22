export class ValueChangedEvent extends Event {
  static eventName = "valuechanged";
  data;
  constructor(value) {
    super(ValueChangedEvent.eventName, {});
    this.data = { value };
  }
}
//# sourceMappingURL=InlineEditorUtils.js.map
