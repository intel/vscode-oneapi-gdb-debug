module.exports = {
    timeout: 99999999,
    reporter: "mocha-multi-reporters",
    reporterOptions: {
        "reporterEnabled": "spec, src/uiTests/utils/mocha-junit-reporter",
        "srcUiTestsUtilsMochaJunitReporterReporterOptions": {
            "mochaFile": "vsCodeUiTestResults.xml"
        }
    }
}