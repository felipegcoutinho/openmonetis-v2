export const settingsConfirmation = {
  reset: "ZERAR",
  delete: "EXCLUIR",
} as const;

export type SettingsDangerousAction = keyof typeof settingsConfirmation;

export class InvalidSettingsConfirmationError extends Error {
  constructor(readonly action: SettingsDangerousAction) {
    super("Invalid settings confirmation");
    this.name = "InvalidSettingsConfirmationError";
  }
}

export function assertSettingsConfirmation(action: SettingsDangerousAction, confirmation: string) {
  if (confirmation !== settingsConfirmation[action]) {
    throw new InvalidSettingsConfirmationError(action);
  }
}
