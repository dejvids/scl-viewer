export interface EnumType {
    id: string;
    isEnumType : boolean;
    values: EnumValue[];
}

export interface EnumValue {
    name: string;
    description: string;
}

export interface EnumObject {
    name: string;
    type: EnumType | null;
}