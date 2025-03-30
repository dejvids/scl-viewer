import { DataAttribute } from "./DataAttribute";

export interface DataObjectType {
    id: string;
    cdc: string;
    sdos: SubDataObject[];
    das: DataAttribute[];
}

export interface DataObject {
    name: string;
    type: DataObjectType | null;
}

export interface SubDataObject {
    name: string;
    typeId: string;
    doType: DataObjectType | null;
}