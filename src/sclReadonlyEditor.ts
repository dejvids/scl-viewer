

import * as vscode from 'vscode';
import {DOMParser} from 'xmldom';
import { DOType, DAElement } from './models/DOType';

export class SclReadonlyEditorProvider implements vscode.CustomTextEditorProvider {

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new SclReadonlyEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(SclReadonlyEditorProvider.viewType, provider);
        return providerRegistration;
    }

    private static readonly viewType = 'scl.icd';

    constructor(
        private readonly context: vscode.ExtensionContext
    ) { }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true
        };
        webviewPanel.webview.html = this.getHtmlForWebview(document.getText());

        function updateWebview() {
            webviewPanel.webview.postMessage({
                type: 'update',
                text: document.getText()
            });
        }

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });

        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                case 'add':
                    this.handleAddMessage(document);
                    return;

                case 'delete':
                    this.handleDeleteMessage(document, e.text);
                    return;
            }
        });

        updateWebview();
    }

    private getHtmlForWebview(content: string): string {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'application/xml');

        const ied = doc.getElementsByTagName('IED')[0];
        const dataTemplate = doc.getElementsByTagName('DataTypeTemplates')[0];
        const doTypes = this.getDoTypes(dataTemplate);

        return /* html */`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">

            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        </head>
        <body>
            <h1>SCL Viewer</h1>
            <h2>IED ${ied.getAttribute('name')}</h2>
            <h3>Logical Devices</h3>
            <ul>
                ${this.getLdevicesList(ied)}
            </ul>
            </hr>
            <h2> Data Templates </h2>
            <h3>Logical Node Types</h3>
            <ul>
                ${this.getLNodeTypeList(dataTemplate, doTypes)}
            </ul>
        </body>
        </html>`;
    }


    private getLdevicesList(ied: Element) {
        var lDevices = ied.getElementsByTagName('LDevice');
        // create a list of all the logical devices as <li> elements
        var lDeviceList = '';
        for (var i = 0; i < lDevices.length; i++) {
            lDeviceList += '<li>' + lDevices[i].getAttribute('inst');
            const ln0 = lDevices[i].getElementsByTagName('LN0');
            const lNodes = lDevices[i].getElementsByTagName('LN');

            // create a list of all the logical nodes as nested elements of the logical device
            lDeviceList += '<ul>';
            lDeviceList += '<li>' + ln0[0].getAttribute('lnClass') + '</li>';
            for (var j = 0; j < lNodes.length; j++) {
                lDeviceList += `<li lnType="${lNodes[j].getAttribute('lnType')}">` + lNodes[j].getAttribute('lnClass') + '</li>';
            }

            lDeviceList += '</ul>';
            lDeviceList += '</li>';

        }
        return lDeviceList;
    }

    private getDoTypes(dataTemplate: Element): DOType[] {
        var doTypeNodes = dataTemplate.getElementsByTagName('DOType');
        var doTypes = [];

        for (var i = 0; i < doTypeNodes.length; i++) {
            var daTags = doTypeNodes[i].getElementsByTagName('DA');
            var das = [];
            for (var j = 0; j < daTags.length; j++) {
                const daElement: DAElement = {
                    name: daTags[j].getAttribute('name') || '',
                    bType: daTags[j].getAttribute('bType') || '',
                    valKind: daTags[j].getAttribute('valKind') || '',
                    val: daTags[j].getAttribute('val') || '',
                    fc: daTags[j].getAttribute('fc') || ''
                };
                das.push(daElement);
            }

            const doType: DOType = {
                id: doTypeNodes[i].getAttribute('id') || '',
                cdc: doTypeNodes[i].getAttribute('cdc') || '',
                das: das
            };

            doTypes.push(doType);
        }

        return doTypes;
    }

    private getLNodeTypeList(dataTemplate: Element, doTypes: DOType[]): string {
        const lnodeTypes = dataTemplate.getElementsByTagName('LNodeType');

        var lNodeTypeList = '';
        for (var i = 0; i < lnodeTypes.length; i++) {
            lNodeTypeList += '<li>' + lnodeTypes[i].getAttribute('id');
            const doNames = lnodeTypes[i].getElementsByTagName('DO');
            lNodeTypeList += '<ul>';
            for (var j = 0; j < doNames.length; j++) {
                const doType = doTypes.find(doType => doType.id === doNames[j].getAttribute('type'));
                lNodeTypeList += '<li>DO: ' + doNames[j].getAttribute('name') + ' (' + doType?.cdc + ')';
                lNodeTypeList += '<ul>';
                for (var k = 0; doType && doType.das && k < doType.das.length; k++) {
                    lNodeTypeList += '<li>' + doType?.das[k].name + ` [${doType?.das[k].fc}]` + '</li>';
                }

                lNodeTypeList += '</ul>';
                lNodeTypeList += '</li>';
            }
           
            lNodeTypeList += '</ul>';
            lNodeTypeList += '</li>';
        }

        return lNodeTypeList;
    }

    private handleDeleteMessage(document: vscode.TextDocument, text: any) {
        return this.updateTextDocument(document, text);
    }

    private handleAddMessage(document: vscode.TextDocument) {
        return this.updateTextDocument(document, document.getText());
    }

	private updateTextDocument(document: vscode.TextDocument, json: string) {
		const edit = new vscode.WorkspaceEdit();

		// Just replace the entire document every time for this example extension.
		// A more complete extension should compute minimal edits instead.
		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			json);

		return vscode.workspace.applyEdit(edit);
	}
}