import React from 'react';
const paths = {
 grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 box: 'm12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5',
 bag: 'M5 7h14l1 14H4L5 7ZM8 8V6a4 4 0 0 1 8 0v2',
 users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
 team: 'M4 21v-4a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v4M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM8 17v4M16 17v4',
 settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
 search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
 bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
 chevron: 'm9 5 7 7-7 7', down: 'm6 9 6 6 6-6', arrow: 'M7 17 17 7M7 7h10v10',
 plus: 'M12 5v14M5 12h14', download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
 calendar: 'M8 2v4M16 2v4M3 10h18M3 4h18v17H3z',
 wallet: 'M3 6V4h16v3M3 7h18v14H3V7ZM16 12h5v5h-5z',
 trend: 'm3 17 6-6 4 4 8-10M15 5h6v6', close: 'm6 6 12 12M6 18 18 6',
 menu: 'M4 6h16M4 12h16M4 18h16', help: 'M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
 store: 'M3 10 5 3h14l2 7M4 10v11h16V10M9 21v-7h6v7M3 10c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0',
 shirt: 'm8 3-5 3 2 6 3-1v10h8V11l3 1 2-6-5-3c0 4-8 4-8 0Z',
 headset: 'M4 14v-3a8 8 0 0 1 16 0v3M4 12H2v8h5v-8H4ZM20 12h2v8h-5v-8h3',
 shoe: 'M3 14c4 0 6-3 6-7l4 2v5l8 3v4H3v-7ZM13 12l3-1M16 15l2-2',
 watch: 'M9 2h6l1 5M9 22h6l1-5M8 7H6v10h12V7H8ZM12 9v4l2 1',
 check: 'm5 12 4 4L19 6', edit: 'm15 5 4 4M4 20l5-1L21 7l-4-4L5 15l-1 5Z',
 eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
 clock: 'M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z', logout:'M9 4H3v16h6M9 12h12m-5-5 5 5-5 5', mail:'M3 5h18v14H3zM3 5l9 8 9-8'
};
export default function Icon({name, size=20, ...props}) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.box}/></svg>; }
