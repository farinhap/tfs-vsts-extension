import os = require('os');
import url = require('url');
import tl = require('vsts-task-lib/task');
import { buildKlaCommand, setAgentTempDir, setAgentToolsDir, downloadInstallKla, runKiuwanLocalAnalyzer, getKiuwanRetMsg, auditFailed, getLastAnalysisResults, saveKiuwanResults, uploadKiuwanResults, noFilesToAnalyze } from 'kiuwan-common/utils';
import { _exist } from 'vsts-task-lib/internal';
import { debug } from 'vsts-task-tool-lib';
import { isUndefined } from 'util';

var osPlat: string = os.platform();
var agentHomeDir = tl.getVariable('Agent.HomeDirectory');
var agentTempDir = tl.getVariable('Agent.TempDirectory');
if (!agentTempDir) {
    agentTempDir = setAgentTempDir(agentHomeDir, osPlat);
}
var agentToolsDir = tl.getVariable('Agent.ToolsDirectory');
if (!agentToolsDir) {
    agentToolsDir = setAgentToolsDir(agentHomeDir, osPlat);
}
const toolName = 'KiuwanLocalAnalyzer';
const toolVersion = '1.0.0';

async function run() {
    try {
        // Default technologies to analyze
        let technologies = 'abap,actionscript,aspnet,c,cobol,cpp,csharp,html,java,javascript,jcl,jsp,natural,objectivec,oracleforms,perl,php,powerscript,python,rpg4,ruby,swift,vb6,vbnet,xml';

        // Get the values from the task's inputs by the user
        let changeRequest = tl.getInput('changerequest');
        let failOnAudit = tl.getBoolInput('failonaudit');
        let failOnNoFiles = tl.getBoolInput('failonnofiles');

        let skipclones = tl.getBoolInput('skipclones');
        let ignoreclause: string = "";
        if (skipclones) {
            ignoreclause = "ignore=clones,architecture,insights";
        }
        else {
            ignoreclause = "ignore=architecture,insights";
        }

        let analysisScope = tl.getInput('analysisscope');
        let crStatus = tl.getInput('crstatus');
        let encoding = tl.getInput('encoding');
        let includePatterns = tl.getInput('includepatterns');
        if (includePatterns === null) {
            includePatterns = "**/*";
        }
        let excludePatterns = tl.getInput('excludepatterns');
        let memory = tl.getInput('memory');
        memory += 'm';
        let timeout = Number(tl.getInput('timeout'));
        timeout = timeout * 60000
        let dbanalysis = tl.getBoolInput('dbanalysis');
        if (dbanalysis) {
            let dbtechnology = tl.getInput('dbtechnology');
            technologies += ',' + dbtechnology;
            debug(`Including database technology: ${dbtechnology}`);
            debug(`Analyzing technologies: ${technologies}`);
        }

        // Get the Kiuwan connection service authorization
        let kiuwanConnection = tl.getInput("kiuwanConnection", true);

        // For DEBUG mode only since we dont have a TFS EndpointUrl object available
        // let kiuwanUrl = url.parse("https://www.kiuwan.com/");
        let kiuwanUrl: url.Url = url.parse(tl.getEndpointUrl(kiuwanConnection, false));

        let kiuwanEndpointAuth = tl.getEndpointAuthorization(kiuwanConnection, true);
        // Get user and password from variables defined in the build, otherwise get them from
        // the Kiuwan service endpoint authorization
        let kiuwanUser = tl.getVariable('KiuwanUser');
        if (kiuwanUser === undefined || kiuwanUser === "") {
            kiuwanUser = kiuwanEndpointAuth.parameters["username"];
        }
        let kiuwanPasswd = tl.getVariable('KiuwanPasswd');
        if (kiuwanPasswd === undefined || kiuwanPasswd === "") {
            kiuwanPasswd = kiuwanEndpointAuth.parameters["password"];
        }

        // Get other relevant Variables from the task
        let buildNumber = tl.getVariable('Build.BuildNumber');
        let branch = tl.getVariable('Build.SourceBranch');
        let branchName = tl.getVariable('Build.SourceBranchName');
        let deliveryLabel = "";
        /**
         * Build.Reason Possible values
         * 
         * Manual: A user manually queued the build.
         * IndividualCI: Continuous integration (CI) triggered by a Git push or a TFVC check-in.
         * BatchedCI: Continuous integration (CI) triggered by a Git push or a TFVC check-in, and the Batch changes was selected.
         * Schedule: Scheduled trigger.
         * ValidateShelveset: A user manually queued the build of a specific TFVC shelveset.
         * CheckInShelveset: Gated check-in trigger.
         * PullRequest: The build was triggered by a Git branch policy that requires a build.
         * BuildCompletion: The build was triggered by another build
         **/
        let buildReason = isUndefined( tl.getVariable("Build.Reason") ) ? "Manual" : tl.getVariable("Build.Reason");

        console.log(`BuildReason: ${buildReason}`);

        // Build.Repository.Provider possible values: TfsGit, TfsVersionControl, Git, GitHub, Svn
        let repositoryType = tl.getVariable("Build.Repository.Provider");
        switch (repositoryType) {
            case "TfsVersionControl": {
                let ChangeSet = tl.getVariable("Build.SourceVersion"); // Tfvc
                let ChangeSetMsg = tl.getVariable("Build.SourceVersionMessage"); // Tfvc
                let shelveSet = tl.getVariable("Build.SourceTfvcShelveset"); //Tfvc
                if (buildReason === "ValidateShelveset" || buildReason === "CheckInShelveset") {
                    deliveryLabel = `${shelveSet} Build ${buildNumber}`;
                }
                else if (buildReason.includes("CI")) {
                    deliveryLabel = `C${ChangeSet}: ${ChangeSetMsg} Build: ${buildNumber}`;
                }
                else {
                    deliveryLabel = `${branchName} Build ${buildNumber}`;
                }
                break;
            }
            case "Git":
            case "GitHub":
            case "TfsGit": {
                let commitId = tl.getVariable("Build.SourceVersion"); // Git
                let commitMsg = tl.getVariable("Build.SourceVersionMessage"); // Git
                if (buildReason === "PullRequest" || buildReason.includes("CI")) {
                    deliveryLabel = `${commitId}: ${commitMsg} Build ${buildNumber}`;
                }
                else {
                    deliveryLabel = `${branchName} Build ${buildNumber}`;
                }
                break;
            }
            case "Svn": {
                deliveryLabel = `${branchName} Build ${buildNumber}`;
                break;
            }
            default:
                deliveryLabel = `${branchName} Build ${buildNumber}`;
        }

        // Now the project name may come from different sources
        // the System.TeamProject variable, an existing Kiuwan app name or a new one
        let projectSelector = tl.getInput('projectnameselector');
        let projectName = '';
        if (projectSelector === 'default') {
            projectName = tl.getVariable('System.TeamProject');
            console.log(`Kiuwan application from System.TeamProject: ${projectName}`);
        }
        if (projectSelector === 'kiuwanapp') {
            projectName = tl.getInput('kiuwanappname');
            console.log(`Kiuwan application from Kiuwan app list: ${projectName}`);
        }
        if (projectSelector === 'appname') {
            projectName = tl.getInput('customappname');
            console.log(`Kiuwan application from user input: ${projectName}`);
        }

        let sourceDirectory = tl.getVariable('Build.SourcesDirectory');
        // Change the source directory to the alternate, if set for partial deliveries
        if (analysisScope === "partialDelivery") {
            let altSourceDirectory = tl.getInput('alternativesourcedir');
            if (altSourceDirectory !== undefined || altSourceDirectory !== "") {
                sourceDirectory = altSourceDirectory;
            }
        }

        let agentName = tl.getVariable('Agent.Name');

        let kla = 'Not installed yet';

        // We treat al agents equal now:
        // Check if the KLA is already installed, either because the KIUWAN_HOME variable
        // is set or because it was installed by a previous task execution.
        var kiuwanHome: string;
        kiuwanHome = tl.getVariable('KIUWAN_HOME');

        if (kiuwanHome !== undefined && kiuwanHome !== "") {
            let klaDefaultPath = 'KiuwanLocalAnalyzer';
            let hasDefaultPath = kiuwanHome.endsWith(klaDefaultPath);
            console.log(`Kiuwan_HOME env variable defined: ${kiuwanHome}`);
            kiuwanHome = hasDefaultPath ? kiuwanHome.substring(0, kiuwanHome.lastIndexOf(klaDefaultPath)) : kiuwanHome;
            kla = await buildKlaCommand(kiuwanHome, osPlat);
        }
        else {
            // Check if it is installed in the Agent tools directory from a previosu task run
            // It will download and install it in the Agent Tools directory if not found
            let klaInstallPath = await downloadInstallKla(kiuwanConnection, toolName, toolVersion, osPlat);

            // Get the appropriate kla command depending on the platform
            kla = await buildKlaCommand(klaInstallPath, osPlat);
        }

        let advancedArgs = "";
        let overrideDotKiuwan: boolean = tl.getBoolInput('overridedotkiuwan');

        if (overrideDotKiuwan) {
            advancedArgs = `.kiuwan.analysis.excludesPattern=${excludePatterns} ` +
                `.kiuwan.analysis.includesPattern=${includePatterns} ` +
                `.kiuwan.analysis.encoding=${encoding}`;
        }
        else {
            advancedArgs = `exclude.patterns=${excludePatterns} ` +
                `include.patterns=${includePatterns} ` +
                `encoding=${encoding}`;
        }

        let klaArgs: string =
            `-n "${projectName}" ` +
            `-s "${sourceDirectory}" ` +
            `-l "${deliveryLabel}" ` +
            `-as ${analysisScope} ` +
            `-crs ${crStatus} ` +
            `-cr "${changeRequest}" ` +
            `-bn "${branch}" ` +
            '-wr ' +
            `--user ${kiuwanUser} ` +
            `--pass ${kiuwanPasswd} ` +
            `${advancedArgs} ` +
            `supported.technologies=${technologies} ` +
            `memory.max=${memory} ` +
            `timeout=${timeout} ` +
            `${ignoreclause}`;

        console.log('Running Kiuwan analysis');

        console.log(`${kla} ${klaArgs}`);
        let kiuwanRetCode: Number = await runKiuwanLocalAnalyzer(kla, klaArgs);

        let kiuwanMsg: string = getKiuwanRetMsg(kiuwanRetCode);

        if (kiuwanRetCode === 0 || auditFailed(kiuwanRetCode)) {
            let kiuwanEndpoint = `/saas/rest/v1/apps/${projectName}/deliveries?changeRequest=${changeRequest}&label=${deliveryLabel}`;
            let kiuwanDeliveryResult = await getLastAnalysisResults(kiuwanUrl, kiuwanUser, kiuwanPasswd, kiuwanEndpoint);

            tl.debug(`[KW] Result of last delivery for ${projectName}: ${kiuwanDeliveryResult}`);

            const kiuwanResultsPath = saveKiuwanResults(`${kiuwanDeliveryResult}`, "delivery");

            uploadKiuwanResults(kiuwanResultsPath, 'Kiuwan Delivery Results', "delivery");
        }

        if (kiuwanRetCode === 0) {
            tl.setResult(tl.TaskResult.Succeeded, kiuwanMsg);
        }
        else {
            if (auditFailed(kiuwanRetCode) && !failOnAudit) {
                tl.setResult(tl.TaskResult.Succeeded, kiuwanMsg);
            }
            else {
                if (noFilesToAnalyze(kiuwanRetCode) && !failOnNoFiles) {
                    tl.setResult(tl.TaskResult.Succeeded, kiuwanMsg);
                }
                else {
                    tl.setResult(tl.TaskResult.Failed, kiuwanMsg);
                }
            }
        }
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
        console.error('Task failed: ' + err.message);
    }
}

run();