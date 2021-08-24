# Launch & Intellisense Configurator for Intel(R) oneAPI Toolkits

This is an extension for seamless integration with Intel(R) oneAPI tools and makes it easier to build, run, and debug projects in Visual Studio Code* (VS Code).


- [eventual additional tool] description

## Where to find Intel oneAPI toolkits

This extension does not provide any of the tools that are required to perform profiling or analysis.

Please visit https://software.intel.com/oneapi for details. For more information on how to use Visual Studio Code with Intel oneAPI toolkits please visit [Using VS Code with Intel oneAPI toolkits](https://software.intel.com/content/www/us/en/develop/documentation/using-vs-code-with-intel-oneapi/top.html)



## How to use oneapi-debug
1.

## Prepare Launch Configuration
This extension enables the ability to prepare launch configurations for running and debugging projects created using Intel oneAPI toolkits:
1. Using the VS Code explorer, click `File -> Open Folder`.
2. Navigate to the folder where your project is located and click `OK`.
3. Press `Ctrl+Shift+P ( or View -> Command Palette... )` to open the Command Palette.
4. Type **Intel oneAPI** and select `Intel oneAPI: Generate launch configurations`.
5. Follow the prompts to add launch configurations.
6. Using the VS Code Explorer, open the C++ file for your project.
7. The configuration is now available to debug and run using the gdb-oneapi debugger. To debug and run, click on the **Run** icon or press `Ctrl+Shift+D`.


## How to use IntelliSense for oneAPI Code
 1. Make sure that the [C/C++ extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) is already installed.
 2. Press `Ctrl+Shift+P` and choose the option `C/C++ Edit Configurations (JSON)`. As a result, a c_cpp_properties.json file will be created in .vscode folder.
 3. Edit the file so that it looks like in the example:
 ```
    {
    "configurations": [
            {
                "name": "Linux",
                "includePath": [
                    "${workspaceFolder}/**",
                    "/opt/intel/oneapi/**"
                ],
                "defines": [],
                "compilerPath": "/opt/intel/oneapi/compiler/latest/linux/bin/dpcpp",
                "cStandard": "c17",
                "cppStandard": "c++17",
                "intelliSenseMode": "linux-clang-x64"
            }
        ],
        "version": 4
            }
```
4. If necessary, replace the path to the oneAPI components with the one that is relevant for your installation folder.
5. IntelliSense for oneAPI is ready.

## Contributing
Install Visual Studio Code (at least version 1.42) and open this project within it. You also need `node + npm`.
- Switch to project root folder
- `npm install`
- `code .`

At this point you should be able to run the extension in the "Extension Development Host".

## License
This extension is released under the MIT License.

*Other names and brands may be claimed as the property of others.

