// Bounded read concurrency; settle workers before returning an error.
export async function readPool(items, read, limit=2) {
  const results=new Array(items.length);let next=0,failure;
  const workers=Array.from({length:Math.min(limit,items.length)},async()=>{
    while(!failure&&next<items.length) {
      const index=next++;
      try {results[index]=await read(items[index],index);}catch(error){failure ||= error;}
    }
  });
  await Promise.all(workers);
  if(failure)throw failure;
  return results;
}
