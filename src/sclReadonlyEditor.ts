

import * as vscode from 'vscode';
import { DOMParser } from 'xmldom';
import { DataObjectType, DataObject, SubDataObject } from './models/DataObject';
import { DataAttribute, DataAttributeType } from './models/DataAttribute';
import { EnumType, EnumValue } from './models/EnumObject';
import { LnType } from './models/Node';

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
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document.getText());

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

    private getHtmlForWebview(webview: vscode.Webview, content: string): string {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'application/xml');

        const ied = doc.getElementsByTagName('IED')[0];
        const dataTemplate = doc.getElementsByTagName('DataTypeTemplates')[0];

        const enumTypes = this.getEnumTypes(dataTemplate);
        const daTypes = this.getDaTypes(dataTemplate);
        const doTypes = this.getDoTypes(dataTemplate, daTypes, enumTypes);
        const lnTypes = this.getLnTypes(dataTemplate, doTypes);

        const treeviewStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'treeview.css'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'style.css'));

        const treeviewScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'treeview.js'));

        return /* html */`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <link rel="stylesheet" href="${treeviewStyleUri}">
            <link rel="stylesheet" href="${styleUri}">
            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        </head>
        <body>
            <div class="container">
                <div class="side-panel">
                    <h2>IED ${ied.getAttribute('name')}</h2>
                    <h3>Logical Devices</h3>
                    <ul id="iedUL">
                        ${this.getLdevicesList(ied)}
                    </ul>
                </div>
                </hr>
                <div class="side-panel">
                    <h2> Data Templates </h2>
                    <h3>Logical Node Types</h3>
                    <ul id="dtUL">
                        ${this.getLNodeTypeList(lnTypes)}
                    </ul>
                </div>
            </div>
            <script src="${treeviewScriptUri}"></script>
        </body>
        </html>`;
    }


    private getLdevicesList(ied: Element) {
        var lDevices = ied.getElementsByTagName('LDevice');
        // create a list of all the logical devices as <li> elements
        var lDeviceList = '';
        for (var i = 0; i < lDevices.length; i++) {
            lDeviceList += '<li><span class="caret">' + lDevices[i].getAttribute('inst') + '</span>';
            const ln0 = lDevices[i].getElementsByTagName('LN0');
            const lNodes = lDevices[i].getElementsByTagName('LN');

            // create a list of all the logical nodes as nested elements of the logical device
            lDeviceList += '<ul class="nested">';
            lDeviceList += '<li>' + ln0[0].getAttribute('lnClass') + '</li>';
            for (var j = 0; j < lNodes.length; j++) {
                const prefix = lNodes[j].getAttribute('prefix') || '';
                const lnCLass = lNodes[j].getAttribute('lnClass') || '';
                const inst = lNodes[j].getAttribute('inst') || '';
                lDeviceList += `<li lnType="${lNodes[j].getAttribute('lnType')}">` + prefix + lnCLass + inst + '</li>';
            }

            lDeviceList += '</ul>';
            lDeviceList += '</li>';

        }
        return lDeviceList;
    }

    private getEnumTypes(dataTemplate: Element): EnumType[] {
        var enumTypeNodes = dataTemplate.getElementsByTagName('EnumType');
        var enumTypes: EnumType[] = [];
        for (var i = 0; i < enumTypeNodes.length; i++) {
            const enumTags = enumTypeNodes[i].getElementsByTagName('EnumVal');
            const enumValues: EnumValue[] = [];

            for (var j = 0; j < enumTags.length; j++) {
                const enumValue: EnumValue = {
                    name: enumTags[j].textContent || '',
                    description: enumTags[j].getAttribute('desc') || ''
                };
                enumValues.push(enumValue);
            }

            const enumType: EnumType = {
                id: enumTypeNodes[i].getAttribute('id') || '',
                values: enumValues,
                isEnumType: true
            };

            enumTypes.push(enumType);
        }

        return enumTypes;
    }

    private getDaTypes(dataTemplate: Element): DataAttributeType[] {
        var daTypeNodes = dataTemplate.getElementsByTagName('DAType');
        var daTypes: DataAttributeType[] = [];

        for (var i = 0; i < daTypeNodes.length; i++) {
            const daTags = daTypeNodes[i].getElementsByTagName('BDA');
            const bdas = [];

            for (var j = 0; j < daTags.length; j++) {
                const bdaType: string = daTags[j].getAttribute('type') || '';
                const bda: DataAttribute = {
                    name: daTags[j].getAttribute('name') || '',
                    bType: daTags[j].getAttribute('bType') || '',
                    valKind: daTags[j].getAttribute('valKind') || '',
                    val: '',
                    fc: daTags[j].getAttribute('fc') || '',
                    typeId: bdaType === '' ? null : bdaType,
                    type: null
                };
                bdas.push(bda);
            }

            const daType: DataAttributeType = {
                id: daTypeNodes[i].getAttribute('id') || '',
                fc: daTypeNodes[i].getAttribute('fc') || '',
                attributes: bdas
            };

            daTypes.push(daType);
        }

        daTypes.forEach(daType => {
            daType.attributes.forEach(da => {
                if (da.typeId) {
                    da.type = daTypes.find(daType => daType.id === da.typeId) || null;
                }
            });
        });

        return daTypes;
    }

    private getDoTypes(dataTemplate: Element, daTypes: DataAttributeType[], enumTypes: EnumType[]): DataObjectType[] {
        var doTypeNodes = dataTemplate.getElementsByTagName('DOType');
        var doTypes: DataObjectType[] = [];

        for (var i = 0; i < doTypeNodes.length; i++) {
            const daTags = doTypeNodes[i].getElementsByTagName('DA');
            const sdoTags = doTypeNodes[i].getElementsByTagName('SDO');
            const das = [];
            for (var j = 0; j < daTags.length; j++) {
                const bType = daTags[j].getAttribute('bType');
                const daTypeId = daTags[j].getAttribute('type') || '';
                const daElement: DataAttribute = {
                    name: daTags[j].getAttribute('name') || '',
                    bType: bType || '',
                    valKind: daTags[j].getAttribute('valKind') || '',
                    val: daTags[j].getAttribute('val') || '',
                    fc: daTags[j].getAttribute('fc') || '',
                    typeId: daTags[j].getAttribute('type') || null,
                    type: bType === 'Enum'
                        ? enumTypes.find(enumType => enumType.id === daTypeId) || null
                        : daTypes.find(daType => daType.id === daTypeId) || null
                };

                das.push(daElement);
            }

            const sdos: SubDataObject[] = [];
            for (let j = 0; j < sdoTags.length; j++) {
                const sdoElement: SubDataObject = {
                    name: sdoTags[j].getAttribute('name') || '',
                    typeId: sdoTags[j].getAttribute('type') || '',
                    doType: null
                    // doType: doTypes.find(doType => doType.id === sdoTags[j].getAttribute('type')) || null
                };
                sdos.push(sdoElement);
            }

            const doType: DataObjectType = {
                id: doTypeNodes[i].getAttribute('id') || '',
                cdc: doTypeNodes[i].getAttribute('cdc') || '',
                sdos: sdos,
                das: das
            };

            doTypes.push(doType);
        }

        doTypes.forEach(doType => {
            doType.sdos.forEach(sdo => {
                sdo.doType = doTypes.find(doType => doType.id === sdo.typeId) || null;
            });
        });

        return doTypes;
    }

    private getLnTypes(dataTemplate: Element, doTypes: DataObjectType[]): LnType[] {
        var lnodeTypes = dataTemplate.getElementsByTagName('LNodeType');
        var lnTypes = [];

        for (var i = 0; i < lnodeTypes.length; i++) {
            const doNames = lnodeTypes[i].getElementsByTagName('DO');
            const dos = [];
            for (var j = 0; j < doNames.length; j++) {
                const doType = doTypes.find(doType => doType.id === doNames[j].getAttribute('type'));
                const doElement: DataObject = {
                    name: doNames[j].getAttribute('name') || '',
                    type: doType || null
                };

                if (doElement) {
                    dos.push(doElement);
                }
            }

            const lnType: LnType = {
                id: lnodeTypes[i].getAttribute('id') || '',
                prefix: lnodeTypes[i].getAttribute('prefix') || '',
                lnClass: lnodeTypes[i].getAttribute('lnClass') || '',
                inst: lnodeTypes[i].getAttribute('inst') || '',
                dos: dos
            };

            lnTypes.push(lnType);
        }

        return lnTypes;
    }

    private getLNodeTypeList(lnodeTypes: LnType[]): string {
        var lNodeTypeList = '';
        for (var i = 0; i < lnodeTypes.length; i++) {
            lNodeTypeList += '<li><span class="caret">' + lnodeTypes[i].lnClass + ' (' + lnodeTypes[i].id + ')</span>';
            const doElements = lnodeTypes[i].dos;

            lNodeTypeList += '<ul class="nested">';
            lNodeTypeList += this.getDosList(doElements);
            lNodeTypeList += '</ul>';

            lNodeTypeList += '</li>';
        }

        return lNodeTypeList;
    }

    private getDosList(doNames: DataObject[] | null) {
        let dosList: string = '';
        for (var j = 0; doNames && j < doNames.length; j++) {
            const doType = doNames[j].type;
            dosList += '<li><span class="caret">DO: ' + doNames[j].name + ' (' + doType?.cdc + ')</span>';
            dosList += '<ul class="nested">';

            if (doType?.sdos) {
                dosList += this.getSDosList(doType?.sdos);
            }

            for (var k = 0; doType && doType.das && k < doType.das.length; k++) {
                if (doType.das[k].type) {
                    dosList += this.getDaList(doType.das[k]);
                }
                else {
                    dosList += '<li>' + doType?.das[k].name + ` [${doType?.das[k].fc}]` + '</li>';
                }
            }

            dosList += '</ul>';
            dosList += '</li>';
        }
        return dosList;
    }

    private getDaList(dataAttribute: DataAttribute) {
        const daType = dataAttribute.type;
        if (!daType) {
            return '';
        }

        const isEnumType = daType.hasOwnProperty('isEnumType');

        let dosList = '<li><span class="caret">DA:' + dataAttribute.name + ` [${dataAttribute.fc}]` + (isEnumType ? '[ENUM]' : '') + '</span>';
        dosList += '<ul class="nested">';

        if (isEnumType) { // Use the added property to check if it's an EnumType
            if ('values' in daType) {
                dosList += this.getEnumList(daType as EnumType);
            }
        }

        else {


            const dataAttributeType = daType as DataAttributeType;

            for (var l = 0; l < (dataAttributeType.attributes ?? []).length; l++) {
                if (dataAttributeType.attributes[l].type) {
                    dosList += this.getDaList(dataAttributeType.attributes[l]);
                }
                else {
                    dosList += '<li>' + dataAttributeType.attributes[l].name + ` [${dataAttributeType.attributes[l].fc}]` + '</li>';
                }
            }
        }

        dosList += '</ul>';
        dosList += '</li>';
        return dosList;
    }

    private getEnumList(enumType: EnumType) {
        let enumList: string = '';
        for (var j = 0; j < enumType.values.length; j++) {
            enumList += '<li>' + enumType.values[j].name + '</li>';
        }
        return enumList;
    }

    private getSDosList(doNames: SubDataObject[]) {
        let sdosList: string = '';
        for (var j = 0; doNames && j < doNames.length; j++) {
            const doType = doNames[j].doType;
            sdosList += '<li><span class="caret">SDO: ' + doNames[j].name + ' (' + doType?.cdc + ')</span>';
            sdosList += '<ul class="nested">';

            for (let k = 0; doType && doType.sdos && k < doType.sdos.length; k++) {
                sdosList += this.getSDosList(doType?.sdos);
            }

            for (var k = 0; doType && doType.das && k < doType.das.length; k++) {
                sdosList += this.getDaList(doType.das[k]);
                // sdosList += '<li>' + doType?.das[k].name + ` [${doType?.das[k].fc}]` + '</li>';
            }

            sdosList += '</ul>';
            sdosList += '</li>';
        }
        return sdosList;
    }

    private handleDeleteMessage(document: vscode.TextDocument, content: any) {
        return this.updateTextDocument(document, content);
    }

    private handleAddMessage(document: vscode.TextDocument) {
        return this.updateTextDocument(document, document.getText());
    }

    private updateTextDocument(document: vscode.TextDocument, json: string) {
        const edit = new vscode.WorkspaceEdit();

        // Just replace the entire document every time for this example extension.
        // A more complete extension should compute minimal edits instead.
        let resource = edit.get(document.uri);

        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            json);

        return vscode.workspace.applyEdit(edit);
    }
}