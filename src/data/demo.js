/**
 * Datos de demostracion.
 * Se muestran SOLO hasta que el usuario configure una fuente real.
 * Los streams son flujos de prueba publicos de Mux y Apple, pensados para
 * validar la reproduccion; no son canales de television.
 */

export const DEMO_FLAG = 'DEMO';

export const DEMO_CHANNELS = [
  {
    id: 'demo_bipbop',
    name: 'DEMO - Apple bipbop (HLS multi-bitrate)',
    logo: '',
    group: 'DEMO',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8',
    kind: 'live',
    tvgId: 'demo_bipbop',
    demo: true
  },
  {
    id: 'demo_mux',
    name: 'DEMO - Mux x36xhzz (HLS)',
    logo: '',
    group: 'DEMO',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    kind: 'live',
    tvgId: 'demo_mux',
    demo: true
  },
  {
    id: 'demo_mux_pts',
    name: 'DEMO - Mux PTS shift (HLS vivo)',
    logo: '',
    group: 'DEMO',
    url: 'https://test-streams.mux.dev/pts_shift/master.m3u8',
    kind: 'live',
    tvgId: 'demo_mux_pts',
    demo: true
  }
];

export const DEMO_MOVIES = [
  { id: 'demo_mov_1', name: 'DEMO - Big Buck Bunny', logo: '', group: 'DEMO Peliculas', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', kind: 'vod', plot: 'Video de prueba publico (Mux).', year: '2008', demo: true },
  { id: 'demo_mov_2', name: 'DEMO - Tears of Steel', logo: '', group: 'DEMO Peliculas', url: 'https://test-streams.mux.dev/pts_shift/master.m3u8', kind: 'vod', plot: 'Segundo flujo de prueba publico (Mux).', year: '2012', demo: true }
];

export const DEMO_SERIES = [
  { id: 'demo_ser_1', name: 'DEMO - Serie de prueba', logo: '', group: 'DEMO Series', url: '', kind: 'series', plot: 'Serie ficticia para probar la navegacion.', year: '2024', demo: true }
];

export const DEMO_EPISODES = [
  { id: 'demo_ep_1', name: 'DEMO - Episodio 1', number: 1, season: 1, plot: 'Episodio de demostracion.', logo: '', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', kind: 'episode', demo: true }
];

export function isDemoItem(item) {
  return !!(item && (item.demo || (item.group && item.group.indexOf('DEMO') === 0)));
}
