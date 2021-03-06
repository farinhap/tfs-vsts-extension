The Kiuwan extension for FTS and VSTS includes 2 new build tasks to run Kiuwan analyses as part of your application builds. In this latest version we have added visual extensions to show results in the build's summary tab and specific Kiuwan tabs with more result details of baselina and delivery analyses. Including links to go to see the full reports in Kiuwan directly from the build screens.

You can, as well, define a Kiuwan service endpoint. This will allow you to store you Kiuwan credentials at the project level. At the same time this service endpoint allows the extension to get information from your Kiuwan account to provide new exciting features and more to come.


## What you need to know before installing it ##

**NOTE: For TFS 2015 (update 2 and up) you need version 2.2015.1 of the extension. You can [download a zip file with the VSIX file](https://www.kiuwan.com/pub/tfs2015/kiuwan-publisher.kiuwan-analysis-extension-2.2015.4.vsix.zip) from Kiuwan**

This extension works with the Kiuwan Application Security platform. So you need a Kiuwan account in our cloud service, or an on-premises installation of the Kiuwan platform, to use it.

The included build tasks will work on Windows, Linux or MacOS TFS agents and VSTS private or hosted Windows, Linux and MacOS agents.

For TFS and VSTS private agents, you don't need to pre-install the Kiuwan Local Analyzer (KLA). The first time you run a Kiuwan task the KLA will be downloaded and installed in the agent tools directory that ran the Kiuwan build task. Next time the same agent runs a Kiuwan task it will use that installation. However, if you tighter control, you can download the Kiuwan Local Analyzer (KLA) from your Kiuwan account and pre-install it in the agent machines you want to use. Make sure you define the KIUWAN_HOME environment variable pointing to the directory where you installed the KLA (i.e. C:\KiuwanLocalAnalyzer).

If the Agent.TempDirectory and the the Agent.ToolsDirectory variables are not set in your private agents they are set by the build tasks to ${Agent.HomeDirectory}/_temp and ${Agent.ToolsDirectory}/_tools respectively for the tasks to work properly.

For hosted agents (that are spawned dynamically), the KLA is downloaded and installed every time a Kiuwan task runs.

## What you get with the extension ##

A service endpoint type and 2 build tasks. One to run Kiuwan baseline analyses to analyze your releases. And one to run Kiuwan delivery analyses for your change or pull requests.

- **New Service Endpoint type.** To connect to the Kiuwan platform form TFS/VSTS. Now you can define a new service endpoint to the Kiuwan platform. You just need to select the Kiuwan Platform service connection type from the "New Service Endpoint" pulldown in the TFS/VSTS Services configuration tab.

<img src="https://www.kiuwan.com/wp-content/uploads/2018/03/vsts-services.png">

<img src="https://www.kiuwan.com/wp-content/uploads/2018/03/new-service-endpoint.png">

Then you just configure a name for the Kiuwan connection, the URL of the Kiuwan platform you are using (cloud or on-premises) and your Kiuwan account credentials to use to connect to Kiuwan.

<img src="https://www.kiuwan.com/wp-content/uploads/2018/03/kiuwan-endpoint-config.png">

### **NOTE**: Kiuwan credentials for your build tasks
You can now configure the Kiuwan connection in your existing tasks. The credentials configured the selected Kiuwan connection will be used to run the analysis. For backward compatibility, if you don't configure the Kiuwan connection in the task, the build definition variables: KiuwanUser and KiuwanPasswd, will be use for credentials. These variables can be used as well to override the Kiuwan connection credentials. This can be useful if you want a particular build definition to run analyses with a different user.

<img src="https://www.kiuwan.com/wp-content/uploads/2018/01/kiuwan-tasks.png">

- **Kiuwan Baseline Analysis.** This task will run a Kiuwan baseline analysis as part of your build definition. The results are automatically uploaded to your Kiuwan account in the cloud where you can see the results and browse through the security vulnerabilities and other relevant defects  found in your applications.

<img src="https://www.kiuwan.com/wp-content/uploads/2018/01/analysis-results.png">

After the build finishes completely, you can see a summary of the Code Security and Code Analysis results in a Kiuwan specific section in the build summary page. Additionaly you can see more details in a specific Kiuwan tab. A link to all the results in Kiuwan is available from both visual extensions.

<img src="https://www.kiuwan.com/wp-content/uploads/2018/11/kiuwan-baseline-tab.png">

- **Kiuwan Delivery Analysis.** To use this task you need to have the Life Cycle module in your Kiuwan account. It allows you to audit the deliveries of you application's change requests. The task runs a Kiuwan delivery analysis as part of your build definition. The results are automatically uploaded to your Kiuwan account and the defined audit is ran comparing the results with the latest existing application baseline. The OK or Not OK (OK/NOK) audit result is what the task will return, failing or not failing your build definition execution.

<img src="https://www.kiuwan.com/wp-content/uploads/2018/01/kiuwan-audit-results.png">

After the build finishes completely, you can see the resultof the audit directly in a Kiuwan specific section in the build summary page. Additionally there is a new Kiuwan audit tab to see por details about the aduit checkpoins that failed. A link to the complete Kiuwan audit report is available from both visual extensions.

<img src="https://www.kiuwan.com/wp-content/uploads/2018/11/kiuwan-audit-tab.png">

### **NOTE**: Kiuwan application selection
By default, we use the project name as the application name in Kiuwan the results are uploaded to. However, you can override this behavior in a task, picking the application from a list with the existing applications in your Kiuwan account (bear in mind than the application list in the combo depend on the permissions the Kiuwan user defined in the Kiuwan connection), or entering a new application name.
