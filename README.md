## GDB with GPU Debug Support for Intel(R) oneAPI Toolkits

This extension for Visual Studio Code (VS Code) enables
additional features of GPU debugging with GDB for Intel® oneAPI toolkits.

- [eventual additional tool] description

To learn more about using extensions with oneAPI, see [Using Visual Studio Code with Intel® oneAPI Toolkits](https://software.intel.com/content/www/us/en/develop/documentation/using-vs-code-with-intel-oneapi/top.html)

## Prepare Launch Configuration
Note that this feature is only available for the Linux target platform.

This extension enables the ability to prepare launch configurations for running and debugging projects created using Intel oneAPI toolkits:
1. Using the VS Code explorer, click `File -> Open Folder`.
2. Navigate to the folder where your project is located and click `OK`.
3. Press `Ctrl+Shift+P ( or View -> Command Palette... )` to open the Command Palette.
4. Type **Intel oneAPI** and select `Intel oneAPI: Generate launch configurations`.
5. Follow the prompts to add launch configurations.
6. Using the VS Code Explorer, open the C++ file for your project.
8. The configuration is now available to debug and run using the gdb-oneapi debugger. You can find it in .vscode/launch.json. To debug and run, click on the **Run** icon or press `Ctrl+Shift+D`.

Note that you can modify the configuration manually. For example, you may need to change:

* `"args"` - Example `["arg1", "arg2"]`. If you are escaping characters, you will need to double escape them. For example, `["{\\\"arg1\\\": true}"]` will send `{"arg1": true}` to your application.
* `"stopAtEntry"` - If set to true, the debugger should stop at the entry-point of the target (ignored on attach). Default value is false.
* `"cwd"` - Sets the working directory of the application launched by the debugger.
* `"environment"` - Environment variables to add to the environment for the program. Example: `[ { "name": "config", "value": "Debug" } ], not [ { "config": "Debug" } ]`.

More information about all the `launch.json` features can be found on page [Configuring C/C++ debugging
](https://code.visualstudio.com/docs/cpp/launch-json-reference).

## SIMD View
This extension provides a view in the debug view that displays the SIMD lane state of a Intel GPU thread. The view will automatically populate when hitting a GPU thread breakpoint.

### ThreadID
The thread ID as GDB see in in the GPU inferior process. I.e. `2.1` in the GDB console would be `1` 

### Name
The string name that the VSCode knows the GPU thread as.

### SIMD Lanes
The status of the SIMD lanes in the thread. The bits indicate how many lanes are active (typically SIMD8 so 8 lanes) and 0 indicates inactive lane.
Ideally, all lanes should be active.

![View of SIMD view in VSCode debug session](/media/simd.png)

## Differences between GDB and GDB-oneapi
All differences between these two distributions of GDB can be listed by one of help function:
1. Press `Ctrl+Shift+P ( or View -> Command Palette... )` to open the Command Palette.
2. Type **help** to see help commands
3. Choose `Intel oneAPI: List gdb-oneapi debugger unique commands (help)`
4. New window will open with all differences and important documentation links
5. If you want quick access to GDB-oneAPI Online Documentation choose `Intel oneAPI: Open gdb-oneapi debugger online documentation (help)`

## Contributing
Install Visual Studio Code (at least version 1.42) and open this project within it. You also need `node + npm`.
- Switch to project root folder
- `npm install`
- `code .`

At this point you should be able to run the extension in the "Extension Development Host".

## License
This extension is released under the MIT License.

*Other names and brands may be claimed as the property of others.

