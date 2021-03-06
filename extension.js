'use strict';
var path = require('path');
var vscode = require('vscode');
var vscode_languageclient = require('vscode-languageclient');
function activate(context) {
    console.log("Activated");
    var serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
    var debugOptions = { execArgv: ["--nolazy", "--debug=6004"] };
    var serverOptions = {
        run: { module: serverModule, transport: vscode_languageclient.TransportKind.ipc },
        debug: { module: serverModule, transport: vscode_languageclient.TransportKind.ipc, options: debugOptions }
    };
    // Options to control the language client
    var clientOptions = {
        // Register the server for plain text documents
        documentSelector: ['javascript'],
        synchronize: {
            // Synchronize the setting section 'languageServerExample' to the server
            configurationSection: 'orionToolsServer',
            // Notify the server about file changes to '.clientrc files contain in the workspace
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
        }
    };
    // Create the language client and start the client.
    var client = new vscode_languageclient.LanguageClient('orion-tools-server', serverOptions, clientOptions);
    var disposable = client.start();
    // Push the disposable to the context's subscriptions so that the 
    // client can be deactivated on extension deactivation
    
  
    var errorBugs = [];
    var warningBugs = [];
    var firstTime = true;
    var statusBarE = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    var statusBarW = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    var lintWindow = vscode.window.createOutputChannel("Orion Linter");
    var lastJob = null;
    
    statusBarE.command = "orion.JumpToError";
    statusBarW.command = "orion.JumpToWarning";
    var errorDecoration = vscode.window.createTextEditorDecorationType({
        gutterIconPath: path.join(__dirname+"/error.svg"),
        borderWidth:"0px 0px 1px 0px",
        borderColor:"#ff2052",
        borderRadius:"1px",
        borderStyle:"solid",
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        overviewRulerColor: "#ff2052"
    });
    
    var warningDecoration = vscode.window.createTextEditorDecorationType({
        gutterIconPath: path.join(__dirname+"/warning.svg"),
        borderWidth:"0px 0px 1px 0px",
        borderColor:"#fdee00",
        borderRadius:"1px",
        borderStyle:"solid",
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        overviewRulerColor: "#ff2052"
    })
    client.onNotification({method:"testNotification"}, function(output){
        
        var status = output.pop();
        var tempE = status.errorNum <= 1 ? "JSError: " : "JSErrors: "; 
        var tempW = status.warningNum <= 1 ? "JSWarning: " : "JSWarnings: ";
        var tempIconE = status.errorNum === 0 ? "$(check) " : "$(issue-opened) ";
        var tempIconW = status.warningNum === 0 ? "$(check) " : "$(alert) ";
        statusBarE.text = tempIconE + tempE + status.errorNum;
        statusBarW.text = tempIconW + tempW + status.warningNum;
        
        var messageToShow = "";
        lintWindow.show(true);
        if (lastJob !== null) {
            clearTimeout(lastJob);
        }
        output.sort(function(a, b){
           if (a.range.start.line > b.range.start.line){
               return 1;
           } else if (a.range.start.line === b.range.start.line){
               if(a.range.start.character > b.range.start.character){
                   return 1;
               } else if (a.range.start.character === b.range.start.character){
                   return 0;
               } else {
                   return -1;
               }
           } else {
               return -1;
           }
        });
        
        errorBugs = [];
        warningBugs = [];
        var errRanges = [];
        var warningRanges = [];
        for(var p = 0; p < output.length; p++){
            var problem = output[p];
            var tempStart = new vscode.Position(problem.range.start.line, problem.range.start.character);
            var tempEnd = new vscode.Position(problem.range.end.line, problem.range.end.character);
            messageToShow = messageToShow + "[ORION] " + tempStart.line + ":" + tempStart.character + " " + problem.rawMessage + "\n";

            if (problem.severity <= 1){
                errRanges.push({range : new vscode.Range(tempStart, tempEnd), hoverMessage:problem.message});
                errorBugs.push({range : new vscode.Range(tempStart, tempEnd), label:"[ORION] " + tempStart.line + ":" + tempStart.character + " " + problem.rawMessage});
            } else {
                warningRanges.push({range : new vscode.Range(tempStart, tempEnd), hoverMessage:problem.message, label:"[ORION] " + tempStart.line + ":" + tempStart.character + " " + problem.rawMessage});
                warningBugs.push({range : new vscode.Range(tempStart, tempEnd), label:"[ORION] " + tempStart.line + ":" + tempStart.character + " " + problem.rawMessage});
            }
        }
        
        vscode.window.activeTextEditor.setDecorations(errorDecoration, errRanges);
        vscode.window.activeTextEditor.setDecorations(warningDecoration, warningRanges);
        if ((status.errorNum + status.warningNum) === 0 && !firstTime){
            lintWindow.clear();
            lintWindow.append("No Errors and Warnings");
            lintWindow.hide(); // This method does not work as expected: it is not hiding the outputchannel
            
        } else if ((status.errorNum + status.warningNum) > 0 ) {
            lastJob = setTimeout(function() {
                lintWindow.clear();
                lintWindow.append(messageToShow);
            }, 500);
        }
        
        if (firstTime){  
            statusBarE.color = "#faebd7";
            statusBarW.color = "#faebd7";
            statusBarE.show();
            statusBarW.show();
            firstTime = false;
        }
    });
    
    var orionLintJumpToErrorCommand = vscode.commands.registerCommand("orion.JumpToError", function(){
        if (errorBugs.length > 0){
            vscode.window.showQuickPick(errorBugs, {
                onDidSelectItem: function(bug){
                    vscode.window.activeTextEditor.selection = new vscode.Selection(bug.range.start, bug.range.end);
                    vscode.window.activeTextEditor.revealRange(bug.range);
                }
            });
        }
    });
    
    var orionLintJumpToWarningCommand = vscode.commands.registerCommand("orion.JumpToWarning", function(){
        if (warningBugs.length > 0){
            vscode.window.showQuickPick(warningBugs, {
                onDidSelectItem: function (bug) {
                    vscode.window.activeTextEditor.selection = new vscode.Selection(bug.range.start, bug.range.end);
                    vscode.window.activeTextEditor.revealRange(bug.range);
                }
            });
        }
    })
    
    
    
    context.subscriptions.push(disposable);
    context.subscriptions.push(statusBarE);
    context.subscriptions.push(statusBarW);
    context.subscriptions.push(lintWindow);
    context.subscriptions.push(orionLintJumpToErrorCommand);

}
exports.activate = activate;
//# sourceMappingURL=extension.js.map