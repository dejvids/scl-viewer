export interface DOType {
    id: string;
    cdc: string;
    das: DAElement[];
}

export interface DAElement {
    name: string;
    bType: string;
    valKind: string;
    val: string;
    fc: string;
}