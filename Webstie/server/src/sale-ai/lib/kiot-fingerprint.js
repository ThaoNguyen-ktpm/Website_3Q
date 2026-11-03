import {createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const fingerprint=p=>digest([p.id,p.code,p.name,p.currentPrice,p.notes,p.createdAt,p.active,p.stock,p.modifiedDate,p.inventoryMissing,p.activeMissing,p.taxPresent,p.rawFields]);
export const notesFingerprint=notes=>digest(notes??'');
