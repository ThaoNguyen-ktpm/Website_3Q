// Pages backed by the real API (Bảo 2026-10-27): [page, label, permission the server also checks].
export type AppPage=[string,string,string];
export const PRICE:AppPage[]=[['sale','Sale AI','sale.manage'],['search','Tìm kiếm sản phẩm','products.view']];
export const MANAGE:AppPage[]=[['team','Nhân viên','staff.view'],['audit','Nhật ký','audit.view'],['documents','Tài liệu','documents.view']];
