import { SettingsPanel } from "@/components/settings-panel";
import { AiProvidersSettings } from "@/features/ai-providers/components/ai-providers-settings";
import { DeviceTokenSettings } from "@/features/device-tokens/components/device-token-settings";

export function IntegrationsSettings() {
  return (
    <SettingsPanel>
      <DeviceTokenSettings />
      <AiProvidersSettings />
    </SettingsPanel>
  );
}
