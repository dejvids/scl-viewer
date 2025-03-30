export interface DataAttributeType {
    id: string;
    fc: string;
    attributes: DataAttribute[];
}

export interface DataAttribute {
    name: string;
    bType: string;
    valKind: string;
    val: string;
    fc: string;
    type: DataAttributeType | null;
    typeId: string | null;
}