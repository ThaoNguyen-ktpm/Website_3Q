import { useEffect, useState } from 'react';
import { getProducts, UnauthenticatedError, type Product } from '../api/products';

type ProductState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; products: Product[] };

export function useProducts(onSessionExpired: () => void): ProductState {
  const [state, setState] = useState<ProductState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    getProducts(controller.signal)
      .then((products) => setState({ status: 'success', products }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof UnauthenticatedError) { onSessionExpired(); return; }
        if (error instanceof Error && error.name === 'AbortError') return;
        setState({ status: 'error', message: 'Không thể tải sản phẩm. Vui lòng thử lại sau.' });
      });
    return () => controller.abort();
  }, [onSessionExpired]);

  return state;
}
