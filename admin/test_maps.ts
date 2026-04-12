import { resolveGoogleMapsInputToLatLng, parseLatLngFromGoogleMapsInput } from './src/lib/googleMapsUrl.js';

const input = `Elathur
Kerala

https://maps.app.goo.gl/hxfJhfxmSSVeov8C8`;

async function test() {
  console.log('Testing parseLatLngFromGoogleMapsInput:');
  const parsed = parseLatLngFromGoogleMapsInput(input);
  console.log('Result:', parsed);

  console.log('\nTesting resolveGoogleMapsInputToLatLng:');
  const resolved = await resolveGoogleMapsInputToLatLng(input);
  console.log('Result:', resolved);
}

test().catch(console.error);
