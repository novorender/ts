// run with node to upate glsl code injection settings

import fs from "fs";
import { URL } from 'url'; // in Browser, the URL in native accessible on window
const settingsPath = new URL(".vscode/settings.json", import.meta.url);
const settingsName = "webgl-glsl-editor.codeInjectionSource";
const options = { encoding: "utf8" };
const commonCode = fs.readFileSync(new URL("core3d/common.glsl", import.meta.url), options);
const lines = commonCode.split('\n');
const settingsText = fs.readFileSync(settingsPath, options);
const settingsJson = JSON.parse(settingsText);
const codeInjection = [
    "#version 300 es",
    "precision highp float;",
    "precision highp int;",
    "precision highp usampler2D;",
    ...lines
];
settingsJson[settingsName] = codeInjection;
const newSettingsJson = { ...settingsJson, [settingsName]: codeInjection };
const newSettingsText = JSON.stringify(newSettingsJson, undefined, 4);
fs.writeFileSync(settingsPath, newSettingsText);
console.log("glsl editor settings updated!");
