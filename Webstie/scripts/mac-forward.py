#!/usr/bin/env python3
"""MacBook: open the shop website at http://localhost:5173 by forwarding it to the machine running npm run dev.

Bảo 2026-10-20 (docs/LAN.md): Google sign-in only accepts localhost, so the Mac keeps using localhost and this
script relays it over the shop wifi. Standard library only. Run: python3 mac-forward.py 192.168.110.213
"""
import asyncio
import os
import sys

HOST = sys.argv[1] if len(sys.argv) > 1 else '192.168.110.213'
PORT = 5173
LISTEN_PORT = int(os.environ.get('LISTEN_PORT', PORT))  # only differs when testing on the server itself


async def pipe(reader, writer):
    try:
        while data := await reader.read(65536):
            writer.write(data)
            await writer.drain()
    except (ConnectionError, OSError):
        pass
    finally:
        writer.close()


async def handle(client_reader, client_writer):
    try:
        server_reader, server_writer = await asyncio.open_connection(HOST, PORT)
    except OSError as error:
        print(f'Không kết nối được máy chủ {HOST}:{PORT} ({error}). Máy chủ đã chạy npm run dev và cùng wifi chưa?')
        client_writer.close()
        return
    await asyncio.gather(pipe(client_reader, server_writer), pipe(server_reader, client_writer))


async def main():
    server = await asyncio.start_server(handle, '127.0.0.1', LISTEN_PORT)
    print(f'Đang chuyển http://localhost:{LISTEN_PORT} tới {HOST}:{PORT}. Mở Chrome vào http://localhost:{LISTEN_PORT}.')
    print('Giữ cửa sổ này mở khi dùng web; bấm Ctrl+C để tắt.')
    async with server:
        await server.serve_forever()


try:
    asyncio.run(main())
except KeyboardInterrupt:
    pass
