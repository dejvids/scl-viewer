import { DataObject } from "./DataObject";

export interface LnType {
    id: string;
    prefix: string;
    lnClass: string;
    inst: string;
    dos: DataObject[] | null;
}
