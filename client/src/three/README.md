# Túi Birkin 25 3D (Three.js)

Mô hình 3D túi Hermès Birkin 25 da cá sấu thật (alligator), khóa vàng, dựng bằng code Three.js. Vân da lấy từ ảnh chụp thật trong `ref/`. Nền trong suốt nên đặt được lên mọi màu nền.

## Dùng trong trang (React)

Cần package `three` (đã có trong `client/package.json`):

```bash
npm install three@0.170.0 @types/three@0.170.0 --workspace client
```

**Bản 3D xoay được.** Nên tải lazy để three.js (~150 kB gzip) không làm chậm trang:

```tsx
import { lazy, Suspense } from 'react';

const BirkinBag3D = lazy(() =>
  import('../components/BirkinBag3D').then((m) => ({ default: m.BirkinBag3D })),
);

export function LoginHero() {
  return (
    <div style={{ height: 480 }}>
      <Suspense fallback={null}>
        <BirkinBag3D />
      </Suspense>
    </div>
  );
}
```

Component tự lấp đầy khung chứa, nên chỉnh kích thước bằng khung chứa. Các prop:

| Prop | Mặc định | Ý nghĩa |
|---|---|---|
| `autoRotate` | `true` | Tự xoay chậm. Tắt khi trình duyệt bật giảm chuyển động. |
| `initialAzimuth` | `28` | Góc nhìn ban đầu (độ). `0` là chính diện, `90` là nhìn ngang. |
| `className` | — | Class cho khung chứa canvas. |

Người xem kéo chuột (hoặc vuốt) để xoay. Clochette và ổ khóa lắc theo tốc độ xoay. Vân da được tạo trong Web Worker, nên trang không bị khựng; túi hiện mờ dần vào sau khoảng 1 giây.

**Bản ảnh tĩnh** (nền trong suốt) nằm trong `client/src/assets/`:

| File | Dùng cho |
|---|---|
| `birkin-25-4k-1600.webp` / `birkin-25-front-4k-1600.webp` | web, nhẹ (~230 KB) |
| `birkin-25-4k.webp` / `birkin-25-front-4k.webp` | màn hình lớn (~4K) |
| `*.png` | bản gốc 4K (~10 MB), không commit vào git |

```tsx
import bagImg from '../assets/birkin-25-4k-1600.webp';

<img src={bagImg} alt="Túi Hermès Birkin 25 da cá sấu thật màu xanh, khóa vàng" width={1576} height={1600} style={{ width: '100%', height: 'auto' }} />
```

## Chỉnh thông số

| Muốn chỉnh | File | Thông số |
|---|---|---|
| Dáng, kích thước (cm), độ thon, nếp hông, quai, đai, khóa | `birkinSpec.ts` | `BIRKIN_SPEC` |
| Độ tối, độ đậm màu, độ nét, độ bóng của da | `birkinTextures.ts` | `ALBEDO_GAIN`, `SATURATION`, `SHARPEN`, `GLOSS` |
| Ánh sáng môi trường, đèn | `birkinScene.ts` | `environmentIntensity`, `key`, `glint`, `rim` |
| Độ lắc của clochette / ổ khóa | `createBirkinModel.ts` | `SWING` |

## Công cụ khi dev (không vào bản build)

Chạy dev server rồi mở các trang sau:

```bash
npx vite client --host 127.0.0.1 --port 5181
```

- `/bag-preview.html?az=0&rotate=0`: xem túi ở một góc cố định.
- `/compare.html`: khối xám đặt cạnh và chồng lên ảnh tham chiếu (`?leather=1` để xem bản có da).

Render lại ảnh 4K nền trong suốt (file được ghi thẳng vào `src/assets/`):

```bash
npx vite client --config client/vite.render.config.ts
```

Mở `http://127.0.0.1:5182/render-4k.html?az=28&name=birkin-25-4k.png`.

## Cấu trúc

- `createBirkinModel.ts`: dựng các bộ phận (thân, hông, đáy, đai, quai, khóa, clochette, ổ khóa) và vật liệu.
- `birkinSurface.ts`: hình học bề mặt thân, dùng chung cho mesh và texture.
- `birkinTextures.ts`, `photoLeather.ts`, `birkin.worker.ts`: tạo vân da từ ảnh (khử bóng, làm nét, chiếu lên thân).
- `birkinScene.ts`: ánh sáng, bóng đổ, khung hình camera.
- `ref/`: ảnh chụp tham chiếu của túi thật.
