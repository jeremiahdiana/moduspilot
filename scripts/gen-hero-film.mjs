#!/usr/bin/env node
// Generates apps/web/public/hero-film.html (the homepage hero embed) from the
// durable source modus-hero-film-preview.html.
//
// The embed = source + a prepended <!doctype> head + an appended override
// <style>/<script> that:
//   - hides the preview chrome (.toprow / .foot-note)
//   - fills the viewport with an ambient aurora background
//   - CONTAINS the 16:9 film (whole app ALWAYS visible, never cropped) and
//     frames it as a floating product window (rounded corners + shadow)
//   - adds a top scrim so the fixed homepage navbar stays legible
//
// Run:  node scripts/gen-hero-film.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'modus-hero-film-preview.html');
const OUT = join(root, 'apps/web/public/hero-film.html');

const source = readFileSync(SRC, 'utf8');

const HEAD = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n';

// CONTAIN + framed. MARGIN leaves ambient breathing room so the film reads as a
// floating product window, not an edge-to-edge crop.
const OVERRIDE = `
<style>
  html,body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;overflow:hidden!important;background:#060608!important}
  .toprow,.foot-note{display:none!important}
  .wrap{position:fixed!important;inset:0!important;display:grid!important;place-items:center!important;
    max-width:none!important;width:100%!important;height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important}
  /* Fixed 16:9 base; JS scales it to COVER the viewport — full-bleed, edge to edge.
     The aurora fills the whole screen; the app floats centered in it. */
  .film{width:1280px!important;height:720px!important;flex:none!important;transform-origin:center center!important;
    border-radius:0!important;border:none!important;box-shadow:none!important;aspect-ratio:auto!important;max-width:none!important}
  .film::after{background:radial-gradient(150% 110% at 50% 45%,transparent 64%,rgba(0,0,0,.42))!important}
  /* Cover crops the film edges, so pull the caption + progress bar into a title-safe
     inset (~7% sides, lifted off the bottom) so they never get clipped. */
  .caption{padding:16px 7% 26px 7%!important;background:linear-gradient(0deg,rgba(4,4,5,.94) 34%,transparent)!important}
  .timeline{left:7%!important;right:7%!important;bottom:14px!important;width:auto!important;border-radius:2px!important;overflow:hidden!important}
</style>
<script>
  (function(){
    var BASE_W=1280, BASE_H=720;
    function fit(){
      var f=document.getElementById('film'); if(!f)return;
      f.style.transform='scale('+Math.max(innerWidth/BASE_W, innerHeight/BASE_H)+')'; // cover
    }
    addEventListener('resize', fit, {passive:true});
    var tries=0, iv=setInterval(function(){ fit(); if(++tries>30 && document.getElementById('film')) clearInterval(iv); }, 100);
    if(document.readyState!=='loading') fit(); else document.addEventListener('DOMContentLoaded', fit);
  })();
</script>
</body></html>`;

writeFileSync(OUT, HEAD + source + OVERRIDE);
console.log('Wrote', OUT, '(' + (HEAD.length + source.length + OVERRIDE.length) + ' bytes)');
