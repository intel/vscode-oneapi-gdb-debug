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

### Location
To see the expanded location, just hover over the desired cell.

![Location column](/media/location.gif)

### oneAPI GPU Threads
The status of the SIMD lanes in the thread. Dark blue represents active lanes stopped at a breakpoint, light blue indicates active lanes that do not meet breakpoint conditions and grey indicates inactive lanes.

![View of SIMD view in VSCode debug session](/media/simd.png)

### SIMD lane specific breakpoints
Note that SIMD lane specific breakpoints are saved between sessions, but will be applied only after hitting a regular breakpoint inside the kernel.

There are several ways to set a SIMD lane specific breakpoint:
* Add such a breakpoint by right-clicking on the desired line, selecting "Add Conditional Breakpoint" and "Expression". Then use the commands -break-insert and specify the thread number using the flag -p and SIMD lane using the flag -l:
`-break-insert -p THREADID -l SIMDLANE`
![Right-clicking conditional breakpoint](/media/right_click_cbp.gif)

* Use the `Intel oneAPI: Add SIMD lane conditional breakpoint` function at the desired line from the drop-down menu and specify the THREADID and SIMDLANE in format:
`THREADID:SIMDLANE`
![Functional conditional breakpoint](/media/func_cbp.gif)


### Symbolic indication of SIMD lanes
In the settings, you can specify an additional designation for active and inactive lanes using any text character. This may be useful for clearer recognition of lane status.

![Symbolic indication](/media/symbols.png)
### Choose SIMD Lane
You can choose a new SIMD lane by clicking on it. Choosing a new SIMD lane will show updated information in the SELECTED LANE tab, and extended thread information can be found using the debug console (command `-exec -thread-info`).
Please note that at the moment the Variables view is not refreshed automatically after clicking on SIMD lane. To get around this and see the current state of the variables for the selected SIMD, you need to perform any manipulation with Watch view, for example, add or remove any value.

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

## Troubleshooting

### Kernel breakpoints do not work
The problem is most likely caused by the fact that the environment variables ZET_ENABLE_PROGRAM_DEBUGGING and IGC_EnableGTLocationDebugging were not set. Despite the fact that the debug configuration generated by this extension contains the settings of these variables, VSCode currently has a known problem with the operation of the "environment" field from launch.json. To work around this issue, set the environment variables by doing the following:
- Click on the **Run** icon or press `Ctrl+Shift+D` to start debugging and end the debugging session. Thanks to this, a debugging terminal will appear:
- In this terminal, run:
   `export ZET_ENABLE_PROGRAM_DEBUGGING=1`
   `export IGC_EnableGTLocationDebugging=1`
- After that, run debugging as usual without closing this terminal

![Debug terminal](/media/debug-terminal.png)

Note that the debug session is started by running a command from this terminal. If characters remain in the terminal, this will make the command incorrect and cause the debugging session to hang.

## Contributing
Install Visual Studio Code (version 1.42, or newer) and open this project within it. You also need `node + yarn`.
- Switch to project root folder.
- `yarn install`
- `code .`

At this point you should be able to run the extension in the "Extension
Development Host".

## License
1. This extension is released under the MIT License.


2. oneapi-gdb-debug-0.2.1.vsix\extension\media\userHelp\content.json

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
