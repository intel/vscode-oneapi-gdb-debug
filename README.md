## GDB with GPU Debug Support for Intel(R) oneAPI Toolkits

An extension to expose additional features of GPU debugging with GDB for Intel(R) oneAPI.


- [eventual additional tool] description


## How to use
1.

## Prepare Launch Configuration
* Note that this feature is only available for the Linux target platform.

This extension enables the ability to prepare launch configurations for running and debugging projects created using Intel oneAPI toolkits:
1. Using the VS Code explorer, click `File -> Open Folder`.
2. Navigate to the folder where your project is located and click `OK`.
3. Press `Ctrl+Shift+P ( or View -> Command Palette... )` to open the Command Palette.
4. Type **Intel oneAPI** and select `Intel oneAPI: Generate launch configurations`.
5. Follow the prompts to add launch configurations.
6. Using the VS Code Explorer, open the C++ file for your project.
7. The configuration is now available to debug and run using the gdb-oneapi debugger. To debug and run, click on the **Run** icon or press `Ctrl+Shift+D`.

## Contributing
Install Visual Studio Code (at least version 1.42) and open this project within it. You also need `node + npm`.
- Switch to project root folder
- `npm install`
- `code .`

At this point you should be able to run the extension in the "Extension Development Host".

## License
This extension is released under the MIT License.

*Other names and brands may be claimed as the property of others.

