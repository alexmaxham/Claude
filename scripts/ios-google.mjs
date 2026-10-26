// Turns on native Google sign-in in the iPhone app.
// Download GoogleService-Info.plist for the iOS app from the Firebase console, then:
//   npm run ios:google -- ~/Downloads/GoogleService-Info.plist
// It copies the file into the Xcode project, registers Google's URL scheme in
// Info.plist and switches IOS_GOOGLE_SIGN_IN on. Safe to run again with a new file.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const path = (p) => new URL(p, root).pathname;
const BUNDLE_ID = 'com.alexmaxham.tasko';

const source = process.argv[2];
if (!source) fail('Pass the path to GoogleService-Info.plist, e.g. npm run ios:google -- ~/Downloads/GoogleService-Info.plist');

// GoogleService-Info.plist is a flat dictionary of strings and booleans.
const plist = readFileSync(source, 'utf8');
const value = (key) => plist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`))?.[1];

const bundleId = value('BUNDLE_ID');
if (bundleId !== BUNDLE_ID) fail(`That file is for the app "${bundleId}". Add an iOS app with bundle ID ${BUNDLE_ID} in Firebase and download its file.`);
const projectId = value('PROJECT_ID');
const webProjectId = readFileSync(path('src/cloud/config.ts'), 'utf8').match(/projectId: '([^']+)'/)?.[1];
if (projectId !== webProjectId) fail(`That file is for the Firebase project "${projectId}", but the web app uses "${webProjectId}".`);
const scheme = value('REVERSED_CLIENT_ID');
if (!scheme || !value('CLIENT_ID')) {
  fail('That file has no CLIENT_ID. Enable Google under Authentication → Sign-in method first, then download GoogleService-Info.plist again.');
}

// 1. The file itself, bundled with the app (Firebase reads it at launch).
copyFileSync(source, path('ios/App/App/GoogleService-Info.plist'));

const pbxPath = path('ios/App/App.xcodeproj/project.pbxproj');
let pbx = readFileSync(pbxPath, 'utf8');
if (!pbx.includes('GoogleService-Info.plist')) {
  const FILE = 'A1C0FFEE2F00000100000001';
  const BUILD = 'A1C0FFEE2F00000100000002';
  pbx = insertAfter(pbx, '/* Begin PBXBuildFile section */\n',
    `\t\t${BUILD} /* GoogleService-Info.plist in Resources */ = {isa = PBXBuildFile; fileRef = ${FILE} /* GoogleService-Info.plist */; };\n`);
  pbx = insertAfter(pbx, '/* Begin PBXFileReference section */\n',
    `\t\t${FILE} /* GoogleService-Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = "GoogleService-Info.plist"; sourceTree = "<group>"; };\n`);
  pbx = insertAfter(pbx, '\t\t\t\t504EC3131FED79650016851F /* Info.plist */,\n',
    `\t\t\t\t${FILE} /* GoogleService-Info.plist */,\n`);
  pbx = insertAfter(pbx, '\t\t\t\t504EC30F1FED79650016851F /* Assets.xcassets in Resources */,\n',
    `\t\t\t\t${BUILD} /* GoogleService-Info.plist in Resources */,\n`);
  writeFileSync(pbxPath, pbx);
}

// 2. Google sends the user back to the app through this URL scheme.
const infoPath = path('ios/App/App/Info.plist');
let info = readFileSync(infoPath, 'utf8');
const urlTypes = `\t<key>CFBundleURLTypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>CFBundleURLName</key>
\t\t\t<string>google</string>
\t\t\t<key>CFBundleURLSchemes</key>
\t\t\t<array>
\t\t\t\t<string>${scheme}</string>
\t\t\t</array>
\t\t</dict>
\t</array>
`;
const existing = /\t<key>CFBundleURLTypes<\/key>\n\t<array>[\s\S]*?\n\t<\/array>\n/;
if (existing.test(info)) {
  if (!info.includes('<string>google</string>')) fail('Info.plist already has other URL types; add the scheme in Xcode instead: ' + scheme);
  info = info.replace(existing, urlTypes);
} else {
  info = insertBefore(info, '\t<key>CFBundleVersion</key>\n', urlTypes);
}
writeFileSync(infoPath, info);

// 3. Show the Google button in the app.
const configPath = path('src/cloud/config.ts');
writeFileSync(configPath, readFileSync(configPath, 'utf8').replace('IOS_GOOGLE_SIGN_IN = false', 'IOS_GOOGLE_SIGN_IN = true'));

console.log(`Google sign-in is set up for the iPhone app (URL scheme ${scheme}).
Next: npm run ios, then commit ios/App and src/cloud/config.ts.`);

function insertAfter(text, anchor, addition) {
  if (!text.includes(anchor)) fail(`Couldn't find where to add the file in ${anchor.trim()}; add it in Xcode instead.`);
  return text.replace(anchor, anchor + addition);
}

function insertBefore(text, anchor, addition) {
  if (!text.includes(anchor)) fail(`Couldn't find ${anchor.trim()} in Info.plist.`);
  return text.replace(anchor, addition + anchor);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
