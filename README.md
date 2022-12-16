## GDB with GPU Debug Support for Intel® oneAPI Toolkits

This extension for Visual Studio Code (VS Code) enables
additional features of GPU debugging with GDB for Intel® oneAPI toolkits.

To learn more about using extensions with oneAPI, see [Using Visual Studio Code with Intel® oneAPI Toolkits](https://www.intel.com/content/www/us/en/develop/documentation/using-vs-code-with-intel-oneapi/top.html).

## Get started
Start using this VS Code extension with guide [Get Started with Intel® Distribution for GDB* on Linux* OS Host](https://www.intel.com/content/www/us/en/develop/documentation/get-started-with-debugging-dpcpp-linux/top.html).

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

More information about all the `launch.json` features can be found at [Configuring C/C++ debugging](https://code.visualstudio.com/docs/cpp/launch-json-reference).

## SIMD View
In the debug view, this extension provides SIMD View, which displays the SIMD lane state of an Intel GPU thread. The view will automatically populate when hitting a GPU thread breakpoint.

Thread name can be edited during the debug process by following the steps below:
1. Make sure that you can see SIMD LANES while debugging.
2. Open the Debug Console.
3. Choose the needed thread using command `-exec thread THREADID`.
4. Rename the desired thread by running the command `-exec thread name YOURNAME`.
5. Press `Continue` (`F5`) on your debug window to see renewed threads.

SIMD Lanes view may have reduced functionality on some machines. This issue is already under review.

Currently machines with multiple GPUs exhibit issues related to the SIMD Lanes view. These are under optimization.

### Location
To see the expanded location, just hover over the desired cell.

![Location column](/media/location.gif)

### SIMD Lanes
The status of the SIMD lanes in the thread. The bits indicate how many lanes are active (typically SIMD8, or 8 lanes) and 0 indicates an inactive lane.
Ideally, all lanes should be active.

![View of SIMD view in VSCode debug session](/media/simd.png)

### Choose SIMD Lane
You can choose a new SIMD lane by clicking on it. Choosing a new SIMD lane will show updated information in the SELECTED LANE tab, and extended thread information can be found using the debug console (command `-exec -thread-info`).

![Hardware info](/media/lane.gif)

### Hardware info
You can see your device's info in a separate tab while debugging.

![Hardware info](/media/hwInfo.gif)

## Differences Between GDB and GDB-oneapi
To display the differences between these two distributions of GDB:
1. Press `Ctrl+Shift+P ( or View -> Command Palette... )` to open the Command Palette.
2. Type **help** to see help commands.
3. Choose `Intel oneAPI: List gdb-oneapi debugger unique commands (help)`.
4. A new window will open with a list of the differences and links to documentation.
5. For quick access to GDB-oneAPI Online Documentation, see `Intel oneAPI: Open gdb-oneapi debugger online documentation (help)`.

## Contributing
Install Visual Studio Code (version 1.42, or newer) and open this project within it. You also need `node + yarn`.
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
