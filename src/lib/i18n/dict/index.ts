/* Tüm sözlük parçaları: { "Türkçe metin": ["English", "Русский"] } */
import common from "./common";
import calendar from "./calendar";
import visit from "./visit";
import kasa from "./kasa";
import clients from "./clients";
import admin from "./admin";
import hours from "./hours";
import crm from "./crm";
import wa from "./wa";
import sync from "./sync";
import growth from "./growth";
import overrides from "./overrides";

export const DICT: Record<string, [string, string]> = { ...admin, ...clients, ...kasa, ...visit, ...calendar, ...hours, ...crm, ...wa, ...sync, ...growth, ...common, ...overrides };
