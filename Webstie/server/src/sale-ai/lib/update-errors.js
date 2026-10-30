// Per-product failures may continue; authorization and journal failures may not.
export const stopsPlatform=error=>[401,403].includes(error.httpStatus);
