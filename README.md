## GDB with GPU Debug Support for Intel® oneAPI Toolkits

This extension for Visual Studio Code (VS Code) enables
additional features of GPU debugging with GDB for Intel® oneAPI toolkits.

To learn more about using extensions with oneAPI, see [Using Visual Studio Code with Intel® oneAPI Toolkits](https://www.intel.com/content/www/us/en/develop/documentation/using-vs-code-with-intel-oneapi/top.html)

## Prepare Launch Configuration
Note that this feature is only available for the Linux* target platform.

This extension enables the ability to prepare launch configurations for running
and debugging projects created using Intel oneAPI toolkits:

1. Open your DPC++ project in VS Code.
2. Build your DPC++ project with the `-g` and `-O0` options to prepare for
   debugging.
3. Press `Ctrl+Shift+P ( or View -> Command Palette... )` to open the Command
   Palette.
4. Type **Intel oneAPI** and select `Intel oneAPI: Generate launch configurations`.
5. Follow the prompts to add a DPC++ launch configuration.
6. Open the C++ source file(s) that you will be debugging in the VS Code edit window.
7. The configuration is now available to debug and run using the gdb-oneapi debugger. You can find it in .vscode/launch.json. To debug and run, click on the **Run** icon or press `Ctrl+Shift+D`.

Note that you can modify the configuration manually. For example, you may need to change:

* `"args"` - An array of arguments to be passed to your app by the debugger.
* `"stopAtEntry"` - Setting to "true" forces a break on your main() function. Default value is false.
* `"cwd"` - Sets the working directory of the application launched by the debugger.
* `"environment"` - Environment variables to add to the environment for the program.

More information about all the `launch.json` features can be found on page [Configuring C/C++ debugging
](https://code.visualstudio.com/docs/cpp/launch-json-reference).

## SIMD View
This extension provides a view in the debug view that displays the SIMD lane state of a Intel GPU thread. The view will automatically populate when hitting a GPU thread breakpoint.

If you want you can edit thread name during debug process by following these steps:
1. Make sure that you can see SIMD LANES while debugging
2. Open Debug Console
3. Choose needed thread using this command '-exec thread THREADID'
4. Then run this command to rename needed thread '-exec thread name YOURNAME'
5. Press Continue (F5) on your debug window to see renewed threads


*On some Linux machines there might be some troubles with SIMD Lanes view. This problem is already under optimization.*

### Location
To see the expanded location just hover over the needed cell.

![Location column](/media/location.gif)

### SIMD Lanes
The status of the SIMD lanes in the thread. The bits indicate how many lanes are active (typically SIMD8, or 8 lanes) and 0 indicates an inactive lane.
Ideally, all lanes should be active.

![View of SIMD view in VSCode debug session](/media/simd.png)

### Choose SIMD Lane
You can choose new SIMD Lane by simply clicking on it. You will see the updated information in SELECTED LANE tab. And also you can use the debug console to see extended thread information (*-exec -thread-info* command).

![Hardware info](/media/lane.gif)

### Hardware info
You can see your devices info in separate tab while debugging.

![Hardware info](/media/hwInfo.gif)

## Differences Between GDB and GDB-oneapi
To display the differences between these two distributions of GDB:
1. Press `Ctrl+Shift+P ( or View -> Command Palette... )` to open the Command Palette.
2. Type **help** to see help commands.
3. Choose `Intel oneAPI: List gdb-oneapi debugger unique commands (help)`.
4. A new window will open with a list of the differences and links to documentation.
5. For quick access to GDB-oneAPI Online Documentation choose `Intel oneAPI: Open gdb-oneapi debugger online documentation (help)`.

## Contributing
Install Visual Studio Code (at least version 1.42) and open this project within it. You also need `node + yarn`.
- Switch to project root folder.
- `yarn install`
- `code .`

At this point you should be able to run the extension in the "Extension
Development Host".

## License
1. This extension is released under the MIT License.


2. oneapi-gdb-debug-0.0.1.vsix\extension\media\userHelp\content.json

    Copyright (c) Intel Corporation

    Permission is granted to copy, distribute and/or modify this document under the terms of
    the GNU Free Documentation License, Version 1.3 or any later version published by the Free
    Software Foundation; with the Invariant Sections being “Free Software” and “FreeSoftware
    Needs Free Documentation”, with the Front-Cover Texts being “A GNU Manual,”and with the
    Back-Cover Texts as in (a) below.
    (a) The FSF’s Back-Cover Text is: “You are free to copy and modify this GNU Manual.
    Buying copies from GNU Press supports the FSF in developing
    GNU and promoting software freedom.”

Other names and brands may be claimed as the property of others.
