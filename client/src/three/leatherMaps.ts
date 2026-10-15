// Leather map containers shared by the texture worker and the main thread.

/** Raw RGBA maps; plain data so it can be computed in a worker and transferred. */
export interface ScaleField {
  width: number;
  height: number;
  pxPerCm: number;
  albedo: Uint8ClampedArray;
  normal: Uint8ClampedArray;
  roughness: Uint8ClampedArray;
}

export interface ScaleCanvases {
  albedo: HTMLCanvasElement;
  normal: HTMLCanvasElement;
  roughness: HTMLCanvasElement;
}

export function fieldToCanvases(f: ScaleField): ScaleCanvases {
  const mk = (data: Uint8ClampedArray) => {
    const c = document.createElement('canvas');
    c.width = f.width;
    c.height = f.height;
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(data), f.width, f.height), 0, 0);
    return c;
  };
  return { albedo: mk(f.albedo), normal: mk(f.normal), roughness: mk(f.roughness) };
}
