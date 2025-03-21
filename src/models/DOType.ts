export interface LnType {
    id: string;
    prefix: string;
    lnClass: string;
    inst: string;
    dos: DoElement[] | null;
}

export interface DoType {
    id: string;
    cdc: string;
    sdos: SdoElement[];
    das: DaElement[];
}

export interface DoElement {
    name: string;
    type: DoType | null;
}

export interface DaElement {
    name: string;
    bType: string;
    valKind: string;
    val: string;
    fc: string;
}

export interface SdoElement {
    name: string;
    doType: DoType | null;
}