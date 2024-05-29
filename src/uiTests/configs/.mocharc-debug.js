module.exports = {
    timeout: 99999999,
    reporter: "mocha-multi-reporters",
    reporterOptions: {
        "reporterEnabled": "spec, mocha-junit-reporter",
        "mochaJunitReporterReporterOptions": {
            "mochaFile": "vsCodeUiTestResults.xml"
        }
    }
}