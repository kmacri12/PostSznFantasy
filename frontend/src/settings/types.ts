export interface SettingField {
  key: string;
  label: string;
  /** A position limit: the stored 99 shows as "No limit" and an empty field saves as 99. */
  limit?: boolean;
}

export interface SettingGroup {
  id: string;
  title: string;
  fields: SettingField[];
}

export type SettingsValues = Record<string, number | string>;
