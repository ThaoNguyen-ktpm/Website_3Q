/** Accept a one-time link or its bare code, never fetch the pasted URL. */
export function linkCode(text:string){
 const value=text.trim();
 try{return new URL(value).searchParams.get('ma')||''}catch{return value}
}
