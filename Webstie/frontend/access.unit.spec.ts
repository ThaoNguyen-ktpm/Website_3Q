import {test,expect} from '@playwright/test';
import {allowedPage} from './src/access';

test('documents require documents.view even for an admin or a manager',()=>{
 expect(allowedPage({role:'STAFF',permissions:['documents.view']},'documents')).toBe(true);
 expect(allowedPage({role:'ADMIN',permissions:[]},'documents')).toBe(false);
 expect(allowedPage({role:'MANAGER',permissions:['documents.manage']},'documents')).toBe(false);
 expect(allowedPage({role:'STAFF',permissions:[]},'documents')).toBe(false);
});
