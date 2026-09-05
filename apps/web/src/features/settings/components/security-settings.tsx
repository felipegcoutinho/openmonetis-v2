import { SettingsPanel } from "@/components/settings-panel";
import { PasskeySettings } from "./passkey-settings";
import { PasswordSettings } from "./password-settings";

export function SecuritySettings() {
  return (
    <SettingsPanel>
      <PasswordSettings />
      <PasskeySettings />
    </SettingsPanel>
  );
}
