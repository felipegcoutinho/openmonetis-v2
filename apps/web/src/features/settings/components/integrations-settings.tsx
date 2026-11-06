import { SettingsPanel } from "@/components/settings-panel";
import { DeviceTokenSettings } from "@/features/device-tokens/components/device-token-settings";

export function IntegrationsSettings() {
  return (
    <SettingsPanel>
      <DeviceTokenSettings />
    </SettingsPanel>
  );
}
