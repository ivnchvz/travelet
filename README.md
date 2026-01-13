# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.


Step-by-Step: Modify and Rebuild
Step 1: Modify the Codebase in Cursor

Open Project in Cursor:

Launch Cursor on your Mac.
Open the travelet folder: File > Open Folder > Navigate to ~/travelet.
Explore the app directory (e.g., app/_layout.js, app/home/index.js, app/explore/index.js, app/documents/index.js) to see the Home, Explore, and Documents tabs.


Make Changes:

Example Modifications:

Update Tab Titles or Icons: Edit app/_layout.js to change tab names or add icons:
javascriptimport { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="home"
        options={{ title: 'Dashboard', tabBarIcon: () => <Ionicons name="home" size={20} /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: 'Discover', tabBarIcon: () => <Ionicons name="search" size={20} /> }}
      />
      <Tabs.Screen
        name="documents"
        options={{ title: 'Files', tabBarIcon: () => <Ionicons name="document" size={20} /> }}
      />
    </Tabs>
  );
}

Install @expo/vector-icons if needed: npx expo install @expo/vector-icons.


Enhance Documents Tab: Add a button in app/documents/index.js:
javascriptimport { View, Text, Button } from 'react-native';
import AddDocumentModal from '../components/AddDocumentModal';
import PDFViewer from '../components/PDFViewer';

export default function DocumentsScreen() {
  return (
    <View>
      <Text>Files</Text>
      <AddDocumentModal />
      <Button title="Refresh PDFs" onPress={() => console.log('Refreshed')} />
      {/* PDFViewer logic here */}
    </View>
  );
}



Use Cursor’s AI to suggest improvements (e.g., styling with StyleSheet or adding navigation).


Save Changes:

Save all modified files in Cursor.



Step 2: Rebuild and Install on iPhone X

Regenerate Native Files (if Needed):

If you changed app.json (e.g., added permissions), run:
bashcd ~/travelet
npx expo prebuild --clean

This updates ios/Travelet.xcworkspace. Skip this if only code logic changed.


Open in Xcode:

Open ~/travelet/ios/Travelet.xcworkspace in Xcode.


Rebuild:

Go to Signing & Capabilities:

Ensure Team is “Wasser Stiefel (Personal Team)” and Automatically manage signing is checked.
Select your iPhone X as the destination.


Click Run (play button) to build and install the updated app.


Trust Certificate:

On iPhone X, go to Settings > General > VPN & Device Management > Tap Trust for wssrstfl@gmail.com (if not already trusted).