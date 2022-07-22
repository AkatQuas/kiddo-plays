import * as EmulationModelModule from "../../models/emulation/emulation.js";
import * as EmulationModule from "./emulation.js";
self.Emulation = self.Emulation || {};
Emulation = Emulation || {};
Emulation.AdvancedApp = EmulationModule.AdvancedApp.AdvancedApp;
Emulation.AdvancedAppProvider = EmulationModule.AdvancedApp.AdvancedAppProvider;
Emulation.DeviceModeModel = EmulationModelModule.DeviceModeModel.DeviceModeModel;
Emulation.DeviceModeModel.Type = EmulationModelModule.DeviceModeModel.Type;
Emulation.DeviceModeView = EmulationModule.DeviceModeView.DeviceModeView;
Emulation.DeviceModeWrapper = EmulationModule.DeviceModeWrapper.DeviceModeWrapper;
Emulation.DeviceModeWrapper.ActionDelegate = EmulationModule.DeviceModeWrapper.ActionDelegate;
Emulation.EmulatedDevice = EmulationModelModule.EmulatedDevices.EmulatedDevice;
Emulation.EmulatedDevicesList = EmulationModelModule.EmulatedDevices.EmulatedDevicesList;
Emulation.InspectedPagePlaceholder = EmulationModule.InspectedPagePlaceholder.InspectedPagePlaceholder;
Emulation.InspectedPagePlaceholder.instance = EmulationModule.InspectedPagePlaceholder.InspectedPagePlaceholder.instance;
Emulation.MediaQueryInspector = EmulationModule.MediaQueryInspector.MediaQueryInspector;
//# sourceMappingURL=emulation-legacy.js.map
