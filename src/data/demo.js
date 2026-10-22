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
  },
  {
    id: 'demo_sintel',
    name: 'DEMO - Sintel (trailer)',
    logo: '',
    group: 'DEMO',
    url: 'https://bitmovin-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    kind: 'live',
    tvgId: 'demo_sintel',
    demo: true
  },
  {
    id: 'demo_tears',
    name: 'DEMO - Tears of Steel',
    logo: '',
    group: 'DEMO',
    url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    kind: 'live',
    tvgId: 'demo_tears',
    demo: true
  }
];

export const DEMO_MOVIES = [
  { id: 'demo_mov_1', name: 'DEMO - Big Buck Bunny', logo: '', group: 'DEMO Peliculas', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', kind: 'vod', plot: 'Video de prueba publico (Mux).', year: '2008', demo: true },
  { id: 'demo_mov_2', name: 'DEMO - Tears of Steel', logo: '', group: 'DEMO Peliculas', url: 'https://test-streams.mux.dev/pts_shift/master.m3u8', kind: 'vod', plot: 'Segundo flujo de prueba publico (Mux).', year: '2012', demo: true },
  { id: 'demo_mov_3', name: 'DEMO - Sintel', logo: '', group: 'DEMO Peliculas', url: 'https://bitmovin-a.akamaihd.net/content/sintel/hls/playlist.m3u8', kind: 'vod', plot: 'Corto animado de Blender Foundation.', year: '2010', demo: true },
  { id: 'demo_mov_4', name: 'DEMO - Tears of Steel (HLS)', logo: '', group: 'DEMO Peliculas', url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', kind: 'vod', plot: 'Corto de ciencia ficcion.', year: '2012', demo: true }
];

export const DEMO_SERIES = [
  { id: 'demo_ser_1', name: 'DEMO - Serie de prueba', logo: '', group: 'DEMO Series', url: '', kind: 'series', plot: 'Serie ficticia para probar la navegacion.', year: '2024', demo: true },
  { id: 'demo_ser_2', name: 'DEMO - Mux Samples', logo: '', group: 'DEMO Series', url: '', kind: 'series', plot: 'Coleccion de flujos de prueba.', year: '2020', demo: true }
];

export const DEMO_EPISODES = [
  { id: 'demo_ep_1', name: 'DEMO - Episodio 1: BipBop', number: 1, season: 1, seriesId: 'demo_ser_1', plot: 'Episodio de demostracion con flujo BipBop.', logo: '', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', kind: 'episode', demo: true },
  { id: 'demo_ep_2', name: 'DEMO - Episodio 2: PTS Shift', number: 2, season: 1, seriesId: 'demo_ser_1', plot: 'Segundo episodio con otro flujo de prueba.', logo: '', url: 'https://test-streams.mux.dev/pts_shift/master.m3u8', kind: 'episode', demo: true },
  { id: 'demo_ep_3', name: 'DEMO - Mux x36xhzz', number: 1, season: 1, seriesId: 'demo_ser_2', plot: 'Muestra de flujo HLS.', logo: '', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', kind: 'episode', demo: true },
  { id: 'demo_ep_4', name: 'DEMO - PTS Shift', number: 2, season: 1, seriesId: 'demo_ser_2', plot: 'Muestra con PTS shift.', logo: '', url: 'https://test-streams.mux.dev/pts_shift/master.m3u8', kind: 'episode', demo: true }
];

export function isDemoItem(item) {
  return !!(item && (item.demo || (item.group && item.group.indexOf('DEMO') === 0)));
}
