/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 *
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
(function () {

    // Secure policy of VSCode webviews prevents js scripts to load other scripts or even files if they don't have valid nonce.
    // Nonce is very usefull and gives protection from code injection.
    // Writing script in html causes that debugging is impossible.
    // To make proper working of webview DOM elements i got to have their data.
    // I didn't find a good solution to load json file here, so i had to paste it here manually
    // If i find better solution - I will change it
    // If got any question, write to @mgackowx

    const USER_HELP = {
        "intro": "Hello, here you can find some important informations about differnces between GDB and GDB-oneAPI. These information have to point you what should you check before starting your work. When you get familiar with below content, go to GDB-oneAPI user manual to check details. There is also GDB-oneAPI cheat sheet which can be helpful on daily work. If you have a problem with installation and cofiguring you can always check GDB-oneAPI online documentation. If you want to compare some command with pure GDB, then check GDB online documentation",
        "intro_oneapiFeatures": "1. Below you can find what have changed in Intel® Distribution for GDB compared to pure GD. Here are some important features which comes to GDB-OneAPI. Point your mouse the command or word to see short description, click on it, to see more informations, if you want to localize command in the documentation - click on the '?' mark",
        "oneapiFeatures": [
            {
                "name": "SIMD lane managing",
                "description": "Some instructions can be performed on several data elements simultaneously (SIMD: Single Instruction Multiple Data), so a thread computes a vector of data elements in parallel. There is a 1-to-1 relation between active SIMD lanes in a thread and data elements that are being processed by the thread at a moment"
            },
            {
                "name": "Extends thread elements with SIMD lane number",
                "description": "All thread elements can be extended with a SIMD lane specifiers. A SIMD lane identifier comes within a thread in the format thread ID:lane. If thread ID is skipped, then the currently selected thread is taken, e.g., ':2' specifies SIMD lane 2 in the current thread. Another valid examples: '2:3', '2-3:4', '1.*:3'. A SIMD lane wildcard – all active SIMD lanes of specified thread(s) or the current thread if no thread is specified: thread ID: *: ':*', '1:*', '1.2-3:*'. The thread ID wildcard can be used together with the SIMD lane wildcard: '*:*' or '1.*:*'. In case when the target architecture supports SIMD lanes, but a lane is not specified in the list item, takes the default SIMD lane, which is the currently selected lane if it is active, or the first active SIMD lane within the thread."
            },
            {
                "name": "Inferior-Specific Breakpoints",
                "description": "It is also possible to limit breakpoints to specific inferior program space, which can be especially useful when doing multi-target debugging with some source files shared between targets"
            },
            {
                "name": "Control-flow Enforcement Debugging",
                "description": "Control-flow Enforcement Technology (CET) provides two capabilities to defend against 'Return-oriented Programming' and 'call/jmp-oriented programming' style control-flow attacks: Shadow Stack and Indirect Branch Tracking (IBT)"
            },
            {
                "name": "User Aliases",
                "description": "It is often useful to define alternate spellings of existing commands. For example, if a new GDB command defined in Python has a long name to type, it is handy to have an abbreviated version of it that involves less typing. GDB itself uses aliases. For example, s' is an alias of the step' command even though it is otherwise an ambiguous abbreviation of other commands like set' and show'. You can define a new alias with the alias' command: 'alias [-a] [--] ALIAS = COMMAND'"
            }
        ],
        "intro_comparisonTable": "2. In the table below are presented commands which differ between gdb and gdb-oneapi with description.",
        "gdbCommandsToCompare": [
            {
                "id": "infoThreads_gdb",
                "command": {
                    "name": "info threads",
                    "link": "https://sourceware.org/gdb/onlinedocs/gdb/Threads.html",
                    "descriptionShort": "A command to inquire about existing threads.",
                    "descriptionLong": "Display information about all threads in three columns: 'ID', 'Target ID', 'Frame'. Can show additional Gid column when use with specifier '-gid'"
                },
                "keyWords": [
                    {
                        "name": "info ",
                        "aliases": "inf, i",
                        "descriptionShort": "Generic command for showing things about the program being debugged."
                    },
                    {
                        "name": "threads",
                        "descriptionShort": "Threads of a single program are akin to multiple processes—except that they share one address space. It's not a standalone function.",
                        "descriptionLong": "In some operating systems, such as GNU/Linux and Solaris, a single program may have more than one thread of execution. The precise semantics of threads differ from one operating system to another, but in general the threads of a single program are akin to multiple processes—except that they share one address space (that is, they can all examine and modify the same variables). On the other hand, each thread has its own registers and execution stack, and perhaps private memory."
                    }
                ]
            },
            {
                "id": "threadId_gdb",
                "command": {
                    "name": "thread [thread-id]",
                    "link": "https://sourceware.org/gdb/onlinedocs/gdb/Threads.html",
                    "descriptionShort": "A command to switch among threads and its SIMD lanes.",
                    "descriptionLong": "Make thread with specified ID the current thread. When SIMD lanes are supported, with this command you can switch the thread's focus from one SIMD lane to another: 'thread 2:3' – switch the lane of a thread 2, to the lane number 3."
                },
                "keyWords": [
                    {
                        "name": "thread ",
                        "descriptionShort": "Manages thread properties. Can be used with 'thread-id', 'apply', 'name', 'find'. Helps user to manage active threads.",
                        "descriptionLong": "In general, the threads of a single program are akin to multiple processes—except that they share one address space (that is, they can all examine and modify the same variables). On the other hand, each thread has its own registers and execution stack, and perhaps private memory."
                    },
                    {
                        "name": "[thread-id]",
                        "descriptionShort": "ID number of the thread as shown in the 'info threads' output."
                    }
                ]
            },
            {
                "id": "threadApply_gdb",
                "command": {
                    "name": "Thread apply [thread-id-list | all] [flag] [command]",
                    "link": "https://sourceware.org/gdb/onlinedocs/gdb/Threads.html",
                    "descriptionShort": "A command which allow to apply a command to a list of threads specific breakpoints.",
                    "descriptionLong": "The 'thread apply' command allows you to apply the named command to one or more threads. Specify the threads that you want affected using the thread ID list syntax (see thread ID lists) or specify 'all' to apply to all threads. To apply a command to all threads in descending order, type 'thread apply all [command]'. To apply a command to all threads in ascending order, type 'thread apply all -ascending [command]."
                },
                "keyWords": [
                    {
                        "name": "thread ",
                        "descriptionShort": "Manages thread properties. Can be used with 'thread-id', 'apply', 'name', 'find'. Helps user to manage active threads.",
                        "descriptionLong": "In general, the threads of a single program are akin to multiple processes—except that they share one address space (that is, they can all examine and modify the same variables). On the other hand, each thread has its own registers and execution stack, and perhaps private memory."
                    },
                    {
                        "name": "apply ",
                        "descriptionShort": "Key word using to applying commands to threads or frames. It's not a standalone function."
                    },
                    {
                        "name": "[thread-id-list ",
                        "descriptionShort": "List of numeric values IDs.",
                        "descriptionLong": "'thread-is-list' can be a thread ID with or without an inferior qualifier. E.g., '2.1' or '1' or a range of thread numbers, again with or without an inferior qualifier, as in inf.thr1-thr2 or thr1-thr2. E.g., '1.2-4' or '2-4'. Or it can be all threads of an inferior, specified with a star wildcard, with or without an inferior qualifier, as in inf.* (e.g., '1.*') or *.The former refers to all threads of the given inferior, and the latter form without an inferior qualifier refers to all threads of the current inferior."
                    },
                    {
                        "name": "| all] ",
                        "descriptionShort": "Command which uses causes applying [command] to all threads.",
                        "descriptionLong": "To apply a command to all threads in descending order, 'type thread apply all [command]'. To apply a command to all threads in ascending order, type 'thread apply all -ascending [command]."
                    },
                    {
                        "name": "[flag] ",
                        "descriptionShort": "The flag arguments control what output to produce and how to handle errors raised when applying command to a thread. flag must start with a - directly followed by one letter in 'qcs'. If several flags are provided, they must be given individually, such as '-c' '-q'.",
                        "descriptionLong": "By default, GDB displays some thread information before the output produced by command, and an error raised during the execution of a command will abort thread apply. The following flags can be used to fine-tune this behavior: -c: 'continue', causes any errors in command to be displayed, and the execution of thread apply then continues. -s: 'silent', causes any errors or empty output produced by a command to be silently ignored. That is, the execution continues, but the thread information and errors are not printed. -q: 'quiet' disables printing the thread information. Flags -c and -s cannot be used together."
                    },
                    {
                        "name": "[command]",
                        "descriptionShort": "This is GDB function which user can apply to a thread. For example, if you type 'thread apply all backtrace', GDB will display the backtrace for all the threads."
                    }
                ]
            },
            {
                "id": "commandsListEnd_gdb",
                "command": {
                    "name": "commands [command-list] end",
                    "link": "https://sourceware.org/gdb/current/onlinedocs/gdb/Break-Commands.html",
                    "descriptionShort": "Specify a list of commands for the given breakpoints.",
                    "descriptionLong": "You can give any breakpoint (or watchpoint or catchpoint) a series of commands to execute when your program stops due to that breakpoint. For example, you might want to print the values of certain expressions or enable other breakpoints. The commands themselves appear on the following lines. Type a line containing just 'end' to terminate the commands. To remove all commands from a breakpoint, type commands and follow it immediately with 'end'; that is, give no commands. With no argument, commands refer to the last breakpoint, watchpoint, or catchpoint set (not to the breakpoint most recently encountered). If the most recent breakpoints were set with a single command, then the commands will apply to all the breakpoints set by that command. This applies to breakpoints set by 'rbreak' and applies when a single break command creates multiple breakpoints."
                },
                "keyWords": [
                    {
                        "name": "commands ",
                        "descriptionShort": "Starts commands chain with the pattern."
                    },
                    {
                        "name": "[command-list] ",
                        "descriptionShort": "List of functions to give to breakpoint and to execute when hit. Placed after 'commands' and before 'end' key words in separate lines.",
                        "descriptionLong": "Type a line containing just 'end' to terminate the commands. With no argument, commands refer to the last break/watch/catchpoint set. If the most recent breakpoints were set with a single command, then the commands will apply to all the breakpoints set by that command. This applies to breakpoints set by rbreak and applies when a single break command creates multiple breakpoints."
                    },
                    {
                        "name": "end",
                        "descriptionShort": "Ends sequence of functions.",
                        "descriptionLong": "Type a line containing just 'end' to terminate the commands. To remove all commands from a breakpoint, type commands and follow it immediately with 'end'."
                    }
                ]
            },
            {
                "id": "recordFunctionCallHistory_gdb",
                "command": {
                    "name": "record function-call-history",
                    "link": "https://sourceware.org/gdb/current/onlinedocs/gdb/Process-Record-and-Replay.html",
                    "descriptionShort": "Prints the execution history at function granularity. Prints auxiliary information which can be disabled by '/s' modifier.",
                    "descriptionLong": "For each sequence of instructions that belong to the same function, it prints the name of that function, the source lines for this instruction sequence (if the '/l' modifier is specified), and the instructions numbers that form the sequence (if the '/I' modifier is specified). The function names are indented to reflect the call stack depth if the '/c' modifier is specified. The '/l', '/i', and '/c' modifiers can be given together. Every use of command prints ten more functions after the last ten-function print."
                },
                "keyWords": [
                    {
                        "name": "record ",
                        "descriptionShort": "This command starts the process record and replay target.",
                        "descriptionLong": "The recording method can be specified as parameter. Without a parameter the command uses the full recording method. To see the following recording methods, follow documentation link. Some of methods available:  'full', 'btrace', 'stop', 'goto', 'save', 'restore'."
                    },
                    {
                        "name": "function-call-history ",
                        "descriptionShort": "reference to history of calling functions.",
                        "descriptionLong": "By default, ten functions are printed. This can be changed using the 'set record function-call-history-size' command. Functions are printed in execution order. There are several ways to specify what to print."
                    }
                ]
            }
        ],
        "oneapiCommandsToCompare": [
            {
                "id": "infoThreads_oneapi",
                "command": {
                    "name": "info threads",
                    "chapter": "4.10 – Debugging Programs With Multiple Threads.",
                    "descriptionShort": "A command to inquire about existing threads. Shows additional information – SIMD lane number.",
                    "descriptionLong": "Display information about all threads in three columns: 'ID', 'Target ID', 'Frame'. Can show additional Gid column when use with specifier '-gid'. Command shows additional information on 'ID' column – SIMD lane number. It follows the pattern: id_number:SIMD_lane_number; 1.1:0; 1.3:[0-7]."
                },
                "keyWords": [
                    {
                        "name": "info ",
                        "aliases": "inf, i",
                        "descriptionShort": "Generic command for showing things about the program being debugged."
                    },
                    {
                        "name": "threads",
                        "descriptionShort": "Threads of a single program are akin to multiple processes—except that they share one address space. It's not a standalone function.",
                        "descriptionLong": "In some operating systems, such as GNU/Linux and Solaris, a single program may have more than one thread of execution. The precise semantics of threads differ from one operating system to another, but in general the threads of a single program are akin to multiple processes—except that they share one address space (that is, they can all examine and modify the same variables). On the other hand, each thread has its own registers and execution stack, and perhaps private memory."
                    }
                ]
            },
            {
                "id": "threadId_oneapi",
                "command": {
                    "name": "thread [thread-id:lane]",
                    "chapter": "4.10 – Debugging Programs With Multiple Threads",
                    "descriptionShort": "A command to switch among threads and its SIMD lanes.",
                    "descriptionLong": "Make thread with specified ID the current thread. When SIMD lanes are supported, with this command you can switch the thread's focus from one SIMD lane to another: 'thread 2:3' – switch the lane of a thread 2, to the lane number 3."
                },
                "keyWords": [
                    {
                        "name": "thread ",
                        "descriptionShort": "Manages thread properties. Can be used with 'thread-id', 'apply', 'name', 'find'. Helps user to manage active threads.",
                        "descriptionLong": "In general, the threads of a single program are akin to multiple processes—except that they share one address space (that is, they can all examine and modify the same variables). On the other hand, each thread has its own registers and execution stack, and perhaps private memory."
                    },
                    {
                        "name": "[thread-id",
                        "descriptionShort": "<b>thread ID</b> is ID number of the thread as shown by 'info threads' command."
                    },
                    {
                        "name": ":lane]",
                        "descriptionShort": "<b>Lane</b> is number of SIMD lane."
                    }
                ]
            },
            {
                "id": "threadApply_oneapi",
                "command": {
                    "name": "Thread apply [thread-id-list | all | all-lanes] [flag] [command]",
                    "chapter": "4.10 – Debugging Programs With Multiple Threads.",
                    "descriptionShort": "A command which allow to apply a command to a list of threads specific breakpoints.",
                    "descriptionLong": "The 'thread apply' command allows you to apply the named command to one or more threads. Specify the threads that you want affected using the thread ID list syntax (see thread ID lists) or specify 'all' to apply to all threads. To apply a command to all threads in descending order, type 'thread apply all [command]'. To apply a command to all threads in ascending order, type 'thread apply all -ascending [command]'. If SIMD lanes are supported, the command is applied to all active SIMD lanes within a thread. Specify 'all-lanes' to apply the command to all active SIMD lanes in all threads."
                },
                "keyWords": [
                    {
                        "name": "thread ",
                        "descriptionShort": "Manages thread properties. Can be used with 'thread-id', 'apply', 'name', 'find'. Helps user to manage active threads.",
                        "descriptionLong": "In general, the threads of a single program are akin to multiple processes—except that they share one address space (that is, they can all examine and modify the same variables). On the other hand, each thread has its own registers and execution stack, and perhaps private memory."
                    },
                    {
                        "name": "apply ",
                        "descriptionShort": "Key word using to applying commands to threads or frames. It's not a standalone function."
                    },
                    {
                        "name": "[thread-id-list ",
                        "descriptionShort": "List of numeric values IDs.",
                        "descriptionLong": "'thread-is-list' can be a thread ID with or without an inferior qualifier. E.g., '2.1' or '1' or a range of thread numbers, again with or without an inferior qualifier, as in inf.thr1-thr2 or thr1-thr2. E.g., '1.2-4' or '2-4'. Or it can be all threads of an inferior, specified with a star wildcard, with or without an inferior qualifier, as in inf.* (e.g., '1.*') or *.The former refers to all threads of the given inferior, and the latter form without an inferior qualifier refers to all threads of the current inferior."
                    },
                    {
                        "name": "| all ",
                        "descriptionShort": "Command which uses causes applying [command] to all threads.",
                        "descriptionLong": "To apply a command to all threads in descending order, 'type thread apply all [command]'. To apply a command to all threads in ascending order, type 'thread apply all -ascending [command]."
                    },
                    {
                        "name": "| all-lanes] ",
                        "descriptionShort": "Allows to apply the command to all active SIMD lanes in all threads.",
                        "descriptionLong": "To apply a command to all active lanes in ascending order type 'thread apply all-lanes -ascending [command]'."
                    },
                    {
                        "name": "[flag] ",
                        "descriptionShort": "The flag arguments control what output to produce and how to handle errors raised when applying command to a thread. flag must start with a - directly followed by one letter in 'qcs'. If several flags are provided, they must be given individually, such as '-c' '-q'.",
                        "descriptionLong": "By default, GDB displays some thread information before the output produced by command, and an error raised during the execution of a command will abort thread apply. The following flags can be used to fine-tune this behavior: -c: 'continue', causes any errors in command to be displayed, and the execution of thread apply then continues. -s: 'silent', causes any errors or empty output produced by a command to be silently ignored. That is, the execution continues, but the thread information and errors are not printed. -q: 'quiet' disables printing the thread information. Flags -c and -s cannot be used together."
                    },
                    {
                        "name": "[command]",
                        "descriptionShort": "This is GDB function which user can apply to a thread. For example, if you type 'thread apply all backtrace', GDB will display the backtrace for all the threads."
                    }
                ]
            },
            {
                "id": "commandsList_oneapi",
                "command": {
                    "name": "commands [command-list] end",
                    "chapter": "5.1.7 – Breakpoint Command Lists",
                    "descriptionShort": "Specify a list of commands for the given breakpoints.",
                    "descriptionLong": "Additional modifier exists for this command in GDB-oneAPI - '/a' modifier forces GDB to execute the breakpoint actions for all SIMD lanes which match the condition of the specified breakpoint(s). Note that if there are active lanes which do not match the breakpoint condition, actions are not executed for these lanes."
                },
                "keyWords": [
                    {
                        "name": "commands ",
                        "descriptionShort": "Starts commands chain with the pattern."
                    },
                    {
                        "name": "[command-list] ",
                        "descriptionShort": "List of functions to give to breakpoint and to execute when hit. Placed after 'commands' and before 'end' key words in separate lines.",
                        "descriptionLong": "Type a line containing just 'end' to terminate the commands. With no argument, commands refer to the last break/watch/catchpoint set. If the most recent breakpoints were set with a single command, then the commands will apply to all the breakpoints set by that command. This applies to breakpoints set by rbreak and applies when a single break command creates multiple breakpoints."
                    },
                    {
                        "name": "end",
                        "descriptionShort": "Ends sequence of functions.",
                        "descriptionLong": "Type a line containing just 'end' to terminate the commands. To remove all commands from a breakpoint, type commands and follow it immediately with 'end'."
                    }
                ]
            },
            {
                "id": "recordFunctionCallHistory_oneapi",
                "command": {
                    "name": "record function-call-history",
                    "chapter": "7 – Recording Inferior's Execution and Replaying It.",
                    "descriptionShort": "Prints the execution history at function granularity. Prints auxiliary information which can be disabled by '/s' modifier.",
                    "descriptionLong": "For each sequence of instructions that belong to the same function, it prints the name of that function, the source lines for this instruction sequence (if the '/l' modifier is specified), and the instructions numbers that form the sequence (if the '/I' modifier is specified). The function names are indented to reflect the call stack depth if the '/c' modifier is specified. The '/l', '/i', and '/c' modifiers can be given together. Every use of command prints ten more functions after the last ten-function print. When recording an inferior, GDB may print additional auxiliary information during stepping commands and commands displaying the execution history. Printing auxiliary information is enabled by default and can be omitted with the /s modifier."
                },
                "keyWords": [
                    {
                        "name": "record ",
                        "descriptionShort": "This command starts the process record and replay target.",
                        "descriptionLong": "The recording method can be specified as parameter. Without a parameter the command uses the full recording method. To see the following recording methods, follow documentation link. Some of methods available:  'full', 'btrace', 'stop', 'goto', 'save', 'restore'."
                    },
                    {
                        "name": "function-call-history",
                        "descriptionShort": "Reference to history of calling functions.",
                        "descriptionLong": "By default, ten functions are printed. This can be changed using the 'set record function-call-history-size' command. Functions are printed in execution order. There are several ways to specify what to print."
                    }
                ]
            }
        ],
        "intro_oneapiNewCommands": "3. Table below presents commands added byt GDB-oneAPI distribution and were not included in pure GDB.",
        "oneapiNewCommands": [
            {
                "id": "setScheduleLockingEval_oneapi",
                "command": {
                    "name": "set scheduler-locking-eval",
                    "chapter": "5.5.1 – All-Stop Mode",
                    "descriptionShort": "When on, it prevents thread switching during expression evaluations.",
                    "descriptionLong": "Thus, if the current thread starts an inferior call, other threads are not permitted to run before the call is finished. This setting can be used together with 'set scheduler-locking step mode', so the thread focus does not change unexpectedly."
                },
                "keyWords": [
                    {
                        "name": "set ",
                        "descriptionShort": "Allow user to set different settings all over the program. Use with specific commands."
                    },
                    {
                        "name": "scheduler-locking-eval",
                        "descriptionShort": "Contains scheduler locking evaluation settings."
                    }
                ]
            },
            {
                "id": "showScheduleLockingEval_oneapi",
                "command": {
                    "name": "show scheduler-locking-eval",
                    "chapter": "5.5.1 – All-Stop Mode",
                    "descriptionShort": "Display the current scheduler locking evaluation setting.",
                    "descriptionLong": "Thus, if the current thread starts an inferior call, other threads are not permitted to run before the call is finished. This setting can be used together with 'set scheduler-locking step mode', so the thread focus does not change unexpectedly."
                },
                "keyWords": [
                    {
                        "name": "show ",
                        "descriptionShort": "Allow user to display different set settings all over the program. Use with specific command."
                    },
                    {
                        "name": "scheduler-locking-eval",
                        "descriptionShort": "Contains scheduler locking evaluation settings."
                    }
                ]
            },
            {
                "id": "breakLocationInferior_oneapi",
                "command": {
                    "name": "break [location] inferior [inferior-num] [if [condition]] ",
                    "chapter": "5.5.5 – Inferior-Specific Breakpoints",
                    "descriptionShort": "Function to limit breakpoints to specific inferior program space, which can be especially useful when doing multi-target debugging with some source files shared between targets.",
                    "descriptionLong": "If inferior gets removed while inferior-specific breakpoint is present, a warning will be printed, and the breakpoint will never hit."
                },
                "keyWords": [
                    {
                        "name": "break ",
                        "descriptionShort": "When called without any arguments. Break' sets a breakpoint at the next instruction to be executed in the selected stack frame.",
                        "descriptionLong": "In any selected frame but the innermost, this makes your program stop as soon as control returns to that frame. This is like the effect of a finish' command in the frame inside the selected frame – except that finish' does not leave an active breakpoint. If you use break' without an argument in the innermost frame, GDB stops the next time it reaches the current location.",
                        "aliases": "b, br, bre, brea"
                    },
                    {
                        "name": "[location] ",
                        "descriptionShort": "'break location' set a breakpoint at the given location, which can be specify a function name, a line number or an address of an instruction.",
                        "descriptionLong": "The breakpoint will stop your program just before it executes any of the code in the specified location."
                    },
                    {
                        "name": "inferior ",
                        "descriptionShort": "GDB represents the state of each program execution with an object called an inferior.",
                        "descriptionLong": "An inferior typically corresponds to a process but is more general and applies also to targets that do not have processes. Inferiors may be created before a process runs and may be retained after a process exits. Inferiors have unique identifiers that are different from process ids. Usually, each inferior will also have its own distinct address space, although some embedded targets may have several inferiors running in different parts of a single address space. Each inferior may in turn have multiple threads running in it."
                    },
                    {
                        "name": "[inferior-num] ",
                        "descriptionShort": "'inferior-num' is one of the inferior numbers as shown by info inferior' output. Use the qualifier inferior [inferior-num]' with a breakpoint command to specify that you only want GDB to stop the program if execution happens in a context of the specified inferior.",
                        "descriptionLong": "Inferior specific breakpoint won't be inserted at all for other inferiors and thus won't be shown by the info break' command. You can use the inferior' qualifier with the other qualifiers and conditionals too: (gdb) break frik.c:13 inferior 1 thread 2 if bartab > lim."
                    },
                    {
                        "name": "[if ",
                        "descriptionShort": "This is optional - allow to specify a condition – if condition is specified the breakpoint will be hit only when condition will be true."
                    },
                    {
                        "name": "[condition]]",
                        "descriptionShort": "If condition is specified the breakpoint will be hit only when condition will be true."
                    }
                ]
            },
            {
                "id": "infoCetStatus_oneapi",
                "command": {
                    "name": "info cet status",
                    "chapter": "12.1 – Control-flow Enforcement Debugging",
                    "descriptionShort": "This command prints general status information of CET at the current point of execution.",
                    "descriptionLong": "There is specific output pattern of this command - to se it check documentation."
                },
                "keyWords": [
                    {
                        "name": "info ",
                        "descriptionShort": "Generic command for showing things about the program being debugged.",
                        "aliases": "inf, i"
                    },
                    {
                        "name": "cet ",
                        "descriptionShort": "Control-flow Enforcement Technology (CET) provides two capabilities to defend against “Return-oriented Programming” and “call/jmp-oriented programming” style control-flow attacks: Shadow attack and Indirect Branch Tracking (IBT).",
                        "descriptionLong": "Attack detailed description are attached in the documentation."
                    },
                    {
                        "name": "status",
                        "descriptionShort": "Use it to status inquiries."
                    }
                ]
            },
            {
                "id": "infoCetBacktrace_oneapi",
                "command": {
                    "name": "info cet backtrace",
                    "chapter": "12.1 – Control-flow Enforcement Debugging",
                    "descriptionShort": "This command prints backtrace of the shadow attack for the current running process.",
                    "descriptionLong": "There is specific output pattern of this command - to se it check documentation."
                },
                "keyWords": [
                    {
                        "name": "info ",
                        "descriptionShort": "Generic command for showing things about the program being debugged.",
                        "aliases": "inf, i"
                    },
                    {
                        "name": "cet ",
                        "descriptionShort": "Control-flow Enforcement Technology (CET) provides two capabilities to defend against “Return-oriented Programming” and “call/jmp-oriented programming” style control-flow attacks: Shadow attack and Indirect Branch Tracking (IBT).",
                        "descriptionLong": "Attack detailed description are attached in the documentation."
                    },
                    {
                        "name": "backtrace",
                        "descriptionShort": "It’s a summary of how your program got where it is",
                        "descriptionLong": "It shows one line per frame, for many frames, starting with the currently executing frame (frame zero), followed by its caller (frame one), and up to he stack. To print a backtrace of entire stack, use ‘backtrace’ command. By default, all stack frames are printed. You can stop the backtrace at any time by typing the system interrupt character (ctrl + c).",
                        "aliases": "bt"
                    }
                ]
            },
            {
                "id": "infoTsxAbortReason_oneapi",
                "command": {
                    "name": "info tsx-abort-reason [expression]",
                    "chapter": "12.2 Decoding Abort Reasons of Speculative Execution",
                    "descriptionShort": "This command evaluates/decodes the abort reason into human readable format.",
                    "descriptionLong": "There is specific output pattern of this command - to se it check documentation."
                },
                "keyWords": [
                    {
                        "name": "info ",
                        "descriptionShort": "Generic command for showing things about the program being debugged.",
                        "aliases": "inf, i"
                    },
                    {
                        "name": "tsx-abort-reason ",
                        "descriptionShort": "Intel® TSX (Transactional Synchronization Extensions) feature for GDB adds to the concept of speculative execution.",
                        "descriptionLong": "When a speculative execution is aborted, the aborts reason is encoded in the x86 EAX general register, which can also be stores in some user-created variable. However, this abort reason is not in a human readable format. This command changes this situation."
                    },
                    {
                        "name": "[expression]",
                        "descriptionShort": "It’s any expression, including variables or a general-purpose register such as ‘$EAX’"
                    }
                ]
            },
            {
                "id": "inferiorConnectionShortname_oneapi",
                "command": {
                    "name": "inferior.connection_shortname",
                    "chapter": "24.2.2.16 – Inferiors in Python",
                    "descriptionShort": "Short name of the inferior’s connection, as assigned by GDB."
                },
                "keyWords": [
                    {
                        "name": "inferior.",
                        "descriptionShort": "GDB represents the state of each program execution with an object called an <b>inferior</b>.",
                        "descriptionLong": "An inferior typically corresponds to a process but is more general and applies also to targets that do not have processes. Inferiors may be created before a process runs and may be retained after a process exits. Inferiors have unique identifiers that are different from process ids. Usually, each inferior will also have its own distinct address space, although some embedded targets may have several inferiors running in different parts of a single address space. Each inferior may in turn have multiple threads running in it."
                    },
                    {
                        "name": "connection_shortname",
                        "descriptionShort": "Contains short name of the inferior’s connection, as assigned by GDB."
                    }
                ]
            },
            {
                "id": "inferiorConnectionString_oneapi",
                "command": {
                    "name": "inferior.connection_string",
                    "chapter": "24.2.2.16 – Inferiors in Python",
                    "descriptionShort": "String of the inferior’s connection, as assigned by GDB."
                },
                "keyWords": [
                    {
                        "name": "inferior.",
                        "descriptionShort": "GDB represents the state of each program execution with an object called an <b>inferior</b>.",
                        "descriptionLong": "An inferior typically corresponds to a process but is more general and applies also to targets that do not have processes. Inferiors may be created before a process runs and may be retained after a process exits. Inferiors have unique identifiers that are different from process ids. Usually, each inferior will also have its own distinct address space, although some embedded targets may have several inferiors running in different parts of a single address space. Each inferior may in turn have multiple threads running in it."
                    },
                    {
                        "name": "connection_string",
                        "descriptionShort": "Contains string of the inferior’s connection, as assigned by GDB."
                    }
                ]
            },
            {
                "id": "inferiorConnectionTarget_oneapi",
                "command": {
                    "name": "inferior.connection_target",
                    "chapter": "24.2.2.16 – Inferiors in Python",
                    "descriptionShort": "Target of the inferior’s connection, extracted from connection_string."
                },
                "keyWords": [
                    {
                        "name": "inferior",
                        "descriptionShort": "GDB represents the state of each program execution with an object called an <b>inferior</b>.",
                        "descriptionLong": "An inferior typically corresponds to a process but is more general and applies also to targets that do not have processes. Inferiors may be created before a process runs and may be retained after a process exits. Inferiors have unique identifiers that are different from process ids. Usually, each inferior will also have its own distinct address space, although some embedded targets may have several inferiors running in different parts of a single address space. Each inferior may in turn have multiple threads running in it."
                    },
                    {
                        "name": ".connection_target",
                        "descriptionShort": "Contains target of the inferior’s connection, extracted from connection_string."
                    }
                ]
            },
            {
                "id": "eventsQuit_oneapi",
                "command": {
                    "name": "events.quit()",
                    "chapter": "24.2.2.17 – Events in Python",
                    "descriptionShort": "Emits event.QuitEvent which indicates the exit from GDB."
                },
                "keyWords": [
                    {
                        "name": "events.",
                        "descriptionShort": "GDB provides a general event facility so that Python code can be notified of various state changes, particularly changes that occurs in the inferior.",
                        "descriptionLong": "Its an object that describes some state change. The type of the object and its attributes will vary depending on the details of the change. All the existing events are described in the documentation."
                    },
                    {
                        "name": "quit()",
                        "descriptionShort": "Emits event.QuitEvent which indicates the exit from GDB."
                    }
                ]
            },
            {
                "id": "recordClearTrace_oneapi",
                "command": {
                    "name": "record.clear_trace()",
                    "chapter": "24.2.2.19 –  Recording in Python",
                    "descriptionShort": "Clear the trace data of the current recording. This forces re-decoding of the trace for successive commands."
                },
                "keyWords": [
                    {
                        "name": "record.",
                        "descriptionShort": "GDB provides a general event facility so that Python code can be notified of various state changes, particularly changes that occurs in the inferior.",
                        "descriptionLong": "Its an object that describes some state change. The type of the object and its attributes will vary depending on the details of the change. All the existing events are described in the documentation."
                    },
                    {
                        "name": "clear_trace()",
                        "descriptionShort": "Emits event.QuitEvent which indicates the exit from GDB."
                    }
                ]
            },
            {
                "id": "recordAuxiliaryNumber_oneapi",
                "command": {
                    "name": "recordAuxiliary.number",
                    "chapter": "24.2.2.19 –  Recording in Python",
                    "descriptionShort": "Some GDB features write auxiliary information into the execution history. This information is represented by a gdb.RecordAuxiliary object in the instruction list."
                },
                "keyWords": [
                    {
                        "name": "recordAuxiliary.",
                        "descriptionShort": "Some GDB features write auxiliary information into the execution history. This information is represented by a gdb.RecordAuxiliary object in the instruction list."
                    },
                    {
                        "name": "number",
                        "descriptionShort": "An integer value identifying this auxilliary"
                    }
                ]
            },
            {
                "id": "recordAuxiliaryData_oneapi",
                "command": {
                    "name": "recordAuxiliary.data",
                    "chapter": "24.2.2.19 –  Recording in Python",
                    "descriptionShort": "Some GDB features write auxiliary information into the execution history. This information is represented by a gdb.RecordAuxiliary object in the instruction list. "
                },
                "keyWords": [
                    {
                        "name": "recordAuxiliary.",
                        "descriptionShort": "Some GDB features write auxiliary information into the execution history. This information is represented by a gdb.RecordAuxiliary object in the instruction list."
                    },
                    {
                        "name": "data",
                        "descriptionShort": "An string representation of the auxilliary data."
                    }
                ]
            },
            {
                "id": "gdbPtwrite_oneapi",
                "command": {
                    "name": "gdb.ptwrite",
                    "chapter": "24.2.4 – gdb.ptwrite",
                    "descriptionShort": "This module provides additional functionality for recording programs that makes use of the PTRWITE instruction. PTWRITE is a x86 instruction that allows to write values into the Intel Processor Trace.",
                    "descriptionLong": "If an inferior use the instruction, GDB insert the raw payload value as auxiliary information into the execution history. Auxiliary informations is by default printed during ‘record instruction-history’. ‘record function-call-history; and all stepping commands and is accessible in Python as a ‘RecordAuxilliary’ object."
                },
                "keyWords": [
                    {
                        "name": "gdb.",
                        "descriptionShort": "Object which represents gdb and its functions"
                    },
                    {
                        "name": "ptwrite",
                        "descriptionShort": "PTWRITE is a x86 instruction that allows to write values into the Intel Processor Trace."
                    }
                ]
            },
            {
                "id": "registerListener_oneapi",
                "command": {
                    "name": "register_listener(listener)",
                    "chapter": "24.2.4 – gdb.ptwrite",
                    "descriptionShort": "Used to register the ptwrite listener.",
                    "descriptionLong": "It can return a string, which will be printed by GDB during commands, or None, resulting in n output. None can also be registered to deactivate printing."
                },
                "keyWords": [
                    {
                        "name": "register_listener",
                        "descriptionShort": "Used to register the ptwrite listener.",
                        "descriptionLong": "It can return a string, which will be printed by GDB during commands, or None, resulting in n output. None can also be registered to deactivate printing."
                    },
                    {
                        "name": "(listener)",
                        "descriptionShort": "The listener can be any callable object that accepts two arguments."
                    }
                ]
            },
            {
                "id": "getListener_oneapi",
                "command": {
                    "name": "get_listener()",
                    "chapter": "24.2.4 – gdb.ptwrite",
                    "descriptionShort": "Returns the currently active ptwrite listener function"
                },
                "keyWords": [
                    {
                        "name": "get_listener()",
                        "descriptionShort": "Returns the currently active ptwrite listener function"
                    }
                ]
            },
            {
                "id": "defaultListener_oneapi",
                "command": {
                    "name": "default_listener(payload, ip)",
                    "chapter": "24.2.4 – gdb.ptwrite",
                    "descriptionShort": "The listener function active upon starting GDB by default.",
                    "descriptionLong": "It prints the plain ptwrite payload as hex. The default listener can be overwritten by registering a custom listener in python or by registering 'None', for no output at all. Registering a listener function creates per thread copies to allow unique internal states per thread."
                },
                "keyWords": [
                    {
                        "name": "default_listener",
                        "descriptionShort": "The listener function active upon starting GDB by default."
                    },
                    {
                        "name": "(payload, ",
                        "descriptionShort": "Payload of the listener."
                    },
                    {
                        "name": "ip)",
                        "descriptionShort": "Hex value presented with listener payload."
                    }
                ]
            },
            {
                "id": "mianJitDump_oneapi",
                "command": {
                    "name": "maint jit dump [addr] [filename]",
                    "chapter": "Appendix D: Maintenance Commands",
                    "descriptionShort": "Dump the in-memory JIT object containing <b>[addr]</b> into <b>[filename]</b>.",
                    "descriptionLong": "It prints the plain ptwrite payload as hex. The default listener can be overwritten by registering a custom listener in python or by registering 'None', for no output at all. Registering a listener function creates per thread copies to allow unique internal states per thread."
                },
                "keyWords": [
                    {
                        "name": "maint ",
                        "descriptionShort": "command which stands for 'maintenance' and lets user to access maintenance methods."
                    },
                    {
                        "name": "jit ",
                        "descriptionShort": "A JIT (just-in-time) compiler is a program or library that generates native executable code at runtime and executes it, usually to achieve good performance while maintaining platform independence",
                        "descriptionLong": "Programs that use JIT compilation are normally difficult to debug because portions of their code are generated at runtime, instead of being loaded from object files, which is where GDB normally finds the program’s symbols and debug information."
                    },
                    {
                        "name": "dump ",
                        "descriptionShort": "Command used with specific commands to dump unused stuff."
                    },
                    {
                        "name": "[addr] ",
                        "descriptionShort": "Address of in-memory JIT object."
                    },
                    {
                        "name": "[filename]",
                        "descriptionShort": "Filename to which in-memory JIT object will be dumped."
                    }
                ]
            }
        ]
    };

    const ALL_GDB_COMMANDS = [
        USER_HELP.gdbCommandsToCompare,
        USER_HELP.oneapiCommandsToCompare,
        USER_HELP.oneapiNewCommands
    ];

    let CLICK_MODAL_COUNT = 0;
    let Z_INDEX = 2;
    let ACTIVE_MODALS = [];

    function RUN_SCRIPT() {
        let commandWordsIds = composeCommandWordIds();
        setEventListeners(commandWordsIds);
    }

    function composeCommandWordIds() {
        const commandWordsIds = [];
        for (const collection of ALL_GDB_COMMANDS) {
            for (const command of collection) {
                for (const keyWord of command.keyWords) {
                    // getting all id's creating them in the same way how they had been created in src/UserHelp.ts
                    const spanId = `${keyWord.name.replace(/[^a-zA-Z-_]/g, '')}_${command.id}`;
                    commandWordsIds.push(spanId);
                }
            }
        }
        return commandWordsIds;
    }

    function setEventListeners(commandWordsIds) {
        // Set listeners for commands tds
        for (const collection of ALL_GDB_COMMANDS) {
            for (const command of collection) {
                htmlObjectCommand = document.getElementById(command.id);

                htmlObjectCommand.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (e.target.nodeName === "TD") {
                        const commandId = e.target.id;
                        const activeCommand = getItemFromJson(commandId, '', false);
                        const modal = createModal(commandId, activeCommand, false, true);
                        showModal(modal, e);
                    }
                });

                htmlObjectCommand.addEventListener('mouseenter', (e) => {
                    e.stopPropagation();
                    if (e.target.nodeName === "TD") {
                        const commandId = e.target.id;
                        const activeCommand = getItemFromJson(commandId, '', false);
                        const modal = createModal(commandId, activeCommand, true, true);
                        modal.addEventListener("mouseleave", (e) => modal.remove());
                        showModal(modal, e);
                    }
                });
            }
        }

        // Set listeners for buttons
        for (const collection of [USER_HELP.gdbCommandsToCompare, USER_HELP.oneapiCommandsToCompare]) {
            for (command of collection) {
                htmlObjectButtonToDocs = document.getElementById(`docButton_${command.id}`);

                htmlObjectButtonToDocs.addEventListener("click", (e) => {
                    // Need to reference to sibling to get to different commands - command.id leads always to last command in collection
                    const commandId = e.target.parentNode.previousElementSibling.id;
                    const activeCommand = getItemFromJson(commandId, '', false);
                    // console.log(`Button ${e.target.id} clicked and command ${activeCommand.name} appeared in docs`);
                    e.target.outerHTML = activeCommand.command['link'] ? `<p><a href=${activeCommand.command.link}>LINK</a></p>` : `<p>Chapter: ${activeCommand.command.chapter}</p>`;
                });
            }
        }

        // Set listeners for keyWords spans
        for (id of commandWordsIds) {
            htmlObjectKeyWord = document.getElementById(id);

            htmlObjectKeyWord.addEventListener("click", (e) => {
                e.stopPropagation();
                const keyWord = e.target.innerHTML;
                const commandId = e.target.parentNode.id;
                const activeKeyWord = getItemFromJson(commandId, keyWord, true);
                const modal = createModal(commandId, activeKeyWord, false, false);
                showModal(modal, e);
            });

            htmlObjectKeyWord.addEventListener("mouseenter", (e) => {
                e.stopPropagation();
                const keyWord = e.target.innerHTML;
                const commandId = e.target.parentNode.id;
                const activeKeyWord = getItemFromJson(commandId, keyWord, true);
                const modal = createModal(commandId, activeKeyWord, true, false);
                modal.addEventListener("mouseleave", (e) => modal.remove());
                showModal(modal, e);
            });
        }
    }

    function getItemFromJson(commandId, keyWord, isKeyWord) {
        for (const collection of ALL_GDB_COMMANDS) {
            for (const command of collection) {
                if (command.id === commandId) {
                    if (isKeyWord) {
                        for (word of command.keyWords) {
                            if (word.name === keyWord) {
                                return word;
                            }
                        }
                    }
                    return command;
                }
            }
        }
        console.error(`Function 'getItemFromJson' couldn't find item: ${item}`);
    }

    function createModal(commandId, item, isHover, isCommand) {
        const modal = document.createElement('div');
        const closeMark = document.createElement('div');
        const name = document.createElement('div');
        const description = document.createElement('div');
        const aliases = document.createElement('div');

        if (isCommand){
            item = item.command;
        }

        name.innerHTML = isCommand ? item.name : item.name.replace(/[^a-zA-Z-_]/g, '');
        description.innerHTML = `<p>${item.descriptionShort}</p><p>${!isHover && item['descriptionLong'] ? item['descriptionLong'] : ''}</p>`;
        aliases.innerHTML = `Aliases: ${item['aliases'] ? item['aliases'] : '-no-aliases-'}`;

        let id = '';

        if (isHover) {
            id = 'helpTextModal_hover';
        } else {
            if(isCommand){
                id = `helpTextModal_click_${commandId}`;
            }else{
                id = `helpTextModal_click_${name.innerHTML}_${commandId}`;
            }
        }

        const hoverModal = document.getElementById('helpTextModal_hover');
        if (hoverModal) {
            hideModal(hoverModal);
        }

        const oldModal = document.getElementById(id);
        if (oldModal) {
            hideModal(oldModal);
        }

        Z_INDEX = Z_INDEX < 120 && Z_INDEX >= 2 ? (Z_INDEX + 1) : 2;
        modal.style['z-index'] = Z_INDEX;
        modal.style['position'] = 'absolute';
        modal.style['font-family'] = 'Consolas';
        modal.style['border'] = '1px solid gray';
        modal.style['background-color'] = 'darkslategray';
        modal.style['max-width'] = '500px';

        name.style['font-weight'] = 'bolder';
        name.style['text-align'] = 'center';
        name.style['padding'] = '5px';
        name.style['border-bottom'] = '1px dotted lightgrey';

        description.style['width'] = 'fit-content';
        description.style['text-align'] = 'justify';
        description.style['padding'] = '5px';
        description.style['border-bottom'] = '1px dotted lightgrey';

        aliases.style['font-style'] = 'italic';
        aliases.style['text-align'] = 'left';
        aliases.style['padding'] = '5px';

        closeMark.style['width'] = '100%';
        closeMark.style['height'] = '20px';
        closeMark.style['margin-top'] = '-25px';
        closeMark.style['text-align'] = 'end';
        closeMark.style['color'] = 'white';
        closeMark.style['cursor'] = 'pointer';
        closeMark.innerHTML = `close X`;
        closeMark.addEventListener("click", () => hideModal(modal));
        closeMark.addEventListener("mouseover", () => closeMark.style['color'] = 'red');
        closeMark.addEventListener("mouseout", () => closeMark.style['color'] = 'white');

        modal.appendChild(name);
        modal.appendChild(description);
        modal.appendChild(aliases);

        if (!isHover) {
            modal.appendChild(closeMark);
        }

        modal.id = id;
        return modal;
    }

    function showModal(modal, event) {
        document.body.appendChild(modal);
        modal.style.left = `${event.clientX}px`;
        modal.style.top = `${event.clientY+window.scrollY}px`;
        modal.style.display = 'block';
        document.body.appendChild(modal);
    }

    function hideModal(modal) {
        modal.style.display = 'none';
        modal.remove();
    }

    document.addEventListener('DOMContentLoaded', RUN_SCRIPT);
})();
