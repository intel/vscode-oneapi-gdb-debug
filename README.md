## GDB with GPU Debug Support for Intel® oneAPI Toolkits

This extension for Visual Studio Code (VS Code) enables
additional features of GPU debugging with GDB for Intel® oneAPI toolkits.

![FullView](/media/full.png)

To learn more about using extensions with oneAPI, see [Using Visual Studio Code with Intel® oneAPI Toolkits](https://www.intel.com/content/www/us/en/develop/documentation/using-vs-code-with-intel-oneapi/top.html).

## Get started
Start using this VS Code extension with guide [Get Started with Intel® Distribution for GDB* on Linux* OS Host](https://www.intel.com/content/www/us/en/docs/distribution-for-gdb/get-started-guide-linux/2025-1/overview.html).

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

## Debugger Health Checks for oneAPI

![Debugger Health Checks](/media/healthCheckC.png)

The Debugger Health Checks provide a tool for verifying the setup and functionality of the oneAPI environment and debugger. It allows you to run a series of tests to ensure that key components, such as GPU drivers, environment variables, and debugging tools, are correctly configured.

### How to Use:
1. Open the Debugger Health Checks panel by clicking on the stethoscope icon in the status bar or pressing Run in the panel.

![Debugger Health Checks](/media/healthCheckR.png)

2. The tests will automatically execute, and results will be displayed in a tree format. Each check will show whether it passed, failed, or requires attention (warning).
3. Hover over each test result to view additional information about the specific check, including version numbers and recommendations on how to resolve issues.


## Settings
### Symbolic indication of SIMD lanes
In the settings, you can specify an additional designation for active and inactive lanes using any text character. This may be useful for clearer recognition of lane status.

![Symbolic indication](/media/symbols.png)

### Display Threads Settings
In the settings, there's an option to enable or disable the display of inactive threads. This can help users focus on active threads or get a comprehensive view of all threads.

![Show incative](/media/show_inactive.png)

## SIMD View
In the debug view, this extension provides SIMD View, which displays the SIMD lane state of an Intel GPU thread. The view will automatically populate when hitting a GPU thread breakpoint.

### oneAPI GPU Threads
The specific values corresponding to the status of the SIMD lanes in your current color scheme can be found in the SIMD Lanes tooltip. Dark blue represents active lanes that are stopped at a breakpoint, light blue indicates active lanes that do not meet breakpoint conditions, and grey indicates inactive lanes.

![View of SIMD view in VSCode debug session](/media/simd.gif)

### SIMD lane specific breakpoints
Note that SIMD lane specific breakpoints are saved between sessions, but will be applied only after hitting a regular breakpoint inside the kernel.

There are several ways to set a SIMD lane specific breakpoint:
* Add such a breakpoint by right-clicking on the desired line, selecting "Add Conditional Breakpoint" and "Expression". Then use the commands -break-insert and specify the thread number using the flag -p and SIMD lane using the flag -l:
`-break-insert -p THREADID -l SIMDLANE`
![Right-clicking conditional breakpoint](/media/right-clicking_cbp.gif)

* Use the `Intel oneAPI: Add SIMD lane conditional breakpoint` function at the desired line from the drop-down menu and specify the THREADID and SIMDLANE in format:
`THREADID:SIMDLANE`
![Functional conditional breakpoint](/media/func_cbp.gif)

### SIMD lane specific breakpoints
Note that SIMD lane specific breakpoints are saved between sessions, but will be applied only after hitting a regular breakpoint inside the kernel.

There are several ways to set a SIMD lane specific breakpoint:
* Add such a breakpoint by right-clicking on the desired line, selecting "Add Conditional Breakpoint" and "Expression". Then use the commands -break-insert and specify the thread number using the flag -p and SIMD lane using the flag -l:
`-break-insert -p THREADID -l SIMDLANE`
![Right-clicking conditional breakpoint](/media/right-clicking_cbp.gif)

* Use the `Intel oneAPI: Add SIMD lane conditional breakpoint` function at the desired line from the drop-down menu and specify the THREADID and SIMDLANE in format:
`THREADID:SIMDLANE`
![Functional conditional breakpoint](/media/func_cbp.gif)

### SIMD lane specific breakpoints
Note that SIMD lane specific breakpoints are saved between sessions, but will be applied only after hitting a regular breakpoint inside the kernel.

There are several ways to set a SIMD lane specific breakpoint:
* Add such a breakpoint by right-clicking on the desired line, selecting "Add Conditional Breakpoint" and "Expression". Then use the commands -break-insert and specify the thread number using the flag -p and SIMD lane using the flag -l:
`-break-insert -p THREADID -l SIMDLANE`
![Right-clicking conditional breakpoint](/media/right_click_cbp.gif)

* Use the `Intel oneAPI: Add SIMD lane conditional breakpoint` function at the desired line from the drop-down menu and specify the THREADID and SIMDLANE in format:
`THREADID:SIMDLANE`
![Functional conditional breakpoint](/media/func_cbp.gif)

### Choose SIMD Lane
You can choose a new SIMD lane by clicking on it. Choosing a new SIMD lane will show updated information in the SELECTED LANE tab, and extended thread information can be found using the debug console (command `-exec -thread-info`).

![Lane info](/media/lane.gif)

### Selected lane and Thread info
You can see additional properties in separate tabs while debugging:
* Lane Number - the number of the currently selected lane;
* State - indicates the current status of the lane;
* Work item Global ID - the global ID coordinates of the Work item processed by the current context. Unsigned int vector of size 3, when available. Otherwise, void;
* Work item Local ID - The local ID coordinates of the work item processed by the current context, within its thread's workgroup. Unsigned int vector of size 3, when available.  Otherwise, void;
* Execution Mask - the hex mask encodes for which lanes the breakpoint condition was evaluated to true;
* ID - current thread ID;
* Active Lanes mask - the hex mask of the SIMD lanes which were hit by the breakpoint;
* SIMD Width - the number of working items processed in kernel by a GPU thread.

### Hardware info
You can see your device's info in a separate tab while debugging.

![Hardware info](/media/hwinfo.png)


## Scheduler-locking
Buttons in the debug toolbar provide quick access to turning scheduler-locking on or off for **step** and **continue** flags. Scheduler-locking controls how GDB handles other threads during debugging.

- **step**: When *on*, the scheduler is locked for stepping commands duringnormal execution and record modes.  While stepping, other threads may not preempt the current thread, so that the focus of debugging does not change unexpectedly.  This setting is *off* by default.

- **continue**: When *on*, the scheduler is locked for continuing commands during normal execution and record modes.  For continuing commands other threads may not preempt the current thread.  This setting is *off* by default.

The overall status of scheduler-locking is displayed in the status bar.

![Scheduler-locking info](/media/scheduler.png)


## SIMD Variable Watch
The SIMD Variable Watch functions like the classic Watch panel but displays values for all lanes, making it convenient to compare values without the need for switching between lanes.
Most expressions can be evaluated only for active lanes, however GDB convenience variables are usually available for inactive lanes, too, e.g. $_workitem_global_id or $_workitem_local_id.

![Watch Panel](/media/simdWatch.png)

## GPU Memory Viewing
VS Code's generic debugger now includes a feature for viewing binary data. When a variable supports memory viewing and editing, an inline binary icon appears in the Variables view. Clicking on the icon opens the Hex Editor, allowing to perform operations on the binary data.
This functionality appears in the Variables and Watch panels. Clicking on the icon opens the Hex Editor, in which is possible to inspect conveniently large pieces of data. This functionality enables users to examine the memory space of Intel® GPU kernels.

![Memory Viewing](/media/memView.png)

### SIMD lane specific breakpoints
Note that SIMD lane specific breakpoints are saved between sessions, but will be applied only after hitting a regular breakpoint inside the kernel.

There are several ways to set a SIMD lane specific breakpoint:
* Add such a breakpoint by right-clicking on the desired line, selecting "Add Conditional Breakpoint" and "Expression". Then use the commands -break-insert and specify the thread number using the flag -p and SIMD lane using the flag -l:
`-break-insert -p THREADID -l SIMDLANE`
![Right-clicking conditional breakpoint](/media/right-clicking_cbp.gif)

* Use the `Intel oneAPI: Add SIMD lane conditional breakpoint` function at the desired line from the drop-down menu and specify the THREADID and SIMDLANE in format:
`THREADID:SIMDLANE`
![Functional conditional breakpoint](/media/func_cbp.gif)

### Choose SIMD Lane
You can choose a new SIMD lane by clicking on it. Choosing a new SIMD lane will show updated information in the SELECTED LANE tab, and extended thread information can be found using the debug console (command `-exec -thread-info`).

![Lane info](/media/lane.gif)

### Selected lane and Thread info
You can see additional properties in separate tabs while debugging:
* Lane Number - the number of the currently selected lane;
* State - indicates the current status of the lane;
* Work item Global ID - the global ID coordinates of the Work item processed by the current context. Unsigned int vector of size 3, when available. Otherwise, void;
* Work item Local ID - The local ID coordinates of the work item processed by the current context, within its thread's workgroup. Unsigned int vector of size 3, when available.  Otherwise, void;
* Execution Mask - the hex mask encodes for which lanes the breakpoint condition was evaluated to true;
* ID - current thread ID;
* Active Lanes mask - the hex mask of the SIMD lanes which were hit by the breakpoint;
* SIMD Width - the number of working items processed in kernel by a GPU thread.

### Hardware info
You can see your device's info in a separate tab while debugging.

![Hardware info](/media/hwinfo.png)

## SIMD Variable Watch
The SIMD Variable Watch functions like the classic Watch panel but displays values for all lanes, making it convenient to compare values without the need for switching between lanes.
Most expressions can be evaluated only for active lanes, however GDB convenience variables are usually available for inactive lanes, too, e.g. $_workitem_global_id or $_workitem_local_id.

![Watch Panel](/media/simdWatch.png)

## GPU Memory Viewing
VS Code's generic debugger now includes a feature for viewing binary data. When a variable supports memory viewing and editing, an inline binary icon appears in the Variables view. Clicking on the icon opens the Hex Editor, allowing to perform operations on the binary data.
This functionality appears in the Variables and Watch panels. Clicking on the icon opens the Hex Editor, in which is possible to inspect conveniently large pieces of data. This functionality enables users to examine the memory space of Intel® GPU kernels.

![Memory Viewing](/media/memView.png)

## GPU Memory Viewing
VS Code's generic debugger now includes a feature for viewing binary data. When a variable supports memory viewing and editing, an inline binary icon appears in the Variables view. Clicking on the icon opens the Hex Editor, allowing to perform operations on the binary data.
This functionality appears in the Variables and Watch panels. Clicking on the icon opens the Hex Editor, in which is possible to inspect conveniently large pieces of data. This functionality enables users to examine the memory space of Intel® GPU kernels.

![Memory Viewing](/media/memView.png)

### Choose SIMD Lane
You can choose new SIMD Lane by simply clicking on it. You will see the updated information in SELECTED LANE tab. And also you can use the debug console to see extended thread information (*-exec -thread-info* command).

![Hardware info](/media/lane.gif)

### Hardware info
You can see your devices info in separate tab while debugging.

![Hardware info](/media/hwInfo.gif)

## GPU Memory Viewing
VS Code's generic debugger now includes a feature for viewing binary data. When a variable supports memory viewing and editing, an inline binary icon appears in the Variables view. Clicking on the icon opens the Hex Editor, allowing to perform operations on the binary data.
This functionality appears in the Variables and Watch panels. Clicking on the icon opens the Hex Editor, in which is possible to inspect conveniently large pieces of data. This functionality enables users to examine the memory space of Intel® GPU kernels.

![Memory Viewing](/media/memView.png)

## Differences Between GDB and GDB-oneapi
To display the differences between these two distributions of GDB:
1. Press `Ctrl+Shift+P ( or View -> Command Palette... )` to open the Command Palette.
2. Type **help** to see help commands.
3. Choose `Intel oneAPI: List gdb-oneapi debugger unique commands (help)`.
4. A new window will open with a list of the differences and links to documentation.
5. For quick access to GDB-oneAPI Online Documentation, see `Intel oneAPI: Open gdb-oneapi debugger online documentation (help)`.


Note that the debug session is started by running a command from this terminal. If characters remain in the terminal, this will make the command incorrect and cause the debugging session to hang.

## Contributing
Install Visual Studio Code (version 1.86, or newer) and open this project within it. You also need `node + yarn`.
- Switch to project root folder.
- `yarn install`
- `code .`

At this point you should be able to run the extension in the "Extension Development Host".

## License
1. This extension is released under the MIT License.


2. oneapi-gdb-debug-0.5.0.vsix\extension\media\userHelp\content.json

    Copyright (c) 2021-2025 Intel Corporation

    Permission is granted to copy, distribute and/or modify this document under the terms of
    the GNU Free Documentation License, Version 1.3 or any later version published by the Free
    Software Foundation; with the Invariant Sections being “Free Software” and “FreeSoftware
    Needs Free Documentation”, with the Front-Cover Texts being “A GNU Manual,”and with the
    Back-Cover Texts as in (a) below.
    (a) The FSF’s Back-Cover Text is: “You are free to copy and modify this GNU Manual.
    Buying copies from GNU Press supports the FSF in developing
    GNU and promoting software freedom.”

Other names and brands may be claimed as the property of others.

## Legal Notice

   Your use of this software and any required dependent software (
   `GDB with GPU Debug Support for Intel® oneAPI Toolkits`) 
   is subject to the terms and conditions of the software license
   agreements for the Software Package, which may also include notices, disclaimers, or
   license terms for third party or open source software included in or with the Software
   Package, and your use indicates your acceptance of all such terms. Please refer to the
   `./third-party-programs*.txt` or other similarly-named text file included with the Software
   Package for additional details.
