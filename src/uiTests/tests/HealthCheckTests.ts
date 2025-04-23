import { By, Workbench } from "vscode-extension-tester";
import { InitDefaultEnvironment, Retry, SetInputText, Wait } from "../utils/CommonFunctions";
import { TestOptions } from "../utils/Types";
import { LoggerAggregator as logger } from "../utils/Logger";
import { assert } from "chai";

export default function(options: TestOptions) {
    describe("Debugger Health Checks for oneAPI", () => {
        it("Debugger Health Checks for oneAPI displays expected info", async function() {
            this.timeout(this.test?.ctx?.defaultTimeout * 3);
            await HealthChecksPaneTests(options);
        });
    });
}

async function HealthChecksPaneTests(options: TestOptions): Promise<void> {
    type HealthCheck = {
        label: string;
        result: string | undefined;
        details: string;
    }

    await InitDefaultEnvironment();
    await Wait(3 * 1000);
    await SetInputText("> Intel oneAPI: Focus Debugger Healths Checks and Run");
    await Wait(5 * 1000);
    const driver = new Workbench().getDriver();
    const rows = await driver.findElements(By.xpath("//*[contains(@id, 'list_id_')]"));

    for (const row of rows) {
        const id = await row.getAttribute("id");
        const dataLastElement = await row.getAttribute("data-last-element");

        if (/^list_id_\d+_\d+$/.test(id)) {
            await row.click();
        }
        if (dataLastElement === "true") {
            break;
        }
    }
    const rowsExpanded = await driver.findElements(By.css(".monaco-icon-label.custom-view-tree-node-item-resourceLabel"));
    let skipNext = false;
    const healthChecks: HealthCheck[] = [];

    for (const [index, row] of rowsExpanded.entries()) {
        if (skipNext) {
            skipNext = false;
            continue;
        }
        const label = await row.findElement(By.css(".monaco-highlighted-label")).getText();
        const result = (await Retry(async() => await row.findElement(By.css(".label-description")).getText(), 1000, false, false))?.trim();
        const parent = await row.findElement(By.xpath("ancestor::node()[3]"));
        const expanded = await parent.getAttribute("aria-expanded");
        let details = "";

        if (expanded === "true") {
            details = (await rowsExpanded[index + 1].findElement(By.css(".monaco-highlighted-label")).getText()).trim();
            skipNext = true;
        }
        const healthCheck: HealthCheck = {
            label,
            result,
            details
        };

        logger.Info(JSON.stringify(healthCheck));
        healthChecks.push(healthCheck);
    }

    assert.isTrue(healthChecks.slice(1).every(x => x.result === "PASS"), `Health check failed! ${healthChecks.slice(1).filter(x => x.result !== "PASS").map(x => `${x.label}: ${x.result}`).join(", ")}`);
    logger.Pass("All health checks passed!");
}
