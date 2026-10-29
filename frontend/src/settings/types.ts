export interface SettingField {
  key: string;
  label: string;
}

export interface SettingGroup {
  id: string;
  title: string;
  fields: SettingField[];
}

export type SettingsValues = Record<string, number | string>;
